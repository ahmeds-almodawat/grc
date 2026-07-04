# Patch 4 — Audit, Evidence Integrity, and Production Governance

This patch is the final squashed professionalization layer after Patch 1–3.

It adds:

- Audit universe
- Risk-based annual audit plan
- Audit engagements, criteria, procedures, workpapers
- Audit evidence requests
- Audit findings, management responses, follow-ups, QAIP reviews
- Evidence versions
- Evidence review decisions
- Evidence integrity hashes
- Immutable audit event hash chain
- External auditor read-only session register
- Production go-live governance gates and gate evidence
- Production decision register
- Admin hub tab: Audit & Evidence Integrity

It does **not** mark the platform production ready. Production approval still requires real signed evidence.

---

## 1. Extract

Extract the ZIP to:

```text
C:\Users\molte\Downloads
```

You should have:

```text
C:\Users\molte\Downloads\patch4_grc_changes
```

---

## 2. Apply

From your platform root:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-4-audit-evidence-production-governance

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch4_grc_changes\scripts\apply-patch4.ps1"
```

---

## 3. Verify

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch4_grc_changes\scripts\verify-patch4.ps1"
```

Then run the full gate:

```powershell
npm ci
npm run typecheck
npm run build
npm run test:unit
npx playwright install --with-deps
npm run test:e2e
npm audit --audit-level=high
npm run proof:all
```

---

## 4. Supabase migration

Local:

```powershell
supabase db reset
```

Linked staging:

```powershell
supabase db push
```

Do **not** push to production until backup, restore dry-run, rollback plan, and go-live approval are completed.

---

## 5. Commit

```powershell
git status
git diff --stat

git add supabase/migrations/065_patch4_audit_evidence_production_governance.sql src/lib/auditEvidenceGovernanceApi.ts src/pages/AuditEvidenceGovernanceCenter.tsx src/App.tsx README.md

git commit -m "Patch 4: add audit evidence integrity and production governance"
git push -u origin patch-4-audit-evidence-production-governance
```

Open PR into `main`.

---

## 6. UAT scenario

Manual UAT for Patch 4:

1. Create an audit universe item.
2. Create annual audit plan.
3. Create audit engagement.
4. Add audit criteria.
5. Add procedure.
6. Add workpaper.
7. Request evidence.
8. Create evidence version.
9. Add integrity hash.
10. Add immutable audit event.
11. Create finding.
12. Add management response.
13. Add follow-up.
14. Create production gate.
15. Attach gate evidence.
16. Approve/reject gate.
17. Confirm dashboard updates.

---

## 7. Important limitation

Patch 4 creates the control structure. It does not create real approvals. Do not manually mark production-ready until real gate evidence is approved.
