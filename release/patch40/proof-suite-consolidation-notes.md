# Proof Suite & Test Script Consolidation Notes

This document provides administrative and architectural context regarding the test runners and proof scripts present in this repository.

---

## 1. Authoritative Testing Anchors

### 1.1 The Master Proof Suite (`proof:all`)
- **Script**: `scripts/v700-proof-suite.mjs`
- **Command**: `npm run proof:all`
- **Purpose**: This is the absolute master gate for GRC platform validation. It integrates all sub-validators (database schemas, security definers, persona tests, RLS assertions, and restore integrity checks).
- **Rule**: No production release or deployment should occur without a clean pass from this command.

### 1.2 The Runtime Security Audit (`v700:runtime-security`)
- **Script**: `scripts/v700-runtime-security-bridge-audit.mjs`
- **Command**: `npm run v700:runtime-security`
- **Purpose**: This is the primary gatekeeper of runtime SQL security. It monitors active RPC schemas to confirm that:
  - Total remaining broad `SECURITY DEFINER` execute grants is strictly **0**.
  - All direct client-to-DB calls route through the edge-bridge layer or are explicitly whitelisted.

---

## 2. Legacy and Patch-Level Proofs

### 2.1 Patch-Level Verification (`patchXX:all`)
- **Format**: `scripts/patchXX-*.mjs`
- **Purpose**: Each individual patch (from Patch 15 to Patch 40) includes scoped schema, workflow, and frontend verification checks. These are designed to be run during that patch's specific development lifecycle to confirm migration convergence and file mapping.
- **Maintenance**: Patch-level verifications do not replace `proof:all`, but act as specific checks for code reviews of those features.

### 2.2 Proof Evidence Suites (`v64`, `v66`, `v67`, `v72`)
- **Directories**: `release/v64/`, `release/v66/`, etc.
- **Purpose**: Maintain static regression verification inputs and outputs (such as authenticated SQL logs, persona matrices, and staging restoration runs) to serve as audit logs.

---

## 3. Future Consolidation Plan
- **Pre-Release State**: Legacy `vXX-*.mjs` scripts must not be deleted or renamed destructively prior to initial production deployment to maintain baseline verification integrity.
- **Post-Signoff Archiving**: Once the platform achieves formal sign-off from all security and operational stakeholders, old patch-level validation scripts (`scripts/patch15-*` through `scripts/patch39-*`) should be archived into a dedicated `./scripts/archive/` subfolder, and their respective entries removed from `package.json` to keep development commands simple.
