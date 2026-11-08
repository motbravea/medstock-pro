using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MedStockPro.Api.Data;
using MedStockPro.Api.DTOs;
using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly AuditService _audit;

        public AuthController(
            AppDbContext context,
            IConfiguration configuration,
            AuditService audit)
        {
            _context = context;
            _configuration = configuration;
            _audit = audit;
        }

        [HttpPost("login")]
        [EnableRateLimiting("login")] // 5 attempts / minute / IP -> 429
        public async Task<ActionResult> Login(LoginDto request)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(user => user.Username == request.Username);

            if (user == null)
            {
                return Unauthorized("Invalid username or password");
            }

            if (!user.IsActive)
            {
                return Unauthorized("This account is inactive");
            }

            var passwordIsValid = BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash
            );

            if (!passwordIsValid)
            {
                return Unauthorized("Invalid username or password");
            }

            var token = GenerateJwtToken(
                user.Id,
                user.FullName,
                user.Username,
                user.Role
            );

            await _audit.LogAsync(
                action: "Login",
                entityType: "User",
                entityId: user.Id,
                entityName: user.Username,
                description: $"{user.FullName} signed in",
                userOverride: user);

            return Ok(new
            {
                message = "Login successful",
                token,
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Username,
                    user.Role,
                    user.IsActive
                }
            });
        }

        private string GenerateJwtToken(int userId, string fullName, string username, string role)
        {
            var jwtKey = _configuration["Jwt:Key"];
            var jwtIssuer = _configuration["Jwt:Issuer"];
            var jwtAudience = _configuration["Jwt:Audience"];
            var expiresInHours = int.Parse(_configuration["Jwt:ExpiresInHours"] ?? "8");

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim("FullName", fullName),
                new Claim(ClaimTypes.Role, role)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!));

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256
            );

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.Now.AddHours(expiresInHours),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
