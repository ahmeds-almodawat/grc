# v7.0 Stabilization A+B — Runtime Security Bridge + Proof Suite

This package intentionally avoids a large runtime rewrite. It delivers the safe first layer of Packages A+B:

- Runtime security bridge inventory and grant comparison.
- Frontend RPC inventory.
- v65 workflow SQL strength audit.
- Real persona test gap report.
- Consolidated proof commands.

## What this package does not do

- It does not restore broad `SECURITY DEFINER` execute grants.
- It does not fake evidence or human approvals.
- It does not move RPCs into Edge Functions yet.
- It does not claim production readiness.
- It does not rewrite migrations or create a baseline.

## Apply

Copy the patch contents into the project root, then run:

```powershell
node scripts/v700-install-stabilization-ab-scripts.mjs
npm run v700:all
```

## New consolidated commands

```powershell
npm run proof:technical
npm run proof:runtime-security
npm run proof:personas
npm run proof:restore
npm run proof:pilot
npm run proof:all
```

`proof:personas` is strict by design. It should fail until real authenticated persona tests exist.

## Main reports

- `release/v700/frontend-rpc-inventory.json`
- `release/v700/runtime-security-bridge-audit.json`
- `release/v700/v65-strength-audit.json`
- `release/v700/real-persona-test-gap-report.json`
- `release/v700/proof-suite-all.json`

## How to use the runtime security report

If `service_role_only_rpc_called_by_frontend` is greater than zero, those browser call sites should be reviewed and usually moved behind Edge Functions with server-side authorization.

Do not solve that by reopening broad execute grants.
