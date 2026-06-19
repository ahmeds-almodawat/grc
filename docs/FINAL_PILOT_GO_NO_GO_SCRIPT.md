# Final Pilot Go / No-Go Script

## Go only if all hard gates are satisfied

- Fresh Supabase installation passed.
- RLS personas passed with real test users.
- OVR workflow passed from reporter to Quality closure.
- Backup and restore dry-run passed.
- Arabic/RTL critical screens reviewed.
- Pilot users are named and trained.

## No-go if any of these are true

- Any hard gate is blocked.
- Employee can see another department improperly.
- Department can close its own audit/OVR incorrectly.
- OVR can close without Quality evidence.
- Backup exists but restore was not tested.
