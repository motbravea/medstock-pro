using MedStockPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace MedStockPro.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<ProductCategory> ProductCategories { get; set; }
        public DbSet<Supplier> Suppliers { get; set; }
        public DbSet<ProductSupplier> ProductSuppliers { get; set; }
        public DbSet<ProductBarcode> ProductBarcodes { get; set; }
        public DbSet<StockMovement> StockMovements { get; set; }
        public DbSet<PendingMovement> PendingMovements { get; set; }
        public DbSet<Alert> Alerts { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<License> Licenses { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ─── Uniqueness constraints (B10) ───────────────────────────────
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();

            // Category/Supplier names are unique among ACTIVE rows only.
            // Deleting is a soft-delete (IsActive=false); the filtered index
            // lets the user re-create or rename to a previously-used name
            // without colliding with the deactivated row.
            modelBuilder.Entity<Category>()
                .HasIndex(c => c.Name)
                .IsUnique()
                .HasFilter("\"IsActive\" = 1");

            modelBuilder.Entity<Supplier>()
                .HasIndex(s => s.Name)
                .IsUnique()
                .HasFilter("\"IsActive\" = 1");

            // Internal barcode on the Product row is allowed to be empty,
            // so we make the index filtered to non-empty values only.
            modelBuilder.Entity<Product>()
                .HasIndex(p => p.InternalBarcode)
                .IsUnique()
                .HasFilter("\"InternalBarcode\" != ''");

            // Barcode value must be unique across all *active* rows so a
            // deactivated value can later be re-issued without DB conflict.
            modelBuilder.Entity<ProductBarcode>()
                .HasIndex(b => b.BarcodeValue)
                .IsUnique()
                .HasFilter("\"IsActive\" = 1");

            // ─── Audit log indexes (read-heavy filters) ────────────────────
            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => a.CreatedAt);
            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => new { a.EntityType, a.EntityId });
            modelBuilder.Entity<AuditLog>()
                .HasIndex(a => a.UserId);

            // ─── Pending movement indexes + relationships ──────────────────
            // Status is the primary filter for the admin queue.
            modelBuilder.Entity<PendingMovement>()
                .HasIndex(p => p.Status);
            // One source StockOut can be returned at most once (enforce via
            // a filtered unique index: only when status is not Rejected).
            modelBuilder.Entity<PendingMovement>()
                .HasIndex(p => p.SourceMovementId)
                .IsUnique()
                .HasFilter("\"Status\" != 'Rejected'");
            // Restrict deletes so a referenced StockMovement can't be removed
            // out from under a pending return.
            modelBuilder.Entity<PendingMovement>()
                .HasOne(p => p.SourceMovement)
                .WithMany()
                .HasForeignKey(p => p.SourceMovementId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<PendingMovement>()
                .HasOne(p => p.RestoredMovement)
                .WithMany()
                .HasForeignKey(p => p.RestoredMovementId)
                .OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<PendingMovement>()
                .HasOne(p => p.RequestedByUser)
                .WithMany()
                .HasForeignKey(p => p.RequestedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<PendingMovement>()
                .HasOne(p => p.ReviewedByUser)
                .WithMany()
                .HasForeignKey(p => p.ReviewedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }

}