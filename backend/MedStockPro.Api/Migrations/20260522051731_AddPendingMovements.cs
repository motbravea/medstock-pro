using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedStockPro.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPendingMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PendingMovements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProductId = table.Column<int>(type: "INTEGER", nullable: false),
                    RequestedByUserId = table.Column<int>(type: "INTEGER", nullable: false),
                    SourceMovementId = table.Column<int>(type: "INTEGER", nullable: false),
                    MovementType = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    RequesterNotes = table.Column<string>(type: "TEXT", nullable: false),
                    ReviewedByUserId = table.Column<int>(type: "INTEGER", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ReviewerNotes = table.Column<string>(type: "TEXT", nullable: false),
                    RestoredMovementId = table.Column<int>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PendingMovements_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PendingMovements_StockMovements_RestoredMovementId",
                        column: x => x.RestoredMovementId,
                        principalTable: "StockMovements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_PendingMovements_StockMovements_SourceMovementId",
                        column: x => x.SourceMovementId,
                        principalTable: "StockMovements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PendingMovements_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PendingMovements_Users_ReviewedByUserId",
                        column: x => x.ReviewedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PendingMovements_ProductId",
                table: "PendingMovements",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingMovements_RequestedByUserId",
                table: "PendingMovements",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingMovements_RestoredMovementId",
                table: "PendingMovements",
                column: "RestoredMovementId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingMovements_ReviewedByUserId",
                table: "PendingMovements",
                column: "ReviewedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingMovements_SourceMovementId",
                table: "PendingMovements",
                column: "SourceMovementId",
                unique: true,
                filter: "\"Status\" != 'Rejected'");

            migrationBuilder.CreateIndex(
                name: "IX_PendingMovements_Status",
                table: "PendingMovements",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PendingMovements");
        }
    }
}
