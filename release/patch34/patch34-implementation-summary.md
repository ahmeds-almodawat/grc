# Patch 34 Evidence Bridge Operations Center

Patch 34 exposes the Patch 33 evidence bridge through a live operations page for accreditation, quality, compliance, and executive governance users.

## Added

- `src/lib/evidenceBridgeApi.ts`
- `src/pages/EvidenceBridgeCenter.tsx`
- Quality/Safety hub tab: `Evidence Bridge`
- `scripts/patch34-evidence-bridge-frontend-proof.mjs`
- Package scripts: `patch34:frontend-proof`, `patch34:all`

## Live Areas

- Clause-control-evidence bridge
- Live evidence gap register
- Evidence collection queue
- Overdue evidence requests
- Stale and expired evidence register
- Evidence review queue
- Department evidence readiness
- Clause evidence readiness
- Accreditation live readiness summary
- CAPA, training, SOP, risk, and audit dependencies
- Evidence exception register
- Executive evidence bridge summary

## Security

- Read access uses Patch 33 security-invoker views through the existing Supabase client.
- State-changing actions are exposed only through the existing privileged action bridge wrapper.
- No direct browser RPC calls were added.
- No service-role browser usage was added.
- No migration was required.
