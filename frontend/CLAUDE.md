# Frontend Agent Notes

- Build with Next.js App Router, TypeScript, Tailwind, Zod, native fetch, Lucide icons, Playwright, and Chart.js where relevant.
- Keep the UI professional for SOC analysts: dense, scannable, keyboard-friendly, accessible, and responsive.
- Keep code modular and split features enough that agents can work in parallel without editing the same files unnecessarily.
- Use semantic HTML, visible focus states, ARIA labels, non-color-only badges, and drawer focus management.
- Keep API calls in `lib/api.ts`; do not add Next.js route handlers, Prisma, database access, or credentials.
- Preserve URL state for search, filters, sorting, and pagination.
- Do not abuse `useEffect`; use it for synchronization, not derived state. Use `useCallback` and `useMemo` where they reduce rerenders or stabilize props.
- Consider render cost before adding state. Prefer derived values, stable handlers, and focused component boundaries.
- Verify meaningful frontend changes with `npm run lint`, `npm run typecheck`, and `npm run test:e2e`.
