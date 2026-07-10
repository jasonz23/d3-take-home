using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AlertTriage.Api.Migrations;

[Migration("20260710010000_AddAlertSearchIndexes")]
public partial class AddAlertSearchIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""CREATE EXTENSION IF NOT EXISTS pg_trgm;""");

        migrationBuilder.Sql(
            """CREATE INDEX IF NOT EXISTS "IX_Alerts_Search_Id_Trgm" ON "Alerts" USING gin ("Id" gin_trgm_ops);""");
        migrationBuilder.Sql(
            """CREATE INDEX IF NOT EXISTS "IX_Alerts_Search_Title_Trgm" ON "Alerts" USING gin ("Title" gin_trgm_ops);""");
        migrationBuilder.Sql(
            """CREATE INDEX IF NOT EXISTS "IX_Alerts_Search_Source_Trgm" ON "Alerts" USING gin ("Source" gin_trgm_ops);""");
        migrationBuilder.Sql(
            """CREATE INDEX IF NOT EXISTS "IX_Alerts_Search_Assignee_Trgm" ON "Alerts" USING gin ("Assignee" gin_trgm_ops);""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Alerts_Search_Assignee_Trgm";""");
        migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Alerts_Search_Source_Trgm";""");
        migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Alerts_Search_Title_Trgm";""");
        migrationBuilder.Sql("""DROP INDEX IF EXISTS "IX_Alerts_Search_Id_Trgm";""");
    }
}
