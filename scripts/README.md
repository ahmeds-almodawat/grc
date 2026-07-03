# Validation & CI/CD Scripts

This folder contains all custom validation scripts used to audit UI integrity, database schemas, and edge-bridge security.

- `npm run proof:all` executes all schema, workflow, and frontend tests.
- `npm run v700:runtime-security` ensures no dangerous `SECURITY DEFINER` grants exist on public mutations.
- **Do not delete or rename these files** casually, as they are referenced heavily in `package.json` for CI/CD checks.
