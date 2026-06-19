# Post-Pilot Exit Criteria

## Purpose

Define what must be true before the controlled pilot can be closed and before any wider rollout is considered.

## Controlled pilot success criteria

- Pilot scope was respected.
- User count stayed within approved maximum.
- No real patient identifiers were used.
- No confidential OVR details were used.
- Priority 1 workflows were tested.
- Critical defects are closed or confirmed not applicable.
- High defects have owners and decisions.
- Evidence pack is generated and reviewed.
- Management/Admin, IT, and Quality complete final review.

## Production readiness is separate

A successful controlled pilot does not authorize production use.

Production readiness requires:

- Staging/live deployment proof.
- Staging/live RLS persona validation.
- Backup/restore procedure approved for target environment.
- Monitoring and support model approved.
- Data retention and deletion policy approved.
- Security review completed.
- Final go-live signoff.

## Pilot closure report sections

```text
1. Pilot scope
2. Pilot dates
3. Pilot users and roles
4. Modules tested
5. Evidence reviewed
6. Defects and risks
7. Confidentiality confirmation
8. Management/Admin decision
9. IT decision
10. Quality decision
11. Recommendation: stop / extend pilot / prepare production readiness phase
```

## Recommended next phases

| Outcome | Next step |
|---|---|
| Pilot failed | Fix blockers and repeat limited pilot. |
| Pilot passed with warnings | Remediate warnings and prepare staging validation. |
| Pilot passed cleanly | Begin production readiness phase, not direct go-live. |
