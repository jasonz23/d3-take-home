# Demo Video

https://www.loom.com/share/faa22fa0564a411b87acbcfd3b6f58b5

# Alert Triage Mini-View

SOC alert triage app built as a monorepo:

```text
Next.js + TypeScript -> ASP.NET Core 8 Web API -> EF Core -> PostgreSQL 16
```

The frontend never connects to PostgreSQL or imports alert JSON directly. Alert reads, filtering, sorting, pagination, imports, status updates, assignee updates, audit history, and analytics all go through the ASP.NET API.

## Run Locally

```bash
docker compose up -d
./backend/scripts/setup-backend.sh
./backend/scripts/run-backend.sh
```

In another terminal:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Import mock data after the API starts:

```bash
curl -F "file=@backend/AlertTriage.Api/Data/alerts.json;type=application/json" \
  http://localhost:8182/api/alerts/import
```

Frontend: `http://localhost:8181`  
Analytics: `http://localhost:8181/charts`  
API/Swagger: `http://localhost:8182/swagger`

## Key Decisions And Trade-Offs

- Kept ASP.NET as the system of record. This is more setup than a frontend-only demo, but it matches the requested production boundary and keeps DB credentials out of the browser.
- Made filtering, sorting, pagination, search, import validation, status updates, assignee updates, and analytics API-owned. The UI stays thin and refresh/share works because filters and page state are mirrored into the URL.
- Used EF Core with PostgreSQL and checked-in migrations. The reset/setup flow does not auto-seed; mock alerts are imported explicitly through the API so local state is predictable.
- Added optimistic updates with `version` conflict checks for status and assignee changes. This is simple and visible for a take-home; production should use a stronger row-version strategy.
- Added `AlertStatusEvent` audit rows and an Investigation Timeline in the drawer. This makes the stored audit trail visible instead of only persisting it.
- Added keyboard-first triage, accessible focus handling, sticky filters/table headers, loading/empty states, toasts, and Chart.js analytics. These are practical SOC workflow improvements rather than decorative UI.

## UX Improvements

- **Keyboard-first triage:** Shortcuts (`J/K`, `Enter`, `/`, `Esc`, `1-5`) reduce repetitive mouse interaction during high-volume investigations.
- **Accessible visual controls:** Semantic tables, visible focus states, ARIA labels, live status messages, and non-color-only badges make the queue usable with keyboards and assistive technology.
- **Sticky filters and table header:** Search, filters, and column labels stay available while analysts scan long alert queues.
- **Assignee editing:** Updating ownership directly in the drawer keeps triage flow fast without leaving the selected alert.
- **Investigation timeline:** Status history in the side drawer turns audit events into a readable investigation narrative.
- **Analytics charts page:** Chart.js summaries expose severity, status, source, assignee workload, and created-over-time trends without exporting data.
- **Pagination with URL state:** Page, page size, filters, search, and sort persist in the URL so analysts can refresh or share the same queue view.

## AI Coding Agent Usage

I used Codex as the primary coding agent to scaffold and iterate on the monorepo. I delegated repetitive implementation work: ASP.NET controller/contracts/tests, EF models and migrations, Next.js components, Tailwind layout, Playwright tests, mock data generation, scripts, and README updates.

I used terminal commands, Docker, `dotnet test`, `npm run lint`, `npm run typecheck`, `npm run test:e2e`, and `npm run build` as verification tools. I did not rely on generated code without running it.

I overrode or corrected agent assumptions when runtime checks showed issues: .NET 8 pathing on a machine with .NET 10 installed, `dotnet-ef` setup, API startup seeding versus manual import, EF content include behavior, CORS/port changes, status-event tracking, brittle Playwright selectors, and Chart.js client-only rendering.

## Production Follow-Ups

For production, I would add real authentication/authorization, derive `ChangedBy` from the authenticated analyst, move secrets to managed secret storage, harden CORS, add structured logs/metrics/tracing, enforce valid status-transition rules, and use PostgreSQL-native concurrency such as `xmin` or a dedicated row-version column.

For performance, I would add caching for read-heavy endpoints such as alert summaries, source lists, and stable filter metadata, with explicit invalidation after imports or status/assignee updates. I would also optimize query paths with production-scale indexes, keyset pagination for deep queues, full-text or trigram search tuning, response compression, API pagination limits, and background jobs for expensive analytics.

For operational hardening, I would add server-side rate limits, file scanning and size limits for imports, audit-log retention policies, backup/restore checks, PostgreSQL integration tests, and broader load testing around search, filtering, and concurrent triage updates.
