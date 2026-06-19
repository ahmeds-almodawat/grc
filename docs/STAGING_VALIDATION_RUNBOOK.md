# Staging Validation Runbook

Run ci:static, repo health, staging Supabase checks, persona SQL evidence, workflow smoke evidence, restore proof, and reviewer approval. Use synthetic/non-confidential data only.

## Safety boundary

- No real patient identifiers.
- No confidential OVR details.
- No production rollout.
- No fake approvals.
- No bypass of strict proof gates.
