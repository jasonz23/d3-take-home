# Frontend Agent Notes

- Follow existing component boundaries: table, filters, drawer, badges, charts, API/types, and utilities.
- Keep new work modular. Split code by feature and responsibility so multiple agents can safely work in parallel.
- Favor compact enterprise UI over marketing layouts or decorative cards.
- Keep controls accessible: real buttons/selects/inputs, clear labels, keyboard support, and stable focus.
- Do not fetch mock JSON directly; all alert data comes from the ASP.NET API.
- Use optimistic UI only with rollback/error handling for failed API calls.
- Avoid unnecessary effects and state. Use `useMemo` for expensive derived values and `useCallback` for handlers passed across component boundaries.
- Watch render behavior when changing shared state, tables, drawers, charts, or keyboard handlers.
- Run `npm run lint`, `npm run typecheck`, and `npm run test:e2e` before handing off UI changes.
