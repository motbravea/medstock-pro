using System.Security.Claims;
using System.Text.Json;
using MedStockPro.Api.Data;
using MedStockPro.Api.Models;

namespace MedStockPro.Api.Services
{
    /// <summary>
    /// Central place every controller calls when an important action happens.
    /// Pulls the acting user from the current HttpContext so callers don't
    /// have to thread it through. Never throws — audit failures must not
    /// poison the main request.
    /// </summary>
    public class AuditService
    {
        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            WriteIndented = false,
        };

        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContext;
        private readonly ILogger<AuditService> _logger;

        public AuditService(
            AppDbContext context,
            IHttpContextAccessor httpContext,
            ILogger<AuditService> logger)
        {
            _context = context;
            _httpContext = httpContext;
            _logger = logger;
        }

        public async Task LogAsync(
            string action,
            string entityType,
            int entityId,
            string entityName,
            string description,
            object? oldValues = null,
            object? newValues = null,
            User? userOverride = null)
        {
            try
            {
                var ctx = _httpContext.HttpContext;

                int? userId = userOverride?.Id;
                if (userId is null)
                {
                    if (int.TryParse(ctx?.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var uid))
                    {
                        userId = uid;
                    }
                }

                var userName = userOverride?.Username
                    ?? ctx?.User?.FindFirstValue(ClaimTypes.Name)
                    ?? string.Empty;
                var userRole = userOverride?.Role
                    ?? ctx?.User?.FindFirstValue(ClaimTypes.Role)
                    ?? string.Empty;
                var ip = ctx?.Connection?.RemoteIpAddress?.ToString() ?? string.Empty;

                var entry = new AuditLog
                {
                    UserId = userId,
                    UserName = userName,
                    UserRole = userRole,
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    EntityName = entityName ?? string.Empty,
                    Description = description ?? string.Empty,
                    OldValues = oldValues is null ? string.Empty : JsonSerializer.Serialize(oldValues, JsonOpts),
                    NewValues = newValues is null ? string.Empty : JsonSerializer.Serialize(newValues, JsonOpts),
                    IpAddress = ip,
                    CreatedAt = DateTime.Now,
                };

                _context.AuditLogs.Add(entry);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Audit log write failed for action {Action}", action);
            }
        }
    }
}
