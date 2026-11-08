using Microsoft.AspNetCore.Mvc;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetHealth()
        {
            return Ok(new
            {
                status = "MedStock Pro API is running",
                project = "Dental Clinic Inventory System",
                time = DateTime.Now
            });
        }
    }
}