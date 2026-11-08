using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    /// <summary>
    /// Admin sets a new password for any user (no current-password challenge
    /// — the assumption is that an Admin is reaching for this when the user
    /// has lost or wants to rotate the password). Per the QA spec only the
    /// new password is asked for; no confirmation field.
    /// </summary>
    public class ChangePasswordDto
    {
        [Required(ErrorMessage = "Password is required")]
        [StringLength(128, MinimumLength = 6,
            ErrorMessage = "Password must be at least 6 characters")]
        public string Password { get; set; } = string.Empty;
    }
}
