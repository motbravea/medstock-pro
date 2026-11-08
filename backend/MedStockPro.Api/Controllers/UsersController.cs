using System.Security.Claims;
using MedStockPro.Api.Data;
using MedStockPro.Api.DTOs;
using MedStockPro.Api.Models;
using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditService _audit;

        public UsersController(AppDbContext context, AuditService audit)
        {
            _context = context;
            _audit = audit;
        }

        private int? GetCurrentUserId()
        {
            var idText = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idText, out var id) ? id : null;
        }

        [HttpGet]
        public async Task<ActionResult> GetUsers()
        {
            var users = await _context.Users
                .OrderBy(u => u.FullName)
                .Select(user => new
                {
                    user.Id,
                    user.FullName,
                    user.Username,
                    user.Role,
                    user.IsActive,
                    user.CreatedAt
                })
                .ToListAsync();

            return Ok(users);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult> GetUserById(int id)
        {
            var user = await _context.Users
                .Where(user => user.Id == id)
                .Select(user => new
                {
                    user.Id,
                    user.FullName,
                    user.Username,
                    user.Role,
                    user.IsActive,
                    user.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return NotFound("User not found");
            }

            return Ok(user);
        }

        [HttpPost]
        public async Task<ActionResult> CreateUser(CreateUserDto request)
        {
            var usernameExists = await _context.Users
                .AnyAsync(user => user.Username == request.Username);

            if (usernameExists)
            {
                return BadRequest("Username already exists");
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

            var user = new User
            {
                FullName = request.FullName,
                Username = request.Username,
                PasswordHash = passwordHash,
                Role = request.Role,
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action: "UserCreated",
                entityType: "User",
                entityId: user.Id,
                entityName: user.Username,
                description: $"Created user '{user.Username}' (role {user.Role})",
                newValues: new { user.Username, user.FullName, user.Role });

            return Ok(new
            {
                message = "User created successfully",
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Username,
                    user.Role,
                    user.IsActive,
                    user.CreatedAt
                }
            });
        }

        // PUT: api/Users/5
        // Update full name, username, or role. Password is NOT touched here.
        [HttpPut("{id:int}")]
        public async Task<ActionResult> UpdateUser(int id, UpdateUserDto request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("User not found");

            // Username uniqueness across ALL rows except this user — never
            // reuse a username, even one belonging to a deactivated account.
            var usernameTaken = await _context.Users
                .AnyAsync(u => u.Username == request.Username && u.Id != id);
            if (usernameTaken)
            {
                return BadRequest("Username already exists");
            }

            // An admin must not be able to demote themselves to Staff — that
            // would lock them out of /Users immediately and is almost always
            // an accident. Other admins can still change this user's role.
            var currentUserId = GetCurrentUserId();
            if (currentUserId == id && user.Role == "Admin" && request.Role != "Admin")
            {
                return BadRequest(
                    "You cannot change your own role. Ask another admin to do it.");
            }

            var oldSnapshot = new { user.FullName, user.Username, user.Role };

            user.FullName = request.FullName;
            user.Username = request.Username;
            user.Role = request.Role;

            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action: "UserUpdated",
                entityType: "User",
                entityId: user.Id,
                entityName: user.Username,
                description:
                    $"Updated user '{user.Username}' " +
                    $"(role {oldSnapshot.Role} → {user.Role})",
                oldValues: oldSnapshot,
                newValues: new { user.FullName, user.Username, user.Role });

            return Ok(new
            {
                message = "User updated successfully",
                user = new
                {
                    user.Id,
                    user.FullName,
                    user.Username,
                    user.Role,
                    user.IsActive,
                    user.CreatedAt
                }
            });
        }

        // POST: api/Users/5/change-password
        // Admin sets a brand-new password for the user. Only the new
        // password is asked for. The hash is replaced; the old hash is
        // never returned or echoed back.
        [HttpPost("{id:int}/change-password")]
        public async Task<ActionResult> ChangePassword(int id, ChangePasswordDto request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("User not found");

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            await _context.SaveChangesAsync();

            // IMPORTANT: do NOT include the password or the hash in the
            // audit values. We only log the fact that a change happened.
            await _audit.LogAsync(
                action: "PasswordChanged",
                entityType: "User",
                entityId: user.Id,
                entityName: user.Username,
                description: $"Password changed for '{user.Username}'");

            return Ok(new { message = "Password updated successfully" });
        }

        // PUT: api/Users/5/activate
        [HttpPut("{id:int}/activate")]
        public async Task<ActionResult> Activate(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("User not found");

            if (user.IsActive)
            {
                return Ok(new { message = "User is already active" });
            }

            user.IsActive = true;
            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action: "UserActivated",
                entityType: "User",
                entityId: user.Id,
                entityName: user.Username,
                description: $"Activated user '{user.Username}'");

            return Ok(new { message = "User activated" });
        }

        // PUT: api/Users/5/deactivate
        [HttpPut("{id:int}/deactivate")]
        public async Task<ActionResult> Deactivate(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("User not found");

            // Self-deactivation lock — an admin would immediately lose
            // access and be unable to undo it from the UI.
            var currentUserId = GetCurrentUserId();
            if (currentUserId == id)
            {
                return BadRequest(
                    "You cannot deactivate your own account. " +
                    "Ask another admin to do it.");
            }

            // Last-admin lock — never let the system drop to zero active
            // admins, otherwise no one can manage users afterwards.
            if (user.Role == "Admin" && user.IsActive)
            {
                var activeAdminCount = await _context.Users
                    .CountAsync(u => u.Role == "Admin" && u.IsActive);
                if (activeAdminCount <= 1)
                {
                    return BadRequest(
                        "This is the last active admin. " +
                        "Promote another user to Admin first.");
                }
            }

            if (!user.IsActive)
            {
                return Ok(new { message = "User is already inactive" });
            }

            user.IsActive = false;
            await _context.SaveChangesAsync();

            await _audit.LogAsync(
                action: "UserDeactivated",
                entityType: "User",
                entityId: user.Id,
                entityName: user.Username,
                description: $"Deactivated user '{user.Username}'");

            return Ok(new { message = "User deactivated" });
        }
    }
}
