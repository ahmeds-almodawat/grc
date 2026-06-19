# v7.2 Runtime Bridge + Real Authenticated Persona Proof

## Runtime bridge

Seven privileged browser workflows now use the authenticated
`privileged-action` Edge Function:

- board-pack snapshot creation
- escalation acknowledgement
- escalation resolution
- role assignment
- role deactivation
- OVR workflow transition
- OVR corrective-action project creation

The Edge Function validates the caller's Supabase user token. It then calls the
service-role-only `public.v72_execute_privileged_action` dispatcher. The
dispatcher restores the verified user as `auth.uid()` for the existing
database workflow functions and adds organization, privileged-role,
cross-organization, self-deactivation, and last-super-admin safeguards.

The original SECURITY DEFINER functions remain unavailable to `public`, `anon`,
and `authenticated`.

## Authenticated table access

The v7.2 migration grants authenticated users only the table operations needed
by the targeted workflows. RLS remains enabled and authoritative. DELETE is not
granted.

Backup and export metadata policies are tightened so normal employees cannot
read operational package, schedule, or export-log data merely because it
belongs to their organization.

## Persona proof

`npm run v72:persona-proof` creates eight temporary synthetic users in local
Supabase Auth:

- Super Admin
- Executive
- Quality
- Auditor
- Department Manager A
- Department Manager B
- Employee A
- Employee B

It signs in each user through Supabase Auth and executes real client queries
for same-scope access, cross-organization denial, cross-department denial,
confidential OVR denial, evidence scope, self-approval prevention, role
administration, backup/export denial, and anonymous denial.

The proof also executes all seven Edge Function bridge actions. All test
identities and records are synthetic and are deleted after execution.

## Commands

```powershell
npm run v72:all
npm run proof:technical
npm run proof:runtime-security
npm run proof:personas
npm run proof:restore
npm run proof:pilot
npm run proof:all
```

`proof:pilot` still requires genuine Management/Admin, IT, and Quality
approvals. v7.2 does not complete those fields automatically.
