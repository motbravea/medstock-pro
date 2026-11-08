using System.Net.NetworkInformation;
using System.Security.Cryptography;
using System.Text;

namespace MedStockPro.Api.Services
{
    /// <summary>
    /// Produces a stable, privacy-safe fingerprint of the current machine and
    /// returns it as a SHA-256 hash. Combines several local identifiers so no
    /// single one changing (e.g. a swapped NIC) is likely to break the bind,
    /// while a copy to a different computer produces a different hash.
    ///
    /// Identifiers used (all read locally, nothing leaves the machine):
    ///   - Windows MachineGuid (registry) — most stable
    ///   - Computer name
    ///   - First non-loopback physical MAC address
    /// The result is cached for the process lifetime.
    /// </summary>
    public class MachineFingerprintService
    {
        private readonly ILogger<MachineFingerprintService> _logger;
        private string? _cachedHash;

        public MachineFingerprintService(ILogger<MachineFingerprintService> logger)
        {
            _logger = logger;
        }

        /// <summary>Lowercase hex SHA-256 of the composed fingerprint.</summary>
        public string GetMachineHash()
        {
            if (_cachedHash != null) return _cachedHash;

            var parts = new List<string>
            {
                "machine-guid:" + SafeMachineGuid(),
                "computer-name:" + SafeComputerName(),
                "mac:" + SafeMacAddress(),
            };

            var composed = string.Join("|", parts);
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(composed));
            _cachedHash = Convert.ToHexString(bytes).ToLowerInvariant();
            return _cachedHash;
        }

        private string SafeMachineGuid()
        {
            // Only Windows has this registry key; on other OSes we fall back to
            // the other identifiers, which is fine for the clinic (Windows).
            if (!OperatingSystem.IsWindows()) return "n/a";
            try
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(
                    @"SOFTWARE\Microsoft\Cryptography");
                var value = key?.GetValue("MachineGuid") as string;
                return string.IsNullOrWhiteSpace(value) ? "n/a" : value.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not read MachineGuid; using fallback.");
                return "n/a";
            }
        }

        private static string SafeComputerName()
        {
            try { return Environment.MachineName; }
            catch { return "n/a"; }
        }

        private static string SafeMacAddress()
        {
            try
            {
                var nic = NetworkInterface.GetAllNetworkInterfaces()
                    .Where(n =>
                        n.OperationalStatus == OperationalStatus.Up &&
                        n.NetworkInterfaceType != NetworkInterfaceType.Loopback &&
                        n.NetworkInterfaceType != NetworkInterfaceType.Tunnel)
                    .OrderBy(n => n.NetworkInterfaceType == NetworkInterfaceType.Ethernet ? 0 : 1)
                    .FirstOrDefault();

                var mac = nic?.GetPhysicalAddress()?.ToString();
                return string.IsNullOrWhiteSpace(mac) ? "n/a" : mac;
            }
            catch
            {
                return "n/a";
            }
        }
    }
}
