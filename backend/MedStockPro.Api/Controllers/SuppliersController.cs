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
    public class SuppliersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditService _audit;

        public SuppliersController(AppDbContext context, AuditService audit)
        {
            _context = context;
            _audit = audit;
        }

        [HttpGet]
        [Authorize]
        public async Task<ActionResult> GetSuppliers()
        {
            var suppliers = await _context.Suppliers
                .Where(s => s.IsActive)
                .OrderBy(s => s.Name)
                .Select(s => new { s.Id, s.Name, s.PhoneNumber, s.Email, s.Address, s.Notes, s.IsActive, s.CreatedAt })
                .ToListAsync();
            return Ok(suppliers);
        }

        [HttpGet("{id:int}")]
        [Authorize]
        public async Task<ActionResult> GetSupplierById(int id)
        {
            var supplier = await _context.Suppliers
                .Where(s => s.Id == id && s.IsActive)
                .Select(s => new { s.Id, s.Name, s.PhoneNumber, s.Email, s.Address, s.Notes, s.IsActive, s.CreatedAt })
                .FirstOrDefaultAsync();
            if (supplier == null) return NotFound("Supplier not found");
            return Ok(supplier);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CreateSupplier(SupplierDto request)
        {
            // Look across active + inactive rows. If a soft-deleted supplier
            // with this name already exists, reactivate it (carry the new
            // contact info) instead of inserting a duplicate.
            var existing = await _context.Suppliers
                .FirstOrDefaultAsync(s => s.Name.ToLower() == request.Name.ToLower());

            if (existing != null && existing.IsActive)
            {
                return BadRequest("Supplier already exists");
            }

            if (existing != null && !existing.IsActive)
            {
                existing.IsActive = true;
                existing.PhoneNumber = request.PhoneNumber;
                existing.Email = request.Email;
                existing.Address = request.Address;
                existing.Notes = request.Notes;
                await _context.SaveChangesAsync();

                await _audit.LogAsync(
                    "SupplierReactivated",
                    "Supplier",
                    existing.Id,
                    existing.Name,
                    $"Reactivated supplier '{existing.Name}'",
                    newValues: new { existing.Name, existing.PhoneNumber, existing.Email });

                return Ok(new { message = "Supplier reactivated", supplier = existing });
            }

            var supplier = new Supplier
            {
                Name = request.Name,
                PhoneNumber = request.PhoneNumber,
                Email = request.Email,
                Address = request.Address,
                Notes = request.Notes,
                IsActive = true,
                CreatedAt = DateTime.Now
            };
            _context.Suppliers.Add(supplier);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("SupplierCreated", "Supplier", supplier.Id, supplier.Name,
                $"Created supplier '{supplier.Name}'",
                newValues: new { supplier.Name, supplier.PhoneNumber, supplier.Email });

            return Ok(new { message = "Supplier created successfully", supplier });
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateSupplier(int id, SupplierDto request)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound("Supplier not found");

            // Only ACTIVE other rows count.
            var nameExists = await _context.Suppliers
                .AnyAsync(s =>
                    s.IsActive &&
                    s.Name.ToLower() == request.Name.ToLower() &&
                    s.Id != id);
            if (nameExists) return BadRequest("Supplier name already exists");

            var old = new { supplier.Name, supplier.PhoneNumber, supplier.Email, supplier.Address };
            supplier.Name = request.Name;
            supplier.PhoneNumber = request.PhoneNumber;
            supplier.Email = request.Email;
            supplier.Address = request.Address;
            supplier.Notes = request.Notes;
            await _context.SaveChangesAsync();

            await _audit.LogAsync("SupplierUpdated", "Supplier", supplier.Id, supplier.Name,
                $"Updated supplier '{supplier.Name}'",
                oldValues: old,
                newValues: new { supplier.Name, supplier.PhoneNumber, supplier.Email, supplier.Address });

            return Ok(new { message = "Supplier updated successfully", supplier });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteSupplier(int id)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound("Supplier not found");

            supplier.IsActive = false;
            await _context.SaveChangesAsync();

            await _audit.LogAsync("SupplierDeactivated", "Supplier", supplier.Id, supplier.Name,
                $"Deactivated supplier '{supplier.Name}'");

            return Ok(new { message = "Supplier deactivated successfully" });
        }

        // ─────────────────────────────────────────────────────────────────
        //  Supplier-side convenience endpoint.
        //  Returns every product this supplier carries together with the
        //  pricing/barcode/preferred metadata from the ProductSupplier link.
        //  Mutations (add product, update price, remove link) still go
        //  through the existing product-side endpoints — no duplication.
        // ─────────────────────────────────────────────────────────────────
        [HttpGet("{supplierId:int}/products")]
        [Authorize]
        public async Task<ActionResult> GetSupplierProducts(int supplierId)
        {
            var supplier = await _context.Suppliers
                .Where(s => s.Id == supplierId && s.IsActive)
                .Select(s => new { s.Id, s.Name })
                .FirstOrDefaultAsync();
            if (supplier == null) return NotFound("Supplier not found");

            var rows = await _context.ProductSuppliers
                .Where(ps => ps.SupplierId == supplierId)
                .Include(ps => ps.Product)
                .Where(ps => ps.Product != null && ps.Product.IsActive)
                .OrderByDescending(ps => ps.IsPreferredSupplier)
                .ThenBy(ps => ps.Product!.Name)
                .Select(ps => new
                {
                    // ProductSupplier link fields (same shape the product-
                    // side endpoint uses, so the frontend can share types).
                    ProductSupplierId = ps.Id,
                    ps.ProductId,
                    ProductName = ps.Product!.Name,
                    ps.Product.Description,
                    ps.Product.PhotoPath,
                    ps.Product.CurrentStock,
                    ps.Product.MinimumStock,
                    ps.Product.ExpiryDate,
                    ps.Product.InternalBarcode,
                    // Price / barcode / preferred / lastPurchase from the link.
                    ps.SupplierBarcode,
                    ps.Price,
                    ps.LastPurchaseDate,
                    ps.IsPreferredSupplier,
                })
                .ToListAsync();

            return Ok(rows);
        }
    }
}
