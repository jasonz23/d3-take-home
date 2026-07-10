using AlertTriage.Api.Contracts;
using AlertTriage.Api.Controllers;
using AlertTriage.Api.Data;
using AlertTriage.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text;
using Xunit;

namespace AlertTriage.Api.Tests;

public sealed class AlertsControllerTests
{
    [Fact]
    public async Task GetAlerts_WhenPageRequested_ReturnsPagedAlertsAndMeta()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.AddRange(
            CreateAlert(id: "alert-001", source: "CrowdStrike"),
            CreateAlert(id: "alert-002", source: "Okta"),
            CreateAlert(id: "alert-003", source: "Sentinel"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetAlerts(
            search: null,
            severity: null,
            status: null,
            source: null,
            sortBy: "id",
            sortDirection: "asc",
            page: 2,
            pageSize: 2,
            cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AlertListResponse>(ok.Value);

        var alert = Assert.Single(response.Data);
        Assert.Equal("alert-003", alert.Id);
        Assert.Equal(3, response.Meta.Total);
        Assert.Equal(3, response.Meta.Filtered);
        Assert.Equal(2, response.Meta.Page);
        Assert.Equal(2, response.Meta.PageSize);
        Assert.Equal(2, response.Meta.TotalPages);
        Assert.Equal(["CrowdStrike", "Okta", "Sentinel"], response.Meta.Sources);
    }

    [Fact]
    public async Task GetAlerts_WhenPageSizeIsTooLarge_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert());
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetAlerts(
            search: null,
            severity: null,
            status: null,
            source: null,
            sortBy: null,
            sortDirection: null,
            page: 1,
            pageSize: 101,
            cancellationToken: CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Theory]
    [InlineData("alert-001", "alert-001")]
    [InlineData("powershell", "alert-001")]
    [InlineData("okta", "alert-002")]
    [InlineData("maya", "alert-003")]
    public async Task GetAlerts_WhenSearchProvided_MatchesIdTitleSourceAndAssignee(
        string search,
        string expectedId)
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.AddRange(
            CreateAlert(
                id: "alert-001",
                title: "Suspicious PowerShell execution",
                source: "CrowdStrike",
                assignee: null),
            CreateAlert(
                id: "alert-002",
                title: "Impossible travel sign-in",
                source: "Okta",
                assignee: "Jason Zhao"),
            CreateAlert(
                id: "alert-003",
                title: "Endpoint malware quarantined",
                source: "Sentinel",
                assignee: "Maya Chen"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetAlerts(
            search: search,
            severity: null,
            status: null,
            source: null,
            sortBy: "id",
            sortDirection: "asc",
            page: 1,
            pageSize: 25,
            cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AlertListResponse>(ok.Value);
        var alert = Assert.Single(response.Data);

        Assert.Equal(expectedId, alert.Id);
        Assert.Equal(1, response.Meta.Filtered);
    }

    [Fact]
    public async Task GetSummary_ReturnsAggregatedAlertCounts()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.AddRange(
            CreateAlert(
                id: "alert-001",
                severity: AlertSeverity.Critical,
                status: AlertStatus.New,
                source: "CrowdStrike",
                assignee: null,
                createdAt: DateTimeOffset.Parse("2026-07-08T10:00:00Z")),
            CreateAlert(
                id: "alert-002",
                severity: AlertSeverity.High,
                status: AlertStatus.Resolved,
                source: "Okta",
                assignee: "Jason Zhao",
                createdAt: DateTimeOffset.Parse("2026-07-09T10:00:00Z")),
            CreateAlert(
                id: "alert-003",
                severity: AlertSeverity.Critical,
                status: AlertStatus.InProgress,
                source: "Okta",
                assignee: "Jason Zhao",
                createdAt: DateTimeOffset.Parse("2026-07-09T11:00:00Z")));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetSummary(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AlertSummaryResponse>(ok.Value);

        Assert.Equal(3, response.Data.Total);
        Assert.Equal(2, response.Data.Unresolved);
        Assert.Equal(2, response.Data.Critical);
        Assert.Equal(1, response.Data.Unassigned);
        Assert.Contains(response.Data.BySeverity, x => x.Label == "Critical" && x.Count == 2);
        Assert.Contains(response.Data.ByStatus, x => x.Label == "Resolved" && x.Count == 1);
        Assert.Contains(response.Data.BySource, x => x.Label == "Okta" && x.Count == 2);
        Assert.Contains(response.Data.ByAssignee, x => x.Label == "Jason Zhao" && x.Count == 2);
        Assert.Contains(response.Data.CreatedByDay, x => x.Label == "2026-07-09" && x.Count == 2);
    }

    [Fact]
    public async Task ImportAlerts_WhenJsonIsValid_ReplacesAlertsAndSavesFields()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(id: "old-alert"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);
        var file = CreateJsonFile(
            """
            [
              {
                "id": "alert-upload-001",
                "title": "Uploaded suspicious PowerShell execution",
                "severity": "Critical",
                "status": "InProgress",
                "source": "CrowdStrike",
                "createdAt": "2026-07-09T18:00:00Z",
                "assignee": "Jason Zhao"
              }
            ]
            """);

        var result = await controller.ImportAlerts(file, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ImportAlertsResponse>(ok.Value);
        Assert.Equal(1, response.Imported);

        var alert = await db.Alerts
            .Include(x => x.StatusEvents)
            .SingleAsync();
        Assert.Equal("alert-upload-001", alert.Id);
        Assert.Equal("Uploaded suspicious PowerShell execution", alert.Title);
        Assert.Equal(AlertSeverity.Critical, alert.Severity);
        Assert.Equal(AlertStatus.InProgress, alert.Status);
        Assert.Equal("CrowdStrike", alert.Source);
        Assert.Equal(DateTimeOffset.Parse("2026-07-09T18:00:00Z"), alert.CreatedAt);
        Assert.Equal("Jason Zhao", alert.Assignee);
        Assert.Equal(2, alert.Version);

        var statusEvent = Assert.Single(alert.StatusEvents);
        Assert.Equal(AlertStatus.New, statusEvent.PreviousStatus);
        Assert.Equal(AlertStatus.InProgress, statusEvent.NewStatus);
        Assert.Equal("import", statusEvent.ChangedBy);
    }

    [Fact]
    public async Task ImportAlerts_WhenJsonHasUnexpectedField_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);
        var file = CreateJsonFile(
            """
            [
              {
                "id": "alert-upload-001",
                "title": "Uploaded suspicious PowerShell execution",
                "severity": "Critical",
                "status": "New",
                "source": "CrowdStrike",
                "createdAt": "2026-07-09T18:00:00Z",
                "assignee": null,
                "updatedAt": "2026-07-09T18:00:00Z"
              }
            ]
            """);

        var result = await controller.ImportAlerts(file, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Alerts);
    }

    [Fact]
    public async Task UpdateStatus_WhenVersionMatches_UpdatesAlertAndWritesAuditEvent()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert());
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateStatus(
            "alert-001",
            new UpdateAlertStatusRequest(AlertStatus.InProgress, 1),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);

        var alert = await db.Alerts.Include(x => x.StatusEvents).SingleAsync();
        Assert.Equal(AlertStatus.InProgress, alert.Status);
        Assert.Equal(2, alert.Version);

        var statusEvent = Assert.Single(alert.StatusEvents);
        Assert.Equal(AlertStatus.New, statusEvent.PreviousStatus);
        Assert.Equal(AlertStatus.InProgress, statusEvent.NewStatus);
        Assert.Equal("demo-analyst", statusEvent.ChangedBy);
    }

    [Fact]
    public async Task UpdateStatus_WhenVersionIsStale_ReturnsConflictWithoutChangingAlert()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(version: 2));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateStatus(
            "alert-001",
            new UpdateAlertStatusRequest(AlertStatus.Resolved, 1),
            CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);

        var alert = await db.Alerts.Include(x => x.StatusEvents).SingleAsync();
        Assert.Equal(AlertStatus.New, alert.Status);
        Assert.Equal(2, alert.Version);
        Assert.Empty(alert.StatusEvents);
    }

    [Fact]
    public async Task UpdateAssignee_WhenVersionMatches_UpdatesAssigneeAndVersion()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert());
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateAssignee(
            "alert-001",
            new UpdateAlertAssigneeRequest("  Maya Chen  ", 1),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UpdateAlertAssigneeResponse>(ok.Value);

        Assert.Equal("Maya Chen", response.Data.Assignee);
        Assert.Equal(2, response.Data.Version);

        var alert = await db.Alerts.SingleAsync();
        Assert.Equal("Maya Chen", alert.Assignee);
        Assert.Equal(2, alert.Version);
    }

    [Fact]
    public async Task UpdateAssignee_WhenBlank_SavesNullAssignee()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(assignee: "Jason Zhao"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateAssignee(
            "alert-001",
            new UpdateAlertAssigneeRequest("   ", 1),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);

        var alert = await db.Alerts.SingleAsync();
        Assert.Null(alert.Assignee);
        Assert.Equal(2, alert.Version);
    }

    [Fact]
    public async Task UpdateAssignee_WhenVersionIsStale_ReturnsConflictWithoutChangingAlert()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(version: 2, assignee: "Jason Zhao"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateAssignee(
            "alert-001",
            new UpdateAlertAssigneeRequest("Maya Chen", 1),
            CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);

        var alert = await db.Alerts.SingleAsync();
        Assert.Equal("Jason Zhao", alert.Assignee);
        Assert.Equal(2, alert.Version);
    }

    private static AlertDbContext CreateDbContext(SqliteConnection connection)
    {
        var options = new DbContextOptionsBuilder<AlertDbContext>()
            .UseSqlite(connection)
            .Options;

        var db = new AlertDbContext(options);
        db.Database.EnsureCreated();

        return db;
    }

    private static Alert CreateAlert(
        int version = 1,
        string id = "alert-001",
        string title = "Suspicious PowerShell execution",
        AlertSeverity severity = AlertSeverity.Critical,
        AlertStatus status = AlertStatus.New,
        string source = "CrowdStrike",
        string? assignee = null,
        DateTimeOffset? createdAt = null) =>
        new()
        {
            Id = id,
            Title = title,
            Severity = severity,
            Status = status,
            Source = source,
            CreatedAt = createdAt ?? DateTimeOffset.UtcNow.AddMinutes(-30),
            UpdatedAt = createdAt ?? DateTimeOffset.UtcNow.AddMinutes(-30),
            Assignee = assignee,
            Version = version
        };

    private static IFormFile CreateJsonFile(string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        var stream = new MemoryStream(bytes);

        return new FormFile(stream, 0, bytes.Length, "file", "alerts.json")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/json"
        };
    }
}
