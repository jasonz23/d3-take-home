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

    [Fact]
    public async Task GetAlerts_WhenPageIsInvalid_ReturnsBadRequest()
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
            page: 0,
            pageSize: 25,
            cancellationToken: CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetAlerts_WhenInvalidSeverityProvided_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert());
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetAlerts(
            search: null,
            severity: "Severe",
            status: null,
            source: null,
            sortBy: null,
            sortDirection: null,
            page: 1,
            pageSize: 25,
            cancellationToken: CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetAlerts_WhenInvalidStatusProvided_ReturnsBadRequest()
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
            status: "Ignored",
            source: null,
            sortBy: null,
            sortDirection: null,
            page: 1,
            pageSize: 25,
            cancellationToken: CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetAlerts_WhenFiltersAndSortProvided_AppliesThemServerSide()
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
                createdAt: DateTimeOffset.Parse("2026-07-09T10:00:00Z")),
            CreateAlert(
                id: "alert-002",
                severity: AlertSeverity.Critical,
                status: AlertStatus.New,
                source: "CrowdStrike",
                createdAt: DateTimeOffset.Parse("2026-07-09T11:00:00Z")),
            CreateAlert(
                id: "alert-003",
                severity: AlertSeverity.High,
                status: AlertStatus.New,
                source: "Okta",
                createdAt: DateTimeOffset.Parse("2026-07-09T12:00:00Z")),
            CreateAlert(
                id: "alert-004",
                severity: AlertSeverity.Critical,
                status: AlertStatus.Resolved,
                source: "CrowdStrike",
                createdAt: DateTimeOffset.Parse("2026-07-09T13:00:00Z")));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetAlerts(
            search: null,
            severity: "Critical",
            status: "New",
            source: "CrowdStrike",
            sortBy: "id",
            sortDirection: "desc",
            page: 1,
            pageSize: 25,
            cancellationToken: CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AlertListResponse>(ok.Value);

        Assert.Equal(new[] { "alert-002", "alert-001" }, response.Data.Select(x => x.Id).ToArray());
        Assert.Equal(4, response.Meta.Total);
        Assert.Equal(2, response.Meta.Filtered);
        Assert.Equal(new[] { "CrowdStrike", "Okta" }, response.Meta.Sources);
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
    public async Task GetSummary_WhenNoAlerts_ReturnsEmptySummary()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.GetSummary(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AlertSummaryResponse>(ok.Value);

        Assert.Equal(0, response.Data.Total);
        Assert.Equal(0, response.Data.Unresolved);
        Assert.Equal(0, response.Data.Critical);
        Assert.Equal(0, response.Data.Unassigned);
        Assert.Null(response.Data.LastUpdatedAt);
        Assert.All(response.Data.BySeverity, bucket => Assert.Equal(0, bucket.Count));
        Assert.All(response.Data.ByStatus, bucket => Assert.Equal(0, bucket.Count));
        Assert.Empty(response.Data.BySource);
        Assert.Empty(response.Data.ByAssignee);
        Assert.Empty(response.Data.CreatedByDay);
    }

    [Fact]
    public async Task GetAlert_WhenAlertExists_ReturnsDetailsWithOrderedStatusHistory()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var alert = CreateAlert(status: AlertStatus.Resolved);
        alert.StatusEvents.Add(CreateStatusEvent(
            alert.Id,
            AlertStatus.InProgress,
            AlertStatus.Resolved,
            DateTimeOffset.Parse("2026-07-09T18:20:00Z")));
        alert.StatusEvents.Add(CreateStatusEvent(
            alert.Id,
            AlertStatus.New,
            AlertStatus.InProgress,
            DateTimeOffset.Parse("2026-07-09T18:05:00Z")));
        db.Alerts.Add(alert);
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.GetAlert("alert-001", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = GetAnonymousData<AlertResponse>(ok.Value!);

        Assert.Equal("alert-001", response.Id);
        var history = Assert.IsAssignableFrom<IReadOnlyList<AlertStatusEventResponse>>(
            response.StatusHistory);
        Assert.Equal(2, history.Count);
        Assert.Equal(AlertStatus.New, history[0].PreviousStatus);
        Assert.Equal(AlertStatus.InProgress, history[0].NewStatus);
        Assert.Equal(AlertStatus.Resolved, history[1].NewStatus);
    }

    [Fact]
    public async Task GetAlert_WhenMissing_ReturnsNotFound()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.GetAlert("missing-alert", CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
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
    public async Task ImportAlerts_WhenFileIsMissing_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.ImportAlerts(null, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Alerts);
    }

    [Fact]
    public async Task ImportAlerts_WhenFileIsEmpty_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.ImportAlerts(CreateJsonFile(""), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Alerts);
    }

    [Fact]
    public async Task ImportAlerts_WhenJsonIsInvalid_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.ImportAlerts(
            CreateJsonFile("""[{ "id": "alert-001" """),
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Alerts);
    }

    [Fact]
    public async Task ImportAlerts_WhenRequiredFieldIsMissing_ReturnsBadRequest()
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
                "createdAt": "2026-07-09T18:00:00Z",
                "assignee": null
              }
            ]
            """);

        var result = await controller.ImportAlerts(file, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(db.Alerts);
    }

    [Fact]
    public async Task ImportAlerts_WhenDuplicateIdsProvided_ReturnsBadRequest()
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
                "assignee": null
              },
              {
                "id": "ALERT-UPLOAD-001",
                "title": "Duplicate alert",
                "severity": "High",
                "status": "New",
                "source": "Okta",
                "createdAt": "2026-07-09T18:05:00Z",
                "assignee": "Jason Zhao"
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
    public async Task UpdateStatus_WhenAlertIsMissing_ReturnsNotFound()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.UpdateStatus(
            "missing-alert",
            new UpdateAlertStatusRequest(AlertStatus.InProgress, 1),
            CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task UpdateStatus_WhenVersionIsInvalid_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert());
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateStatus(
            "alert-001",
            new UpdateAlertStatusRequest(AlertStatus.InProgress, 0),
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);

        var alert = await db.Alerts.Include(x => x.StatusEvents).SingleAsync();
        Assert.Equal(AlertStatus.New, alert.Status);
        Assert.Equal(1, alert.Version);
        Assert.Empty(alert.StatusEvents);
    }

    [Fact]
    public async Task UpdateStatus_WhenStatusIsUnchanged_ReturnsAlertWithoutAuditEvent()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(status: AlertStatus.InProgress, version: 2));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateStatus(
            "alert-001",
            new UpdateAlertStatusRequest(AlertStatus.InProgress, 2),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UpdateAlertStatusResponse>(ok.Value);

        Assert.Equal(AlertStatus.InProgress, response.Data.Status);
        Assert.Equal(2, response.Data.Version);

        var alert = await db.Alerts.Include(x => x.StatusEvents).SingleAsync();
        Assert.Equal(AlertStatus.InProgress, alert.Status);
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

    [Fact]
    public async Task UpdateAssignee_WhenAlertIsMissing_ReturnsNotFound()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        var controller = new AlertsController(db);

        var result = await controller.UpdateAssignee(
            "missing-alert",
            new UpdateAlertAssigneeRequest("Maya Chen", 1),
            CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task UpdateAssignee_WhenVersionIsInvalid_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(assignee: "Jason Zhao"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateAssignee(
            "alert-001",
            new UpdateAlertAssigneeRequest("Maya Chen", 0),
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);

        var alert = await db.Alerts.SingleAsync();
        Assert.Equal("Jason Zhao", alert.Assignee);
        Assert.Equal(1, alert.Version);
    }

    [Fact]
    public async Task UpdateAssignee_WhenAssigneeIsTooLong_ReturnsBadRequest()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(assignee: "Jason Zhao"));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);
        var longAssignee = new string('a', 201);

        var result = await controller.UpdateAssignee(
            "alert-001",
            new UpdateAlertAssigneeRequest(longAssignee, 1),
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);

        var alert = await db.Alerts.SingleAsync();
        Assert.Equal("Jason Zhao", alert.Assignee);
        Assert.Equal(1, alert.Version);
    }

    [Fact]
    public async Task UpdateAssignee_WhenAssigneeIsUnchanged_ReturnsAlertWithoutVersionBump()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = CreateDbContext(connection);
        db.Alerts.Add(CreateAlert(assignee: "Jason Zhao", version: 2));
        await db.SaveChangesAsync();

        var controller = new AlertsController(db);

        var result = await controller.UpdateAssignee(
            "alert-001",
            new UpdateAlertAssigneeRequest("Jason Zhao", 2),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<UpdateAlertAssigneeResponse>(ok.Value);

        Assert.Equal("Jason Zhao", response.Data.Assignee);
        Assert.Equal(2, response.Data.Version);

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

    private static T GetAnonymousData<T>(object value)
    {
        var dataProperty = value.GetType().GetProperty("data");
        Assert.NotNull(dataProperty);

        return Assert.IsType<T>(dataProperty.GetValue(value));
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

    private static AlertStatusEvent CreateStatusEvent(
        string alertId,
        AlertStatus previousStatus,
        AlertStatus newStatus,
        DateTimeOffset changedAt) =>
        new()
        {
            Id = Guid.NewGuid(),
            AlertId = alertId,
            PreviousStatus = previousStatus,
            NewStatus = newStatus,
            ChangedAt = changedAt,
            ChangedBy = "demo-analyst"
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
