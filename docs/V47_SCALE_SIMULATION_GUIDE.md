# v4.7 Scale Simulation Guide

Target test scale:

- 50 departments
- 1,000 users
- 120+ projects
- 1,500+ tasks
- 500 OVR records
- 300 risk/compliance/audit records
- 800+ evidence metadata records

Run:

```bash
npm run v50:scale
```

Review generated files in:

```text
release/v50-scale-seed/
```

Import only after review. Do not import generated test data into production.
