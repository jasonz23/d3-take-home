namespace AlertTriage.Api.Models;

public sealed class AlertStatusEvent
{
    public Guid Id { get; set; }
    public string AlertId { get; set; } = default!;
    public AlertStatus PreviousStatus { get; set; }
    public AlertStatus NewStatus { get; set; }
    public DateTimeOffset ChangedAt { get; set; }
    public string ChangedBy { get; set; } = "demo-analyst";

    public Alert Alert { get; set; } = default!;
}
