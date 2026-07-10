using System.Text.Json;
using System.Text.Json.Serialization;
using AlertTriage.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AlertTriage.Api.Data;

public static class AlertSeeder
{
    public static async Task SeedAsync(AlertDbContext db)
    {
        if (await db.Alerts.AnyAsync())
        {
            return;
        }

        var path = Path.Combine(
            AppContext.BaseDirectory,
            "Data",
            "alerts.json");

        var json = await File.ReadAllTextAsync(path);
        var alerts = JsonSerializer.Deserialize<List<AlertSeedRecord>>(
            json,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters =
                {
                    new JsonStringEnumConverter(allowIntegerValues: false)
                }
            });

        if (alerts is null)
        {
            throw new InvalidOperationException("The alerts JSON file could not be parsed.");
        }

        var duplicateIds = alerts
            .GroupBy(x => x.Id, StringComparer.OrdinalIgnoreCase)
            .Where(x => x.Count() > 1)
            .Select(x => x.Key)
            .ToArray();

        if (duplicateIds.Length > 0)
        {
            throw new InvalidOperationException(
                $"The alerts JSON file contains duplicate IDs: {string.Join(", ", duplicateIds)}.");
        }

        db.Alerts.AddRange(alerts.Select(ToAlert));
        await db.SaveChangesAsync();
    }

    private static Alert ToAlert(AlertSeedRecord record)
    {
        if (string.IsNullOrWhiteSpace(record.Id) ||
            string.IsNullOrWhiteSpace(record.Title) ||
            string.IsNullOrWhiteSpace(record.Source))
        {
            throw new InvalidOperationException("Each seeded alert requires id, title, and source.");
        }

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

        foreach (var statusEvent in BuildStatusHistory(alert.Id, record.Status, record.CreatedAt))
        {
            alert.StatusEvents.Add(statusEvent);
            alert.UpdatedAt = statusEvent.ChangedAt;
            alert.Version++;
        }

        return alert;
    }

    private static IEnumerable<AlertStatusEvent> BuildStatusHistory(
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
            ChangedBy = "demo-analyst"
        };
    }

    private sealed record AlertSeedRecord(
        string Id,
        string Title,
        AlertSeverity Severity,
        AlertStatus Status,
        string Source,
        DateTimeOffset CreatedAt,
        string? Assignee);
}
