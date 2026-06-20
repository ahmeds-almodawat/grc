# Live Staging Execution Runbook

## Objective

Run the GRC Control Center in a real staging environment using synthetic/non-confidential data only, then capture evidence for controlled-pilot approval.

## Preconditions

- Local `ci:static` passes.
- v7.3 module acceptance evidence exists.
- v7.4 repo hardening exists.
- v7.5 controlled-pilot readiness pack exists.
- v7.6 repo hygiene passes.
- v7.7 staging validation pack exists.
- Human signoff is still pending unless real approvers have completed the approval files.

## Execution phases

1. Freeze the branch for staging candidate review.
2. Confirm environment variables using the v7.8 env template audit.
3. Deploy Supabase staging using non-production project credentials.
4. Deploy frontend staging to a non-production URL.
5. Run smoke-test matrix.
6. Run persona checks with synthetic data.
7. Validate OVR confidentiality boundaries.
8. Run rollback drill.
9. Collect evidence.
10. Hold go/no-go review.

## Hard safety rules

- No real patient identifiers.
- No confidential OVR details.
- No production database connection.
- No service-role key in frontend code or browser environment.
- No production rollout without approved signoff.
