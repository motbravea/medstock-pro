namespace MedStockPro.Api.Models
{
    /// <summary>
    /// Append-only record of important actions in the system. Used by Admin
    /// to review staff/admin activity and trace data changes.
    /// </summary>
    public class AuditLog
    {
        public int Id { get; set; }

        public int? UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string UserRole { get; set; } = string.Empty;

        /// <summary>e.g. "ProductCreated", "StockOut", "Login".</summary>
        public string Action { get; set; } = string.Empty;

        /// <summary>e.g. "Product", "Supplier", "Backup".</summary>
        public string EntityType { get; set; } = string.Empty;

        public int EntityId { get; set; }
        public string EntityName { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        /// <summary>JSON snapshot of relevant fields before the change.</summary>
        public string OldValues { get; set; } = string.Empty;

        /// <summary>JSON snapshot of relevant fields after the change.</summary>
        public string NewValues { get; set; } = string.Empty;

        public string IpAddress { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
