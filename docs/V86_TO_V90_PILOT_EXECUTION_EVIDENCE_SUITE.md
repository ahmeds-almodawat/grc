# v8.6 to v9.0 Pilot Execution Evidence Suite

## Purpose

This suite prepares the GRC Control Center for controlled-pilot execution evidence after the governed launch suite.

It covers:

- v8.6 Pilot evidence capture operations
- v8.7 Control testing and effectiveness review
- v8.8 Resilience, continuity, and third-party readiness
- v8.9 Post-pilot remediation and scale readiness
- v9.0 Controlled-pilot final decision dossier

## Safety boundary

This pack keeps the platform status as `technical_ready_pending_human_approval` and `production_ready = false`. It does not bypass the v66 strict gate or human approvals.

## What this update changes

- Adds operational documents.
- Adds release evidence generators.
- Adds a CI-safe validation workflow.
- Adds combined review evidence under `release/v86-v90`.

## What this update does not change

- No RLS policy changes.
- No migration changes.
- No runtime bridge changes.
- No approval file changes.
- No production-readiness claim.
