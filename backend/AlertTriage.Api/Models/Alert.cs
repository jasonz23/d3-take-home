namespace AlertTriage.Api.Models;

public enum AlertSeverity
{
    Low,
    Medium,
    High,
    Critical
}

public enum AlertStatus
{
    New,
    InProgress,
    Escalated,
    Resolved,
    FalsePositive
}

public sealed class Alert
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public AlertSeverity Severity { get; set; }
    public AlertStatus Status { get; set; }
    public string Source { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
    public string? Assignee { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public int Version { get; set; } = 1;

    public ICollection<AlertStatusEvent> StatusEvents { get; set; } = [];
}
