# GRC v1.1 Release-Control Closure

## Closure status

- Classification: `GRC_V1_1_RELEASE_CLOSED`
- Deployment-control model: `GRC_VERCEL_MODEL_B_CONTROL_ACTIVE`
- Production platform: `OPEN`
- Maintenance: `OFF`
- Future release model: `STAGED_PRODUCTION_ARTIFACT_PLUS_EXPLICIT_PROMOTION`
- Evidence captured before cleanup at: `2026-08-12T18:06:23.797Z`
- Administrative closure completed at: `2026-08-12T18:11:14.696Z`

## Accepted production and repository lineage

- Production acceptance: GRC v1.1 accepted through the R8-G post-acceptance gate.
- Production deployment: `dpl_BfuMxSW3UaaJHkvZ4dRNXNFqkBtn`
- Production application SHA: `9395f1dbf2f16ec2ac86d36909c024e23ff61951`
- Repository `main` SHA: `23a1face9455b1219a19e77f60e664aa688cbbd2`
- Deployment-control PR: `#94`
- Deployment-control merge commit: `23a1face9455b1219a19e77f60e664aa688cbbd2`

The repository/Production SHA divergence is expected. The newer `main` commit contains only the reviewed deployment-control and CI policy from PR #94; it was not an application release and was not promoted to Production.

## Enforced controls

- GitHub ruleset: `GRC Main Protection` (`20755678`), active on `main`.
- Required checks:
  - `Vercel deployment control`
  - `Build, Test, Security, Proof`
- Pull requests are required.
- Required checks must be current with the target branch.
- Force pushes and branch deletion are blocked.
- The bypass list is empty.
- `vercel.json` sets `git.deploymentEnabled.main=false`.
- Production changes require an explicitly authorized staged artifact and a separate explicit promotion.

## Hosted empirical proof

- Non-main proof: push of `codex/v1.1-vercel-deployment-control` created Preview `dpl_83bU81qrCs84mbgFsh4jp3MTgXEd` for SHA `aaf5fc67609aad4f16d912b5a882841250c5c04e`.
- The Preview was `READY`, Preview-only, and had zero Production aliases.
- Main proof: merging PR #94 created zero Vercel deployments from `main` or merge SHA `23a1face9455b1219a19e77f60e664aa688cbbd2` during a 346.7-second observation.
- Deployment count remained `34`; Production deployment, SHA, and aliases remained unchanged.
- Result: `HOSTED_MAIN_FALSE_EMPIRICAL_PROOF=PASSED`.

## Promotion and rollback

The permanent operator procedure is [Staged Production Release](../../docs/runbooks/STAGED_PRODUCTION_RELEASE.md). It requires an immutable staged Production-target artifact built and deployed with domains skipped, validation by deployment ID/URL, and a separately authorized `vercel promote` operation that does not rebuild the artifact.

The previous READY Production deployment ID must be recorded before every cutover. If rollback is separately authorized, use Vercel's traffic rollback command against that preserved deployment. At this closure, the retained rollback target is `dpl_2jzvVKmvztmKHAe8a1cVFM72ZagT`.

## Residual governance limitation

`SINGLE_OPERATOR_REVIEW_GAP=ACCEPTED_RESIDUAL_GOVERNANCE_LIMITATION`

Independent human segregation of duties is not present. Current compensating controls are protected `main`, mandatory pull requests, two mandatory CI/security checks, strict up-to-date enforcement, force-push protection, deletion protection, an empty bypass list, CODEOWNERS ownership metadata, explicit Production promotion, and separate rollback control.

If a second trusted repository reviewer is added, update the ruleset to require at least one approval and Code Owner approval.

## Authorized cleanup record

- Temporary Preview `dpl_83bU81qrCs84mbgFsh4jp3MTgXEd`: `DELETED_AFTER_EVIDENCE_CAPTURE`. Its sole alias was an automatic Preview alias; it had zero Production aliases.
- Merged remote feature branch `codex/v1.1-vercel-deployment-control`: `DELETED_AFTER_EVIDENCE_CAPTURE`.
- The local feature worktree was retained untouched because it may contain preserved local evidence.
- Production deployment and rollback deployment are excluded from cleanup.

This evidence contains no password, token, private environment value, or unnecessary user identifier.
