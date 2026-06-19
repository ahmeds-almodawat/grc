# v6.4 Persona SQL Test Runbook

1. Apply all migrations to a fresh Supabase staging database.
2. Open Supabase SQL editor.
3. Run `release/v64/v64_persona_security_tests.sql` or `supabase/tests/v64_persona_security_tests.sql`.
4. Any raised exception is a failed production-security proof.
5. Attach the query result and errors to the release evidence folder.

This script is intentionally stricter than the UI checklist. It is not a replacement for browser persona tests; it proves the database layer first.
