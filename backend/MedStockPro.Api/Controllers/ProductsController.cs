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
    public class ProductsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly AuditService _audit;
        private readonly AlertService _alertService;
        private readonly StoragePaths _storage;

        public ProductsController(
            AppDbContext context,
            AuditService audit,
            AlertService alertService,
            StoragePaths storage)
        {
            _context = context;
            _audit = audit;
            _alertService = alertService;
            _storage = storage;
        }

        // GET: api/Products
        // Returns every active product enriched with the data the product
        // list page needs: categories, supplier count, supplier-barcode
        // values (so client-side search can match them), and a setup-ready
        // flag matching the rules in /setup-status. Done with three batched
        // queries + in-memory join — no N+1.
        [HttpGet]
        [Authorize]
        public async Task<ActionResult> GetProducts()
        {
            return Ok(await BuildProductsListResponseAsync(query: null));
        }

        // GET: api/Products/5
        // Admin and Staff can view one product
        [HttpGet("{id}")]
        [Authorize]
        public async Task<ActionResult> GetProductById(int id)
        {
            var product = await _context.Products
                .Where(product => product.Id == id && product.IsActive)
                .Select(product => new
                {
                    product.Id,
                    product.Name,
                    product.Description,
                    product.PhotoPath,
                    product.CurrentStock,
                    product.MinimumStock,
                    product.ExpiryDate,
                    product.ExpiryAlertDays,
                    product.InternalBarcode,
                    product.IsActive,
                    product.CreatedAt,
                    product.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (product == null)
            {
                return NotFound("Product not found");
            }

            return Ok(product);
        }

        // GET: api/Products/search?query=gloves
        // Same enriched shape as GetProducts, server-side filtered.
        // Matches against: name, description, internal barcode, supplier
        // barcode (any ProductBarcode value, type Supplier/External).
        [HttpGet("search")]
        [Authorize]
        public async Task<ActionResult> SearchProducts([FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return BadRequest("Search query is required");
            }

            return Ok(await BuildProductsListResponseAsync(query));
        }

        // Internal helper that powers both list endpoints.
        // Pass query=null for full list, or a non-empty string to filter.
        private async Task<List<object>> BuildProductsListResponseAsync(string? query)
        {
            var q = query?.ToLower();

            // If we're searching, look up the set of products whose ANY
            // active barcode (internal/supplier/external) contains the query.
            // Returned as a List<int> (not HashSet) so EF can translate the
            // .Contains() call to SQL on the products query below.
            List<int>? matchingByBarcode = null;
            if (!string.IsNullOrWhiteSpace(q))
            {
                matchingByBarcode = await _context.ProductBarcodes
                    .Where(b => b.IsActive && b.BarcodeValue.ToLower().Contains(q))
                    .Select(b => b.ProductId)
                    .Distinct()
                    .ToListAsync();
            }

            var productsQuery = _context.Products.Where(p => p.IsActive);
            if (q != null)
            {
                productsQuery = productsQuery.Where(p =>
                    p.Name.ToLower().Contains(q) ||
                    p.Description.ToLower().Contains(q) ||
                    p.InternalBarcode.ToLower().Contains(q) ||
                    matchingByBarcode!.Contains(p.Id));
            }

            var products = await productsQuery
                .OrderBy(p => p.Name)
                .ToListAsync();

            if (products.Count == 0) return new List<object>();

            var productIds = products.Select(p => p.Id).ToList();

            // Batch lookups — one round-trip per relation.
            var categoryRows = await _context.ProductCategories
                .Where(pc => productIds.Contains(pc.ProductId))
                .Include(pc => pc.Category)
                .Where(pc => pc.Category != null && pc.Category.IsActive)
                .Select(pc => new { pc.ProductId, pc.Category!.Id, pc.Category.Name })
                .ToListAsync();

            var supplierLinkIds = await _context.ProductSuppliers
                .Where(ps => productIds.Contains(ps.ProductId))
                .Select(ps => ps.ProductId)
                .ToListAsync();

            var barcodeRows = await _context.ProductBarcodes
                .Where(b => productIds.Contains(b.ProductId) && b.IsActive)
                .Select(b => new { b.ProductId, b.BarcodeType, b.BarcodeValue })
                .ToListAsync();

            // Stitch.
            var categoriesByProduct = categoryRows
                .GroupBy(r => r.ProductId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(r => new { r.Id, r.Name }).ToList());

            var supplierCountByProduct = supplierLinkIds
                .GroupBy(id => id)
                .ToDictionary(g => g.Key, g => g.Count());

            var supplierBarcodesByProduct = barcodeRows
                .Where(b => b.BarcodeType == "Supplier" || b.BarcodeType == "External")
                .GroupBy(b => b.ProductId)
                .ToDictionary(g => g.Key, g => g.Select(b => b.BarcodeValue).ToList());

            var hasInternalBarcodeRow = new HashSet<int>(
                barcodeRows.Where(b => b.BarcodeType == "Internal").Select(b => b.ProductId));

            return products.Select(p =>
            {
                var hasInternalBarcode =
                    hasInternalBarcodeRow.Contains(p.Id) ||
                    !string.IsNullOrWhiteSpace(p.InternalBarcode);
                var hasCategory = categoriesByProduct.ContainsKey(p.Id);
                var hasSupplier = supplierCountByProduct.ContainsKey(p.Id);
                var hasMinimumStock = p.MinimumStock > 0;
                var hasExpirySettings = p.ExpiryAlertDays > 0;

                return (object)new
                {
                    p.Id,
                    p.Name,
                    p.Description,
                    // Canonical path + absolute URL so images resolve on the
                    // main computer AND on client PCs.
                    PhotoPath = PhotoPaths.Normalize(p.PhotoPath),
                    PhotoUrl = PhotoPaths.ToUrl(p.PhotoPath, Request),
                    p.CurrentStock,
                    p.MinimumStock,
                    p.ExpiryDate,
                    p.ExpiryAlertDays,
                    p.InternalBarcode,
                    p.IsActive,
                    p.CreatedAt,
                    p.UpdatedAt,

                    // ── Enrichment used by the products list page ──────────
                    Categories = categoriesByProduct.GetValueOrDefault(p.Id, new()),
                    SupplierCount = supplierCountByProduct.GetValueOrDefault(p.Id, 0),
                    SupplierBarcodes = supplierBarcodesByProduct.GetValueOrDefault(p.Id, new()),
                    HasInternalBarcode = hasInternalBarcode,
                    IsSetupReady =
                        hasInternalBarcode &&
                        hasCategory &&
                        hasSupplier &&
                        hasMinimumStock &&
                        hasExpirySettings,
                };
            }).ToList();
        }

        // POST: api/Products
        // Only Admin can create products
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> CreateProduct(CreateProductDto request)
        {
            // Uniqueness only applies when a real barcode value was provided.
            // Several products are allowed to have an empty InternalBarcode
            // (the DB-level filtered index already permits this) — the check
            // here must mirror that or the user gets a false "exists" error
            // on every new product they leave blank.
            if (!string.IsNullOrWhiteSpace(request.InternalBarcode))
            {
                var barcodeExists = await _context.Products
                    .AnyAsync(product => product.InternalBarcode == request.InternalBarcode);

                if (barcodeExists)
                {
                    return BadRequest("Internal barcode already exists");
                }
            }

            var product = new Product
            {
                Name = request.Name,
                Description = request.Description,
                PhotoPath = request.PhotoPath,
                CurrentStock = request.CurrentStock,
                MinimumStock = request.MinimumStock,
                ExpiryDate = request.ExpiryDate,
                ExpiryAlertDays = request.ExpiryAlertDays,
                InternalBarcode = request.InternalBarcode,
                IsActive = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            // Newly-created products can already need attention — a product
            // entered with stock=0 or stock<=minimum must surface immediately
            // without waiting for the first stock movement.
            await _alertService.CheckLowStockAlert(product);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductCreated", "Product", product.Id, product.Name,
                $"Created product '{product.Name}' (stock {product.CurrentStock}, min {product.MinimumStock})",
                newValues: new { product.Name, product.CurrentStock, product.MinimumStock, product.InternalBarcode });

            return Ok(new { message = "Product created successfully", product });
        }

        // PUT: api/Products/5
        // Admin AND Staff can update products.
        [HttpPut("{id}")]
        [Authorize]
        public async Task<ActionResult> UpdateProduct(int id, UpdateProductDto request)
        {
            var product = await _context.Products.FindAsync(id);

            if (product == null)
            {
                return NotFound("Product not found");
            }

            var oldSnapshot = new
            {
                product.Name,
                product.Description,
                product.CurrentStock,
                product.MinimumStock,
                product.ExpiryDate,
                product.ExpiryAlertDays,
                product.InternalBarcode,
                product.IsActive,
            };

            // Same fix as Create: blank InternalBarcode is allowed on any
            // number of products, so only enforce uniqueness when the user
            // actually typed something.
            if (!string.IsNullOrWhiteSpace(request.InternalBarcode))
            {
                var barcodeExists = await _context.Products
                    .AnyAsync(existingProduct =>
                        existingProduct.InternalBarcode == request.InternalBarcode &&
                        existingProduct.Id != id
                    );

                if (barcodeExists)
                {
                    return BadRequest("Internal barcode already exists");
                }
            }

            product.Name = request.Name;
            product.Description = request.Description;
            product.PhotoPath = request.PhotoPath;
            product.CurrentStock = request.CurrentStock;
            product.MinimumStock = request.MinimumStock;
            product.ExpiryDate = request.ExpiryDate;
            product.ExpiryAlertDays = request.ExpiryAlertDays;
            product.InternalBarcode = request.InternalBarcode;
            product.IsActive = request.IsActive;
            product.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            // Re-evaluate low-stock state with the updated min/current values.
            await _alertService.CheckLowStockAlert(product);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductUpdated", "Product", product.Id, product.Name,
                $"Updated product '{product.Name}'",
                oldValues: oldSnapshot,
                newValues: new
                {
                    product.Name,
                    product.Description,
                    product.CurrentStock,
                    product.MinimumStock,
                    product.ExpiryDate,
                    product.ExpiryAlertDays,
                    product.InternalBarcode,
                    product.IsActive,
                });

            return Ok(new { message = "Product updated successfully", product });
        }

        // DELETE: api/Products/5
        // Only Admin can deactivate products
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products.FindAsync(id);

            if (product == null)
            {
                return NotFound("Product not found");
            }

            product.IsActive = false;
            product.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductDeactivated", "Product", product.Id, product.Name,
                $"Deactivated product '{product.Name}'");

            return Ok(new { message = "Product deactivated successfully" });
        }
                // GET: api/Products/1/categories
        // Admin and Staff can view product categories
        [HttpGet("{productId:int}/categories")]
        [Authorize]
        public async Task<ActionResult> GetProductCategories(int productId)
        {
            var productExists = await _context.Products
                .AnyAsync(product => product.Id == productId && product.IsActive);

            if (!productExists)
            {
                return NotFound("Product not found");
            }

            var categories = await _context.ProductCategories
                .Where(productCategory => productCategory.ProductId == productId)
                .Include(productCategory => productCategory.Category)
                .Where(productCategory => productCategory.Category != null && productCategory.Category.IsActive)
                .Select(productCategory => new
                {
                    productCategory.Category!.Id,
                    productCategory.Category.Name,
                    productCategory.Category.Description
                })
                .ToListAsync();

            return Ok(categories);
        }

        // POST: api/Products/1/categories/2
        // Only Admin can assign a category to a product
        [HttpPost("{productId:int}/categories/{categoryId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> AddCategoryToProduct(int productId, int categoryId)
        {
            var product = await _context.Products.FindAsync(productId);

            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var category = await _context.Categories.FindAsync(categoryId);

            if (category == null || !category.IsActive)
            {
                return NotFound("Category not found");
            }

            var alreadyLinked = await _context.ProductCategories
                .AnyAsync(productCategory =>
                    productCategory.ProductId == productId &&
                    productCategory.CategoryId == categoryId
                );

            if (alreadyLinked)
            {
                return BadRequest("This category is already assigned to the product");
            }

            var productCategoryLink = new ProductCategory
            {
                ProductId = productId,
                CategoryId = categoryId
            };

            _context.ProductCategories.Add(productCategoryLink);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductCategoryLinked", "Product", product.Id, product.Name,
                $"Linked category '{category.Name}' to product '{product.Name}'");

            return Ok(new
            {
                message = "Category assigned to product successfully",
                product = product.Name,
                category = category.Name
            });
        }

        // DELETE: api/Products/1/categories/2
        // Only Admin can remove a category from a product
        [HttpDelete("{productId:int}/categories/{categoryId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> RemoveCategoryFromProduct(int productId, int categoryId)
        {
            var productCategoryLink = await _context.ProductCategories
                .FirstOrDefaultAsync(productCategory =>
                    productCategory.ProductId == productId &&
                    productCategory.CategoryId == categoryId
                );

            if (productCategoryLink == null)
            {
                return NotFound("Category is not assigned to this product");
            }

            _context.ProductCategories.Remove(productCategoryLink);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductCategoryUnlinked", "Product", productId, "",
                $"Removed category {categoryId} from product {productId}");

            return Ok(new
            {
                message = "Category removed from product successfully"
            });
        }
                // GET: api/Products/1/suppliers
        // Admin and Staff can view suppliers linked to a product
        [HttpGet("{productId:int}/suppliers")]
        [Authorize]
        public async Task<ActionResult> GetProductSuppliers(int productId)
        {
            var productExists = await _context.Products
                .AnyAsync(product => product.Id == productId && product.IsActive);

            if (!productExists)
            {
                return NotFound("Product not found");
            }

            var suppliers = await _context.ProductSuppliers
                .Where(productSupplier => productSupplier.ProductId == productId)
                .Include(productSupplier => productSupplier.Supplier)
                .Where(productSupplier =>
                    productSupplier.Supplier != null &&
                    productSupplier.Supplier.IsActive
                )
                .Select(productSupplier => new
                {
                    productSupplier.Id,
                    productSupplier.SupplierId,
                    SupplierName = productSupplier.Supplier!.Name,
                    productSupplier.Supplier!.PhoneNumber,
                    productSupplier.Supplier!.Email,
                    productSupplier.SupplierBarcode,
                    productSupplier.Price,
                    productSupplier.LastPurchaseDate,
                    productSupplier.IsPreferredSupplier
                })
                .ToListAsync();

            return Ok(suppliers);
        }

        // POST: api/Products/1/suppliers
        // Only Admin can link a supplier to a product
        [HttpPost("{productId:int}/suppliers")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> AddSupplierToProduct(
            int productId,
            ProductSupplierDto request
        )
        {
            var product = await _context.Products.FindAsync(productId);

            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var supplier = await _context.Suppliers.FindAsync(request.SupplierId);

            if (supplier == null || !supplier.IsActive)
            {
                return NotFound("Supplier not found");
            }

            var alreadyLinked = await _context.ProductSuppliers
                .AnyAsync(productSupplier =>
                    productSupplier.ProductId == productId &&
                    productSupplier.SupplierId == request.SupplierId
                );

            if (alreadyLinked)
            {
                return BadRequest("This supplier is already linked to the product");
            }

            if (request.IsPreferredSupplier)
            {
                var existingPreferredSuppliers = await _context.ProductSuppliers
                    .Where(productSupplier => productSupplier.ProductId == productId)
                    .ToListAsync();

                foreach (var existingSupplier in existingPreferredSuppliers)
                {
                    existingSupplier.IsPreferredSupplier = false;
                }
            }

            var productSupplierLink = new ProductSupplier
            {
                ProductId = productId,
                SupplierId = request.SupplierId,
                SupplierBarcode = request.SupplierBarcode,
                Price = request.Price,
                LastPurchaseDate = request.LastPurchaseDate,
                IsPreferredSupplier = request.IsPreferredSupplier
            };

            _context.ProductSuppliers.Add(productSupplierLink);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductSupplierLinked", "Product", product.Id, product.Name,
                $"Linked supplier '{supplier.Name}' to product '{product.Name}' (price {request.Price})",
                newValues: new { supplier.Name, request.Price, request.IsPreferredSupplier });

            return Ok(new
            {
                message = "Supplier linked to product successfully",
                product = product.Name,
                supplier = supplier.Name,
                productSupplier = productSupplierLink
            });
        }

        // PUT: api/Products/1/suppliers/3
        // Only Admin can update supplier price/barcode/preferred status for a product
        [HttpPut("{productId:int}/suppliers/{productSupplierId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateProductSupplier(
            int productId,
            int productSupplierId,
            ProductSupplierDto request
        )
        {
            var productSupplier = await _context.ProductSuppliers
                .FirstOrDefaultAsync(productSupplier =>
                    productSupplier.Id == productSupplierId &&
                    productSupplier.ProductId == productId
                );

            if (productSupplier == null)
            {
                return NotFound("Product supplier link not found");
            }

            var supplier = await _context.Suppliers.FindAsync(request.SupplierId);

            if (supplier == null || !supplier.IsActive)
            {
                return NotFound("Supplier not found");
            }

            var duplicateSupplier = await _context.ProductSuppliers
                .AnyAsync(existingProductSupplier =>
                    existingProductSupplier.ProductId == productId &&
                    existingProductSupplier.SupplierId == request.SupplierId &&
                    existingProductSupplier.Id != productSupplierId
                );

            if (duplicateSupplier)
            {
                return BadRequest("This supplier is already linked to the product");
            }

            if (request.IsPreferredSupplier)
            {
                var existingPreferredSuppliers = await _context.ProductSuppliers
                    .Where(existingProductSupplier =>
                        existingProductSupplier.ProductId == productId &&
                        existingProductSupplier.Id != productSupplierId
                    )
                    .ToListAsync();

                foreach (var existingSupplier in existingPreferredSuppliers)
                {
                    existingSupplier.IsPreferredSupplier = false;
                }
            }

            productSupplier.SupplierId = request.SupplierId;
            productSupplier.SupplierBarcode = request.SupplierBarcode;
            productSupplier.Price = request.Price;
            productSupplier.LastPurchaseDate = request.LastPurchaseDate;
            productSupplier.IsPreferredSupplier = request.IsPreferredSupplier;

            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductSupplierUpdated", "Product", productId, "",
                $"Updated supplier {productSupplier.SupplierId} on product {productId}",
                newValues: new { request.Price, request.IsPreferredSupplier });

            return Ok(new
            {
                message = "Product supplier updated successfully",
                productSupplier
            });
        }

        // DELETE: api/Products/1/suppliers/3
        // Only Admin can remove supplier from product
        [HttpDelete("{productId:int}/suppliers/{productSupplierId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> RemoveSupplierFromProduct(
            int productId,
            int productSupplierId
        )
        {
            var productSupplier = await _context.ProductSuppliers
                .FirstOrDefaultAsync(productSupplier =>
                    productSupplier.Id == productSupplierId &&
                    productSupplier.ProductId == productId
                );

            if (productSupplier == null)
            {
                return NotFound("Product supplier link not found");
            }

            _context.ProductSuppliers.Remove(productSupplier);
            await _context.SaveChangesAsync();

            await _audit.LogAsync("ProductSupplierUnlinked", "Product", productId, "",
                $"Removed supplier link {productSupplierId} from product {productId}");

            return Ok(new
            {
                message = "Supplier removed from product successfully"
            });
        }
                // GET: api/Products/1/barcodes
        // Admin and Staff can view barcodes linked to a product
        [HttpGet("{productId:int}/barcodes")]
        [Authorize]
        public async Task<ActionResult> GetProductBarcodes(int productId)
        {
            var productExists = await _context.Products
                .AnyAsync(product => product.Id == productId && product.IsActive);

            if (!productExists)
            {
                return NotFound("Product not found");
            }

            var barcodes = await _context.ProductBarcodes
                .Where(barcode => barcode.ProductId == productId && barcode.IsActive)
                .OrderBy(barcode => barcode.BarcodeType)
                .Select(barcode => new
                {
                    barcode.Id,
                    barcode.ProductId,
                    barcode.BarcodeValue,
                    barcode.BarcodeType,
                    barcode.Notes,
                    barcode.IsActive,
                    barcode.CreatedAt
                })
                .ToListAsync();

            return Ok(barcodes);
        }

        // POST: api/Products/1/barcodes
        // Only Admin can add a barcode to a product
        [HttpPost("{productId:int}/barcodes")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> AddBarcodeToProduct(
            int productId,
            ProductBarcodeDto request
        )
        {
            var product = await _context.Products.FindAsync(productId);

            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var barcodeExists = await _context.ProductBarcodes
                .AnyAsync(barcode =>
                    barcode.BarcodeValue == request.BarcodeValue &&
                    barcode.IsActive
                );

            if (barcodeExists)
            {
                return BadRequest("This barcode is already linked to a product");
            }

            var productBarcode = new ProductBarcode
            {
                ProductId = productId,
                BarcodeValue = request.BarcodeValue,
                BarcodeType = request.BarcodeType,
                Notes = request.Notes,
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            _context.ProductBarcodes.Add(productBarcode);

            if (request.BarcodeType.ToLower() == "internal")
            {
                product.InternalBarcode = request.BarcodeValue;
                product.UpdatedAt = DateTime.Now;
            }

            await _context.SaveChangesAsync();

            await _audit.LogAsync("BarcodeAdded", "Product", product.Id, product.Name,
                $"Added {request.BarcodeType} barcode '{request.BarcodeValue}'",
                newValues: new { request.BarcodeValue, request.BarcodeType });

            return Ok(new
            {
                message = "Barcode added to product successfully",
                product = product.Name,
                barcode = productBarcode
            });
        }

        // POST: api/Products/1/generate-barcode
        // Only Admin can generate an internal barcode for a product
        [HttpPost("{productId:int}/generate-barcode")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> GenerateInternalBarcode(int productId)
        {
            var product = await _context.Products.FindAsync(productId);

            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            var generatedBarcode = $"MSP-{product.Id.ToString().PadLeft(6, '0')}";

            var barcodeExists = await _context.ProductBarcodes
                .AnyAsync(barcode =>
                    barcode.BarcodeValue == generatedBarcode &&
                    barcode.IsActive
                );

            if (barcodeExists)
            {
                return BadRequest("Internal barcode already exists for this product");
            }

            var productBarcode = new ProductBarcode
            {
                ProductId = productId,
                BarcodeValue = generatedBarcode,
                BarcodeType = "Internal",
                Notes = "Generated by MedStock Pro",
                IsActive = true,
                CreatedAt = DateTime.Now
            };

            _context.ProductBarcodes.Add(productBarcode);

            product.InternalBarcode = generatedBarcode;
            product.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            await _audit.LogAsync("BarcodeGenerated", "Product", product.Id, product.Name,
                $"Generated internal barcode '{generatedBarcode}'",
                newValues: new { generatedBarcode });

            return Ok(new
            {
                message = "Internal barcode generated successfully",
                product = product.Name,
                barcodeValue = generatedBarcode,
                barcodeType = "Code128",
                note = "The frontend will render this value as barcode lines for printing."
            });
        }

        // GET: api/Products/by-barcode/6942080555982
        // Admin and Staff can find a product by any barcode
        [HttpGet("by-barcode/{barcodeValue}")]
        [Authorize]
        public async Task<ActionResult> GetProductByBarcode(string barcodeValue)
        {
            var barcode = await _context.ProductBarcodes
                .Include(barcode => barcode.Product)
                .FirstOrDefaultAsync(barcode =>
                    barcode.BarcodeValue == barcodeValue &&
                    barcode.IsActive &&
                    barcode.Product != null &&
                    barcode.Product.IsActive
                );

            if (barcode == null)
            {
                return NotFound("No product found for this barcode");
            }

            var product = barcode.Product!;

            return Ok(new
            {
                product.Id,
                product.Name,
                product.Description,
                PhotoPath = PhotoPaths.Normalize(product.PhotoPath),
                PhotoUrl = PhotoPaths.ToUrl(product.PhotoPath, Request),
                product.CurrentStock,
                product.MinimumStock,
                product.ExpiryDate,
                product.ExpiryAlertDays,
                product.InternalBarcode,
                scannedBarcode = barcode.BarcodeValue,
                barcodeType = barcode.BarcodeType
            });
        }

        // DELETE: api/Products/1/barcodes/3
        // Only Admin can deactivate a barcode
        [HttpDelete("{productId:int}/barcodes/{barcodeId:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteProductBarcode(int productId, int barcodeId)
        {
            var barcode = await _context.ProductBarcodes
                .FirstOrDefaultAsync(barcode =>
                    barcode.Id == barcodeId &&
                    barcode.ProductId == productId
                );

            if (barcode == null)
            {
                return NotFound("Barcode not found");
            }

            barcode.IsActive = false;

            await _context.SaveChangesAsync();

            await _audit.LogAsync("BarcodeDeactivated", "Product", productId, "",
                $"Deactivated barcode '{barcode.BarcodeValue}' on product {productId}");

            return Ok(new
            {
                message = "Barcode deactivated successfully"
            });
        }
                // POST: api/Products/1/photo
        // Only Admin can upload or replace a product photo
        [HttpPost("{productId:int}/photo")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UploadProductPhoto(
            int productId,
            IFormFile photo
        )
        {
            var product = await _context.Products.FindAsync(productId);

            if (product == null || !product.IsActive)
            {
                return NotFound("Product not found");
            }

            if (photo == null || photo.Length == 0)
            {
                return BadRequest("No photo uploaded");
            }

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            var extension = Path.GetExtension(photo.FileName).ToLower();

            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest("Only JPG, JPEG, PNG, and WEBP images are allowed");
            }

            var maxFileSizeMb = 5;
            var maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

            if (photo.Length > maxFileSizeBytes)
            {
                return BadRequest($"Photo size must be less than {maxFileSizeMb} MB");
            }

            // Save into the RESOLVED uploads root (C:\ProgramData\MedStockPro\
            // Uploads\products in production) — NOT the process working folder,
            // which is C:\Windows\System32 when running as a Windows Service.
            var uploadsFolder = Path.Combine(_storage.UploadsRoot, "products");
            Directory.CreateDirectory(uploadsFolder);

            var fileName = $"product_{product.Id}_{DateTime.Now:yyyyMMddHHmmss}{extension}";
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await photo.CopyToAsync(stream);
            }

            // Always store the canonical public path.
            product.PhotoPath = PhotoPaths.Normalize(fileName);
            product.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            await _audit.LogAsync("PhotoUploaded", "Product", product.Id, product.Name,
                $"Uploaded photo for '{product.Name}'",
                newValues: new { product.PhotoPath });

            return Ok(new
            {
                message = "Product photo uploaded successfully",
                productId = product.Id,
                productName = product.Name,
                photoPath = product.PhotoPath,
                photoUrl = PhotoPaths.ToUrl(product.PhotoPath, Request)
            });
        }
        // GET: api/Products/1/barcode-label
// Admin and Staff can get barcode label data for printing
[HttpGet("{productId:int}/barcode-label")]
[Authorize]
public async Task<ActionResult> GetBarcodeLabelData(int productId)
{
    var product = await _context.Products
        .FirstOrDefaultAsync(product => product.Id == productId && product.IsActive);

    if (product == null)
    {
        return NotFound("Product not found");
    }

    var internalBarcode = await _context.ProductBarcodes
        .Where(barcode =>
            barcode.ProductId == productId &&
            barcode.IsActive &&
            barcode.BarcodeType == "Internal"
        )
        .OrderByDescending(barcode => barcode.CreatedAt)
        .FirstOrDefaultAsync();

    if (internalBarcode == null)
    {
        return BadRequest("No internal barcode found for this product. Generate an internal barcode first.");
    }

    return Ok(new
    {
        productId = product.Id,
        productName = product.Name,
        description = product.Description,
        barcodeValue = internalBarcode.BarcodeValue,
        barcodeType = "Code128",
        labelTitle = product.Name,
        labelSubtitle = "MedStock Pro",
        currentStock = product.CurrentStock,
        minimumStock = product.MinimumStock,
        expiryDate = product.ExpiryDate,
        photoPath = product.PhotoPath,
        generatedAt = DateTime.Now
    });
}
// GET: api/Products/barcode-labels
//      api/Products/barcode-labels?categoryId=5
// Returns one label payload per active product that has an internal
// barcode. Optional categoryId restricts the batch to products that
// belong to a given category — used by the "Print by section" workflow.
// Powers the bulk-print button; the front-end stitches the labels into
// a single multi-page print job for the Zebra.
[HttpGet("barcode-labels")]
[Authorize]
public async Task<ActionResult> GetAllBarcodeLabels([FromQuery] int? categoryId)
{
    // Active internal-barcode rows, joined to their product. Filtering at
    // the DB layer avoids pulling products that would just be skipped.
    var baseQuery = _context.ProductBarcodes
        .Where(b => b.IsActive && b.BarcodeType == "Internal")
        .Join(
            _context.Products.Where(p => p.IsActive),
            b => b.ProductId,
            p => p.Id,
            (b, p) => new { Barcode = b, Product = p });

    // Optional category restriction. We reference ProductCategories with
    // an inner Any() so EF builds an EXISTS subquery — cheap and the
    // filter applies BEFORE the projection.
    if (categoryId.HasValue)
    {
        var requestedCategoryId = categoryId.Value;
        baseQuery = baseQuery.Where(x => _context.ProductCategories
            .Any(pc => pc.ProductId == x.Product.Id &&
                       pc.CategoryId == requestedCategoryId));
    }

    var labels = await baseQuery
        .OrderBy(x => x.Product.Name)
        .Select(x => new
        {
            productId = x.Product.Id,
            productName = x.Product.Name,
            description = x.Product.Description,
            barcodeValue = x.Barcode.BarcodeValue,
            barcodeType = "Code128",
            labelTitle = x.Product.Name,
            labelSubtitle = "MedStock Pro",
            currentStock = x.Product.CurrentStock,
            minimumStock = x.Product.MinimumStock,
            expiryDate = x.Product.ExpiryDate,
            photoPath = x.Product.PhotoPath,
        })
        .ToListAsync();

    // Resolve the category name once (for the header in the print job).
    string? categoryName = null;
    if (categoryId.HasValue)
    {
        categoryName = await _context.Categories
            .Where(c => c.Id == categoryId.Value)
            .Select(c => c.Name)
            .FirstOrDefaultAsync();
    }

    return Ok(new
    {
        total = labels.Count,
        categoryId,
        categoryName,
        generatedAt = DateTime.Now,
        labels,
    });
}

// GET: api/Products/1/setup-status
// Admin and Staff can view if a product is fully configured
[HttpGet("{productId:int}/setup-status")]
[Authorize]
public async Task<ActionResult> GetProductSetupStatus(int productId)
{
    var product = await _context.Products
        .FirstOrDefaultAsync(product => product.Id == productId && product.IsActive);

    if (product == null)
    {
        return NotFound("Product not found");
    }

    var hasInternalBarcode = await _context.ProductBarcodes
        .AnyAsync(barcode =>
            barcode.ProductId == productId &&
            barcode.IsActive &&
            barcode.BarcodeType == "Internal"
        );

    var hasCategory = await _context.ProductCategories
        .AnyAsync(productCategory => productCategory.ProductId == productId);

    var hasSupplier = await _context.ProductSuppliers
        .AnyAsync(productSupplier => productSupplier.ProductId == productId);

    var hasSupplierBarcode = await _context.ProductBarcodes
        .AnyAsync(barcode =>
            barcode.ProductId == productId &&
            barcode.IsActive &&
            barcode.BarcodeType == "Supplier"
        );

    var hasPhoto = !string.IsNullOrWhiteSpace(product.PhotoPath);

    var hasMinimumStock = product.MinimumStock > 0;

    var hasExpirySettings = product.ExpiryAlertDays > 0;

    var isReady =
        hasInternalBarcode &&
        hasCategory &&
        hasSupplier &&
        hasMinimumStock &&
        hasExpirySettings;

    return Ok(new
    {
        productId = product.Id,
        productName = product.Name,
        hasPhoto,
        hasInternalBarcode,
        hasSupplierBarcode,
        hasCategory,
        hasSupplier,
        hasMinimumStock,
        hasExpirySettings,
        isReady,
        missingItems = new
        {
            photo = !hasPhoto,
            internalBarcode = !hasInternalBarcode,
            category = !hasCategory,
            supplier = !hasSupplier,
            minimumStock = !hasMinimumStock,
            expirySettings = !hasExpirySettings
        }
    });
}
// GET: api/Products/1/full-details
// Admin and Staff can view full product details
[HttpGet("{productId:int}/full-details")]
[Authorize]
public async Task<ActionResult> GetProductFullDetails(int productId)
{
    var product = await _context.Products
        .FirstOrDefaultAsync(product => product.Id == productId && product.IsActive);

    if (product == null)
    {
        return NotFound("Product not found");
    }

    var categories = await _context.ProductCategories
        .Where(productCategory => productCategory.ProductId == productId)
        .Include(productCategory => productCategory.Category)
        .Where(productCategory =>
            productCategory.Category != null &&
            productCategory.Category.IsActive
        )
        .Select(productCategory => new
        {
            productCategory.Category!.Id,
            productCategory.Category.Name,
            productCategory.Category.Description
        })
        .ToListAsync();

    var suppliers = await _context.ProductSuppliers
        .Where(productSupplier => productSupplier.ProductId == productId)
        .Include(productSupplier => productSupplier.Supplier)
        .Where(productSupplier =>
            productSupplier.Supplier != null &&
            productSupplier.Supplier.IsActive
        )
        .Select(productSupplier => new
        {
            productSupplier.Id,
            productSupplier.SupplierId,
            SupplierName = productSupplier.Supplier!.Name,
            productSupplier.Supplier.PhoneNumber,
            productSupplier.Supplier.Email,
            productSupplier.Supplier.Address,
            productSupplier.SupplierBarcode,
            productSupplier.Price,
            productSupplier.LastPurchaseDate,
            productSupplier.IsPreferredSupplier
        })
        .OrderByDescending(productSupplier => productSupplier.IsPreferredSupplier)
        .ThenBy(productSupplier => productSupplier.Price)
        .ToListAsync();

    var barcodes = await _context.ProductBarcodes
        .Where(barcode => barcode.ProductId == productId && barcode.IsActive)
        .OrderBy(barcode => barcode.BarcodeType)
        .Select(barcode => new
        {
            barcode.Id,
            barcode.BarcodeValue,
            barcode.BarcodeType,
            barcode.Notes,
            barcode.CreatedAt
        })
        .ToListAsync();

    var activeAlerts = await _context.Alerts
        .Where(alert => alert.ProductId == productId && !alert.IsResolved)
        .OrderByDescending(alert => alert.CreatedAt)
        .Select(alert => new
        {
            alert.Id,
            alert.AlertType,
            alert.Message,
            alert.Severity,
            alert.IsRead,
            alert.CreatedAt
        })
        .ToListAsync();

    var hasPhoto = !string.IsNullOrWhiteSpace(product.PhotoPath);

    var hasInternalBarcode = barcodes.Any(barcode => barcode.BarcodeType == "Internal");

    var hasSupplierBarcode = barcodes.Any(barcode => barcode.BarcodeType == "Supplier");

    var hasCategory = categories.Any();

    var hasSupplier = suppliers.Any();

    var hasMinimumStock = product.MinimumStock > 0;

    var hasExpirySettings = product.ExpiryAlertDays > 0;

    var isReady =
        hasInternalBarcode &&
        hasCategory &&
        hasSupplier &&
        hasMinimumStock &&
        hasExpirySettings;

    var today = DateTime.Today;

    string expiryStatus = "No expiry date";

    if (product.ExpiryDate != null)
    {
        var expiryDate = product.ExpiryDate.Value.Date;

        if (expiryDate < today)
        {
            expiryStatus = "Expired";
        }
        else if (today >= expiryDate.AddDays(-product.ExpiryAlertDays))
        {
            expiryStatus = "Expiring soon";
        }
        else
        {
            expiryStatus = "Valid";
        }
    }

    return Ok(new
    {
        product = new
        {
            product.Id,
            product.Name,
            product.Description,
            PhotoPath = PhotoPaths.Normalize(product.PhotoPath),
            PhotoUrl = PhotoPaths.ToUrl(product.PhotoPath, Request),
            product.CurrentStock,
            product.MinimumStock,
            product.ExpiryDate,
            product.ExpiryAlertDays,
            product.InternalBarcode,
            product.IsActive,
            product.CreatedAt,
            product.UpdatedAt,
            StockStatus = product.CurrentStock <= product.MinimumStock
                ? "Low stock"
                : "Healthy",
            ExpiryStatus = expiryStatus
        },
        categories,
        suppliers,
        barcodes,
        activeAlerts,
        setupStatus = new
        {
            hasPhoto,
            hasInternalBarcode,
            hasSupplierBarcode,
            hasCategory,
            hasSupplier,
            hasMinimumStock,
            hasExpirySettings,
            isReady,
            missingItems = new
            {
                photo = !hasPhoto,
                internalBarcode = !hasInternalBarcode,
                category = !hasCategory,
                supplier = !hasSupplier,
                minimumStock = !hasMinimumStock,
                expirySettings = !hasExpirySettings
            }
        }
    });
}
    }
    
}