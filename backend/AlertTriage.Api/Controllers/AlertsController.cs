using AlertTriage.Api.Contracts;
using AlertTriage.Api.Data;
using AlertTriage.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AlertTriage.Api.Controllers;

[ApiController]
[Route("api/alerts")]
public sealed class AlertsController : ControllerBase
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 25;
    private const int MaxPageSize = 100;
    private const int MaxImportAlerts = 1_000;
    private static readonly string[] RequiredImportFields =
    [
        "id",
        "title",
        "severity",
        "status",
        "source",
        "createdAt",
        "assignee"
    ];

    private readonly AlertDbContext _db;

    public AlertsController(AlertDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAlerts(
        [FromQuery] string? search,
        [FromQuery] string? severity,
        [FromQuery] string? status,
        [FromQuery] string? source,
        [FromQuery] string? sort,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var requestedPage = page ?? DefaultPage;
        var requestedPageSize = pageSize ?? DefaultPageSize;

        if (requestedPage < 1)
        {
            return BadRequest(Error("INVALID_PAGE", "The page must be greater than or equal to 1."));
        }

        if (requestedPageSize < 1 || requestedPageSize > MaxPageSize)
        {
            return BadRequest(Error("INVALID_PAGE_SIZE", $"The page size must be between 1 and {MaxPageSize}."));
        }

        var sortError = TryParseSortTerms(sort, sortBy, sortDirection, out var sortTerms);

        if (sortError is not null)
        {
            return BadRequest(sortError);
        }

        var total = await _db.Alerts.CountAsync(cancellationToken);
        var sources = await _db.Alerts
            .AsNoTracking()
            .Select(x => x.Source)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);
        var query = _db.Alerts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(severity))
        {
            if (!Enum.TryParse<AlertSeverity>(severity, ignoreCase: true, out var parsedSeverity) ||
                !Enum.IsDefined(parsedSeverity))
            {
                return BadRequest(Error("INVALID_SEVERITY", "The severity filter is not valid."));
            }

            query = query.Where(x => x.Severity == parsedSeverity);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<AlertStatus>(status, ignoreCase: true, out var parsedStatus) ||
                !Enum.IsDefined(parsedStatus))
            {
                return BadRequest(Error("INVALID_STATUS", "The status filter is not valid."));
            }

            query = query.Where(x => x.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(source))
        {
            var normalizedSource = source.Trim().ToLower();
            query = query.Where(x => x.Source.ToLower() == normalizedSource);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = ApplySearch(query, search.Trim(), _db.Database.ProviderName);
        }

        var filtered = await query.CountAsync(cancellationToken);
        query = ApplyOrdering(query, sortTerms);

        var totalPages = filtered == 0
            ? 0
            : (int)Math.Ceiling(filtered / (double)requestedPageSize);
        var effectivePage = totalPages == 0
            ? DefaultPage
            : Math.Min(requestedPage, totalPages);

        var alerts = await query
            .Skip((effectivePage - 1) * requestedPageSize)
            .Take(requestedPageSize)
            .Select(x => AlertResponse.From(x, false))
            .ToListAsync(cancellationToken);

        return Ok(new AlertListResponse(
            alerts,
            new AlertListMeta(
                total,
                filtered,
                effectivePage,
                requestedPageSize,
                totalPages,
                sources)));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var alerts = await _db.Alerts
            .AsNoTracking()
            .Select(x => new
            {
                x.Severity,
                x.Status,
                x.Source,
                x.Assignee,
                x.CreatedAt,
                x.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        var bySeverity = new[]
        {
            AlertSeverity.Critical,
            AlertSeverity.High,
            AlertSeverity.Medium,
            AlertSeverity.Low
        }
            .Select(severity => new AlertCountBucket(
                severity.ToString(),
                alerts.Count(x => x.Severity == severity)))
            .ToArray();

        var byStatus = Enum.GetValues<AlertStatus>()
            .Select(status => new AlertCountBucket(
                status.ToString(),
                alerts.Count(x => x.Status == status)))
            .ToArray();

        var bySource = alerts
            .GroupBy(x => x.Source)
            .Select(group => new AlertCountBucket(group.Key, group.Count()))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Label)
            .Take(8)
            .ToArray();

        var byAssignee = alerts
            .GroupBy(x => string.IsNullOrWhiteSpace(x.Assignee)
                ? "Unassigned"
                : x.Assignee)
            .Select(group => new AlertCountBucket(group.Key, group.Count()))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Label)
            .Take(8)
            .ToArray();

        var createdByDay = alerts
            .GroupBy(x => x.CreatedAt.UtcDateTime.Date)
            .Select(group => new AlertCountBucket(
                group.Key.ToString("yyyy-MM-dd"),
                group.Count()))
            .OrderBy(x => x.Label)
            .ToArray();

        var unresolved = alerts.Count(x =>
            x.Status is not AlertStatus.Resolved and not AlertStatus.FalsePositive);

        return Ok(new AlertSummaryResponse(new AlertSummaryData(
            alerts.Count,
            unresolved,
            alerts.Count(x => x.Severity == AlertSeverity.Critical),
            alerts.Count(x => string.IsNullOrWhiteSpace(x.Assignee)),
            alerts.Count == 0 ? null : alerts.Max(x => x.UpdatedAt),
            bySeverity,
            byStatus,
            bySource,
            byAssignee,
            createdByDay)));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAlert(
        string id,
        CancellationToken cancellationToken)
    {
        var alert = await _db.Alerts
            .AsNoTracking()
            .Include(x => x.StatusEvents)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return NotFound(Error("ALERT_NOT_FOUND", "The requested alert was not found."));
        }

        return Ok(new { data = AlertResponse.From(alert, includeHistory: true) });
    }

    [HttpPost("import")]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> ImportAlerts(
        IFormFile? file,
        CancellationToken cancellationToken)
    {
        if (file is null)
        {
            return BadRequest(Error("IMPORT_FILE_REQUIRED", "Upload a JSON file named file."));
        }

        if (file.Length == 0)
        {
            return BadRequest(Error("EMPTY_IMPORT_FILE", "Upload a non-empty JSON file."));
        }

        List<AlertImportRecord> records;

        await using (var stream = file.OpenReadStream())
        {
            var validationError = await ValidateImportShapeAsync(stream, cancellationToken);

            if (validationError is not null)
            {
                return BadRequest(validationError);
            }
        }

        await using (var stream = file.OpenReadStream())
        {
            try
            {
                records = await JsonSerializer.DeserializeAsync<List<AlertImportRecord>>(
                    stream,
                    JsonOptions,
                    cancellationToken) ?? [];
            }
            catch (JsonException)
            {
                return BadRequest(Error("INVALID_IMPORT_JSON", "The uploaded file is not valid alert JSON."));
            }
        }

        var recordError = ValidateImportRecords(records);

        if (recordError is not null)
        {
            return BadRequest(recordError);
        }

        var alerts = records.Select(ToImportedAlert).ToArray();

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        _db.AlertStatusEvents.RemoveRange(_db.AlertStatusEvents);
        _db.Alerts.RemoveRange(_db.Alerts);
        await _db.SaveChangesAsync(cancellationToken);

        _db.Alerts.AddRange(alerts);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new ImportAlertsResponse(
            alerts.Length,
            $"Imported {alerts.Length} alerts."));
    }

    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(
        string id,
        UpdateAlertStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Version < 1)
        {
            return BadRequest(Error("INVALID_VERSION", "The version must be greater than or equal to 1."));
        }

        var alert = await _db.Alerts
            .Include(x => x.StatusEvents)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return NotFound(Error("ALERT_NOT_FOUND", "The requested alert was not found."));
        }

        if (alert.Version != request.Version)
        {
            return Conflict(Error("VERSION_CONFLICT", "The alert was updated by another user."));
        }

        if (alert.Status == request.Status)
        {
            return Ok(new UpdateAlertStatusResponse(AlertResponse.From(alert, includeHistory: true)));
        }

        var previousStatus = alert.Status;
        var changedAt = DateTimeOffset.UtcNow;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            alert.Status = request.Status;
            alert.UpdatedAt = changedAt;
            alert.Version++;

            _db.AlertStatusEvents.Add(new AlertStatusEvent
            {
                Id = Guid.NewGuid(),
                AlertId = alert.Id,
                PreviousStatus = previousStatus,
                NewStatus = request.Status,
                ChangedAt = changedAt,
                ChangedBy = "demo-analyst",
                Alert = alert
            });

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Ok(new UpdateAlertStatusResponse(AlertResponse.From(alert, includeHistory: true)));
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync(cancellationToken);

            return Conflict(Error("VERSION_CONFLICT", "The alert was updated by another user."));
        }
    }

    [HttpPatch("{id}/assignee")]
    public async Task<IActionResult> UpdateAssignee(
        string id,
        UpdateAlertAssigneeRequest request,
        CancellationToken cancellationToken)
    {
        if (request.Version < 1)
        {
            return BadRequest(Error("INVALID_VERSION", "The version must be greater than or equal to 1."));
        }

        var nextAssignee = string.IsNullOrWhiteSpace(request.Assignee)
            ? null
            : request.Assignee.Trim();

        if (nextAssignee?.Length > 200)
        {
            return BadRequest(Error("INVALID_ASSIGNEE", "The assignee must be 200 characters or fewer."));
        }

        var alert = await _db.Alerts
            .Include(x => x.StatusEvents)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (alert is null)
        {
            return NotFound(Error("ALERT_NOT_FOUND", "The requested alert was not found."));
        }

        if (alert.Version != request.Version)
        {
            return Conflict(Error("VERSION_CONFLICT", "The alert was updated by another user."));
        }

        if (alert.Assignee == nextAssignee)
        {
            return Ok(new UpdateAlertAssigneeResponse(AlertResponse.From(alert, includeHistory: true)));
        }

        try
        {
            alert.Assignee = nextAssignee;
            alert.UpdatedAt = DateTimeOffset.UtcNow;
            alert.Version++;

            await _db.SaveChangesAsync(cancellationToken);

            return Ok(new UpdateAlertAssigneeResponse(AlertResponse.From(alert, includeHistory: true)));
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(Error("VERSION_CONFLICT", "The alert was updated by another user."));
        }
    }

    private static IQueryable<Alert> ApplyOrdering(
        IQueryable<Alert> query,
        IReadOnlyList<AlertSortTerm> sortTerms)
    {
        if (sortTerms.Count == 0)
        {
            return query
                .OrderBy(x => x.Status == AlertStatus.Resolved || x.Status == AlertStatus.FalsePositive ? 1 : 0)
                .ThenBy(SeverityRankExpression)
                .ThenByDescending(x => x.CreatedAt)
                .ThenBy(x => x.Id);
        }

        IOrderedQueryable<Alert>? orderedQuery = null;

        foreach (var sortTerm in sortTerms)
        {
            orderedQuery = ApplySortTerm(query, orderedQuery, sortTerm);
        }

        if (!sortTerms.Any(x => x.Key == "id"))
        {
            orderedQuery = orderedQuery!.ThenBy(x => x.Id);
        }

        return orderedQuery!;
    }

    private static IOrderedQueryable<Alert> ApplySortTerm(
        IQueryable<Alert> query,
        IOrderedQueryable<Alert>? orderedQuery,
        AlertSortTerm sortTerm) =>
        sortTerm.Key switch
        {
            "id" => ApplySort(query, orderedQuery, x => x.Id, sortTerm.Descending),
            "title" => ApplySort(query, orderedQuery, x => x.Title, sortTerm.Descending),
            "severity" => ApplySort(query, orderedQuery, SeverityRankExpression, sortTerm.Descending),
            "status" => ApplySort(query, orderedQuery, StatusRankExpression, sortTerm.Descending),
            "source" => ApplySort(query, orderedQuery, x => x.Source, sortTerm.Descending),
            "assignee" => ApplySort(query, orderedQuery, x => x.Assignee, sortTerm.Descending),
            "updatedat" => ApplySort(query, orderedQuery, x => x.UpdatedAt, sortTerm.Descending),
            "createdat" => ApplySort(query, orderedQuery, x => x.CreatedAt, sortTerm.Descending),
            _ => throw new InvalidOperationException($"Unsupported sort key '{sortTerm.Key}'.")
        };

    private static IOrderedQueryable<Alert> ApplySort<TKey>(
        IQueryable<Alert> query,
        IOrderedQueryable<Alert>? orderedQuery,
        Expression<Func<Alert, TKey>> keySelector,
        bool descending)
    {
        if (orderedQuery is null)
        {
            return descending
                ? query.OrderByDescending(keySelector)
                : query.OrderBy(keySelector);
        }

        return descending
            ? orderedQuery.ThenByDescending(keySelector)
            : orderedQuery.ThenBy(keySelector);
    }

    private static object? TryParseSortTerms(
        string? sort,
        string? sortBy,
        string? sortDirection,
        out IReadOnlyList<AlertSortTerm> sortTerms)
    {
        var parsed = new List<AlertSortTerm>();
        var seenKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(sort))
        {
            var parts = sort
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            foreach (var part in parts)
            {
                var pieces = part.Split(':', StringSplitOptions.TrimEntries);

                if (pieces.Length != 2 ||
                    string.IsNullOrWhiteSpace(pieces[0]) ||
                    string.IsNullOrWhiteSpace(pieces[1]))
                {
                    sortTerms = [];
                    return Error("INVALID_SORT", "Sort values must use the format field:asc or field:desc.");
                }

                var key = NormalizeSortKey(pieces[0]);

                if (key is null)
                {
                    sortTerms = [];
                    return Error("INVALID_SORT_FIELD", $"Unsupported sort field '{pieces[0]}'.");
                }

                if (!TryParseSortDirection(pieces[1], out var descending))
                {
                    sortTerms = [];
                    return Error("INVALID_SORT_DIRECTION", "Sort direction must be asc or desc.");
                }

                if (!seenKeys.Add(key))
                {
                    sortTerms = [];
                    return Error("DUPLICATE_SORT_FIELD", $"Sort field '{pieces[0]}' was provided more than once.");
                }

                parsed.Add(new AlertSortTerm(key, descending));
            }
        }
        else if (!string.IsNullOrWhiteSpace(sortBy))
        {
            var key = NormalizeSortKey(sortBy);

            if (key is null)
            {
                sortTerms = [];
                return Error("INVALID_SORT_FIELD", $"Unsupported sort field '{sortBy}'.");
            }

            if (!string.IsNullOrWhiteSpace(sortDirection) &&
                !TryParseSortDirection(sortDirection, out _))
            {
                sortTerms = [];
                return Error("INVALID_SORT_DIRECTION", "Sort direction must be asc or desc.");
            }

            parsed.Add(new AlertSortTerm(
                key,
                string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase)));
        }

        sortTerms = parsed;
        return null;
    }

    private static string? NormalizeSortKey(string key) =>
        key.Trim().ToLowerInvariant() switch
        {
            "id" => "id",
            "title" => "title",
            "severity" => "severity",
            "status" => "status",
            "source" => "source",
            "assignee" => "assignee",
            "updatedat" => "updatedat",
            "createdat" => "createdat",
            _ => null
        };

    private static bool TryParseSortDirection(string direction, out bool descending)
    {
        if (string.Equals(direction, "asc", StringComparison.OrdinalIgnoreCase))
        {
            descending = false;
            return true;
        }

        if (string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase))
        {
            descending = true;
            return true;
        }

        descending = false;
        return false;
    }

    private static IQueryable<Alert> ApplySearch(
        IQueryable<Alert> query,
        string search,
        string? providerName)
    {
        if (providerName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
        {
            var pattern = $"%{search}%";

            return query.Where(x =>
                EF.Functions.ILike(x.Id, pattern) ||
                EF.Functions.ILike(x.Title, pattern) ||
                EF.Functions.ILike(x.Source, pattern) ||
                (x.Assignee != null && EF.Functions.ILike(x.Assignee, pattern)));
        }

        var normalizedSearch = search.ToLowerInvariant();

        return query.Where(x =>
            x.Id.ToLower().Contains(normalizedSearch) ||
            x.Title.ToLower().Contains(normalizedSearch) ||
            x.Source.ToLower().Contains(normalizedSearch) ||
            (x.Assignee != null && x.Assignee.ToLower().Contains(normalizedSearch)));
    }

    private static Expression<Func<Alert, int>> SeverityRankExpression =>
        x => x.Severity == AlertSeverity.Critical ? 0 :
            x.Severity == AlertSeverity.High ? 1 :
            x.Severity == AlertSeverity.Medium ? 2 :
            x.Severity == AlertSeverity.Low ? 3 :
            4;

    private static Expression<Func<Alert, int>> StatusRankExpression =>
        x => x.Status == AlertStatus.New ? 0 :
            x.Status == AlertStatus.InProgress ? 1 :
            x.Status == AlertStatus.Escalated ? 2 :
            x.Status == AlertStatus.Resolved ? 3 :
            x.Status == AlertStatus.FalsePositive ? 4 :
            5;

    private static async Task<object?> ValidateImportShapeAsync(
        Stream stream,
        CancellationToken cancellationToken)
    {
        JsonDocument document;

        try
        {
            document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        }
        catch (JsonException)
        {
            return Error("INVALID_IMPORT_JSON", "The uploaded file is not valid JSON.");
        }

        using (document)
        {
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Error("INVALID_IMPORT_SHAPE", "The uploaded file must contain a JSON array of alerts.");
            }

            var count = document.RootElement.GetArrayLength();

            if (count == 0)
            {
                return Error("EMPTY_IMPORT_FILE", "The uploaded JSON array must contain at least one alert.");
            }

            if (count > MaxImportAlerts)
            {
                return Error("IMPORT_TOO_LARGE", $"Import at most {MaxImportAlerts} alerts at a time.");
            }

            var requiredFields = RequiredImportFields.ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var item in document.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    return Error("INVALID_IMPORT_SHAPE", "Each imported alert must be a JSON object.");
                }

                var fields = item
                    .EnumerateObject()
                    .Select(x => x.Name)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                var missing = requiredFields
                    .Where(x => !fields.Contains(x))
                    .ToArray();

                if (missing.Length > 0)
                {
                    return Error(
                        "INVALID_IMPORT_FIELDS",
                        $"Each alert must include: {string.Join(", ", RequiredImportFields)}.");
                }

                var unknown = fields
                    .Where(x => !requiredFields.Contains(x))
                    .ToArray();

                if (unknown.Length > 0)
                {
                    return Error(
                        "INVALID_IMPORT_FIELDS",
                        $"Unexpected alert field: {unknown[0]}. Allowed fields are: {string.Join(", ", RequiredImportFields)}.");
                }
            }
        }

        return null;
    }

    private static object? ValidateImportRecords(IReadOnlyList<AlertImportRecord> records)
    {
        var duplicateIds = records
            .GroupBy(x => x.Id, StringComparer.OrdinalIgnoreCase)
            .Where(x => x.Count() > 1)
            .Select(x => x.Key)
            .ToArray();

        if (duplicateIds.Length > 0)
        {
            return Error("DUPLICATE_ALERT_IDS", $"Duplicate alert IDs: {string.Join(", ", duplicateIds)}.");
        }

        foreach (var record in records)
        {
            if (string.IsNullOrWhiteSpace(record.Id) ||
                string.IsNullOrWhiteSpace(record.Title) ||
                string.IsNullOrWhiteSpace(record.Source))
            {
                return Error("INVALID_IMPORT_FIELDS", "Each alert requires non-empty id, title, and source.");
            }
        }

        return null;
    }

    private static Alert ToImportedAlert(AlertImportRecord record)
    {
        var alert = new Alert
        {
            Id = record.Id.Trim(),
            Title = record.Title.Trim(),
            Severity = record.Severity,
            Status = record.Status,
            Source = record.Source.Trim(),
            CreatedAt = record.CreatedAt,
            Assignee = string.IsNullOrWhiteSpace(record.Assignee)
                ? null
                : record.Assignee.Trim(),
            UpdatedAt = record.CreatedAt,
            Version = 1
        };

        foreach (var statusEvent in BuildInitialStatusHistory(alert.Id, record.Status, record.CreatedAt))
        {
            alert.StatusEvents.Add(statusEvent);
            alert.UpdatedAt = statusEvent.ChangedAt;
            alert.Version++;
        }

        return alert;
    }

    private static IEnumerable<AlertStatusEvent> BuildInitialStatusHistory(
        string alertId,
        AlertStatus currentStatus,
        DateTimeOffset createdAt)
    {
        return currentStatus switch
        {
            AlertStatus.InProgress =>
            [
                CreateStatusEvent(alertId, AlertStatus.New, AlertStatus.InProgress, createdAt.AddMinutes(4))
            ],
            AlertStatus.Escalated =>
            [
                CreateStatusEvent(alertId, AlertStatus.New, AlertStatus.InProgress, createdAt.AddMinutes(4)),
                CreateStatusEvent(alertId, AlertStatus.InProgress, AlertStatus.Escalated, createdAt.AddMinutes(13))
            ],
            AlertStatus.Resolved =>
            [
                CreateStatusEvent(alertId, AlertStatus.New, AlertStatus.InProgress, createdAt.AddMinutes(4)),
                CreateStatusEvent(alertId, AlertStatus.InProgress, AlertStatus.Resolved, createdAt.AddMinutes(25))
            ],
            AlertStatus.FalsePositive =>
            [
                CreateStatusEvent(alertId, AlertStatus.New, AlertStatus.FalsePositive, createdAt.AddMinutes(10))
            ],
            _ => []
        };
    }

    private static AlertStatusEvent CreateStatusEvent(
        string alertId,
        AlertStatus previousStatus,
        AlertStatus newStatus,
        DateTimeOffset changedAt)
    {
        return new AlertStatusEvent
        {
            Id = Guid.NewGuid(),
            AlertId = alertId,
            PreviousStatus = previousStatus,
            NewStatus = newStatus,
            ChangedAt = changedAt,
            ChangedBy = "import"
        };
    }

    private static JsonSerializerOptions JsonOptions =>
        new(JsonSerializerDefaults.Web)
        {
            Converters =
            {
                new JsonStringEnumConverter(allowIntegerValues: false)
            }
        };

    private static object Error(string code, string message) =>
        new
        {
            error = new
            {
                code,
                message
            }
        };

    private sealed record AlertImportRecord(
        string Id,
        string Title,
        AlertSeverity Severity,
        AlertStatus Status,
        string Source,
        DateTimeOffset CreatedAt,
        string? Assignee);

    private sealed record AlertSortTerm(string Key, bool Descending);
}
