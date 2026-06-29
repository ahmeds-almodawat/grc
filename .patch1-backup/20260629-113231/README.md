# GRC Control Center

GRC Control Center is a bilingual Arabic/English, RTL-ready governance, risk, compliance, audit, OVR, projects/tasks, evidence, approvals, reporting, and controlled-pilot readiness platform for a hospital/company environment.

The project is designed for internal governance operations where confidentiality, role-based access, Row Level Security, restore proof, and human release approval are critical.

## Current status

**Status:** controlled internal pilot evidence stage.

The project is **not production ready yet**.

Latest verified evidence state:

```text
Technical controlled-pilot readiness: strong / passed
Module acceptance evidence: passed with warnings
Runtime security bridge: passed
Authenticated persona proof: passed
Restore dry-run: passed
SQL evidence capture: passed
Human approval: pending
Production readiness: not yet
```

Current expected `proof:all` state before real human approval:

```text
16 passed / 1 failed
only failed command: v66:strict-proof
reason: real Management/Admin, IT, Quality signoff and OVR confidentiality confirmation are still missing
```

Do not bypass this failure. It is an intentional release gate.

## Main modules

- Governance and controlled release gates
- Risk and compliance tracking
- Audit evidence and proof reporting
- OVR / incident workflow readiness
- Projects and tasks
- Evidence attachments and release reports
- Approvals and manual signoff
- Runtime security bridge checks
- Persona-based authorization proof
- Reporting and management review packs

## Safety and confidentiality rules

During controlled pilot:

- Use synthetic or non-confidential data only.
- Do not use real patient identifiers.
- Do not use confidential OVR details.
- Do not mark the platform production ready.
- Do not bypass `v66:strict-proof`.
- Do not fake human approval files.
- Do not remove the final human signoff gate.

Recommended controlled pilot scope:

```text
Controlled internal pilot for GRC Control Center using synthetic/non-confidential data only.
Pilot limited to 5–15 internal users.
No real patient identifiers.
No confidential OVR details.
No production rollout.
```

## Tech stack

- React
- TypeScript
- Vite
- Supabase
- Supabase Edge Functions / runtime bridges
- PostgreSQL / PLpgSQL
- Playwright / Vitest where applicable
- Node.js tooling

## Local setup

From the project root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
npm install
npm run typecheck
npm run build
```

Start local development:

```powershell
npm run dev
```

## Important commands

Run static checks:

```powershell
npm run typecheck
npm run build
```

Run the safe CI-equivalent static wrapper:

```powershell
npm run ci:static
```

Run module acceptance evidence:

```powershell
npm run v73:all
```

Expected v7.3 module acceptance result:

```text
status: passed_with_warnings
strict_passed: true
failed: 0
blocking_failures: 0
```

Run full proof suite:

```powershell
npm run proof:all
```

Expected result before real signoff:

```text
status: failed_review_required
passed_count: 16
failed_count: 1
failed_commands: ["v66:strict-proof"]
```

## Human signoff requirement

The final controlled-pilot gate requires real human completion of:

```text
release\v674\approvals\pilot-signoff.json
release\v674\approvals\ovr-confidentiality-confirmation.json
```

Required approval areas:

- Management/Admin
- IT
- Quality
- IT confidentiality reviewer
- Quality confidentiality reviewer

After real approvals are completed, run:

```powershell
npm run v674:signoff-check
npm run v674:sync-manual-evidence
npm run v66:strict-proof
npm run proof:all
```

Expected after real approval:

```text
v674:signoff-check = strict_passed true
v66:strict-proof = passed
proof:all = fully passed
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture, security model, evidence flow, and pilot boundaries.
- [`docs/RELEASE_POLICY.md`](docs/RELEASE_POLICY.md) — internal evidence versions, semantic versioning plan, and release gates.
- [`docs/V73_MODULE_ACCEPTANCE_EVIDENCE_PACK.md`](docs/V73_MODULE_ACCEPTANCE_EVIDENCE_PACK.md) — v7.3 acceptance evidence pack notes.
- [`docs/V74_REPO_HARDENING.md`](docs/V74_REPO_HARDENING.md) — v7.4 repo hardening summary.

## Production readiness statement

The platform should not be considered production ready until all of the following are complete:

1. Real human approval and confidentiality confirmation are completed.
2. `proof:all` fully passes.
3. Staging/live Supabase RLS and persona tests are executed against a real environment.
4. CI/CD is passing on GitHub.
5. Deployment process and rollback process are documented and tested.
6. Controlled pilot results are reviewed by Management/Admin, IT, and Quality.
