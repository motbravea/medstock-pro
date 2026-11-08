using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class SupplierDto
    {
        [Required(ErrorMessage = "Supplier name is required")]
        [StringLength(120, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;

        [StringLength(40)]
        public string PhoneNumber { get; set; } = string.Empty;

        [StringLength(120)]
        [EmailAddress(ErrorMessage = "Invalid email")]
        public string Email { get; set; } = string.Empty;

        [StringLength(300)]
        public string Address { get; set; } = string.Empty;

        [StringLength(500)]
        public string Notes { get; set; } = string.Empty;
    }
}
