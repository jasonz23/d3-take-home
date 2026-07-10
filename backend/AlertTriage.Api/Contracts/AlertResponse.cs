using AlertTriage.Api.Models;

namespace AlertTriage.Api.Contracts;

public sealed record AlertResponse(
    string Id,
    string Title,
    AlertSeverity Severity,
    AlertStatus Status,
    string Source,
    DateTimeOffset CreatedAt,
    string? Assignee,
    DateTimeOffset UpdatedAt,
    int Version,
    IReadOnlyList<AlertStatusEventResponse>? StatusHistory = null)
{
    public static AlertResponse From(Alert alert, bool includeHistory = false)
    {
        var history = includeHistory
            ? alert.StatusEvents
                .OrderBy(x => x.ChangedAt)
                .Select(AlertStatusEventResponse.From)
                .ToArray()
            : null;

        return new AlertResponse(
            alert.Id,
            alert.Title,
            alert.Severity,
            alert.Status,
            alert.Source,
            alert.CreatedAt,
            alert.Assignee,
            alert.UpdatedAt,
            alert.Version,
            history);
    }
}

public sealed record AlertStatusEventResponse(
    AlertStatus PreviousStatus,
    AlertStatus NewStatus,
    DateTimeOffset ChangedAt,
    string ChangedBy)
{
    public static AlertStatusEventResponse From(AlertStatusEvent statusEvent) =>
        new(
            statusEvent.PreviousStatus,
            statusEvent.NewStatus,
            statusEvent.ChangedAt,
            statusEvent.ChangedBy);
}
