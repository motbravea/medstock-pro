using Microsoft.Extensions.DependencyInjection;

namespace MedStockPro.Api.Services
{
    /// <summary>
    /// Periodically runs the expiry-alert check. Interval is driven by
    /// configuration key "BackgroundJobs:ExpiryCheckIntervalMinutes" so that
    /// development can poll quickly while production runs once per day.
    /// </summary>
    public class ExpiryAlertBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ExpiryAlertBackgroundService> _logger;

        public ExpiryAlertBackgroundService(
            IServiceScopeFactory scopeFactory,
            IConfiguration configuration,
            ILogger<ExpiryAlertBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _configuration = configuration;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var minutes = _configuration.GetValue("BackgroundJobs:ExpiryCheckIntervalMinutes", 1440);
            if (minutes < 1) minutes = 1;
            var interval = TimeSpan.FromMinutes(minutes);

            _logger.LogInformation(
                "ExpiryAlertBackgroundService starting. Interval = {Minutes} minutes.",
                minutes);

            // First run after a short warm-up delay so the API can finish booting.
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var alertService = scope.ServiceProvider.GetRequiredService<AlertService>();

                    _logger.LogInformation("Running automatic expiry alert check.");
                    await alertService.CheckExpiryAlerts();
                    _logger.LogInformation("Expiry alert check completed.");
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Expiry alert check failed; will retry next cycle.");
                }

                try
                {
                    await Task.Delay(interval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }
}
