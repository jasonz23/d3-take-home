# Alert Triage Frontend

Next.js App Router client for the Alert Triage API.

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend runs at `http://localhost:8181` and expects the API at `http://localhost:8182`.

The app calls `NEXT_PUBLIC_API_URL` over HTTP and does not connect to PostgreSQL directly.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test:e2e
```
