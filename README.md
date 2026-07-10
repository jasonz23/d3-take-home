# Alert Triage Mini-View

SOC alert triage app built as a monorepo:

```text
Next.js + TypeScript frontend -> ASP.NET Core 8 API -> EF Core -> PostgreSQL 16
```

The frontend never reads the seed JSON, connects to PostgreSQL, uses Prisma, or defines Next.js API routes. The ASP.NET API owns alert reads, filtering, sorting, status and assignee updates, optimistic concurrency, audit logging, and JSON import.

The mock alert JSON lives at `backend/AlertTriage.Api/Data/alerts.json` and contains 200 alerts with exactly these fields: `id`, `title`, `severity`, `status`, `source`, `createdAt`, and `assignee`.

## Run

```bash
docker compose up -d
```

```bash
cd backend/AlertTriage.Api
dotnet restore
dotnet ef database update
dotnet run --urls http://localhost:8182
```

After the API starts, import the mock data when needed:

```bash
curl -F "file=@backend/AlertTriage.Api/Data/alerts.json;type=application/json" \
  http://localhost:8182/api/alerts/import
```

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Services: frontend `http://localhost:8181`, analytics `http://localhost:8181/charts`, API `http://localhost:8182`, Swagger `http://localhost:8182/swagger`, PostgreSQL `localhost:7433`.

## Tests

```bash
cd backend/AlertTriage.Api.Tests && dotnet test
cd frontend && npm run lint && npm run typecheck && npm run test:e2e
```

## Key Decisions And Trade-Offs

- Kept the C# API as the system of record. This adds more setup than a frontend-only demo, but matches the requested production boundary and keeps DB credentials out of the browser.
- Used EF Core with a checked-in initial migration and a JSON import endpoint for `Data/alerts.json`. Local setup/reset does not seed automatically, so uploaded data is explicit and repeatable.
- Status and assignee updates require the caller’s current `version`; stale writes return `409 VERSION_CONFLICT`. This is simple and visible in the UI, though a production system should use a stronger row-version strategy.
- Alert list filtering, sorting, and pagination are API-owned (`page`, `pageSize`, filter params) and mirrored into the browser URL so refresh/share preserves the analyst's current queue view.
- Alert JSON uploads go through `POST /api/alerts/import`; the API validates the field shape, replaces the mock alert set transactionally, and persists imported alerts through EF Core.
- Alert analytics use Chart.js on `/charts` backed by `GET /api/alerts/summary`, so aggregation stays in the ASP.NET API instead of the browser fetching every row.
- Added `AlertStatusEvent` rows for both real updates and seeded non-new alerts, then display them as an Investigation Timeline in the drawer.
- UX improvement: keyboard-first triage with global shortcuts (`J/K`, `Enter`, `/`, `Esc`, `1-5`) to reduce repetitive mouse interaction during high-volume investigations.
- Added accessibility polish: row-level keyboard navigation, drawer focus trap/restore, visible focus states, ARIA labels/live status messages, skeleton loading, and URL-persisted filters.

## AI Coding Agent Usage

I used Codex as the primary coding agent to scaffold the monorepo, generate the ASP.NET/EF Core backend, build the Next.js UI, and iterate on tests. I used shell commands, Docker, Playwright, and a Dockerized `.NET 8 SDK` as verification tools rather than delegating to another agent.

I overrode or corrected agent-generated assumptions where runtime checks proved them wrong: the SDK-style `.csproj` duplicate content include, ASP.NET record validation metadata placement, EF tracking for new `AlertStatusEvent` inserts, CORS for alternate local ports, and brittle Playwright selectors. The final changes were driven by compile/test/live API feedback, not just generated code.

## Production Follow-Ups

Add real analyst authentication/authorization, derive `ChangedBy` from the authenticated principal, move secrets to environment-specific secret storage, harden CORS, add structured logs/metrics/tracing, enforce valid status-transition rules, and use PostgreSQL-native concurrency such as `xmin` or a dedicated row-version column.
