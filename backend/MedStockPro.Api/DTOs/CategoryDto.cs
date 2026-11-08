using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class CategoryDto
    {
        [Required(ErrorMessage = "Category name is required")]
        [StringLength(80, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;

        [StringLength(300)]
        public string Description { get; set; } = string.Empty;
    }
}
