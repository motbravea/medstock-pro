using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedStockPro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExpiryAlertDaysToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExpiryAlertDays",
                table: "Products",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpiryAlertDays",
                table: "Products");
        }
    }
}
