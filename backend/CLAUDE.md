# Backend Agent Notes

- ASP.NET Core API is the system of record; the frontend must never access PostgreSQL directly.
- Keep changes scoped: contracts, controllers, EF models, migrations, seed/import logic, and tests should stay separated.
- Validate inputs at the API boundary and return consistent error payloads.
- Use async EF calls with cancellation tokens. Avoid hidden startup seeding; data is imported through the API.
- Add or update xUnit tests for backend behavior changes.
- Before handing off, run `./backend/scripts/test-backend.sh` from the repo root and make sure it passes.
