using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    /// <summary>
    /// Posted from the "Receive shipment" workflow. One call carries the
    /// quantity received, an optional supplier (to bump LastPurchaseDate on
    /// the existing ProductSupplier link), an optional expiry date (to
    /// refresh the product's expiry), and optional notes.
    ///
    /// The backend performs everything atomically — partial updates leave
    /// the system inconsistent (movement saved but expiry not refreshed) so
    /// we wrap the whole thing in a single transaction.
    /// </summary>
    public class ReceiveStockDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "ProductId must be a positive id")]
        public int ProductId { get; set; }

        [Range(1, 100000, ErrorMessage = "Quantity must be between 1 and 100000")]
        public int Quantity { get; set; }

        /// <summary>Optional. Must reference an existing ProductSupplier link.</summary>
        public int? SupplierId { get; set; }

        /// <summary>
        /// Optional. If provided, the product's expiry date is updated. Pass
        /// null (or omit) to keep the current expiry untouched. Past dates
        /// are rejected — typo guard for receiving fresh stock.
        /// </summary>
        public DateTime? ExpiryDate { get; set; }

        [StringLength(300)]
        public string Notes { get; set; } = string.Empty;
    }
}
