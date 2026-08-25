# P2 Staging UAT Plan

P3 authorization is required before executing this plan.

## Entry Checks

1. Confirm the endpoint and project reference are staging, not local or Production.
2. Record branch/RC commit, deployed artifact/function versions, migration ledger,
   schema drift, data counts, and backup/restore readiness.
3. Confirm the target is an upgrade environment whose historical ledger is
   compatible; stop on zero-install baseline drift or unexpected remote history.

## Apply And Verify

1. Apply missing forward migrations through 222 in order.
2. Verify canonical views/functions, grants, RLS, constraints/FKs/indexes,
   critical-attention/activity, My Work, Audit criteria, and readiness contracts.
3. Deploy the RC privileged-action function and immutable frontend artifact.
4. Verify environment/CAPTCHA/Patch83U contracts without exposing secret values.

## UAT

1. Perform fresh normal authentication for Super Admin, executive/global,
   division, department, contributor, and read-only/external personas.
2. Verify route/sidebar/detail/action visibility and execution, including
   cross-organization, wrong-scope, and read-only denials.
3. Run core governed reads across Home, Governance, Policy/SOP, Risk,
   Compliance, Audit, CAPA, OVR, Training, Projects, Evidence, My Work,
   Reports, Administration, and readiness surfaces.
4. Use labeled disposable staging records for suggestion/confirmation/rejection,
   Policy/SOP exact versions, CAPA inheritance, supplemental links, analytics,
   review-trigger initiation, import, and storage/evidence flows.
5. Confirm review triggers never auto-revise/approve/publish, then clean up only
   under the approved evidence-preserving protocol.

## Exit Decision

Proceed toward Production authorization only with zero unresolved security,
isolation, migration, Auth/bootstrap, data-integrity, or material route blocker,
and with signed staging evidence. Otherwise execute the documented recovery
plan and retain the failed evidence.

