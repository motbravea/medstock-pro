using MedStockPro.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Dashboard/summary
        [HttpGet("summary")]
        public async Task<ActionResult> GetSummary()
        {
            var today = DateTime.Today;
            var monthStart = new DateTime(today.Year, today.Month, 1);

            var totalProducts = await _context.Products
                .CountAsync(product => product.IsActive);

            var lowStockCount = await _context.Products
                .CountAsync(product =>
                    product.IsActive &&
                    product.CurrentStock <= product.MinimumStock
                );

            var expiredCount = await _context.Products
                .CountAsync(product =>
                    product.IsActive &&
                    product.ExpiryDate != null &&
                    product.ExpiryDate.Value.Date < today
                );

            var expiringSoonCount = await _context.Products
                .CountAsync(product =>
                    product.IsActive &&
                    product.ExpiryDate != null &&
                    product.ExpiryDate.Value.Date >= today &&
                    today >= product.ExpiryDate.Value.Date.AddDays(-product.ExpiryAlertDays)
                );

            var activeAlertsCount = await _context.Alerts
                .CountAsync(alert => !alert.IsResolved);

            var unreadAlertsCount = await _context.Alerts
                .CountAsync(alert => !alert.IsResolved && !alert.IsRead);

            var usedTodayCount = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt.Date == today &&
                    movement.MovementType == "StockOut"
                )
                .SumAsync(movement => (int?)movement.Quantity) ?? 0;

            var usedThisMonthCount = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= monthStart &&
                    movement.MovementType == "StockOut"
                )
                .SumAsync(movement => (int?)movement.Quantity) ?? 0;

            return Ok(new
            {
                totalProducts,
                lowStockCount,
                expiredCount,
                expiringSoonCount,
                activeAlertsCount,
                unreadAlertsCount,
                usedTodayCount,
                usedThisMonthCount
            });
        }

        // GET: api/Dashboard/urgent
        [HttpGet("urgent")]
        public async Task<ActionResult> GetUrgentItems()
        {
            var urgentAlerts = await _context.Alerts
                .Where(alert => !alert.IsResolved)
                .Include(alert => alert.Product)
                .OrderBy(alert =>
                    alert.Severity == "Critical" ? 0 :
                    alert.Severity == "Warning" ? 1 : 2
                )
                .ThenByDescending(alert => alert.CreatedAt)
                .Select(alert => new
                {
                    alert.Id,
                    alert.ProductId,
                    ProductName = alert.Product != null ? alert.Product.Name : "",
                    alert.AlertType,
                    alert.Message,
                    alert.Severity,
                    alert.IsRead,
                    alert.CreatedAt
                })
                .ToListAsync();

            return Ok(urgentAlerts);
        }

        // GET: api/Dashboard/today-usage
        [HttpGet("today-usage")]
        public async Task<ActionResult> GetTodayUsage()
        {
            var today = DateTime.Today;
            var tomorrow = today.AddDays(1);

            var usage = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= today &&
                    movement.CreatedAt < tomorrow &&
                    movement.MovementType == "StockOut"
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
                    movement.Quantity,
                    movement.OldStock,
                    movement.NewStock,
                    movement.Notes,
                    movement.CreatedAt
                })
                .ToListAsync();

            return Ok(usage);
        }

        // GET: api/Dashboard/week-usage
        [HttpGet("week-usage")]
        public async Task<ActionResult> GetWeekUsage()
        {
            var today = DateTime.Today;
            var weekStart = today.AddDays(-7);

            var usage = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= weekStart &&
                    movement.MovementType == "StockOut"
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
                    movement.Quantity,
                    movement.OldStock,
                    movement.NewStock,
                    movement.Notes,
                    movement.CreatedAt
                })
                .ToListAsync();

            return Ok(usage);
        }

        // GET: api/Dashboard/recent-movements
        [HttpGet("recent-movements")]
        public async Task<ActionResult> GetRecentMovements()
        {
            var movements = await _context.StockMovements
                .Include(movement => movement.Product)
                .Include(movement => movement.User)
                .OrderByDescending(movement => movement.CreatedAt)
                .Take(10)
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

        // GET: api/Dashboard/top-used-products
        [HttpGet("top-used-products")]
        public async Task<ActionResult> GetTopUsedProducts()
        {
            var today = DateTime.Today;
            var monthStart = new DateTime(today.Year, today.Month, 1);

            var topProducts = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= monthStart &&
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
                    TotalUsed = group.Sum(movement => movement.Quantity)
                })
                .OrderByDescending(item => item.TotalUsed)
                .Take(10)
                .ToListAsync();

            return Ok(topProducts);
        }

        // GET: api/Dashboard/category-consumption
        [HttpGet("category-consumption")]
        public async Task<ActionResult> GetCategoryConsumption()
        {
            var today = DateTime.Today;
            var monthStart = new DateTime(today.Year, today.Month, 1);

            var categoryConsumption = await _context.StockMovements
                .Where(movement =>
                    movement.CreatedAt >= monthStart &&
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
                        CategoryName = category.Name,
                        item.Quantity,
                        category.IsActive
                    }
                )
                .Where(item => item.IsActive)
                .GroupBy(item => item.CategoryName)
                .Select(group => new
                {
                    CategoryName = group.Key,
                    TotalUsed = group.Sum(item => item.Quantity)
                })
                .OrderByDescending(item => item.TotalUsed)
                .ToListAsync();

            return Ok(categoryConsumption);
        }
    }
}