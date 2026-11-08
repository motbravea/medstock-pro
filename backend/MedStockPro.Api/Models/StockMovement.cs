namespace MedStockPro.Api.Models
{
    public class StockMovement
    {
        public int Id { get; set; }

        public int ProductId { get; set; }

        public Product? Product { get; set; }

        public int UserId { get; set; }

        public User? User { get; set; }

        public string MovementType { get; set; } = string.Empty;

        public int Quantity { get; set; }

        public int OldStock { get; set; }

        public int NewStock { get; set; }

        public string Notes { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}