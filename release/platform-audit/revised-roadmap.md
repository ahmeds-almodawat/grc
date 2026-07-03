# Revised Platform Release Roadmap
**Status**: Revised post-Patch 28  
**Current Phase**: Patch 29A (Audit and Flaw Discovery)

---

## Phase 1: Current Audit (Patch 29A)
- **Scope**: Perform a comprehensive review of all 69 modules, identify workflow gaps, and map layout/security flaws.
- **Deliverables**: Inventory, flaw register, prioritize list, and safety review.
- **Status**: Completed ✅ (Audit results documented under `release/platform-audit/`).

---

## Phase 2: Next Releases (Short Term)

### Patch 29 — Training & Change Management Hardening
- **Target**: Align user onboarding, guides, and simulation setups for pilot users.
- **Key Tasks**:
  - Integrate live department checklists into `UserGuide.tsx` so users have department-specific context.
  - Implement the Bilingual Dictionary editable inputs so translators can fill missing Arabic terms.
  - Resolve FLAW-006 (Arabic translations missing in CAPA and Framework Crosswalks).
- **Safety Boundary**: No changes to core OVR workflow or RLS.

### Patch 30 — Executive Dashboard Truth Layer & Visual Hardening
- **Target**: Polish UI presentation, dashboard indicators, and final UI layout consistency.
- **Key Tasks**:
  - Connect live analytics widgets to the Mobile Command mockup frame.
  - Add scroll-fade indicators on the compact horizontal tab lists (resolving FLAW-010).
  - Clean up duplicated Quick Links to declutter layout view.

---

## Phase 3: Final Stabilization (Medium Term)

### Patch 31 — Security Hardening & Audit Evidence Bridging
- **Target**: Close remaining critical security gaps and complete documentation.
- **Key Tasks**:
  - Perform Runtime RPC classification closure and human security signoff review.
  - Establish the OVR incident-to-evidence bridging links (FLAW-004).
  - Connect the Audit Engagement Checklist to live DB storage.

### Patch 32 — Production Readiness Verification
- **Target**: Full pre-flight check.
- **Key Tasks**:
  - Perform disaster recovery drills.
  - Final validation checks.
  - Verify automated backup restore verification logs in BackupSchedulerCenter.
