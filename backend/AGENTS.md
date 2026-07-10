# Backend Agent Notes

- Prefer small, testable C# changes over broad refactors.
- Keep EF migrations explicit and checked in when schema/index behavior changes.
- Preserve optimistic concurrency with `Version` on mutable alert updates.
- Search, filtering, sorting, pagination, imports, status updates, assignee updates, audit history, and analytics belong in the API.
- Do not add Prisma, Next.js API routes, or database credentials to the frontend.
- Always verify backend changes with `./backend/scripts/test-backend.sh`.
