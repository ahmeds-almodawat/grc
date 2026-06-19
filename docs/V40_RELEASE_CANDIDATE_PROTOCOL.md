# v4.0 Release Candidate Protocol

Purpose: turn the patch-heavy project into a controlled release candidate.

Run:

```bash
node scripts/v40-release-candidate-audit.mjs
```

Required gates:

1. Local build exists.
2. Required npm scripts are registered.
3. Required RC docs exist.
4. Environment variables are present or documented.
5. Consolidated migration bundle is present or warning is accepted.

Recommended command sequence:

```bash
npm run typecheck
npm run build
npm run doctor:consolidation
npm run rc:audit
```

Do not call the app production-ready only because these pass. These are local release-candidate checks only.
