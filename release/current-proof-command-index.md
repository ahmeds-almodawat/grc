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
npm run patch58-2:all
npm run patch59:all
npm run patch60:all
npm run patch61:all
npm run patch62:all
npm run patch63:all
npm run patch64:all
npm run patch65:all
npm run patch66:all
npm run patch67:all
npm run patch68:all
npm run patch69:all
npm run patch70:all
npm run patch71:all
npm run patch72:all
npm run patch73:all
npm run patch74:all
npm run patch75:all
npm run patch76:all
npm run patch77:all
npm run patch78:all
npm run patch79:all
npm run patch80a:all
npm run patch81:all
npm run patch82:all
npm run patch82b:all
npm run patch82c:all
npm run patch82e:all
npm run patch82f:all
npm run patch82g:all
npm run patch82h:all
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

Patch 58.2 adds repository hygiene and restore-noise coverage proof:

```powershell
npm run patch58-2:proof
```

Patch 59 adds evidence action routing and closure handoff proof:

```powershell
npm run patch59:proof
```

Patch 60 adds evidence reviewer decision readiness proof:

```powershell
npm run patch60:proof
```

Patch 61 adds evidence ownership and due-date readiness proof:

```powershell
npm run patch61:proof
```

Patch 62 adds executive closure recommendation readiness proof:

```powershell
npm run patch62:proof
```

Patch 63 adds department evidence coverage readiness proof:

```powershell
npm run patch63:proof
```

Patch 64 adds policy/SOP attestation evidence readiness proof:

```powershell
npm run patch64:proof
```

Patch 65 adds backup, restore, and DR evidence readiness proof:

```powershell
npm run patch65:proof
```

Patch 66 adds access review and security evidence readiness proof:

```powershell
npm run patch66:proof
```

Patch 67 adds training, adoption, and support evidence readiness proof:

```powershell
npm run patch67:proof
```

Patch 68 adds controlled evidence closure action proof:

```powershell
npm run patch68:proof
```

Patch 69 adds executive go/no-go decision pack proof:

```powershell
npm run patch69:proof
```

Patch 70 adds department launch final readiness workflow proof:

```powershell
npm run patch70:proof
```

Patch 71 adds live data quality and role integrity readiness proof:

```powershell
npm run patch71:proof
```

Patch 72 adds UAT pack and hospital pilot acceptance readiness proof:

```powershell
npm run patch72:proof
```

Patch 73 adds live support and incident readiness proof:

```powershell
npm run patch73:proof
```

Patch 74 adds final security and access review readiness proof:

```powershell
npm run patch74:proof
```

Patch 76 adds controlled production authority and cutover gate proof:

```powershell
npm run patch76:proof
```

Patch 77 adds live pilot execution and issue burn-down proof:

```powershell
npm run patch77:proof
```

Patch 78 adds identity, role, and data integrity hardening proof:

```powershell
npm run patch78:proof
```

Patch 79 adds production operations governance, hypercare, and board pack closure proof:

```powershell
npm run patch79:proof
```

Patch 80A adds performance smoothness optimization proof:

```powershell
npm run patch80a:proof
```

Patch 81 adds controlled migration deployment runbook proof:

```powershell
npm run patch81:proof
```

Patch 82 adds staging migration rehearsal evidence proof:

```powershell
npm run patch82:proof
```

Patch 82B adds interactive dashboard UI polish proof:

```powershell
npm run patch82b:proof
```

Patch 82C adds operational dashboard interactivity proof:

```powershell
npm run patch82c:proof
```

Patch 82E adds record-level department drilldown proof:

```powershell
npm run patch82e:proof
```

Patch 82F adds employee ID login alias proof:

```powershell
npm run patch82f:proof
```

Patch 82G adds privileged action JWT compatibility proof:

```powershell
npm run patch82g:proof
```

Patch 82I through Patch 83L retain their individual proof commands in `package.json`. The secure Department Import activation chain is:

```powershell
npm run patch83m:proof
npm run patch83n:proof
npm run patch83o:proof
npm run patch83o1:proof
npm run patch83o2:proof
npm run patch83o3:proof
npm run patch83p:smoke
npm run patch83p:proof
```

Patch 83P is controlled frontend activation readiness only. Its smoke runner builds disabled and enabled modes with a temporary process variable, restores the original process value, and does not modify `.env` files or deploy an environment.

## G. Generated Release Artifacts

Many proof commands regenerate JSON and text evidence under `release/v*` and older `release/patch*` folders. That churn is expected after validation.

After validation, run:

```powershell
npm run release:restore-noise
git status --short --branch
```

Only keep generated release artifacts when intentionally updating current release evidence. Do not use `git add .`.


## Patch 82H / 82H-1 / 82H-2 — Sidebar Nested Navigation and Compact Control Pages

```powershell
npm run patch82h:all
npm run patch82h:proof
```

Patch 82H-2 keeps the same proof command and adds checks that User Management no longer renders the old in-page Control Pages hub, subsidiary rail, or horizontal control card navigation.

## Patch 82V — Security Review

```powershell
npm run patch82v:proof
```

## Patch 82W — Targeted Security Remediation Plan

```powershell
npm run patch82w:proof
```
