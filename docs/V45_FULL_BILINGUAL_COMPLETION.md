# v4.5 Full Bilingual Completion

Purpose: push the platform toward complete Arabic/English readiness.

This pack adds:

- Status dictionary helper.
- Role dictionary helper.
- OVR severity/category labels.
- SQL translation coverage registry.
- i18n deep audit script.

Acceptance target:

- Arabic mode should not show English UI labels except names, codes, file names, or user-entered content.
- Validation messages should be bilingual.
- Status and role labels should use dictionaries.
- Reports and print layouts must support Arabic labels.

Run:

```bash
npm run v45:i18n
```

Review:

```text
release/v45-i18n-deep-audit.json
```
