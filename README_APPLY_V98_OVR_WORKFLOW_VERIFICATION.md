# Apply v9.8 OVR Workflow Verification and Gap Closure

This patch verifies and closes only the controlled-pilot gaps in the existing OVR module. It does not replace the module, weaken RLS, use real patient data, modify approval JSON, or declare production readiness.

## Windows PowerShell

```powershell
Set-Location "C:\Users\molte\Downloads\grc-control-center"
npx supabase start
npx supabase migration up --local
npm run typecheck
npm run build
npm run pilot:ovr-workflow-verification
```

If migration `049` was already applied locally, `npx supabase migration up --local` reports that the database is current.

## Current local migration-history fallback

This workspace has previously had an old duplicate `016` migration-history entry. If `npx supabase migration up --local` refuses to continue because of that pre-existing mismatch, apply only migration `049` with:

```powershell
Set-Location "C:\Users\molte\Downloads\grc-control-center"
Get-Content ".\supabase\migrations\049_v98_ovr_workflow_gap_closure.sql" -Raw |
  docker exec -i supabase_db_grc-control-center psql -X -U postgres -d postgres -v ON_ERROR_STOP=1
npx supabase migration repair 049 --status applied --local
```

Do not paste Docker, PostgreSQL, `NOTICE`, or PowerShell prompt output back into the terminal.

## Proof commands

```powershell
npm run v98:verify-ovr
npm run v98:ovr-gap-report
npm run v98:ovr-e2e
```

The combined command is:

```powershell
npm run pilot:ovr-workflow-verification
```

Generated reports:

- `release/v98/ovr-workflow-verification.md`
- `release/v98/ovr-gap-report.md`
- `release/v98/ovr-synthetic-e2e-test.md`

## Controlled-pilot workflow

The verified lifecycle is:

```text
submitted
  -> manager_review
  -> quality_validation
  -> referred_party_response (when referral is required)
  -> quality_final_review
  -> closed or disputed
  -> reopened
```

`escalated` and `rejected` are controlled exception paths.

Role behavior:

- Reporter submits factual OVR details and later accepts or disputes the final verdict.
- Relevant department manager completes the manager review.
- Quality/Admin validates, refers, issues the final verdict, reopens disputes, escalates, or rejects.
- Referred user or referred department manager sees and responds only after Quality validates and sends the referral.
- Audit sees OVR records but cannot mutate workflow state.
- Unrelated employees and managers cannot see the OVR.

## Confidentiality

The automated E2E test creates temporary synthetic users, departments, OVRs, notifications, evidence metadata, and audit comments. It deletes them after the test.

It does not use:

- Real patient identifiers
- Medical-record numbers
- Real-person names
- Confidential OVR narratives
- Human approvals

Successful local proof is not production approval.
