# Patch 83Q.1 Activation Decision

Decision: `ready_for_controlled_pilot_security_gate`

Reason: all four fixed dispatcher mappings passed focused and regression validation, only `privileged-action` version 5 was deployed, JWT verification remains enabled, and live missing/invalid JWT probes are denied. Migration 170 remains service-role-only for the four RPCs, with no PUBLIC, anon, or authenticated direct execute grants restored.

This is a controlled-pilot security-gate decision, not an unrestricted production-readiness claim. Department Import remains disabled, User Import remains unchanged, and Vercel was not modified.
