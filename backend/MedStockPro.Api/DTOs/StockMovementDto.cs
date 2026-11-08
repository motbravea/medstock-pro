using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class StockMovementDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "ProductId must be a positive id")]
        public int ProductId { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be 1 or more")]
        public int Quantity { get; set; }

        [Required]
        [RegularExpression("^(StockIn|StockOut|Adjustment|Damaged|Expired)$",
            ErrorMessage = "MovementType must be StockIn, StockOut, Adjustment, Damaged, or Expired")]
        public string MovementType { get; set; } = string.Empty;

        [StringLength(300)]
        public string Notes { get; set; } = string.Empty;
    }
}
