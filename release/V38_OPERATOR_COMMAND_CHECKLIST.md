# v3.8 Operator Command Checklist

Run from project root:

```bash
npm run typecheck
npm run build
node scripts/v38-local-doctor.mjs
node scripts/v38-schema-doctor.mjs
node scripts/v38-production-simulator.mjs
node scripts/v38-final-report.mjs
```

Review:

```text
release/V38_FINAL_MASTER_REPORT.md
```

Do not go live if:

- Typecheck fails
- Build fails
- RLS test fails
- OVR closure controls fail
- Backup/restore dry-run is missing
- Arabic/RTL critical workflow is unusable
