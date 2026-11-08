namespace MedStockPro.Api.Models
{
    public class ProductBarcode
    {
        public int Id { get; set; }

        public int ProductId { get; set; }

        public Product? Product { get; set; }

        public string BarcodeValue { get; set; } = string.Empty;

        public string BarcodeType { get; set; } = "Internal";

        public string Notes { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}