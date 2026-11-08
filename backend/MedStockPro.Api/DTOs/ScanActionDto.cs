using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    /// <summary>
    /// Posted by the scan workspace when Staff/Admin clicks "Used (-N)" or
    /// "Return". For "Used" the quantity comes off CurrentStock immediately;
    /// for "Return" the quantity is taken from the linked source StockOut
    /// (this DTO's quantity is ignored on the return path).
    /// </summary>
    public class ScanActionDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "ProductId must be a positive id")]
        public int ProductId { get; set; }

        [Range(1, 1000, ErrorMessage = "Quantity must be between 1 and 1000")]
        public int Quantity { get; set; } = 1;

        [StringLength(300)]
        public string Notes { get; set; } = string.Empty;
    }
}
