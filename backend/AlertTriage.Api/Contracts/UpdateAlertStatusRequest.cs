using System.ComponentModel.DataAnnotations;
using AlertTriage.Api.Models;

namespace AlertTriage.Api.Contracts;

public sealed record UpdateAlertStatusRequest(
    AlertStatus Status,
    [Range(1, int.MaxValue)] int Version);

public sealed record UpdateAlertStatusResponse(AlertResponse Data);
