using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    /// <summary>Body of POST /api/license/activate.</summary>
    public class ActivateLicenseDto
    {
        [Required(ErrorMessage = "Clinic name is required")]
        [StringLength(160, MinimumLength = 1)]
        public string ClinicName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Licence key is required")]
        [StringLength(4000, MinimumLength = 8)]
        public string LicenseKey { get; set; } = string.Empty;
    }
}
