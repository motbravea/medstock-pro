using System.ComponentModel.DataAnnotations;

namespace MedStockPro.Api.DTOs
{
    /// <summary>
    /// Posted by Admin when approving or rejecting a pending return.
    /// Notes are optional and stored on both the PendingMovement row and the
    /// audit log so the decision is traceable.
    /// </summary>
    public class PendingMovementReviewDto
    {
        [StringLength(300)]
        public string Notes { get; set; } = string.Empty;
    }
}
