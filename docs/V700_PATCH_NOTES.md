# v7.0 Stabilization A+B Runtime Security + Proof Suite Patch

## Type

Conservative additive patch. No runtime app files are replaced.

## Add files

- `scripts/v700-install-stabilization-ab-scripts.mjs`
- `scripts/v700-rpc-inventory.mjs`
- `scripts/v700-runtime-security-bridge-audit.mjs`
- `scripts/v700-v65-strength-audit.mjs`
- `scripts/v700-persona-test-gap-report.mjs`
- `scripts/v700-proof-suite.mjs`
- `docs/V700_STABILIZATION_AB_RUNTIME_SECURITY_PROOF_SUITE.md`
- `docs/V700_PATCH_NOTES.md`

## Replace files

None.

## Delete files

None.

## Install

```powershell
node scripts/v700-install-stabilization-ab-scripts.mjs
```

The installer adds consolidated `v700:*` and `proof:*` package scripts without deleting existing commands. If a script key already exists with different content, the old value is preserved under an `archived:<key>:before-v700` script key.

## Run

```powershell
npm run v700:all
```

## Important

This is A+B layer 1 only. It identifies and consolidates. It does not perform risky Edge Function/runtime rewrites.
