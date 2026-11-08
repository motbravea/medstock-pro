using MedStockPro.Api.Data;
using MedStockPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Services
{
    public class AlertService
    {
        private readonly AppDbContext _context;

        public AlertService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Stage a low-stock/out-of-stock alert for one product, or resolve
        /// any existing active stock alert if the product is back to healthy.
        /// Caller is responsible for SaveChangesAsync.
        ///
        /// Business rules (do NOT treat MinimumStock=0 as "alerts disabled"):
        ///   currentStock &lt;= 0                                → Critical "OutOfStock"
        ///   minimumStock &gt; 0 &amp;&amp; currentStock &lt;= minimumStock → Warning "LowStock"
        ///   minimumStock = 0 &amp;&amp; currentStock = 1                → Warning "LowStock" (almost out)
        ///   else                                                     → resolve existing
        ///
        /// We persist both alertTypes ("OutOfStock" and "LowStock"). When the
        /// product transitions between them we update the existing row's
        /// type/severity/message in place — that avoids two alerts per product.
        /// </summary>
        public async Task CheckLowStockAlert(Product product)
        {
            // Look for ANY active stock alert (either type) on this product.
            var existingAlert = await _context.Alerts
                .FirstOrDefaultAsync(alert =>
                    alert.ProductId == product.Id &&
                    (alert.AlertType == "LowStock" || alert.AlertType == "OutOfStock") &&
                    !alert.IsResolved
                );

            string? alertType = null;
            string severity = string.Empty;
            string message = string.Empty;

            if (product.CurrentStock <= 0)
            {
                alertType = "OutOfStock";
                severity = "Critical";
                message = $"{product.Name} is out of stock. Current stock: 0.";
            }
            else if (product.MinimumStock > 0 && product.CurrentStock <= product.MinimumStock)
            {
                alertType = "LowStock";
                severity = "Warning";
                message = $"{product.Name} is low in stock. Current stock: {product.CurrentStock}, minimum stock: {product.MinimumStock}.";
            }
            else if (product.MinimumStock == 0 && product.CurrentStock == 1)
            {
                // No minimum was configured but there is exactly one unit left.
                // Clinically that's "almost out" — surface it as a Warning so
                // the team has time to reorder before it hits zero.
                alertType = "LowStock";
                severity = "Warning";
                message = $"{product.Name} is almost out of stock. Only 1 unit remaining.";
            }

            if (alertType != null)
            {
                if (existingAlert == null)
                {
                    _context.Alerts.Add(new Alert
                    {
                        ProductId = product.Id,
                        AlertType = alertType,
                        Message = message,
                        Severity = severity,
                        IsRead = false,
                        IsResolved = false,
                        CreatedAt = DateTime.Now,
                    });
                }
                else if (
                    existingAlert.AlertType != alertType ||
                    existingAlert.Severity != severity ||
                    existingAlert.Message != message)
                {
                    // Transition (Warning → Critical, or message refresh).
                    // Keep the single row but bring it up to date and mark
                    // unread so the team sees the change again.
                    existingAlert.AlertType = alertType;
                    existingAlert.Severity = severity;
                    existingAlert.Message = message;
                    existingAlert.IsRead = false;
                }
            }
            else if (existingAlert != null)
            {
                existingAlert.IsResolved = true;
                existingAlert.ResolvedAt = DateTime.Now;
            }
        }

        /// <summary>
        /// Walk every active product and apply the low-stock rule. Saves at
        /// the end and returns how many alerts were newly created (so the
        /// "Run check" button can tell the user something useful).
        /// </summary>
        public async Task<(int created, int resolved, int scanned)> CheckLowStockAlertsForAllProducts()
        {
            var products = await _context.Products
                .Where(p => p.IsActive)
                .ToListAsync();

            // Count BOTH stock-alert types so the bulk scan metrics are
            // correct after the new "OutOfStock" alertType was introduced.
            var alertsBefore = await _context.Alerts
                .CountAsync(a =>
                    (a.AlertType == "LowStock" || a.AlertType == "OutOfStock") &&
                    !a.IsResolved);

            foreach (var product in products)
            {
                await CheckLowStockAlert(product);
            }
            await _context.SaveChangesAsync();

            var alertsAfter = await _context.Alerts
                .CountAsync(a =>
                    (a.AlertType == "LowStock" || a.AlertType == "OutOfStock") &&
                    !a.IsResolved);

            // Net created = (final active) - (initial active) clamped to ≥ 0.
            // Net resolved = (initial active) - (final active) clamped to ≥ 0.
            var created = Math.Max(0, alertsAfter - alertsBefore);
            var resolved = Math.Max(0, alertsBefore - alertsAfter);
            return (created, resolved, products.Count);
        }

        public async Task CheckExpiryAlerts()
        {
            var activeProducts = await _context.Products
                .Where(product => product.IsActive && product.ExpiryDate != null)
                .ToListAsync();

            foreach (var product in activeProducts)
            {
                var expiryDate = product.ExpiryDate!.Value.Date;
                var today = DateTime.Today;
                var alertStartDate = expiryDate.AddDays(-product.ExpiryAlertDays);

                if (expiryDate < today)
                {
                    await CreateOrKeepExpiryAlert(
                        product,
                        "Expired",
                        $"{product.Name} is expired. Expiry date: {expiryDate:yyyy-MM-dd}.",
                        "Critical"
                    );

                    await ResolveAlertIfExists(product.Id, "ExpiringSoon");
                }
                else if (today >= alertStartDate)
                {
                    await CreateOrKeepExpiryAlert(
                        product,
                        "ExpiringSoon",
                        $"{product.Name} is expiring soon. Expiry date: {expiryDate:yyyy-MM-dd}.",
                        "Warning"
                    );
                }
                else
                {
                    await ResolveAlertIfExists(product.Id, "ExpiringSoon");
                    await ResolveAlertIfExists(product.Id, "Expired");
                }
            }

            await _context.SaveChangesAsync();
        }

        private async Task CreateOrKeepExpiryAlert(
            Product product,
            string alertType,
            string message,
            string severity
        )
        {
            var existingAlert = await _context.Alerts
                .FirstOrDefaultAsync(alert =>
                    alert.ProductId == product.Id &&
                    alert.AlertType == alertType &&
                    !alert.IsResolved
                );

            if (existingAlert == null)
            {
                var alert = new Alert
                {
                    ProductId = product.Id,
                    AlertType = alertType,
                    Message = message,
                    Severity = severity,
                    IsRead = false,
                    IsResolved = false,
                    CreatedAt = DateTime.Now
                };

                _context.Alerts.Add(alert);
            }
        }

        private async Task ResolveAlertIfExists(int productId, string alertType)
        {
            var existingAlert = await _context.Alerts
                .FirstOrDefaultAsync(alert =>
                    alert.ProductId == productId &&
                    alert.AlertType == alertType &&
                    !alert.IsResolved
                );

            if (existingAlert != null)
            {
                existingAlert.IsResolved = true;
                existingAlert.ResolvedAt = DateTime.Now;
            }
        }
    }
}