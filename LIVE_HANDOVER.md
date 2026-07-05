# GRC Control Center - Live Hospital Handover

## Overview
This document serves as the formal handover of the **GRC Control Center** application from the development/pilot phase to the live hospital operating team.
The application has successfully completed all 70 patches in the modernization and compliance roadmap.

## Live Configuration
- **Application State**: `live-hospital-operating`
- **Baseline Version**: `v6.1.1`
- **Mock Data**: Completely removed. The application enforces strict production data integrity.
- **Staging Tables**: Locked using database-level triggers to prevent accidental test data pollution.

## Architecture Highlights
- **Role-Level Security (RLS)**: Enforced comprehensively across all tables.
- **Security Definer RPCs**: Privileged actions (e.g., Executive Signoffs) use strict Security Definer functions with a robust runtime action registry.
- **Evidence Management**: Production closure proofs and persona audits are immutably logged in the database.

## Operating Runbooks
Please refer to the following operational documents for day-to-day administration:
- `docs/V60_NO_MOCK_REMEDIATION_RUNBOOK.md`
- `docs/V62_REAL_NO_MOCK_DATA_LAYER_RUNBOOK.md`

## Next Steps
The repository is now officially **FROZEN** for the initial Go-Live baseline.
All further modifications must follow the standard IT change management process.
