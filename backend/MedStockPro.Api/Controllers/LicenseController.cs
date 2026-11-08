using MedStockPro.Api.DTOs;
using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedStockPro.Api.Controllers
{
    /// <summary>
    /// Licensing endpoints. These are intentionally anonymous and NOT gated
    /// by the licence middleware — the app must be able to read status and
    /// activate before it is licensed.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class LicenseController : ControllerBase
    {
        private readonly LicenseService _license;

        public LicenseController(LicenseService license)
        {
            _license = license;
        }

        // GET: api/license/status
        [HttpGet("status")]
        public async Task<ActionResult> GetStatus()
        {
            var status = await _license.GetStatusAsync();
            return Ok(new
            {
                licensed = status.Licensed,
                state = status.State.ToString(),
                clinicName = status.ClinicName,
                activatedAt = status.ActivatedAt,
                expiresAt = status.ExpiresAt,
                maxDevices = status.MaxDevices,
                message = status.Message,
            });
        }

        // POST: api/license/activate
        [HttpPost("activate")]
        public async Task<ActionResult> Activate(ActivateLicenseDto request)
        {
            var result = await _license.ActivateAsync(request.ClinicName, request.LicenseKey);
            if (!result.Success)
            {
                return BadRequest(new { message = result.Message });
            }

            var status = result.Status!;
            return Ok(new
            {
                message = result.Message,
                licensed = status.Licensed,
                state = status.State.ToString(),
                clinicName = status.ClinicName,
                activatedAt = status.ActivatedAt,
                expiresAt = status.ExpiresAt,
                maxDevices = status.MaxDevices,
            });
        }
    }
}
