namespace MedStockPro.Api.Models
{
    /// <summary>
    /// A single-row licensing record binding this installation to one clinic
    /// and one machine. The raw license key is NEVER stored — only a SHA-256
    /// hash of it (for integrity/audit) plus the decoded, non-secret payload
    /// fields needed to enforce the licence at runtime.
    /// </summary>
    public class License
    {
        public int Id { get; set; }

        /// <summary>Clinic the licence was issued to (from the signed payload).</summary>
        public string ClinicName { get; set; } = string.Empty;

        /// <summary>SHA-256 hash of the activation key. Never the key itself.</summary>
        public string LicenseKeyHash { get; set; } = string.Empty;

        /// <summary>SHA-256 hash of the machine fingerprint this licence is bound to.</summary>
        public string ActivatedMachineIdHash { get; set; } = string.Empty;

        public DateTime ActivatedAt { get; set; }

        public bool IsActive { get; set; } = true;

        /// <summary>How many devices the licence permits (from the signed payload).</summary>
        public int MaxDevices { get; set; } = 1;

        /// <summary>
        /// Optional expiry copied from the signed payload. Null = perpetual.
        /// Enforced on every launch / protected request.
        /// </summary>
        public DateTime? ExpiresAt { get; set; }
    }
}
