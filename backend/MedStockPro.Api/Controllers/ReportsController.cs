using MedStockPro.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReportsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Reports/monthly-summary?year=2026&month=5
        [HttpGet("monthly-summary")]
        public async Task<ActionResult> GetMonthlySummary([FromQuery] int year, [FromQuery] int month)
        {
            if (year <= 0 || month < 1 || month > 12)
            {
                return BadRequest("Invalid year or month.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var stockOutQuantity = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "StockOut"
                )
                .SumAsync(movement => (int?)movement.Quantity) ?? 0;

            var stockInQuantity = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "StockIn"
                )
                .SumAsync(movement => (int?)movement.Quantity) ?? 0;

            var damagedQuantity = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "Damaged"
                )
                .SumAsync(movement => (int?)movement.Quantity) ?? 0;

            var expiredQuantity = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "Expired"
                )
                .SumAsync(movement => (int?)movement.Quantity) ?? 0;

            var totalMovements = await _context.StockMovements
                .CountAsync(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate
                );

            var alertsCreated = await _context.Alerts
                .CountAsync(alert =>
                    alert.CreatedAt >= startDate &&
                    alert.CreatedAt < endDate
                );

            var activeProducts = await _context.Products
                .CountAsync(product => product.IsActive);

            var lowStockProducts = await _context.Products
                .CountAsync(product =>
                    product.IsActive &&
                    product.CurrentStock <= product.MinimumStock
                );

            return Ok(new
            {
                year,
                month,
                period = $"{startDate:yyyy-MM-dd} to {endDate.AddDays(-1):yyyy-MM-dd}",
                activeProducts,
                totalMovements,
                stockOutQuantity,
                stockInQuantity,
                damagedQuantity,
                expiredQuantity,
                alertsCreated,
                lowStockProducts
            });
        }

        // GET: api/Reports/product-usage?year=2026&month=5
        [HttpGet("product-usage")]
        public async Task<ActionResult> GetProductUsage([FromQuery] int year, [FromQuery] int month)
        {
            if (year <= 0 || month < 1 || month > 12)
            {
                return BadRequest("Invalid year or month.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var productUsage = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "StockOut"
                )
                .Include(movement => movement.Product)
                .GroupBy(movement => new
                {
                    movement.ProductId,
                    ProductName = movement.Product != null ? movement.Product.Name : ""
                })
                .Select(group => new
                {
                    group.Key.ProductId,
                    group.Key.ProductName,
                    TotalUsed = group.Sum(movement => movement.Quantity),
                    UsageCount = group.Count()
                })
                .OrderByDescending(item => item.TotalUsed)
                .ToListAsync();

            return Ok(productUsage);
        }

        // GET: api/Reports/category-usage?year=2026&month=5
        [HttpGet("category-usage")]
        public async Task<ActionResult> GetCategoryUsage([FromQuery] int year, [FromQuery] int month)
        {
            if (year <= 0 || month < 1 || month > 12)
            {
                return BadRequest("Invalid year or month.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var categoryUsage = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "StockOut"
                )
                .Join(
                    _context.ProductCategories,
                    movement => movement.ProductId,
                    productCategory => productCategory.ProductId,
                    (movement, productCategory) => new
                    {
                        movement.Quantity,
                        productCategory.CategoryId
                    }
                )
                .Join(
                    _context.Categories,
                    item => item.CategoryId,
                    category => category.Id,
                    (item, category) => new
                    {
                        CategoryId = category.Id,
                        CategoryName = category.Name,
                        item.Quantity,
                        category.IsActive
                    }
                )
                .Where(item => item.IsActive)
                .GroupBy(item => new
                {
                    item.CategoryId,
                    item.CategoryName
                })
                .Select(group => new
                {
                    group.Key.CategoryId,
                    group.Key.CategoryName,
                    TotalUsed = group.Sum(item => item.Quantity)
                })
                .OrderByDescending(item => item.TotalUsed)
                .ToListAsync();

            return Ok(categoryUsage);
        }

        // GET: api/Reports/staff-usage?year=2026&month=5
        [HttpGet("staff-usage")]
        public async Task<ActionResult> GetStaffUsage([FromQuery] int year, [FromQuery] int month)
        {
            if (year <= 0 || month < 1 || month > 12)
            {
                return BadRequest("Invalid year or month.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var staffUsage = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate &&
                    movement.MovementType == "StockOut"
                )
                .Include(movement => movement.User)
                .GroupBy(movement => new
                {
                    movement.UserId,
                    UserName = movement.User != null ? movement.User.FullName : ""
                })
                .Select(group => new
                {
                    group.Key.UserId,
                    group.Key.UserName,
                    TotalUsed = group.Sum(movement => movement.Quantity),
                    ActionsCount = group.Count()
                })
                .OrderByDescending(item => item.TotalUsed)
                .ToListAsync();

            return Ok(staffUsage);
        }

        // GET: api/Reports/stock-movements?year=2026&month=5
        [HttpGet("stock-movements")]
        public async Task<ActionResult> GetStockMovementsReport([FromQuery] int year, [FromQuery] int month)
        {
            if (year <= 0 || month < 1 || month > 12)
            {
                return BadRequest("Invalid year or month.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var movements = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= startDate &&
                    movement.CreatedAt < endDate
                )
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

        // GET: api/Reports/alerts?year=2026&month=5
        [HttpGet("alerts")]
        public async Task<ActionResult> GetAlertsReport([FromQuery] int year, [FromQuery] int month)
        {
            if (year <= 0 || month < 1 || month > 12)
            {
                return BadRequest("Invalid year or month.");
            }

            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1);

            var alerts = await _context.Alerts
                .Where(alert =>
                    alert.CreatedAt >= startDate &&
                    alert.CreatedAt < endDate
                )
                .Include(alert => alert.Product)
                .OrderByDescending(alert => alert.CreatedAt)
                .Select(alert => new
                {
                    alert.Id,
                    alert.ProductId,
                    ProductName = alert.Product != null ? alert.Product.Name : "",
                    alert.AlertType,
                    alert.Message,
                    alert.Severity,
                    alert.IsRead,
                    alert.IsResolved,
                    alert.CreatedAt,
                    alert.ResolvedAt
                })
                .ToListAsync();

            return Ok(alerts);
        }
        // GET: api/Reports/supplier-cost-overview
[HttpGet("supplier-cost-overview")]
public async Task<ActionResult> GetSupplierCostOverview()
{
    var overview = await _context.ProductSuppliers
        .Include(productSupplier => productSupplier.Product)
        .Include(productSupplier => productSupplier.Supplier)
        .Where(productSupplier =>
            productSupplier.Product != null &&
            productSupplier.Product.IsActive &&
            productSupplier.Supplier != null &&
            productSupplier.Supplier.IsActive
        )
        .Select(productSupplier => new
        {
            productSupplier.ProductId,
            ProductName = productSupplier.Product!.Name,
            productSupplier.SupplierId,
            SupplierName = productSupplier.Supplier!.Name,
            productSupplier.Supplier!.PhoneNumber,
            productSupplier.Supplier!.Email,
            productSupplier.Price,
            productSupplier.SupplierBarcode,
            productSupplier.IsPreferredSupplier,
            productSupplier.LastPurchaseDate
        })
        .OrderBy(item => item.ProductName)
        .ThenBy(item => item.Price)
        .ToListAsync();

    var groupedOverview = overview
        .GroupBy(item => new
        {
            item.ProductId,
            item.ProductName
        })
        .Select(group =>
        {
            var cheapestSupplier = group.OrderBy(item => item.Price).FirstOrDefault();
            var preferredSupplier = group.FirstOrDefault(item => item.IsPreferredSupplier);

            return new
            {
                group.Key.ProductId,
                group.Key.ProductName,
                CheapestSupplier = cheapestSupplier == null ? null : new
                {
                    cheapestSupplier.SupplierId,
                    cheapestSupplier.SupplierName,
                    cheapestSupplier.PhoneNumber,
                    cheapestSupplier.Email,
                    cheapestSupplier.Price,
                    cheapestSupplier.SupplierBarcode
                },
                PreferredSupplier = preferredSupplier == null ? null : new
                {
                    preferredSupplier.SupplierId,
                    preferredSupplier.SupplierName,
                    preferredSupplier.PhoneNumber,
                    preferredSupplier.Email,
                    preferredSupplier.Price,
                    preferredSupplier.SupplierBarcode
                },
                Suppliers = group.Select(item => new
                {
                    item.SupplierId,
                    item.SupplierName,
                    item.PhoneNumber,
                    item.Email,
                    item.Price,
                    item.SupplierBarcode,
                    item.IsPreferredSupplier,
                    item.LastPurchaseDate
                })
            };
        })
        .ToList();

    return Ok(groupedOverview);
}
// GET: api/Reports/restock-estimate
[HttpGet("restock-estimate")]
public async Task<ActionResult> GetRestockEstimate()
{
    var lowStockProducts = await _context.Products
        .Where(product =>
            product.IsActive &&
            product.CurrentStock <= product.MinimumStock
        )
        .ToListAsync();

    var restockItems = new List<object>();
    decimal totalEstimatedCost = 0;

    foreach (var product in lowStockProducts)
    {
        var neededQuantity = product.MinimumStock - product.CurrentStock;

        if (neededQuantity <= 0)
        {
            neededQuantity = 1;
        }

        var preferredSupplier = await _context.ProductSuppliers
            .Include(productSupplier => productSupplier.Supplier)
            .Where(productSupplier =>
                productSupplier.ProductId == product.Id &&
                productSupplier.Supplier != null &&
                productSupplier.Supplier.IsActive &&
                productSupplier.IsPreferredSupplier
            )
            .FirstOrDefaultAsync();

        var cheapestSupplier = await _context.ProductSuppliers
            .Include(productSupplier => productSupplier.Supplier)
            .Where(productSupplier =>
                productSupplier.ProductId == product.Id &&
                productSupplier.Supplier != null &&
                productSupplier.Supplier.IsActive
            )
            .OrderBy(productSupplier => productSupplier.Price)
            .FirstOrDefaultAsync();

        var selectedSupplier = preferredSupplier ?? cheapestSupplier;

        decimal estimatedCost = 0;

        if (selectedSupplier != null)
        {
            estimatedCost = selectedSupplier.Price * neededQuantity;
            totalEstimatedCost += estimatedCost;
        }

        restockItems.Add(new
        {
            productId = product.Id,
            productName = product.Name,
            currentStock = product.CurrentStock,
            minimumStock = product.MinimumStock,
            suggestedRestockQuantity = neededQuantity,
            supplier = selectedSupplier == null ? null : new
            {
                selectedSupplier.SupplierId,
                supplierName = selectedSupplier.Supplier!.Name,
                selectedSupplier.Supplier.PhoneNumber,
                selectedSupplier.Supplier.Email,
                selectedSupplier.Price,
                selectedSupplier.SupplierBarcode,
                selectedSupplier.IsPreferredSupplier
            },
            estimatedCost
        });
    }

    return Ok(new
    {
        totalLowStockProducts = lowStockProducts.Count,
        totalEstimatedCost,
        items = restockItems
    });
}
    }
}