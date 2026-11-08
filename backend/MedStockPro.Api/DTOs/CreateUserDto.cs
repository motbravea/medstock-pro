using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    public class CreateUserDto
    {
        [Required(ErrorMessage = "Full name is required")]
        [StringLength(120, MinimumLength = 2)]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Username is required")]
        [StringLength(64, MinimumLength = 3)]
        [RegularExpression(@"^[a-zA-Z0-9_.-]+$",
            ErrorMessage = "Username may only contain letters, digits, dot, underscore, hyphen")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [StringLength(128, MinimumLength = 6,
            ErrorMessage = "Password must be at least 6 characters")]
        public string Password { get; set; } = string.Empty;

        [Required]
        [RegularExpression("^(Admin|Staff)$",
            ErrorMessage = "Role must be Admin or Staff")]
        public string Role { get; set; } = "Staff";
    }
}
