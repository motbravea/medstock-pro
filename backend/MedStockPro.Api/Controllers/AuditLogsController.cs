using MedStockPro.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class AuditLogsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditLogsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AuditLogs?page=1&pageSize=100
        [HttpGet]
        public async Task<ActionResult> GetAll(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 100)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var total = await _context.AuditLogs.CountAsync();
            var items = await _context.AuditLogs
                .OrderByDescending(a => a.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { total, page, pageSize, items });
        }

        // GET: api/AuditLogs/user/3
        [HttpGet("user/{userId:int}")]
        public async Task<ActionResult> GetByUser(int userId)
        {
            var items = await _context.AuditLogs
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.CreatedAt)
                .Take(500)
                .ToListAsync();
            return Ok(items);
        }

        // GET: api/AuditLogs/entity/Product/12
        [HttpGet("entity/{entityType}/{entityId:int}")]
        public async Task<ActionResult> GetByEntity(string entityType, int entityId)
        {
            var items = await _context.AuditLogs
                .Where(a => a.EntityType == entityType && a.EntityId == entityId)
                .OrderByDescending(a => a.CreatedAt)
                .Take(500)
                .ToListAsync();
            return Ok(items);
        }

        // GET: api/AuditLogs/date-range?start=2026-05-01&end=2026-05-31
        [HttpGet("date-range")]
        public async Task<ActionResult> GetByDateRange(
            [FromQuery] DateTime start,
            [FromQuery] DateTime end)
        {
            if (start == default || end == default || end < start)
            {
                return BadRequest("Provide ?start=yyyy-MM-dd&end=yyyy-MM-dd with end >= start.");
            }

            var inclusiveEnd = end.Date.AddDays(1);

            var items = await _context.AuditLogs
                .Where(a => a.CreatedAt >= start.Date && a.CreatedAt < inclusiveEnd)
                .OrderByDescending(a => a.CreatedAt)
                .Take(1000)
                .ToListAsync();

            return Ok(items);
        }

        // GET: api/AuditLogs/summary — for dashboard widgets
        [HttpGet("summary")]
        public async Task<ActionResult> GetSummary()
        {
            var today = DateTime.Today;
            var todayCount = await _context.AuditLogs
                .CountAsync(a => a.CreatedAt >= today);
            var weekCount = await _context.AuditLogs
                .CountAsync(a => a.CreatedAt >= today.AddDays(-7));
            var byAction = await _context.AuditLogs
                .Where(a => a.CreatedAt >= today.AddDays(-30))
                .GroupBy(a => a.Action)
                .Select(g => new { action = g.Key, count = g.Count() })
                .OrderByDescending(x => x.count)
                .Take(10)
                .ToListAsync();
            return Ok(new { todayCount, weekCount, byAction });
        }
    }
}
