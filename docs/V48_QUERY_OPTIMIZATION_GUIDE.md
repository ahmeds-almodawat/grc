# v4.8 Query Optimization Guide

Production rules:

1. Dashboard pages should use summary views.
2. Detail data should load only when the user opens an item.
3. Large tables must use filters and pagination.
4. Evidence and audit log pages must default to recent/pending records.
5. Global search must limit results and avoid full dataset rendering.

Run:

```bash
npm run v50:performance
```

Then review:

```text
release/v50-reports/v50-performance-audit.json
```
