using System.ComponentModel.DataAnnotations;

namespace AlertTriage.Api.Contracts;

public sealed record UpdateAlertAssigneeRequest(
    [MaxLength(200)] string? Assignee,
    [Range(1, int.MaxValue)] int Version);

public sealed record UpdateAlertAssigneeResponse(AlertResponse Data);
