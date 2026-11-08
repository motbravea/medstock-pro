namespace MedStockPro.Api.Models
{
    public class Product
    {
        public int Id { get; set; }

        public string Name { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public string PhotoPath { get; set; } = string.Empty;

        public int CurrentStock { get; set; }

        public int MinimumStock { get; set; }

        public DateTime? ExpiryDate { get; set; }

        public int ExpiryAlertDays { get; set; } = 30;

        public string InternalBarcode { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}