# v21.0 Framework Crosswalk + Live GRC Backbone Report

Generated: 2026-06-28T22:17:13.629Z

## Purpose

v21 adds the professional crosswalk backbone required to connect the platform to general international GRC, compliance, risk and audit expectations.

## Professional chain

```text
Requirement → Risk → Control → Test → Evidence → Issue → CAPA → Closure → Report
```

## Framework coverage model

- ISO 31000 risk management alignment
- COSO ERM strategy, performance and board reporting alignment
- ISO 37301 compliance management system alignment
- IIA Global Internal Audit Standards alignment
- Optional extensions for ISO 27001, NIST CSF, SOC 2 and CBAHI

## Add-only database contract

- v210_frameworks
- v210_framework_requirements
- v210_framework_mappings
- v210_grc_relationships
- v210_scope_assets

The migration enables RLS and intentionally avoids broad authenticated policies. Live UI writes should be added only through reviewed organization-scoped policies or authenticated Edge bridges.

## UI injection result

Injected pages:

- src/pages/Governance.tsx
- src/pages/Risks.tsx
- src/pages/Compliance.tsx
- src/pages/Audit.tsx
- src/pages/Evidence.tsx
- src/pages/ExecutiveCommandCenter.tsx

## Static audit

- Status: passed
- Critical: 0
- High: 0
- Medium: 0

## Recommendation

Use v21 as the backbone for v22 control testing/CAPA execution, v23 compliance-policy-vendor-incident hardening, and v24 external-auditor evidence pack.
