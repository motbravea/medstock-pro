using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MedStockPro.Api.Data;
using MedStockPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Services
{
    /// <summary>Runtime licence state for this installation.</summary>
    public enum LicenseState
    {
        Unlicensed,      // no licence activated yet
        Active,          // valid, bound to this machine, not expired
        MachineMismatch, // activated, but on a different machine
        Inactive,        // row exists but IsActive = false
        Expired,         // past ExpiresAt
    }

    /// <summary>The non-secret, signed contents of a licence key.</summary>
    public sealed class LicensePayload
    {
        public string Clinic { get; set; } = string.Empty;
        public int MaxDevices { get; set; } = 1;
        public DateTime? Issued { get; set; }
        public DateTime? Expires { get; set; }
    }

    /// <summary>What GET /api/license/status returns and what the gate checks.</summary>
    public sealed class LicenseStatusResult
    {
        public bool Licensed { get; set; }
        public LicenseState State { get; set; }
        public string? ClinicName { get; set; }
        public DateTime? ActivatedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public int? MaxDevices { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public sealed class LicenseActivationResult
    {
        public bool Success { get; init; }
        public string Message { get; init; } = string.Empty;
        public LicenseStatusResult? Status { get; init; }
    }

    /// <summary>
    /// Validates offline licence keys and enforces the machine bind.
    ///
    /// A licence key is  base64url(payloadJson) + "." + base64url(signature)
    /// where the signature is ECDSA-P256/SHA-256 over the payload JSON, made
    /// with the developer's PRIVATE key. The app only ever holds the PUBLIC
    /// key (config "License:PublicKey", safe to ship) and verifies with it, so
    /// the clinic can neither forge nor self-issue keys.
    ///
    /// The raw key is never persisted — only its SHA-256 hash plus the decoded
    /// (non-secret) payload fields required to enforce the licence at runtime.
    /// </summary>
    public class LicenseService
    {
        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        private readonly AppDbContext _context;
        private readonly MachineFingerprintService _machine;
        private readonly IConfiguration _config;
        private readonly ILogger<LicenseService> _logger;

        public LicenseService(
            AppDbContext context,
            MachineFingerprintService machine,
            IConfiguration config,
            ILogger<LicenseService> logger)
        {
            _context = context;
            _machine = machine;
            _config = config;
            _logger = logger;
        }

        // ── Public API ────────────────────────────────────────────────────

        /// <summary>Current licence state for this machine.</summary>
        public async Task<LicenseStatusResult> GetStatusAsync()
        {
            var lic = await _context.Licenses.AsNoTracking()
                .OrderByDescending(l => l.Id)
                .FirstOrDefaultAsync();

            if (lic == null)
            {
                return new LicenseStatusResult
                {
                    Licensed = false,
                    State = LicenseState.Unlicensed,
                    Message = "No licence has been activated on this installation.",
                };
            }

            var result = new LicenseStatusResult
            {
                ClinicName = lic.ClinicName,
                ActivatedAt = lic.ActivatedAt,
                ExpiresAt = lic.ExpiresAt,
                MaxDevices = lic.MaxDevices,
            };

            if (!lic.IsActive)
            {
                result.State = LicenseState.Inactive;
                result.Message = "This licence has been deactivated.";
                return result;
            }

            if (lic.ExpiresAt is DateTime exp && exp.Date < DateTime.Today)
            {
                result.State = LicenseState.Expired;
                result.Message = $"This licence expired on {exp:yyyy-MM-dd}.";
                return result;
            }

            if (!string.Equals(lic.ActivatedMachineIdHash, _machine.GetMachineHash(),
                    StringComparison.OrdinalIgnoreCase))
            {
                result.State = LicenseState.MachineMismatch;
                result.Message = "This installation is not licensed for this computer.";
                return result;
            }

            result.Licensed = true;
            result.State = LicenseState.Active;
            result.Message = "Licence is active.";
            return result;
        }

        /// <summary>True when the app is fully licensed for the current machine.</summary>
        public async Task<bool> IsLicensedAsync()
            => (await GetStatusAsync()).State == LicenseState.Active;

        /// <summary>
        /// Validate a key and bind it to this machine. Idempotent on the same
        /// machine; blocks activation if a licence is already bound to a
        /// different machine (machine-lock).
        /// </summary>
        public async Task<LicenseActivationResult> ActivateAsync(string clinicName, string licenseKey)
        {
            if (string.IsNullOrWhiteSpace(licenseKey))
            {
                return Fail("Licence key is required.");
            }

            var payload = VerifyKey(licenseKey, out var verifyError);
            if (payload == null)
            {
                return Fail(verifyError ?? "The licence key is invalid.");
            }

            // The clinic name entered must match the one the key was issued to.
            var enteredClinic = (clinicName ?? string.Empty).Trim();
            if (!string.IsNullOrEmpty(enteredClinic) &&
                !string.Equals(enteredClinic, payload.Clinic, StringComparison.OrdinalIgnoreCase))
            {
                return Fail($"This key was issued to \"{payload.Clinic}\", not \"{enteredClinic}\".");
            }

            if (payload.Expires is DateTime exp && exp.Date < DateTime.Today)
            {
                return Fail($"This licence key expired on {exp:yyyy-MM-dd}.");
            }

            var machineHash = _machine.GetMachineHash();
            var keyHash = Sha256Hex(licenseKey);

            var existing = await _context.Licenses
                .OrderByDescending(l => l.Id)
                .FirstOrDefaultAsync();

            if (existing != null &&
                !string.IsNullOrEmpty(existing.ActivatedMachineIdHash) &&
                !string.Equals(existing.ActivatedMachineIdHash, machineHash, StringComparison.OrdinalIgnoreCase))
            {
                // Machine-lock: a licence is already bound to another computer.
                return Fail(
                    "A licence is already activated on a different computer. " +
                    "Contact the developer to move the licence.");
            }

            if (existing == null)
            {
                existing = new License();
                _context.Licenses.Add(existing);
            }

            existing.ClinicName = payload.Clinic;
            existing.LicenseKeyHash = keyHash;
            existing.ActivatedMachineIdHash = machineHash;
            existing.ActivatedAt = DateTime.Now;
            existing.IsActive = true;
            existing.MaxDevices = payload.MaxDevices;
            existing.ExpiresAt = payload.Expires;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Licence activated for clinic '{Clinic}' on this machine.", payload.Clinic);

            var status = await GetStatusAsync();
            return new LicenseActivationResult
            {
                Success = true,
                Message = "Licence activated successfully.",
                Status = status,
            };
        }

        // ── Key verification ──────────────────────────────────────────────

        /// <summary>
        /// Verify the signature and decode the payload. Returns null with an
        /// error message when the key is malformed, unsigned, or tampered.
        /// </summary>
        public LicensePayload? VerifyKey(string licenseKey, out string? error)
        {
            error = null;

            var publicKeyB64 = _config["License:PublicKey"];
            if (string.IsNullOrWhiteSpace(publicKeyB64))
            {
                error = "Licensing is not configured on this build (missing public key).";
                _logger.LogError("License:PublicKey is not configured.");
                return null;
            }

            var parts = licenseKey.Trim().Split('.');
            if (parts.Length != 2)
            {
                error = "The licence key format is not recognised.";
                return null;
            }

            byte[] payloadBytes;
            byte[] signature;
            try
            {
                payloadBytes = FromBase64Url(parts[0]);
                signature = FromBase64Url(parts[1]);
            }
            catch
            {
                error = "The licence key is corrupted.";
                return null;
            }

            try
            {
                using var ecdsa = ECDsa.Create();
                ecdsa.ImportSubjectPublicKeyInfo(Convert.FromBase64String(publicKeyB64), out _);

                var ok = ecdsa.VerifyData(payloadBytes, signature, HashAlgorithmName.SHA256);
                if (!ok)
                {
                    error = "The licence key signature is not valid.";
                    return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Licence signature verification failed.");
                error = "The licence key could not be verified.";
                return null;
            }

            try
            {
                var payload = JsonSerializer.Deserialize<LicensePayload>(payloadBytes, JsonOpts);
                if (payload == null || string.IsNullOrWhiteSpace(payload.Clinic))
                {
                    error = "The licence key payload is incomplete.";
                    return null;
                }
                if (payload.MaxDevices < 1) payload.MaxDevices = 1;
                return payload;
            }
            catch
            {
                error = "The licence key payload could not be read.";
                return null;
            }
        }

        // ── helpers ───────────────────────────────────────────────────────

        private static LicenseActivationResult Fail(string message)
            => new() { Success = false, Message = message };

        private static string Sha256Hex(string value)
            => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

        private static byte[] FromBase64Url(string input)
        {
            var s = input.Replace('-', '+').Replace('_', '/');
            switch (s.Length % 4)
            {
                case 2: s += "=="; break;
                case 3: s += "="; break;
            }
            return Convert.FromBase64String(s);
        }
    }
}
