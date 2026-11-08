using MedStockPro.Api.Data;
using MedStockPro.Api.DTOs;
using MedStockPro.Api.Models;
using MedStockPro.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoriesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditService _audit;

        public CategoriesController(AppDbContext context, AuditService audit)
        {
            _context = context;
            _audit = audit;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult> GetCategories()
        {
            var categories = await _context.Categories
                .Where(category => category.IsActive)
                .OrderBy(category => category.Name)
                .Select(category => new
                {
                    category.Id,
                    category.Name,
                    category.Description,
                    category.IsActive,
                    category.CreatedAt
                })
                .ToListAsync();

            return Ok(categories);
        }

        [HttpGet("{id:int}")]
        [Authorize]
        public async Task<ActionResult> GetCategoryById(int id)
        {
            var category = await _context.Categories
                .Where(category => category.Id == id && category.IsActive)
                .Select(category => new
                {
                    category.Id,
                    category.Name,
                    category.Description,
                    category.IsActive,
                    category.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (category == null) return NotFound("Category not found");
            return Ok(category);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CreateCategory(CategoryDto request)
        {
            // Look up by name case-insensitive across BOTH active and inactive
            // rows. If an inactive row already exists we re-activate it instead
            // of inserting a new one — keeps history clean and matches the
            // user expectation that "deleted" categories are just hidden.
            var existing = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name.ToLower() == request.Name.ToLower());

            if (existing != null && existing.IsActive)
            {
                return BadRequest("Category already exists");
            }

            if (existing != null && !existing.IsActive)
            {
                // Reactivate the soft-deleted row with the new description.
                existing.IsActive = true;
                existing.Description = request.Description;
                await _context.SaveChangesAsync();

                await _audit.LogAsync(
                    "CategoryReactivated",
                    "Category",
                    existing.Id,
                    existing.Name,
                    $"Reactivated category '{existing.Name}'",
                    newValues: new { existing.Name, existing.Description });

                return Ok(new { message = "Category reactivated", category = existing });
            }

            var category = new Category
            {
                Name = request.Name,
                Description = request.Description,
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("CategoryCreated", "Category", category.Id, category.Name,
                $"Created category '{category.Name}'", newValues: new { category.Name, category.Description });

            return Ok(new { message = "Category created successfully", category });
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateCategory(int id, CategoryDto request)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound("Category not found");

            // Only ACTIVE other rows count — a deactivated category with the
            // same name should never block a rename.
            var nameExists = await _context.Categories
                .AnyAsync(c =>
                    c.IsActive &&
                    c.Name.ToLower() == request.Name.ToLower() &&
                    c.Id != id);
            if (nameExists) return BadRequest("Category name already exists");

            var old = new { category.Name, category.Description };
            category.Name = request.Name;
            category.Description = request.Description;
            await _context.SaveChangesAsync();

            await _audit.LogAsync("CategoryUpdated", "Category", category.Id, category.Name,
                $"Updated category '{category.Name}'",
                oldValues: old,
                newValues: new { category.Name, category.Description });

            return Ok(new { message = "Category updated successfully", category });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null) return NotFound("Category not found");

            category.IsActive = false;
            await _context.SaveChangesAsync();

            await _audit.LogAsync("CategoryDeactivated", "Category", category.Id, category.Name,
                $"Deactivated category '{category.Name}'");

            return Ok(new { message = "Category deactivated successfully" });
        }

        // ─────────────────────────────────────────────────────────────────
        //  Category-side convenience endpoint.
        //  Returns the category, every product that belongs to it, and a
        //  pre-aggregated set of counts (low/out/expiring/expired) so the
        //  drawer can show the stat tiles without a second round-trip.
        //  Mutations (add/remove product) still call the existing product-
        //  side endpoints — no duplication.
        // ─────────────────────────────────────────────────────────────────
        [HttpGet("{categoryId:int}/products")]
        [Authorize]
        public async Task<ActionResult> GetCategoryProducts(int categoryId)
        {
            var category = await _context.Categories
                .Where(c => c.Id == categoryId && c.IsActive)
                .Select(c => new { c.Id, c.Name, c.Description })
                .FirstOrDefaultAsync();
            if (category == null) return NotFound("Category not found");

            var products = await _context.ProductCategories
                .Where(pc => pc.CategoryId == categoryId)
                .Include(pc => pc.Product)
                .Where(pc => pc.Product != null && pc.Product.IsActive)
                .OrderBy(pc => pc.Product!.Name)
                .Select(pc => new
                {
                    pc.Product!.Id,
                    pc.Product.Name,
                    pc.Product.Description,
                    pc.Product.PhotoPath,
                    pc.Product.CurrentStock,
                    pc.Product.MinimumStock,
                    pc.Product.ExpiryDate,
                    pc.Product.ExpiryAlertDays,
                    pc.Product.InternalBarcode,
                })
                .ToListAsync();

            // Counts use the same rules as AlertService.
            var today = DateTime.Today;
            int low = 0, outCount = 0, expiring = 0, expired = 0;
            foreach (var p in products)
            {
                // Stock state
                if (p.CurrentStock <= 0) outCount++;
                else if (p.MinimumStock > 0 && p.CurrentStock <= p.MinimumStock) low++;
                else if (p.MinimumStock == 0 && p.CurrentStock == 1) low++;

                // Expiry state
                if (p.ExpiryDate is DateTime exp)
                {
                    var expDay = exp.Date;
                    if (expDay < today) expired++;
                    else if ((expDay - today).TotalDays <= p.ExpiryAlertDays) expiring++;
                }
            }

            return Ok(new
            {
                category.Id,
                category.Name,
                category.Description,
                totalProducts = products.Count,
                lowStockCount = low,
                outOfStockCount = outCount,
                expiringCount = expiring,
                expiredCount = expired,
                products,
            });
        }
    }
}
