# Staged Production Release Runbook

This runbook is the durable GRC release path. A merge to `main` must not move Production traffic. Production cutover requires an immutable staged artifact and a separate explicit promotion authorization.

## A. Development

1. Create a feature branch from current `main`.
2. Make the reviewed change, validate it locally, commit it, and push the feature branch.
3. An automatic protected Preview may be created for a non-main branch.
4. Treat Preview as review evidence only. A Preview is not a Production artifact, especially when Preview and Production environment contracts differ.

## B. Review and merge

1. Open a pull request to `main`.
2. Require these exact checks to pass:
   - `Vercel deployment control`
   - `Build, Test, Security, Proof`
3. Resolve review conversations and ensure the branch is current with `main`.
4. Merge only through the active `GRC Main Protection` ruleset.
5. Confirm the merge did not create or promote a Vercel Production deployment.

## C. Create the Production artifact

Proceed only after an explicit release-artifact authorization. Use a clean worktree at the exact approved commit, verify the Vercel project is `grc` in scope `ahmeds-6478s-projects`, and run:

```powershell
vercel build --prod
vercel deploy --prebuilt --prod --skip-domain --scope ahmeds-6478s-projects --yes
```

Record the resulting immutable deployment ID and URL. Confirm it is the expected commit and Production target, is `READY`, has no Production domain assigned, and passes the release's required technical and application checks. Do not treat successful artifact creation as cutover authorization.

## D. Production cutover

Proceed only after a separate explicit promotion authorization naming the approved deployment ID:

```powershell
vercel promote <approved-deployment-id> --scope ahmeds-6478s-projects --yes
```

Promotion must move traffic to the already validated artifact and must not rebuild it.

## E. Post-promotion verification

Verify and record:

- current Production deployment ID;
- expected Git SHA/source identity;
- all Production aliases;
- root and login HTTP health;
- applicable authenticated and authorization smoke tests;
- absence of unexpected runtime, security, database, Auth, or Edge drift.

## F. Rollback

Before cutover, preserve the previous `READY` Production deployment ID. If rollback is explicitly authorized, run:

```powershell
vercel rollback <previous-ready-deployment-id> --scope ahmeds-6478s-projects --yes
```

Verify the Production deployment, aliases, root/login health, and required smoke tests after rollback. Do not rebuild or modify environment values as part of traffic rollback.

## G. Prohibited normal release paths

Do not use:

- automatic deployment from `main`;
- direct Production alias movement without authorization;
- an unreviewed Dashboard redeploy;
- deploy hooks;
- a Preview artifact as Production when environment contracts differ;
- rebuilding during promotion;
- uncontrolled CLI or API Production deployment;
- a merge, successful build, or Preview result as implicit Production authorization.

## Governance limitation

`SINGLE_OPERATOR_REVIEW_GAP=ACCEPTED_RESIDUAL_GOVERNANCE_LIMITATION`

The current repository does not have independent human segregation of duties. Compensating controls are the protected PR path, mandatory current CI/security checks, force-push and deletion protection, empty bypass list, CODEOWNERS metadata, explicit artifact authorization, separate promotion authorization, and preserved rollback target.

When a second trusted reviewer becomes available, require at least one approving review and Code Owner approval in the GitHub ruleset.
