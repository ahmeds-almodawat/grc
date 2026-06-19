-- v6.6.1 staging SQL execution sequence
-- Run these files in staging Supabase SQL editor in this order.
-- Do not run against production.

-- 1) Persona/RLS isolation proof
-- File: release/v661/staging-sql/01_v64_persona_security_tests.sql

-- 2) Workflow smoke proof
-- File: release/v661/staging-sql/02_v65_workflow_smoke_tests.sql

-- 3) Controlled pilot evidence proof
-- File: release/v661/staging-sql/03_v66_controlled_pilot_evidence_tests.sql

-- After each run, export/copy the successful SQL output into:
-- release/v66/evidence-attachments/
