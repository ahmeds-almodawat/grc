# Patch 21 GitHub Sync Diagnostic

Generated: 2026-07-02

## 1. Current Local Branch

- Branch: `main`

## 2. Local HEAD Commit

- `aef754ef17b5f84b778212b6092a4106d3d568b3`
- Short: `aef754e`
- Decorate: `HEAD -> main`

## 3. origin/main Commit

- `aef754ef17b5f84b778212b6092a4106d3d568b3`
- Short: `aef754e`
- Decorate: `origin/main`, `origin/HEAD`

## 4. Ahead / Behind

- `git rev-list --left-right --count origin/main...HEAD`: `0 0`
- Current `main` is not ahead of `origin/main`.
- Current `main` is not behind `origin/main`.

## 5. Patch 21 Files Exist Locally

On current working branch `main`:

- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql`: missing
- `scripts/patch21-assign-owner-role.mjs`: missing
- `release/patch21/ovr-workflow-hardening-checklist.md`: missing

On local branch `patch21-ovr-hardening-owner-role`:

- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql`: present
- `scripts/patch21-assign-owner-role.mjs`: present
- `release/patch21/ovr-workflow-hardening-checklist.md`: present

On local branch `ui-platform-shell-refactor`:

- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql`: present
- `scripts/patch21-assign-owner-role.mjs`: present
- `release/patch21/ovr-workflow-hardening-checklist.md`: present

## 6. Patch 21 Files Exist On origin/main

On `origin/main`:

- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql`: missing
- `scripts/patch21-assign-owner-role.mjs`: missing
- `release/patch21/ovr-workflow-hardening-checklist.md`: missing

Important nuance: `origin/main` does contain some generated `release/patch21/*.json` proof artifacts, but it does not contain the Patch 21 migration, owner assignment script, or checklist file.

## 7. Patch 21 Strings Exist Anywhere Locally

Current `main` working tree has limited Patch 21 strings only in generated release/proof artifacts, not in implementation files:

- `patch21`: found in generated release files.
- `083_patch21`: found in generated release files.
- `containment_required`: found in generated release files.
- `duplicate_of_ovr_id`: found in generated release files.

Current `main` implementation files checked:

- `package.json`: no Patch 21 script.
- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql`: missing.
- `src/types/domain.ts`: no `owner` app role and no Patch 21 OVR fields except older/pre-existing `rca_required`.
- `src/pages/OVR.tsx`: no Patch 21 OVR controls.
- `src/lib/grcApi.ts`: no `updateOvrPatch21Controls` bridge.
- `src/auth/authTypes.ts`: no `owner` app role.
- `src/auth/authAccess.ts`: no `owner` role in access groups.

Local branch `patch21-ovr-hardening-owner-role` has Patch 21 implementation strings in:

- `package.json`
- `scripts/patch21-assign-owner-role.mjs`
- `scripts/patch21-ovr-hardening-proof.mjs`
- `src/auth/authTypes.ts`
- `src/auth/authAccess.ts`
- `src/types/domain.ts`
- `src/pages/OVR.tsx`
- `src/lib/grcApi.ts`
- `src/lib/userManagementApi.ts`
- `supabase/functions/privileged-action/index.ts`
- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql`
- `release/patch21/*`

## 8. Patch 21 In Another Local Branch

Yes.

Branches containing Patch 21 files/strings:

- `patch21-ovr-hardening-owner-role`
- `ui-platform-shell-refactor`

Branch divergence:

- `origin/main...patch21-ovr-hardening-owner-role`: `1 2`
  - The Patch 21 branch is 2 commits ahead of `origin/main`.
  - The Patch 21 branch is 1 commit behind `origin/main`.
- `origin/main...ui-platform-shell-refactor`: `1 4`
  - The UI refactor branch includes Patch 21 plus later layout/refactor commits.

Patch 21 branch commits not on `origin/main`:

- `2929929 Checkpoint before Patch 21 OVR hardening`
- `f8cd890 Checkpoint before full platform layout refactor`

## 9. Patch 21 In Stash

- `git stash list`: empty
- Patch 21 is not in stash.

## 10. Uncommitted Changes

Before creating this diagnostic report:

- `git status --short --branch`: `## main...origin/main`
- No uncommitted code changes were present.

After creating this report:

- The only intentional new file from this audit is `release/patch21/github-sync-diagnostic.md`.

## 11. Merge Conflict Markers

Yes. Line-start conflict markers exist in generated release/evidence files.

Marker counts:

- `^<<<<<<<`: 76
- `^=======`: 76
- `^>>>>>>>`: 76

Examples include:

- `release/v62/v62-real-data-static-audit.json`
- `release/v64/V64_DATABASE_SECURITY_PROOF_REPORT.md`
- `release/v64/v64-rls-static-audit.json`
- `release/v66/V66_GO_NO_GO_GATE.md`
- `release/v672/v672-local-evidence-capture.json`
- `release/v673/V673_SECURITY_DEFINER_EXECUTE_AUDIT.md`
- `release/v700/runtime-security-bridge-audit.json`
- `release/v72/real-authenticated-persona-proof.json`

These markers are present in the current `main` tree and also visible from `origin/main` for at least `release/v700/proof-suite-all.json`.

## 12. release/v700/proof-suite-all.json Corruption

Yes. `release/v700/proof-suite-all.json` is corrupted by conflict markers.

Markers found:

- Line 2: `<<<<<<< Updated upstream`
- Line 4: `=======`
- Line 6: `>>>>>>> Stashed changes`

The same markers are present in `origin/main:release/v700/proof-suite-all.json`.

## 13. Expected Patch 21 Items

### Required Files

On `patch21-ovr-hardening-owner-role`:

- Migration 083: present.
- Owner assignment script: present.
- OVR hardening checklist: present.

On `main` / `origin/main`:

- Migration 083: missing.
- Owner assignment script: missing.
- OVR hardening checklist: missing.

### Owner Role

On `patch21-ovr-hardening-owner-role`:

- `supabase/migrations/083_patch21_ovr_workflow_hardening.sql` adds `owner` to `public.app_role`.
- `src/types/domain.ts` includes `owner`.
- `src/auth/authTypes.ts` includes `owner`.
- `src/auth/authAccess.ts` includes `owner` in role groups.

On `main` / `origin/main`:

- `owner` is not present as an app role in the checked role definition files.

### OVR Fields

Exact expected names on `patch21-ovr-hardening-owner-role`:

- `is_anonymous`: not present as implementation field; branch uses `anonymous_report`.
- `reporter_visibility_mode`: not present; branch uses `reporter_visibility_level` and `audit_visibility_mode`.
- `containment_required`: present.
- `containment_status`: present.
- `capa_action_level`: not present; branch uses `action_level`, `corrective_action_required`, and CAPA due/status logic.
- `dispute_count`: present.
- `rca_required`: present.
- `committee_required`: not present as exact field; branch uses `committee_review_required` and `committee_status`.
- `conflict_of_interest`: present through `conflict_of_interest_flag`.
- `duplicate_of_ovr_id`: present through `possible_duplicate_of_ovr_id`.
- `repeat_event_flag`: not present; branch uses repeat/repeat-intelligence fields such as `repeat_incident_flag` and `repeat_group_key`.
- `owner_override_reason`: present.

On `main` / `origin/main`, the Patch 21 OVR implementation fields are not present in source/migration files. Some names appear only in generated release artifacts or older OVR fields.

### OVR Workflow Behavior On Patch 21 Branch

The branch `patch21-ovr-hardening-owner-role` contains proof and SQL indicators for:

- Quality immediate notification on submitted OVRs.
- Urgent/high/critical containment and target alert bypass behavior.
- Anonymous reporter masking for non-owner views with owner reveal audit.
- Action-level logic so CAPA is not mandatory for every accepted OVR.
- One-time reporter dispute enforcement through `dispute_count` and `PATCH21_OVR_ONE_DISPUTE_ONLY`.
- Closure guard through `patch21_can_close_ovr`.
- Owner override/reopen reason and audit events.

The branch's `release/patch21/ovr-workflow-hardening-summary.json` reports:

- `status`: `passed`
- `passed_count`: 23
- `failed_count`: 0

These behaviors are not implemented on current `main` / `origin/main` because the migration and source changes are absent there.

## 14. Exact Conclusion

Patch 21 exists on another branch and is implemented locally but not pushed to GitHub/main.

More precise conclusion:

- Patch 21 is not lost.
- Patch 21 is not on current `main`.
- Patch 21 is not on `origin/main`.
- Patch 21 is not in stash.
- Patch 21 implementation exists on local branch `patch21-ovr-hardening-owner-role`.
- The later local branch `ui-platform-shell-refactor` also contains Patch 21.
- The Patch 21 branch has some field-name differences from the exact checklist names, but it contains equivalent OVR hardening concepts and a passing local Patch 21 proof artifact.
- `origin/main` contains corrupted generated release proof JSON/MD files with conflict markers, including `release/v700/proof-suite-all.json`.

## 15. Recommended Next Command

Do not merge blindly. First switch to the Patch 21 branch for review:

```powershell
git switch patch21-ovr-hardening-owner-role
```

After review, the safer follow-up would be to create a clean sync branch from current `main` and selectively cherry-pick only the Patch 21 implementation files, excluding generated conflict-marker release artifacts and unrelated DB cleanup dumps.
