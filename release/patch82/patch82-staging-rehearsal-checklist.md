# Patch 82 Staging Rehearsal Checklist

## Preflight

- [ ] Staging environment identified.
- [ ] Staging project/reference recorded.
- [ ] Staging backup/snapshot confirmed.
- [ ] Current migration version captured.
- [ ] Environment variables checked.
- [ ] Privileged bridge configured for staging.
- [ ] Migrations 118-121 identified.
- [ ] Dry-run or staging apply command recorded by operator.
- [ ] Operator recorded.
- [ ] Reviewer recorded.

## Post-Apply Staging Verification

- [ ] Table existence verification completed.
- [ ] RLS enabled verification completed.
- [ ] Policy verification completed.
- [ ] RPC/function existence verification completed.
- [ ] Privileged bridge allowlist verification completed.
- [ ] Frontend smoke test completed.
- [ ] ProductionReadinessCenter smoke test completed.
- [ ] ProductionOperatorConsole smoke test completed.
- [ ] No automatic production launch verification completed.
- [ ] No sample records inserted.

## Blocker Log

- Blocker:
- Owner:
- Severity:
- Required remediation:
- Retest evidence:
- Reviewer decision:

## Approver Signoff Fields

- Approver:
- Approval status:
- Approval date/time:
- Notes:

Staging rehearsal does not approve production launch. Production deployment requires separate executive approval.
