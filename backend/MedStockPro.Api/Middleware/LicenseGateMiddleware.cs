using MedStockPro.Api.Services;

namespace MedStockPro.Api.Middleware
{
    /// <summary>
    /// Blocks every API request when the installation is not licensed for this
    /// machine. The licence endpoints (/api/license/*) and CORS pre-flight are
    /// always allowed so the app can read status and activate. Non-/api routes
    /// (e.g. /uploads static files, swagger in dev) are left to their own
    /// pipeline — the frontend shows the block page before requesting any of
    /// them anyway.
    /// </summary>
    public class LicenseGateMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<LicenseGateMiddleware> _logger;

        public LicenseGateMiddleware(RequestDelegate next, ILogger<LicenseGateMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context, LicenseService license)
        {
            var path = context.Request.Path;

            // Always let CORS pre-flight through.
            if (HttpMethods.IsOptions(context.Request.Method))
            {
                await _next(context);
                return;
            }

            // Only gate API traffic; and never gate the licence endpoints.
            var isApi = path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase);
            var isLicenseEndpoint = path.StartsWithSegments("/api/license", StringComparison.OrdinalIgnoreCase);

            if (!isApi || isLicenseEndpoint)
            {
                await _next(context);
                return;
            }

            var status = await license.GetStatusAsync();
            if (status.State == LicenseState.Active)
            {
                await _next(context);
                return;
            }

            _logger.LogWarning(
                "Blocked {Method} {Path}: licence state {State}.",
                context.Request.Method, path, status.State);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "unlicensed",
                state = status.State.ToString(),
                message = "This installation is not licensed for this computer. "
                          + "Please contact the developer.",
            });
        }
    }
}
