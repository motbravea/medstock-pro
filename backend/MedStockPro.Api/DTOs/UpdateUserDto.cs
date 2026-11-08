using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    /// <summary>
    /// Admin edits a user's profile fields. Password is NOT here — that has
    /// its own endpoint so the change-password code path can be smaller,
    /// audited separately, and impossible to leak a password through a
    /// profile-update field by accident.
    /// </summary>
    public class UpdateUserDto
    {
        [Required(ErrorMessage = "Full name is required")]
        [StringLength(120, MinimumLength = 2)]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Username is required")]
        [StringLength(64, MinimumLength = 3)]
        [RegularExpression(@"^[a-zA-Z0-9_.-]+$",
            ErrorMessage = "Username may only contain letters, digits, dot, underscore, hyphen")]
        public string Username { get; set; } = string.Empty;

        [Required]
        [RegularExpression("^(Admin|Staff)$",
            ErrorMessage = "Role must be Admin or Staff")]
        public string Role { get; set; } = "Staff";
    }
}
