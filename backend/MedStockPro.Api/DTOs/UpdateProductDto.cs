using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class UpdateProductDto
    {
        [Required(ErrorMessage = "Product name is required")]
        [StringLength(120, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;

        [StringLength(500)]
        public string Description { get; set; } = string.Empty;

        [StringLength(300)]
        public string PhotoPath { get; set; } = string.Empty;

        [Range(0, int.MaxValue)]
        public int CurrentStock { get; set; }

        [Range(0, int.MaxValue)]
        public int MinimumStock { get; set; }

        public DateTime? ExpiryDate { get; set; }

        [Range(1, 365)]
        public int ExpiryAlertDays { get; set; } = 30;

        [StringLength(64)]
        public string InternalBarcode { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;
    }
}
