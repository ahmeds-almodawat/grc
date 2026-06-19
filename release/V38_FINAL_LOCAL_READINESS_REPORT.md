# GRC Control Center v3.8 Final Local Readiness Report

Generated: 2026-06-17T23:46:04.879Z

## Automated Summary

- Local doctor score: 100%
- Migration files: 33
- Latest migration: 032_final_local_doctor_production_simulator.sql
- Production simulator automated score: 43%

## Mandatory Manual Proof Before Production

1. Fresh Supabase migration run from first to latest.
2. RLS persona tests for CEO, department manager, employee, Quality, Audit.
3. OVR workflow end-to-end test.
4. Export/backup and restore dry-run evidence.
5. Arabic/RTL visual QA.
6. Pilot acceptance with 1–2 departments before full rollout.

## Generated JSON Reports

- release/v38-local-doctor-report.json
- release/v38-schema-doctor-report.json
- release/v38-production-simulator-report.json