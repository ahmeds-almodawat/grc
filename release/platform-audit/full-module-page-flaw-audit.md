# Full Platform Module and Page Flaw Audit
**Date**: 2026-07-03  
**Audited Version**: patch29a (Post-Patch 28)

---

## 1. Executive Summary

This document presents the complete flaw audit of the GRC Control Center platform. The audit covers 69 distinct modules, hubs, pages, and tabbed components. The goal is to identify layout gaps, security anomalies, bilingual integration flaws, and workflow scaffolding left behind after the stabilization of Patches 21 through 28.

### Key Metrics
- **Total Mapped Pages/Tabs**: 69
- **Total Flaws Identified**: 12
- **Flaw Severity Distribution**:
  - **Critical**: 2
  - **High**: 5
  - **Medium**: 3
  - **Low**: 2

---

## 2. Detailed Flaw Findings

### 2.1 Critical Gaps (Production Blockers)

#### FLAW-001: Audit Engagement Checklist is Scaffolded Only
- **Location**: `src/components/v150/AuditEngagementChecklist.tsx`
- **Observation**: The engagement checklist is static. The file itself has a comment: *"It is workflow scaffolding only; it does not claim real audit results."* This gives false feedback on audit progress.
- **Impact**: Operators cannot track actual audit checklist responses.
- **Remediation**: Establish a database table `audit_engagement_checklists` and modify the component to load and save responses live.

#### FLAW-002: CBAHI Accreditation Readiness is a Static Scaffold
- **Location**: `src/pages/AccreditationCenter.tsx`
- **Observation**: The Accreditation Center presents visual widgets for CBAHI standards readiness, but lacks data-fetching logic or DB-backed states.
- **Impact**: CBAHI standards readiness cannot be audited or linked to live evidence.
- **Remediation**: Introduce a `cbahi_standards` table and link standard checklist items to controls and OVR evidence.

---

### 2.2 High Severity Gaps

#### FLAW-003: Runtime RPC classification review remains before production signoff
- **Location**: `v700:runtime-security` and `v700-runtime-security-bridge-audit.mjs`
- **Observation**: The latest security proof shows zero remaining broad SECURITY DEFINER execute grants, so there is no confirmed exposed broad Security Definer grant finding. However, the runtime RPC inventory still classifies multiple frontend/bridge RPCs as unknown_requires_review or privileged_admin_review. These should be reviewed and documented before production signoff.
- **Evidence**: v673 security definer audit reports remaining_broad_execute_grants = 0. v700 runtime security bridge audit reports remaining_broad_security_definer_execute_grants = 0.
- **Impact**: Governance/signoff risk: privileged and unknown RPC classifications need human security review before production to ensure no unprivileged access is permitted.
- **Remediation**: Review and document all privileged and unknown RPC classifications before production signoff (specifically during a dedicated runtime RPC classification closure patch).

---

### 2.2 High Severity Gaps

#### FLAW-004: Missing Direct OVR Incident to Central Evidence Log Linkage
- **Location**: `src/pages/OVR.tsx` and `src/pages/Evidence.tsx`
- **Observation**: OVR incident reports and evidence files exist in isolated tables. There is no central mapping showing which OVR occurrences serve as evidence for general GRC controls.
- **Impact**: Compliance officers cannot prove standard compliance using historical incidents directly.
- **Remediation**: Create a bridging table or add `ovr_id` to the `evidence_files` schema.

#### FLAW-005: No Automated Verification of Backup Restores
- **Location**: `src/pages/BackupSchedulerCenter.tsx`
- **Observation**: The backup scheduler runs cron triggers locally but has no automated verify routine for restoring dumps in staging environments inside the UI.
- **Impact**: Corruption in backups remains undetected until a disaster recovery is attempted.
- **Remediation**: Expose the output of `restoreDryRun` directly on the backup dashboard.

#### FLAW-006: Missing Translation Keys in Custom Panels
- **Location**: `src/components/v210/FrameworkCrosswalkBackbonePanel.tsx`, `src/components/v220/ControlTestingWorkflowPanel.tsx`
- **Observation**: English text strings are hardcoded in these new panels.
- **Impact**: Switching to Arabic (RTL) renders English headers, breaking layout consistency.
- **Remediation**: Standardize translation strings in the dictionary files.

#### FLAW-007: Empty Mockup Simulator for Mobile Command
- **Location**: `src/pages/ExecutiveMobileCommand.tsx`
- **Observation**: Renders an empty phone frame mockup with static, non-interactive layouts.
- **Impact**: Features look incomplete to senior executives.
- **Remediation**: Inject a condensed version of the main dashboard into the iframe.

---

### 2.3 Medium & Low Severity Gaps

#### FLAW-008: Excess Versioned Audit/Test Scripts
- **Location**: `package.json`, `scripts/`
- **Observation**: Over 50 scripts of format `vXX-*.mjs` exist in `package.json`.
- **Impact**: High project debt, slow package discovery, and complex script execution paths.
- **Remediation**: Deprecate obsolete scripts and move active checks into a unified test runner.

#### FLAW-009: Bilingual Dictionary is Read-Only
- **Location**: `src/pages/BilingualDictionaryCenter.tsx`
- **Observation**: The dashboard lists missing translation keys but offers no text inputs to submit new translations to the database.
- **Impact**: Translators must use database tools to insert Arabic values.
- **Remediation**: Add editable fields directly in the list table.

#### FLAW-010: GRC Hub Compact Tabs Wrap/Overflow Risk
- **Location**: `src/styles.css`
- **Observation**: GRC Hub renders 13 horizontal tabs in compact mode.
- **Impact**: On medium screens, tabs overflow horizontally but lack scroll indicators or arrows, making the interface look cut off.
- **Remediation**: Style horizontal tab containers with fading masks on overflow boundaries.

---

## 3. Platform Health & Security Review
The database schema has reached maturity with 90 migration files, culminating in the hardening of CAPA action plans (Patch 28). RLS and security checks show that baseline authentication and route protections (via `authAccess.ts` and `Layout.tsx` accordions) are robust. However, completing runtime RPC classification review remains the final security step before production sign-off.
