# Patch 83U hosted reset proof — Run 009

Run 009 repairs only the non-secret SQL Editor project-confirmation channel from the safely stopped Run 008. It is staging-only and is not authorized by preparation or readiness output.

- Project: `zghsgzrdwbqdrpuxanac`
- Project confirmation: exact `--sql-editor-project-ref` bound to the Supabase URL and execution freeze
- Confirmation phrase: `EXECUTE RUN 009 RESET NOW`
- Initial Employee credential state/version: `active / 4`
- Successful reset state/version: `admin_reset_change_required / 5`
- Final credential state/version: `active / 6`
- Initial session/refresh counts: `0 / 0`

Sensitive credentials retain the established CurrentUser DPAPI design. No credential files are requested or recreated during preparation. The project reference is non-secret and never uses the hidden credential prompt.

All output files are create-only. Prior Run 001–008 evidence is historical and must not be overwritten.
