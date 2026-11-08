using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class ProductSupplierDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "SupplierId must be a positive id")]
        public int SupplierId { get; set; }

        [StringLength(64)]
        public string SupplierBarcode { get; set; } = string.Empty;

        [Range(0.0, 1_000_000.0, ErrorMessage = "Price must be between 0 and 1,000,000")]
        public decimal Price { get; set; }

        public DateTime? LastPurchaseDate { get; set; }

        public bool IsPreferredSupplier { get; set; } = false;
    }
}
