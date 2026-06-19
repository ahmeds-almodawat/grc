# v6.1.1 Migration Prefix Cleanup Plan

Generated: 2026-06-18T14:55:28.720Z

Migration count: **39**
Prefix gaps: **none**
Duplicate prefixes: **none**

## Proposed renames

No renames required.

## Safety rule

This script does not rename files by default. Renaming historical migrations can break migration history if those migrations were already applied in Supabase.

To apply only in a local/unapplied migration set:

```bash
npm run v611:migration-apply
npm run v61:migrations
```
