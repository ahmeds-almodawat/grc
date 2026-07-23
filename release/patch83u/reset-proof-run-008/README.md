# Patch 83U hosted reset proof — Run 008

Run 008 is an automated-credential successor to the safely stopped Run 007. It is staging-only and is not authorized by preparation or readiness output.

- Project: `zghsgzrdwbqdrpuxanac`
- Confirmation phrase: `EXECUTE RUN 008 RESET NOW`
- Initial Employee credential state/version: `active / 4`
- Successful reset state/version: `admin_reset_change_required / 5`
- Final credential state/version: `active / 6`
- Initial session/refresh counts: `0 / 0`

Encrypted credentials are loaded by exact filename from the CurrentUser DPAPI bundle. Plaintext is retained only in process memory and encrypted files are deleted after a later execution attempt completes or stops. Preparation validates and clears plaintext but does not delete the encrypted files.

All output files are create-only. Prior Run 001–007 evidence is historical and must not be overwritten.
