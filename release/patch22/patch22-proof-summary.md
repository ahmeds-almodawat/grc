# Patch 22 Proof Summary

## Status

Patch 22 implementation gates passed. The broader all-proof suite still requires pre-existing environment/evidence/security remediation outside Patch 22.

## Commands

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run patch22:all`: passed.
  - Patch 22 workflow audit: 166/166 checks passed.
  - Patch 22 security audit: 48/48 checks passed.
- `npm run proof:all`: failed in broader legacy proof gates after Patch 22 checks passed.
  - Passed commands: 13.
  - Failed commands: 4.
  - Failed commands: `v673:security-definer-audit`, `v672:capture`, `v662:strict-proof`, `v66:strict-proof`.
  - `v674:restore-dryrun` now passes after removing merge markers from generated evidence JSON.
- `npm run v700:runtime-security`: command exit code 0, but generated report status is `critical_remediation_required`.
  - `service_role_only_rpc_called_by_frontend`: 0.
  - `service_role_only_rpc_without_bridge_plan`: 0.
  - Remaining broad security-definer grants are reported outside the new Patch 22 bridge.

## Proof Cleanup

- Removed merge conflict markers from `release/v66/v66-manual-evidence.json`.
- Regenerated `release/v661/v661-go-no-go-proof.json`.
- Regenerated `release/v661/V661_GO_NO_GO_PROOF_HELPER.md`.
- Confirmed no remaining `<<<<<<<`, `=======`, or `>>>>>>>` conflict markers in `release`, `scripts`, `supabase`, `src`, or `package.json`.

## Remaining Non-Patch-22 Blockers

- `v673:security-definer-audit`: existing broad execute grants remain in the local database proof state.
- `v672:capture`: local SQL evidence capture failed for v64 persona SQL and v65 workflow SQL; v66 pilot evidence SQL passed.
- `v662:strict-proof`: evidence quality remains 4 passed / 2 failed.
- `v66:strict-proof`: controlled pilot gate remains `not_ready_manual_evidence_required` with 2 missing manual evidence items.

## Evidence Files

- `release/patch22/risk-workflow-audit.json`
- `release/patch22/risk-security-audit.json`

## Manual Follow-up

- Apply migration in a controlled environment before testing live workflow actions.
- Manually test authorized and unauthorized role behavior after the migration is applied.
- Manually verify representative closure blockers with real KRI, treatment, acceptance, and review records.
