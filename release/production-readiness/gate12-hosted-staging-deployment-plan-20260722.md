# Gate 12 hosted staging deployment plan

Classification: **B — existing target requires configuration**. An authenticated Vercel CLI session and project `grc` exist, but this repository has no local project linkage and no dedicated hosted-staging origin/environment is proven. A future operator must approve/link an isolated preview or staging target, configure only the public staging variables, verify production isolation and rollback, then deploy from a clean worktree of the exact release commit. Database migrations and Edge deployment are excluded.
