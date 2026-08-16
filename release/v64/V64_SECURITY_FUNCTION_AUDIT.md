# v6.4 Security Function Audit

```json
{
  "generated_at": "2026-08-16T18:53:05.314Z",
  "migration_files_scanned": 153,
  "security_definer_functions_detected": 530,
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
