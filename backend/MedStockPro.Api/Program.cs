using System.Globalization;
using System.Text;
using System.Threading.RateLimiting;
using MedStockPro.Api.Data;
using MedStockPro.Api.Middleware;
using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting.WindowsServices;
using Microsoft.IdentityModel.Tokens;

// ─────────────────────────────────────────────────────────────────────────
//  Invariant culture — REQUIRED.
//  EF Core's SQLite provider registers a decimal collation that uses
//  decimal.Parse(string) without a culture, which crashes on French/etc.
//  Setting these BEFORE CreateBuilder ensures every thread sees Invariant.
// ─────────────────────────────────────────────────────────────────────────
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

// When running as a Windows Service the process CWD is C:\Windows\System32,
// so we pin the content root to the install directory. That lets appsettings
// and other content resolve from where the app is actually installed.
var runningAsService = WindowsServiceHelpers.IsWindowsService();
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = runningAsService ? AppContext.BaseDirectory : null,
});

// Run under the Windows Service Control Manager when hosted as a service.
// This is a no-op for console / Tauri-launched runs.
if (runningAsService)
{
    builder.Host.UseWindowsService();
}

// CreateBuilder only auto-loads user-secrets when ASPNETCORE_ENVIRONMENT is
// "Development", and the generic overload AddUserSecrets<Program>() relies
// on the synthetic top-level Program class carrying the assembly attribute.
// Pass the UserSecretsId GUID explicitly so the secrets file is loaded on
// every machine and from every shell, regardless of env detection quirks.
const string userSecretsId = "d07bcb1e-ffcb-44f2-92d2-fb755639c745";
builder.Configuration.AddUserSecrets(userSecretsId, reloadOnChange: false);

builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

// ─────────────────────────────────────────────────────────────────────────
//  Storage paths.
//  Production resolves everything under %PROGRAMDATA%\MedStockPro\ in
//  dedicated subfolders (Database / Uploads / Backups / Logs) so a clinic
//  reinstall never blows away data, and the app doesn't depend on the
//  project folder existing. Development keeps the existing relative paths so
//  local work is unchanged.
//
//  ProgramData is used when EITHER:
//    - the environment is Production (installed clinic app), OR
//    - Storage:UseProgramData = true is set explicitly (opt-in for testing).
//  An operator can override the whole root with the MEDSTOCK_DATA_DIR env
//  variable if the clinic needs data on a different drive.
// ─────────────────────────────────────────────────────────────────────────
var programDataFolder = builder.Configuration.GetValue("Storage:ProgramDataFolder", "MedStockPro")!;
var useProgramData =
    builder.Environment.IsProduction() ||
    builder.Configuration.GetValue("Storage:UseProgramData", false);

var dataDirOverride = Environment.GetEnvironmentVariable("MEDSTOCK_DATA_DIR");

string dataRoot;
string databaseRoot;
string uploadsRoot;

if (!string.IsNullOrWhiteSpace(dataDirOverride))
{
    dataRoot = dataDirOverride;
    databaseRoot = Path.Combine(dataRoot, "Database");
    uploadsRoot = Path.Combine(dataRoot, "Uploads");
}
else if (useProgramData)
{
    var programData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
    dataRoot = Path.Combine(programData, programDataFolder);
    databaseRoot = Path.Combine(dataRoot, "Database");
    uploadsRoot = Path.Combine(dataRoot, "Uploads");
}
else
{
    // Development: keep the existing on-disk layout so the current db,
    // uploads and backups are found exactly where they are today.
    dataRoot = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "database"));
    databaseRoot = dataRoot;
    uploadsRoot = Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
}

var backupsRoot = Path.Combine(dataRoot, "Backups");
var logsRoot = Path.Combine(dataRoot, "Logs");

// Create every folder up-front so nothing downstream has to check.
Directory.CreateDirectory(dataRoot);
Directory.CreateDirectory(databaseRoot);
Directory.CreateDirectory(backupsRoot);
Directory.CreateDirectory(logsRoot);
Directory.CreateDirectory(Path.Combine(uploadsRoot, "products"));

// Expose the resolved paths so controllers can grab them via DI.
builder.Services.AddSingleton(new StoragePaths(
    dataRoot, databaseRoot, uploadsRoot, backupsRoot, logsRoot));

// ─────────────────────────────────────────────────────────────────────────
//  Connection string. When using ProgramData (or an override), the db lives
//  in the Database subfolder; development keeps the configured relative path.
// ─────────────────────────────────────────────────────────────────────────
var configuredConnection = builder.Configuration.GetConnectionString("DefaultConnection");
var connectionString = (!string.IsNullOrWhiteSpace(dataDirOverride) || useProgramData)
    ? $"Data Source={Path.Combine(databaseRoot, "medstockpro.db")}"
    : configuredConnection;

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddScoped<AlertService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<LicenseService>();
builder.Services.AddSingleton<MachineFingerprintService>();
builder.Services.AddHostedService<ExpiryAlertBackgroundService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ─────────────────────────────────────────────────────────────────────────
//  CORS lockdown.
//  Replace AllowAnyOrigin with an explicit allow-list driven by config.
//  Tauri dev usually serves on http://localhost:5173 or :1420; the packaged
//  app uses tauri://localhost (and https://tauri.localhost on Windows).
// ─────────────────────────────────────────────────────────────────────────
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? new[]
{
    "http://localhost:5173",
    "http://localhost:1420",
    "tauri://localhost",
    "https://tauri.localhost",
};

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ─────────────────────────────────────────────────────────────────────────
//  JWT key resolution. Order of precedence:
//    1. environment variable JWT__KEY  (for production / packaged install)
//    2. dotnet user-secrets            (for local development)
//    3. appsettings.Development.json   (only meant for fallback in dev)
//  The key MUST be at least 32 bytes (256 bits) — we fail fast otherwise so
//  nobody ships a weak token.
// ─────────────────────────────────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"];
var jwtIssuer = builder.Configuration["Jwt:Issuer"];
var jwtAudience = builder.Configuration["Jwt:Audience"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException(
        "Jwt:Key is missing. Set it via user-secrets (dotnet user-secrets set \"Jwt:Key\" \"<random>\") " +
        "for development, or the JWT__KEY environment variable in production.");
}

if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key must be at least 32 bytes (256 bits). Generate a stronger key.");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey!)
        )
    };
});

builder.Services.AddAuthorization();

// ─────────────────────────────────────────────────────────────────────────
//  Rate limiting.
//  - "login" policy: 5 attempts per minute per IP, queue 0, reject with 429.
//  Applied via [EnableRateLimiting("login")] on the login action.
// ─────────────────────────────────────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
});

var app = builder.Build();

// Apply pending migrations at startup so the audit log table comes online
// without requiring a manual `dotnet ef database update`.
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    ctx.Database.Migrate();

    // One-time normalisation of legacy photo paths. Any value that is not
    // already "/uploads/products/<file>" (full Windows paths, "products\x.jpg",
    // bare filenames, etc.) is rewritten to the canonical served path so the
    // static file server and frontend resolve the image. Idempotent.
    var toFix = ctx.Products
        .Where(p => p.PhotoPath != null && p.PhotoPath != "")
        .ToList();
    var fixedCount = 0;
    foreach (var p in toFix)
    {
        var normalized = MedStockPro.Api.Services.PhotoPaths.Normalize(p.PhotoPath);
        if (!string.Equals(normalized, p.PhotoPath, StringComparison.Ordinal))
        {
            p.PhotoPath = normalized;
            fixedCount++;
        }
    }
    if (fixedCount > 0)
    {
        ctx.SaveChanges();
        var startupLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        startupLogger.LogInformation("Normalised {Count} legacy product photo paths.", fixedCount);
    }
}

// Swagger is a development-only convenience. Never exposed in production so
// the clinic install does not advertise its API surface.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = "/uploads"
});

// HTTPS redirection only makes sense when an HTTPS port is bound. We skip it
// otherwise to avoid the "Failed to determine the https port for redirect"
// warning that confuses operators.
if (builder.Configuration.GetValue("Kestrel:Endpoints:Https:Url", string.Empty)?.StartsWith("https") == true
    || (Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "").Contains("https"))
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowFrontend");

// Licence gate — blocks all /api/* except /api/license/* until the app is
// activated and bound to THIS machine. Placed after CORS so pre-flight works,
// before auth so an unlicensed install cannot even reach the login endpoint.
app.UseMiddleware<LicenseGateMiddleware>();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Log the licence state at startup (does not crash if unlicensed — the
// activation endpoint stays reachable so the clinic can license the install).
using (var scope = app.Services.CreateScope())
{
    var licenseService = scope.ServiceProvider.GetRequiredService<LicenseService>();
    var status = await licenseService.GetStatusAsync();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    if (status.State == LicenseState.Active)
    {
        logger.LogInformation("Licence OK — clinic '{Clinic}'.", status.ClinicName);
    }
    else
    {
        logger.LogWarning(
            "Licence not active (state {State}). API access is blocked until activation.",
            status.State);
    }
}

app.Run();

// Strongly-typed bundle so controllers can ask for the resolved paths.
// DatabaseRoot holds medstockpro.db; DataRoot is the parent of all subfolders.
public record StoragePaths(
    string DataRoot,
    string DatabaseRoot,
    string UploadsRoot,
    string BackupsRoot,
    string LogsRoot);
