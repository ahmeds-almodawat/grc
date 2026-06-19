# Demo data boundary

Demo fixtures must live under `src/demo` only.

Production rules:

- `src/lib`, `src/pages`, and `src/components` must not import from `src/demo` directly.
- Demo data must only be loaded behind `isDemoDataAllowed()`.
- `VITE_ALLOW_DEMO_DATA` must be unset or `false` in production.
- Empty Supabase responses must show empty states, not fictional records.
