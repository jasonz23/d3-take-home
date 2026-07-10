using System;
using AlertTriage.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AlertTriage.Api.Migrations;

[DbContext(typeof(AlertDbContext))]
[Migration("20260710000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Alerts",
            columns: table => new
            {
                Id = table.Column<string>(type: "text", nullable: false),
                Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                Severity = table.Column<string>(type: "text", nullable: false),
                Status = table.Column<string>(type: "text", nullable: false),
                Source = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Assignee = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Version = table.Column<int>(type: "integer", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Alerts", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "AlertStatusEvents",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                AlertId = table.Column<string>(type: "text", nullable: false),
                PreviousStatus = table.Column<string>(type: "text", nullable: false),
                NewStatus = table.Column<string>(type: "text", nullable: false),
                ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                ChangedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AlertStatusEvents", x => x.Id);
                table.ForeignKey(
                    name: "FK_AlertStatusEvents_Alerts_AlertId",
                    column: x => x.AlertId,
                    principalTable: "Alerts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Alerts_CreatedAt",
            table: "Alerts",
            column: "CreatedAt");

        migrationBuilder.CreateIndex(
            name: "IX_Alerts_Severity",
            table: "Alerts",
            column: "Severity");

        migrationBuilder.CreateIndex(
            name: "IX_Alerts_Source",
            table: "Alerts",
            column: "Source");

        migrationBuilder.CreateIndex(
            name: "IX_Alerts_Status",
            table: "Alerts",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_AlertStatusEvents_AlertId_ChangedAt",
            table: "AlertStatusEvents",
            columns: new[] { "AlertId", "ChangedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "AlertStatusEvents");

        migrationBuilder.DropTable(
            name: "Alerts");
    }
}
