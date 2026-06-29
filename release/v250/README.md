# v25.0 Live GRC Operating Workspace

v25.0 adds the operating model layer needed to move from professional static proof to controlled live operation.

Professional chain:

`Operating Cycle → Data Intake → Edge Bridge Review → Access Review → Evidence Snapshot → Production Exception → Management Sign-off`

This pack adds:

- Live GRC operating cycle model
- Data intake governance contract
- Edge bridge readiness registry contract
- Access review and SoD operating expectations
- Framework evidence snapshot contract
- Production exception register contract

Security posture:

- New tables are RLS-enabled
- Authenticated SELECT/INSERT/UPDATE are blocked pending reviewed bridge
- No authenticated DELETE policy
- No broad true policy
- No automatic production reliance
