using MedStockPro.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MedStockPro.Api.Services;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AlertsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AlertService _alertService;
        private readonly AuditService _audit;

        public AlertsController(
            AppDbContext context,
            AlertService alertService,
            AuditService audit)
        {
            _context = context;
            _alertService = alertService;
            _audit = audit;
        }

        // GET: api/Alerts
        // Admin and Staff can view active alerts
        [HttpGet]
        public async Task<ActionResult> GetActiveAlerts()
        {
            var alerts = await _context.Alerts
                .Where(alert => !alert.IsResolved)
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

        // GET: api/Alerts/all
        // Only Admin can view all alerts including resolved ones
        [HttpGet("all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> GetAllAlerts()
        {
            var alerts = await _context.Alerts
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

        // GET: api/Alerts/unread
        // Admin and Staff can view unread active alerts
        [HttpGet("unread")]
        public async Task<ActionResult> GetUnreadAlerts()
        {
            var alerts = await _context.Alerts
                .Where(alert => !alert.IsRead && !alert.IsResolved)
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
                    alert.CreatedAt
                })
                .ToListAsync();

            return Ok(alerts);
        }

        // PUT: api/Alerts/5/read
        // Admin and Staff can mark an alert as read
        [HttpPut("{id:int}/read")]
        public async Task<ActionResult> MarkAlertAsRead(int id)
        {
            var alert = await _context.Alerts.FindAsync(id);

            if (alert == null)
            {
                return NotFound("Alert not found");
            }

            alert.IsRead = true;
            await _context.SaveChangesAsync();

            await _audit.LogAsync("AlertRead", "Alert", alert.Id, alert.AlertType,
                $"Marked {alert.AlertType} alert as read");

            return Ok(new { message = "Alert marked as read successfully" });
        }

        // PUT: api/Alerts/5/resolve
        // Only Admin can manually resolve an alert
        [HttpPut("{id:int}/resolve")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> ResolveAlert(int id)
        {
            var alert = await _context.Alerts.FindAsync(id);

            if (alert == null) return NotFound("Alert not found");

            alert.IsResolved = true;
            alert.ResolvedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            await _audit.LogAsync("AlertResolved", "Alert", alert.Id, alert.AlertType,
                $"Resolved {alert.AlertType} alert");

            return Ok(new { message = "Alert resolved successfully" });
        }
        
                // POST: api/Alerts/check-expiry
        // Only Admin can manually run expiry alert check
        [HttpPost("check-expiry")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CheckExpiryAlerts()
        {
            await _alertService.CheckExpiryAlerts();

            return Ok(new
            {
                message = "Expiry alerts checked successfully"
            });
        }

        // POST: api/Alerts/check-low-stock
        // Re-scan every active product and create/resolve low-stock alerts.
        [HttpPost("check-low-stock")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CheckLowStockAlerts()
        {
            var (created, resolved, scanned) =
                await _alertService.CheckLowStockAlertsForAllProducts();

            await _audit.LogAsync(
                "LowStockCheckRun",
                "Alert",
                0,
                "LowStock",
                $"Scanned {scanned} products. Created {created}, resolved {resolved}.");

            return Ok(new
            {
                message = "Low-stock alerts checked",
                scanned,
                created,
                resolved,
            });
        }

        // POST: api/Alerts/check-all
        // One-click scan that runs BOTH the low-stock and expiry rules.
        // This is what the AlertsPage "Check alerts now" button calls.
        [HttpPost("check-all")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CheckAllAlerts()
        {
            var (created, resolved, scanned) =
                await _alertService.CheckLowStockAlertsForAllProducts();

            await _alertService.CheckExpiryAlerts();

            await _audit.LogAsync(
                "AlertsScanRun",
                "Alert",
                0,
                "All",
                $"Manual scan: {scanned} products. Low-stock created={created}, resolved={resolved}. Expiry rechecked.");

            return Ok(new
            {
                message = "All alerts checked",
                productsScanned = scanned,
                lowStockCreated = created,
                lowStockResolved = resolved,
            });
        }
    }
}