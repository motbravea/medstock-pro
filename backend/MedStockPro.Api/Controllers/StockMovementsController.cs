using System.Linq;
using System.Security.Claims;
using MedStockPro.Api.Data;
using MedStockPro.Api.DTOs;
using MedStockPro.Api.Models;
using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StockMovementsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AlertService _alertService;
        private readonly AuditService _audit;

        public StockMovementsController(
            AppDbContext context,
            AlertService alertService,
            AuditService audit)
        {
            _context = context;
            _alertService = alertService;
            _audit = audit;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> GetAllMovements()
        {
            var movements = await _context.StockMovements
                .Include(movement => movement.Product)
                .Include(movement => movement.User)
                .OrderByDescending(movement => movement.CreatedAt)
                .Select(movement => new
                {
                    movement.Id,
                    movement.ProductId,
                    ProductName = movement.Product != null ? movement.Product.Name : "",
                    movement.UserId,
                    UserName = movement.User != null ? movement.User.FullName : "",
                    movement.MovementType,
                    movement.Quantity,
                    movement.OldStock,
                    movement.NewStock,
                    movement.Notes,
                    movement.CreatedAt
                })
                .ToListAsync();

            return Ok(movements);
        }

        [HttpGet("product/{productId:int}")]
        public async Task<ActionResult> GetMovementsByProduct(int productId)
        {
            var productExists = await _context.Products
                .AnyAsync(product => product.Id == productId);

            if (!productExists)
            {
                return NotFound("Product not found");
            }

            var movements = await _context.StockMovements
                .Where(movement => movement.ProductId == productId)
                .Include(movement => movement.User)
                .OrderByDescending(movement => movement.CreatedAt)
                .Select(movement => new
                {
                    movement.Id,
                    movement.ProductId,
                    movement.UserId,
                    UserName = movement.User != null ? movement.User.FullName : "",
                    movement.MovementType,
                    movement.Quantity,
                    movement.OldStock,
                    movement.NewStock,
                    movement.Notes,
                    movement.CreatedAt
                })
                .ToListAsync();

            return Ok(movements);
        }

        [HttpPost]
        public async Task<ActionResult> CreateStockMovement(StockMovementDto request)
        {
            // ModelState validation already enforces:
            //   ProductId >= 1, Quantity >= 1, MovementType in allowed set.

            var product = await _context.Products.FindAsync(request.ProductId);

            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var userIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userIdText))
            {
                return Unauthorized("User ID not found in token");
            }
            var userId = int.Parse(userIdText);

            // Atomic stock update — eliminates the check-then-act race.
            // SaveChanges still runs the alert + audit work in the same transaction.
            using var tx = await _context.Database.BeginTransactionAsync();

            var oldStock = product.CurrentStock;
            int rowsAffected;
            int newStock;

            switch (request.MovementType)
            {
                case "StockIn":
                    newStock = oldStock + request.Quantity;
                    rowsAffected = await _context.Products
                        .Where(p => p.Id == product.Id)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(p => p.CurrentStock, p => p.CurrentStock + request.Quantity)
                             .SetProperty(p => p.UpdatedAt, DateTime.Now));
                    break;

                case "StockOut":
                case "Damaged":
                case "Expired":
                    // The WHERE clause is the lock: only succeeds if stock is sufficient.
                    rowsAffected = await _context.Products
                        .Where(p => p.Id == product.Id && p.CurrentStock >= request.Quantity)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(p => p.CurrentStock, p => p.CurrentStock - request.Quantity)
                             .SetProperty(p => p.UpdatedAt, DateTime.Now));

                    if (rowsAffected == 0)
                    {
                        await tx.RollbackAsync();
                        return BadRequest("Not enough stock available");
                    }

                    newStock = oldStock - request.Quantity;
                    break;

                case "Adjustment":
                    newStock = request.Quantity;
                    rowsAffected = await _context.Products
                        .Where(p => p.Id == product.Id)
                        .ExecuteUpdateAsync(s =>
                            s.SetProperty(p => p.CurrentStock, request.Quantity)
                             .SetProperty(p => p.UpdatedAt, DateTime.Now));
                    break;

                default:
                    // Should be unreachable thanks to the DTO RegularExpression validator.
                    return BadRequest("Invalid movement type");
            }

            // Re-fetch authoritative current stock for the history record.
            // (Another concurrent StockIn could have arrived between the UPDATE
            // and now; we record what we actually changed, not the latest read.)
            var movement = new StockMovement
            {
                ProductId = product.Id,
                UserId = userId,
                MovementType = request.MovementType,
                Quantity = request.Quantity,
                OldStock = oldStock,
                NewStock = newStock,
                Notes = request.Notes,
                CreatedAt = DateTime.Now
            };
            _context.StockMovements.Add(movement);

            // Reload to align in-memory product with DB for alert evaluation.
            await _context.Entry(product).ReloadAsync();
            await _alertService.CheckLowStockAlert(product);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            await _audit.LogAsync(
                action: $"Stock{request.MovementType}",
                entityType: "Product",
                entityId: product.Id,
                entityName: product.Name,
                description: $"{request.MovementType} qty {request.Quantity} ({oldStock} → {product.CurrentStock})",
                oldValues: new { CurrentStock = oldStock },
                newValues: new { CurrentStock = product.CurrentStock });

            return Ok(new
            {
                message = "Stock movement created successfully",
                movement = new
                {
                    movement.Id,
                    product = product.Name,
                    movement.MovementType,
                    movement.Quantity,
                    movement.OldStock,
                    NewStock = product.CurrentStock,
                    movement.Notes,
                    movement.CreatedAt
                }
            });
        }

        // ─────────────────────────────────────────────────────────────────
        //  Receive shipment.
        //  One call carries quantity + optional supplier + optional new
        //  expiry. Wraps everything in a transaction so partial failures
        //  don't leave the product in an inconsistent state.
        //    1. (optional) refresh expiry date on the product
        //    2. atomic StockIn on the product row
        //    3. create the StockMovement history entry
        //    4. (optional) bump LastPurchaseDate on the matching
        //       ProductSupplier link (only if it already exists — we don't
        //       silently create supplier links here)
        //    5. re-evaluate low-stock alert (resolve if healthy now)
        //    6. write a "StockReceive" audit entry
        // ─────────────────────────────────────────────────────────────────
        [HttpPost("receive")]
        public async Task<ActionResult> Receive(ReceiveStockDto request)
        {
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            if (request.ExpiryDate.HasValue && request.ExpiryDate.Value.Date < DateTime.Today)
            {
                return BadRequest("Expiry date cannot be in the past");
            }

            var userIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdText, out var userId))
            {
                return Unauthorized("User ID not found in token");
            }

            // Validate supplier (if provided) up-front so we fail before
            // touching stock when the FK is bad.
            ProductSupplier? productSupplierLink = null;
            string? supplierName = null;
            if (request.SupplierId.HasValue)
            {
                productSupplierLink = await _context.ProductSuppliers
                    .Include(ps => ps.Supplier)
                    .FirstOrDefaultAsync(ps =>
                        ps.ProductId == product.Id &&
                        ps.SupplierId == request.SupplierId.Value);

                if (productSupplierLink == null)
                {
                    return BadRequest(
                        "Selected supplier is not linked to this product. " +
                        "Link the supplier from the product details drawer first.");
                }
                supplierName = productSupplierLink.Supplier?.Name;
            }

            using var tx = await _context.Database.BeginTransactionAsync();

            var oldStock = product.CurrentStock;
            DateTime? oldExpiry = product.ExpiryDate;

            // Atomic StockIn + optional expiry refresh in one UPDATE.
            if (request.ExpiryDate.HasValue)
            {
                await _context.Products
                    .Where(p => p.Id == product.Id)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(p => p.CurrentStock, p => p.CurrentStock + request.Quantity)
                         .SetProperty(p => p.ExpiryDate, request.ExpiryDate)
                         .SetProperty(p => p.UpdatedAt, DateTime.Now));
            }
            else
            {
                await _context.Products
                    .Where(p => p.Id == product.Id)
                    .ExecuteUpdateAsync(s =>
                        s.SetProperty(p => p.CurrentStock, p => p.CurrentStock + request.Quantity)
                         .SetProperty(p => p.UpdatedAt, DateTime.Now));
            }

            var newStock = oldStock + request.Quantity;

            var notesParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(supplierName))
                notesParts.Add($"From: {supplierName}");
            if (!string.IsNullOrWhiteSpace(request.Notes))
                notesParts.Add(request.Notes);
            var notes = notesParts.Count == 0
                ? "Receive: shipment"
                : string.Join(" · ", notesParts);

            var movement = new StockMovement
            {
                ProductId = product.Id,
                UserId = userId,
                MovementType = "StockIn",
                Quantity = request.Quantity,
                OldStock = oldStock,
                NewStock = newStock,
                Notes = notes,
                CreatedAt = DateTime.Now,
            };
            _context.StockMovements.Add(movement);

            // Refresh supplier's last-purchase date (we already verified the
            // link exists). Don't auto-create — that's a separate workflow.
            if (productSupplierLink != null)
            {
                productSupplierLink.LastPurchaseDate = DateTime.Now;
            }

            await _context.Entry(product).ReloadAsync();
            await _alertService.CheckLowStockAlert(product);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            var auditOld = new
            {
                CurrentStock = oldStock,
                ExpiryDate = oldExpiry,
            };
            var auditNew = new
            {
                CurrentStock = product.CurrentStock,
                ExpiryDate = product.ExpiryDate,
                SupplierUsed = supplierName,
            };

            await _audit.LogAsync(
                action: "StockReceive",
                entityType: "Product",
                entityId: product.Id,
                entityName: product.Name,
                description:
                    $"Received +{request.Quantity}. {oldStock} → {product.CurrentStock}" +
                    (supplierName != null ? $" from {supplierName}" : "") +
                    (request.ExpiryDate.HasValue
                        ? $" · new expiry {request.ExpiryDate.Value:yyyy-MM-dd}"
                        : ""),
                oldValues: auditOld,
                newValues: auditNew);

            return Ok(new
            {
                message = "Shipment received",
                movement = new
                {
                    movement.Id,
                    product = product.Name,
                    movement.MovementType,
                    movement.Quantity,
                    movement.OldStock,
                    NewStock = product.CurrentStock,
                    ExpiryDate = product.ExpiryDate,
                    SupplierUsed = supplierName,
                    movement.Notes,
                    movement.CreatedAt,
                }
            });
        }

        // ─────────────────────────────────────────────────────────────────
        //  Scan-use (instant StockOut from the Scan workspace).
        //  Staff scans a product, picks a quantity (default 1), submits.
        //  This is exactly the StockOut path above but with a simpler DTO
        //  and a dedicated audit action ("ScanUse") so reports can split
        //  scanner usage from manual stock entries.
        // ─────────────────────────────────────────────────────────────────
        [HttpPost("scan-use")]
        public async Task<ActionResult> ScanUse(ScanActionDto request)
        {
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var userIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userIdText))
            {
                return Unauthorized("User ID not found in token");
            }
            var userId = int.Parse(userIdText);

            using var tx = await _context.Database.BeginTransactionAsync();

            var oldStock = product.CurrentStock;
            var rowsAffected = await _context.Products
                .Where(p => p.Id == product.Id && p.CurrentStock >= request.Quantity)
                .ExecuteUpdateAsync(s =>
                    s.SetProperty(p => p.CurrentStock, p => p.CurrentStock - request.Quantity)
                     .SetProperty(p => p.UpdatedAt, DateTime.Now));

            if (rowsAffected == 0)
            {
                await tx.RollbackAsync();
                return BadRequest("Not enough stock available");
            }

            var newStock = oldStock - request.Quantity;
            var movement = new StockMovement
            {
                ProductId = product.Id,
                UserId = userId,
                MovementType = "StockOut",
                Quantity = request.Quantity,
                OldStock = oldStock,
                NewStock = newStock,
                Notes = string.IsNullOrWhiteSpace(request.Notes)
                    ? "Scan: used"
                    : request.Notes,
                CreatedAt = DateTime.Now,
            };
            _context.StockMovements.Add(movement);

            await _context.Entry(product).ReloadAsync();
            await _alertService.CheckLowStockAlert(product);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            await _audit.LogAsync(
                action: "ScanUse",
                entityType: "Product",
                entityId: product.Id,
                entityName: product.Name,
                description: $"Scanned -{request.Quantity} (used). {oldStock} → {product.CurrentStock}",
                oldValues: new { CurrentStock = oldStock },
                newValues: new { CurrentStock = product.CurrentStock });

            return Ok(new
            {
                message = "Marked as used",
                movement = new
                {
                    movement.Id,
                    product = product.Name,
                    movement.MovementType,
                    movement.Quantity,
                    movement.OldStock,
                    NewStock = product.CurrentStock,
                    movement.Notes,
                    movement.CreatedAt
                }
            });
        }

        // ─────────────────────────────────────────────────────────────────
        //  Scan-return (pending; does NOT change CurrentStock).
        //  The scan must reference a prior StockOut by the same user for
        //  the same product that has not already been linked to a non-
        //  rejected PendingMovement. We pick the most recent such source
        //  automatically — the staff just scans, no need to select.
        //  Quantity comes from the source row, not from the DTO.
        // ─────────────────────────────────────────────────────────────────
        [HttpPost("scan-return")]
        public async Task<ActionResult> ScanReturn(ScanActionDto request)
        {
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var userIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrWhiteSpace(userIdText))
            {
                return Unauthorized("User ID not found in token");
            }
            var userId = int.Parse(userIdText);

            // The set of source movements that are already "claimed" by a
            // non-rejected PendingMovement (pending or approved).
            var claimedIds = _context.PendingMovements
                .Where(pm => pm.Status != "Rejected")
                .Select(pm => pm.SourceMovementId);

            // Most recent un-claimed StockOut by this user for this product.
            var source = await _context.StockMovements
                .Where(m => m.ProductId == product.Id
                            && m.UserId == userId
                            && m.MovementType == "StockOut"
                            && !claimedIds.Contains(m.Id))
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            if (source == null)
            {
                return BadRequest(new
                {
                    message = "No prior use by you for this product. " +
                              "You can only return items you previously scanned as 'used'."
                });
            }

            var pending = new PendingMovement
            {
                ProductId = product.Id,
                RequestedByUserId = userId,
                SourceMovementId = source.Id,
                MovementType = "Return",
                Quantity = source.Quantity,
                Status = "Pending",
                RequesterNotes = request.Notes,
                CreatedAt = DateTime.Now,
            };
            _context.PendingMovements.Add(pending);
            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action: "ScanReturnRequested",
                entityType: "Product",
                entityId: product.Id,
                entityName: product.Name,
                description: $"Return of {source.Quantity} requested (source movement #{source.Id}). Awaiting admin approval.",
                newValues: new
                {
                    pending.Id,
                    SourceMovementId = source.Id,
                    pending.Quantity,
                    pending.Status,
                });

            return Ok(new
            {
                message = "Return submitted. Waiting for admin approval — stock unchanged for now.",
                pending = new
                {
                    pending.Id,
                    product = product.Name,
                    pending.Quantity,
                    pending.Status,
                    pending.CreatedAt,
                    sourceMovementId = source.Id,
                }
            });
        }
    }
}
