# Alert Triage Backend

ASP.NET Core 8 Web API for alert reads, filtering, sorting, status and assignee updates, audit history, and JSON import. The API runs on `http://localhost:8182` and uses PostgreSQL on `localhost:7433`.

## Prerequisites

- Docker Desktop
- .NET 8 SDK
- EF Core CLI tool, installed by the setup script if missing

On this Mac, Homebrew may keep .NET 8 at `/opt/homebrew/opt/dotnet@8`. The scripts below automatically use that path when it exists.

## One-Time Setup

From the repo root:

```bash
./backend/scripts/setup-backend.sh
```

This starts PostgreSQL with Docker Compose, restores NuGet packages, installs `dotnet-ef` if needed, and applies the checked-in EF migration.

It does not seed alerts. Upload alert JSON manually after the API is running.

## Reset Database

From the repo root:

```bash
./backend/scripts/reset-database.sh
```

This drops the local PostgreSQL database, recreates the EF schema from migrations, and leaves the alert tables empty. It does not import `AlertTriage.Api/Data/alerts.json`.

## Run The API

```bash
./backend/scripts/run-backend.sh
```

Then open:

```text
API:     http://localhost:8182/api/alerts
Swagger: http://localhost:8182/swagger
```

Alert list query parameters:

```text
search
severity
status
source
sort
sortBy
sortDirection
page
pageSize
```

Use `sort` for multi-column ordering:

```text
sort=severity:asc,status:desc,createdAt:desc
```

`sortBy` and `sortDirection` are still accepted for single-column legacy requests.

Example:

```text
http://localhost:8182/api/alerts?severity=Critical&status=New&sort=severity:asc,status:desc,createdAt:desc&page=2&pageSize=25
```

Analytics summary:

```bash
curl http://localhost:8182/api/alerts/summary
```

This returns aggregate buckets for severity, status, source, assignee, and created date.

Update assignee:

```bash
curl -X PATCH http://localhost:8182/api/alerts/alert-001/assignee \
  -H "Content-Type: application/json" \
  -d '{"assignee":"Maya Chen","version":1}'
```

Send `null` or a blank string to clear the assignee. The API trims names, enforces the 200-character database limit, and returns `409 VERSION_CONFLICT` if the alert changed since the caller loaded it.

## Import Alert JSON

The seed/import file shape is:

```json
[
  {
    "id": "alert-001",
    "title": "Suspicious PowerShell execution",
    "severity": "Critical",
    "status": "New",
    "source": "CrowdStrike",
    "createdAt": "2026-07-09T18:00:00.000Z",
    "assignee": null
  }
]
```

The checked-in mock dataset is `AlertTriage.Api/Data/alerts.json` and contains 200 alerts with those exact fields.

Upload endpoint:

```bash
curl -F "file=@AlertTriage.Api/Data/alerts.json;type=application/json" \
  http://localhost:8182/api/alerts/import
```

The import endpoint validates the JSON field shape, rejects duplicate IDs or unknown fields, replaces the current mock alert set, and saves the uploaded alerts to PostgreSQL through EF Core.

## Manual Commands

Use these if you do not want to run the helper scripts:

```bash
docker compose up -d

cd backend/AlertTriage.Api
dotnet restore
dotnet tool install --global dotnet-ef --version 8.0.4
dotnet ef database update
dotnet run --urls http://localhost:8182
```

If `dotnet-ef` is already installed, replace the install command with:

```bash
dotnet tool update --global dotnet-ef --version 8.0.4
```

```bash
export DOTNET_ROOT="/opt/homebrew/opt/dotnet@8/libexec"
export PATH="/opt/homebrew/opt/dotnet@8/bin:$HOME/.dotnet/tools:$PATH"
```

## Tests

```bash
./backend/scripts/test-backend.sh
```

## Notes

- The seed data lives in `AlertTriage.Api/Data/alerts.json`.
- The API does not auto-seed on startup; import JSON manually when you want mock alerts in the database.
- The frontend should call `NEXT_PUBLIC_API_URL=http://localhost:8182`.
