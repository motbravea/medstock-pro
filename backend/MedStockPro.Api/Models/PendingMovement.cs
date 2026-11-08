namespace MedStockPro.Api.Models
{
    /// <summary>
    /// A stock movement that does not affect inventory until an Admin reviews
    /// it. Today only "Return" uses this path: Staff scans a product they want
    /// to put back, a row is created with Status=Pending, and CurrentStock is
    /// untouched until Admin clicks Approve (writes a real StockIn) or Reject
    /// (no stock change, row marked Rejected).
    /// </summary>
    public class PendingMovement
    {
        public int Id { get; set; }

        public int ProductId { get; set; }
        public Product? Product { get; set; }

        /// <summary>The Staff/Admin who scanned the return.</summary>
        public int RequestedByUserId { get; set; }
        public User? RequestedByUser { get; set; }

        /// <summary>
        /// The original StockOut this return is undoing. Required so the same
        /// "used" event can't be returned twice and so we can show the link
        /// in the audit trail.
        /// </summary>
        public int SourceMovementId { get; set; }
        public StockMovement? SourceMovement { get; set; }

        /// <summary>e.g. "Return". Kept as string for future expansion.</summary>
        public string MovementType { get; set; } = "Return";

        public int Quantity { get; set; } = 1;

        /// <summary>"Pending" | "Approved" | "Rejected".</summary>
        public string Status { get; set; } = "Pending";

        public string RequesterNotes { get; set; } = string.Empty;

        // ─── Review fields (filled when Admin approves/rejects) ─────────────
        public int? ReviewedByUserId { get; set; }
        public User? ReviewedByUser { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string ReviewerNotes { get; set; } = string.Empty;

        /// <summary>
        /// The StockMovement created when an Admin approved this pending
        /// return. Null until approval. Allows us to chain Source → Pending
        /// → Restored movements in the audit trail.
        /// </summary>
        public int? RestoredMovementId { get; set; }
        public StockMovement? RestoredMovement { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
