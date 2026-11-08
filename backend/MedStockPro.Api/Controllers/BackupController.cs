using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class BackupController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly StoragePaths _storage;
        private readonly AuditService _audit;

        public BackupController(
            IConfiguration configuration,
            StoragePaths storage,
            AuditService audit)
        {
            _configuration = configuration;
            _storage = storage;
            _audit = audit;
        }

        // GET: api/Backup/database-info
        [HttpGet("database-info")]
        public ActionResult GetDatabaseInfo()
        {
            var databasePath = ResolveDatabasePath();

            if (string.IsNullOrWhiteSpace(databasePath) || !System.IO.File.Exists(databasePath))
            {
                return NotFound("Database file not found.");
            }

            var fileInfo = new FileInfo(databasePath);

            return Ok(new
            {
                databasePath,
                fileSizeKb = Math.Round(fileInfo.Length / 1024.0, 2),
                lastModified = fileInfo.LastWriteTime,
                backupsFolder = _storage.BackupsRoot,
                exists = true
            });
        }

        // POST: api/Backup/create
        [HttpPost("create")]
        public async Task<ActionResult> CreateBackup()
        {
            var databasePath = ResolveDatabasePath();

            if (string.IsNullOrWhiteSpace(databasePath) || !System.IO.File.Exists(databasePath))
            {
                return NotFound("Database file not found.");
            }

            Directory.CreateDirectory(_storage.BackupsRoot);

            // Millisecond precision + a short GUID so simultaneous clicks can never collide.
            var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss_fff");
            var unique = Guid.NewGuid().ToString("N").Substring(0, 6);
            var backupFileName = $"medstockpro_backup_{timestamp}_{unique}.db";
            var backupPath = Path.Combine(_storage.BackupsRoot, backupFileName);

            try
            {
                System.IO.File.Copy(databasePath, backupPath, overwrite: false);
            }
            catch (IOException ex)
            {
                return Conflict(new { message = "Backup file could not be created.", detail = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    new { message = "Backup folder is not writable.", detail = ex.Message });
            }

            var backupInfo = new FileInfo(backupPath);

            await _audit.LogAsync(
                action: "BackupCreated",
                entityType: "Backup",
                entityId: 0,
                entityName: backupFileName,
                description: $"Backup file created ({Math.Round(backupInfo.Length / 1024.0, 2)} KB)");

            return Ok(new
            {
                message = "Database backup created successfully",
                backupFileName,
                backupPath,
                fileSizeKb = Math.Round(backupInfo.Length / 1024.0, 2),
                createdAt = DateTime.Now
            });
        }

        private string ResolveDatabasePath()
        {
            var connectionString = _configuration.GetConnectionString("DefaultConnection");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                return string.Empty;
            }

            const string prefix = "Data Source=";
            if (!connectionString.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                return connectionString;
            }

            var raw = connectionString.Substring(prefix.Length).Trim();
            return Path.IsPathRooted(raw)
                ? raw
                : Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), raw));
        }
    }
}
