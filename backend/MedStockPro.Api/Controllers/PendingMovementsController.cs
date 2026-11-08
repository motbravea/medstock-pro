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
    /// <summary>
    /// Admin queue for stock changes that require approval. Today only
    /// "Return" goes through here, but the table is designed so other
    /// movement types could be routed for review later.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class PendingMovementsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AlertService _alertService;
        private readonly AuditService _audit;

        public PendingMovementsController(
            AppDbContext context,
            AlertService alertService,
            AuditService audit)
        {
            _context = context;
            _alertService = alertService;
            _audit = audit;
        }

        // GET: api/PendingMovements?status=Pending
        // status can be Pending | Approved | Rejected | All (default Pending).
        [HttpGet]
        public async Task<ActionResult> GetPending([FromQuery] string status = "Pending")
        {
            IQueryable<PendingMovement> query = _context.PendingMovements
                .Include(pm => pm.Product)
                .Include(pm => pm.RequestedByUser)
                .Include(pm => pm.ReviewedByUser)
                .Include(pm => pm.SourceMovement);

            if (!string.Equals(status, "All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(pm => pm.Status == status);
            }

            var rows = await query
                .OrderByDescending(pm => pm.CreatedAt)
                .Select(pm => new
                {
                    pm.Id,
                    pm.ProductId,
                    ProductName = pm.Product != null ? pm.Product.Name : "",
                    pm.Quantity,
                    pm.Status,
                    pm.MovementType,
                    pm.RequesterNotes,
                    pm.ReviewerNotes,
                    pm.CreatedAt,
                    pm.ReviewedAt,
                    RequestedBy = pm.RequestedByUser != null ? pm.RequestedByUser.FullName : "",
                    RequestedByUsername = pm.RequestedByUser != null ? pm.RequestedByUser.Username : "",
                    ReviewedBy = pm.ReviewedByUser != null ? pm.ReviewedByUser.FullName : null,
                    pm.SourceMovementId,
                    SourceCreatedAt = pm.SourceMovement != null ? (DateTime?)pm.SourceMovement.CreatedAt : null,
                    pm.RestoredMovementId,
                })
                .ToListAsync();

            return Ok(rows);
        }

        // GET: api/PendingMovements/count
        // Lightweight: just the pending count for the sidebar badge.
        [HttpGet("count")]
        public async Task<ActionResult> GetCount()
        {
            var pending = await _context.PendingMovements
                .CountAsync(pm => pm.Status == "Pending");
            return Ok(new { pending });
        }

        // POST: api/PendingMovements/{id}/approve
        [HttpPost("{id:int}/approve")]
        public async Task<ActionResult> Approve(int id, PendingMovementReviewDto review)
        {
            var pending = await _context.PendingMovements
                .Include(pm => pm.Product)
                .FirstOrDefaultAsync(pm => pm.Id == id);

            if (pending == null) return NotFound("Pending movement not found");
            if (pending.Status != "Pending")
                return BadRequest($"Pending movement is already {pending.Status}");
            if (pending.Product == null || !pending.Product.IsActive)
                return BadRequest("The product is no longer active");

            var adminIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(adminIdText, out var adminId))
            {
                return Unauthorized("Admin id missing from token");
            }

            using var tx = await _context.Database.BeginTransactionAsync();

            // Atomic StockIn restoring the requested quantity.
            var product = pending.Product;
            var oldStock = product.CurrentStock;
            await _context.Products
                .Where(p => p.Id == product.Id)
                .ExecuteUpdateAsync(s =>
                    s.SetProperty(p => p.CurrentStock, p => p.CurrentStock + pending.Quantity)
                     .SetProperty(p => p.UpdatedAt, DateTime.Now));

            var newStock = oldStock + pending.Quantity;
            var restored = new StockMovement
            {
                ProductId = product.Id,
                UserId = adminId,
                MovementType = "StockIn",
                Quantity = pending.Quantity,
                OldStock = oldStock,
                NewStock = newStock,
                Notes = string.IsNullOrWhiteSpace(review.Notes)
                    ? $"Return approved (pending #{pending.Id})"
                    : $"Return approved (pending #{pending.Id}): {review.Notes}",
                CreatedAt = DateTime.Now,
            };
            _context.StockMovements.Add(restored);
            await _context.SaveChangesAsync();

            pending.Status = "Approved";
            pending.ReviewedByUserId = adminId;
            pending.ReviewedAt = DateTime.Now;
            pending.ReviewerNotes = review.Notes;
            pending.RestoredMovementId = restored.Id;

            await _context.Entry(product).ReloadAsync();
            await _alertService.CheckLowStockAlert(product);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            await _audit.LogAsync(
                action: "ReturnApproved",
                entityType: "Product",
                entityId: product.Id,
                entityName: product.Name,
                description: $"Approved pending return #{pending.Id} (+{pending.Quantity}). {oldStock} → {newStock}.",
                oldValues: new { CurrentStock = oldStock, PendingStatus = "Pending" },
                newValues: new { CurrentStock = newStock, PendingStatus = "Approved", restored.Id });

            return Ok(new
            {
                message = "Return approved and stock restored",
                pending = new
                {
                    pending.Id,
                    pending.Status,
                    pending.ReviewedAt,
                    restoredMovementId = restored.Id,
                    newStock,
                }
            });
        }

        // POST: api/PendingMovements/{id}/reject
        [HttpPost("{id:int}/reject")]
        public async Task<ActionResult> Reject(int id, PendingMovementReviewDto review)
        {
            var pending = await _context.PendingMovements
                .Include(pm => pm.Product)
                .FirstOrDefaultAsync(pm => pm.Id == id);

            if (pending == null) return NotFound("Pending movement not found");
            if (pending.Status != "Pending")
                return BadRequest($"Pending movement is already {pending.Status}");

            var adminIdText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(adminIdText, out var adminId))
            {
                return Unauthorized("Admin id missing from token");
            }

            pending.Status = "Rejected";
            pending.ReviewedByUserId = adminId;
            pending.ReviewedAt = DateTime.Now;
            pending.ReviewerNotes = review.Notes;

            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action: "ReturnRejected",
                entityType: "Product",
                entityId: pending.ProductId,
                entityName: pending.Product?.Name ?? string.Empty,
                description: $"Rejected pending return #{pending.Id} (qty {pending.Quantity}).",
                newValues: new { pending.Id, pending.Status, pending.ReviewerNotes });

            return Ok(new
            {
                message = "Return rejected. No stock change.",
                pending = new
                {
                    pending.Id,
                    pending.Status,
                    pending.ReviewedAt,
                }
            });
        }
    }
}
