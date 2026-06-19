# v3.4 Pilot Rollout Runbook

## Goal
Move from staging validation to a controlled pilot without exposing the full 1,000-employee population too early.

## Recommended Pilot Wave 1
- Executives: 3-5 users
- Governance/Compliance: 5-8 users
- Quality: 5-8 users
- Audit: 2-4 users
- HR/Finance/IT: 10-15 users
- Department managers: 20-30 users
- Normal employees for assigned-task testing: 10-20 users

Target: about 60 users.

## Pilot success criteria
1. No critical open issues.
2. RLS/persona access tests passed.
3. One OVR completed from submission to Quality closure.
4. One project completed with evidence and approval.
5. One export/backup package created and reviewed.
6. One restore dry-run documented.
7. Arabic/RTL critical screens accepted.

## Pilot stop rules
Stop rollout if:
- Any normal employee sees other departments' sensitive data.
- OVR confidentiality fails.
- Evidence/approval closure rules fail.
- Backup/export cannot be produced.
- Critical issue remains open.
