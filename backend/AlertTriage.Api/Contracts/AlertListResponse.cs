namespace AlertTriage.Api.Contracts;

public sealed record AlertListResponse(
    IReadOnlyList<AlertResponse> Data,
    AlertListMeta Meta);

public sealed record AlertListMeta(
    int Total,
    int Filtered,
    int Page,
    int PageSize,
    int TotalPages,
    IReadOnlyList<string> Sources);
