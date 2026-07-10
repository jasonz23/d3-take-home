namespace AlertTriage.Api.Contracts;

public sealed record ImportAlertsResponse(
    int Imported,
    string Message);
