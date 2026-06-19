# v6.1 Real vs Simulated Capability Policy

## Rule

A feature is not production-verified simply because a page exists, a script generated a report, or a dashboard displays a score.

## Claim levels

| Claim level | Meaning |
|---|---|
| Prototype artifact | UI/code exists, but not proven with real data and roles. |
| Static audit | A script inspected files/patterns. Useful but not enough. |
| Checklist artifact | A manual checklist exists. Not proof until completed and signed. |
| Staging verified | Tested in a staging Supabase project with real accounts and data. |
| Production verified | Verified in production or production-equivalent environment with signoff. |

## Production evidence must include

- Environment name.
- Date/time.
- User/persona used.
- Exact test steps or automated test name.
- Result.
- Evidence file/screenshot/log.
- Owner/signoff.

## Automatic generated reports

Generated reports must be labeled as `generated_unverified` until connected to real evidence.

Examples:

- Backup checklist: generated only until restore is performed.
- RLS persona checklist: generated only until real negative-access SQL/browser tests pass.
- Pilot readiness: generated only until pilot users and workflows are actually tested.

## Production data rule

Production must never show fictional company records when data is empty or unavailable.

Allowed:

- Empty state.
- Configuration error.
- Unauthorized state.
- Query error.
- Explicit demo mode clearly labeled and disabled by default.

Not allowed:

- Silent fallback projects.
- Silent fallback OVRs.
- Silent fallback risks.
- Demo departments in production.
- Fake executive scores.
