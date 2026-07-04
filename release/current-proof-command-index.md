# Current Proof Command Index

This is the current operator index for validation commands. Patch-specific chains remain available for traceability, but the commands below are the normal path for current work.

## A. Daily Developer Checks

```powershell
npm run validate:fast
npm run validate:build
```

## B. Before PR

```powershell
npm run validate:release
```

## C. After Merge To Main

```powershell
git switch main
git pull origin main
npm run typecheck
npm run build
npm run validate:release
npm run release:restore-noise
git status --short --branch
```

## D. Before Hospital Deployment

```powershell
npm run validate:proof
npm run validate:security
```

Confirm these operational gates outside the automated commands:

- Staging/persona SQL evidence is current and approved.
- DR restore evidence is current and approved.
- Department launch packs are complete for in-scope departments.
- Training adoption is confirmed for pilot and production users.
- Policy/SOP attestations are complete or explicitly accepted with limitations.
- Executive signoff is recorded.

## E. Security Proof Commands

Use these when reviewing database and runtime security posture:

```powershell
npm run v64:rls-strict
npm run v64:functions-strict
npm run v64:views-strict
npm run v64:strict-all
npm run v673:security-definer-audit
npm run v700:runtime-security
```

## F. Patch-Specific Commands

These are patch validation chains, not daily commands:

```powershell
npm run patch45:all
npm run patch46:all
npm run patch47:all
npm run patch48:all
npm run patch49:all
npm run patch50:all
npm run patch51:all
npm run patch52:all
npm run patch53:all
npm run patch54:all
npm run patch55:all
npm run patch56:all
npm run patch57:all
npm run patch58:all
npm run patch58-1:all
```

Patch 58.1 adds validation lanes that avoid nested duplicate full chains:

```powershell
npm run validate:fast
npm run validate:build
npm run validate:proof
npm run validate:security
npm run validate:release
npm run validate:profile:fast
npm run validate:profile:release
```

## G. Generated Release Artifacts

Many proof commands regenerate JSON and text evidence under `release/v*` and older `release/patch*` folders. That churn is expected after validation.

After validation, run:

```powershell
npm run release:restore-noise
git status --short --branch
```

Only keep generated release artifacts when intentionally updating current release evidence. Do not use `git add .`.
