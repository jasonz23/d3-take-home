namespace AlertTriage.Api.Contracts;

public sealed record AlertSummaryResponse(AlertSummaryData Data);

public sealed record AlertSummaryData(
    int Total,
    int Unresolved,
    int Critical,
    int Unassigned,
    DateTimeOffset? LastUpdatedAt,
    IReadOnlyList<AlertCountBucket> BySeverity,
    IReadOnlyList<AlertCountBucket> ByStatus,
    IReadOnlyList<AlertCountBucket> BySource,
    IReadOnlyList<AlertCountBucket> ByAssignee,
    IReadOnlyList<AlertCountBucket> CreatedByDay);

public sealed record AlertCountBucket(string Label, int Count);
