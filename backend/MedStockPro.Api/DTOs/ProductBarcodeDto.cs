using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class ProductBarcodeDto
    {
        [Required(ErrorMessage = "Barcode value is required")]
        [StringLength(64, MinimumLength = 1)]
        public string BarcodeValue { get; set; } = string.Empty;

        [Required]
        [RegularExpression("^(Internal|Supplier|External)$",
            ErrorMessage = "BarcodeType must be Internal, Supplier, or External")]
        public string BarcodeType { get; set; } = "Supplier";

        [StringLength(200)]
        public string Notes { get; set; } = string.Empty;
    }
}
