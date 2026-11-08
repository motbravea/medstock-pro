namespace MedStockPro.Api.Models
{
    public class ProductSupplier
    {
        public int Id { get; set; }

        public int ProductId { get; set; }

        public Product? Product { get; set; }

        public int SupplierId { get; set; }

        public Supplier? Supplier { get; set; }

        public string SupplierBarcode { get; set; } = string.Empty;

        public decimal Price { get; set; }

        public DateTime? LastPurchaseDate { get; set; }

        public bool IsPreferredSupplier { get; set; } = false;
    }
}