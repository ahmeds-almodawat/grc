# Change Control SOP

## Purpose

Protect controlled-pilot evidence integrity by ensuring changes are planned, reviewed, and traceable.

## Change categories

| Category | Examples | Approval required |
|---|---|---|
| Documentation only | SOP updates, runbook updates | Pilot coordinator |
| Evidence script | Adds reports without changing logic | IT review |
| UI change | Layout, labels, navigation | IT + affected module owner |
| Security/RLS change | Policies, functions, bridge logic | IT + Quality + Management/Admin |
| Migration change | Database schema or data migration | IT + Management/Admin |
| Approval gate change | Signoff/proof logic | Management/Admin + IT + Quality |

## Rules

- Do not change approval gate logic to force a pass.
- Do not rewrite migration history during pilot.
- Do not push directly without a checkpoint for major changes.
- Do not include real confidential evidence in commits.
- Use feature branches for meaningful updates.

## Standard change process

1. Create branch.
2. Apply change.
3. Run `npm run ci:static`.
4. Run targeted evidence script if relevant.
5. Review `git status` to avoid unrelated proof-output noise.
6. Commit with clear message.
7. Push branch.
8. Review before merge.

## Recommended commands

```powershell
git status
git checkout -b vX-change-name
npm run ci:static
git status
git add <specific files>
git commit -m "Describe change clearly"
git push -u origin vX-change-name
```

## Emergency change process

For urgent confidentiality/access issues:

1. Pause pilot.
2. Create hotfix branch.
3. Apply smallest safe fix.
4. Run targeted validation.
5. Obtain IT and Quality approval.
6. Document the reason and impact.
7. Resume only after approval.
