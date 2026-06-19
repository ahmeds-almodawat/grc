# v6.7.2 Local Evidence Capture

Use this helper to prevent PowerShell prompts, Docker logs, and Supabase output from being pasted back into the terminal as commands.

## One-command workflow

```powershell
npm run v672:all
```

The helper:

- Detects the running local Supabase database container.
- Copies the v64, v65, and v66 SQL tests into `release/v662/staging-sql/`.
- Executes every SQL file with `psql -v ON_ERROR_STOP=1`.
- Saves the real outputs under `release/v66/evidence-attachments/`.
- Captures the live migration ledger.
- Creates a limited `Local Supabase Docker staging` restore-start proof.
- Creates a draft controlled-internal-pilot signoff.
- Runs the v662, v661, v66, and v663 proof commands.

If Supabase is stopped:

```powershell
npm run supabase:local:start
npm run v672:all
```

## Safety boundary

The helper does not approve a production rollout. The signoff is draft-only. Do not use real patient identifiers, confidential OVR data, production credentials, or production exports until management, IT, and Quality explicitly approve the controlled pilot.

The restore attachment proves only that the local Docker staging database starts, is reachable, and has the expected migration ledger. It is not evidence of a complete production backup restore.

## Individual commands

```powershell
npm run v672:capture
npm run v672:proof
```

When a SQL proof fails, the helper still runs the remaining SQL files, preserves all outputs, exits nonzero, and prints the exact evidence file to review.
