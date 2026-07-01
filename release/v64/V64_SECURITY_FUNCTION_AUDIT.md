# v6.4 Security Function Audit

```json
{
<<<<<<< Updated upstream
  "generated_at": "2026-07-01T17:28:54.005Z",
  "migration_files_scanned": 82,
  "security_definer_functions_detected": 46,
=======
  "generated_at": "2026-07-01T23:08:34.413Z",
  "migration_files_scanned": 83,
  "security_definer_functions_detected": 55,
>>>>>>> Stashed changes
  "global_security_definer_lockdown_detected": true,
  "findings_total": 0,
  "critical": 0,
  "high": 0,
  "medium": 0,
  "strict_passed": true,
  "note": "Static scan strips SQL comments, honors later SECURITY INVOKER changes, and recognizes the v6.7.3 dynamic blanket revoke. The live v6.7.3 database audit remains authoritative for effective grants."
}
```

## Findings

No critical/high findings detected.
