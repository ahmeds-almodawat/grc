# P3/P3.5 Staging Manifest

## Targets

- Supabase: `zghsgzrdwbqdrpuxanac`
- Vercel project: `grc-staging`
- Alias: `https://grc-staging-lilac.vercel.app`
- Frozen frontend product source: `3c87eeb8e05427f295111c5188b95003082dfdb2`
- Product-source attestation deployment:
  `dpl_J2QcnmP5U6i8rnJWasz9MAL4iQ9n`
- Immutable URL:
  `https://grc-staging-jh2xpqfbt-ahmeds-6478s-projects.vercel.app`
- State: READY

Canonical Vercel project metadata independently reports the deployment's
`gitCommitSha`, branch, commit message, immutable deployment ID, and target.
The metadata SHA matched local, origin, and PR head when F19 was closed.

The final evidence-only RC and matching deployment metadata are recorded in PR
#129 after the evidence commit. The frontend product source remains the frozen
SHA above.

## Environment Contract

- `VITE_SUPABASE_URL`: staging project
- `VITE_SUPABASE_ANON_KEY`: staging publishable/anonymous credential
- `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED=true`
- `VITE_ALLOW_DEMO_DATA=false`
- `VITE_AUTH_CAPTCHA_REQUIRED=true`
- Real Turnstile site configuration active
- Department import execution flag: absent/default-disabled
- User Excel import execution flag: absent/default-disabled
- Production variable changes: none

No values, secrets, keys, tokens, passwords, or cookies are included here.

## Hosted State

- Migration source ceiling: 231
- `privileged-action`: ACTIVE version 10, JWT required
- Legacy `admin-create-user`: staging-only version 3; must not propagate
- Auth users: 8
- Profiles: 8
- Active roles: 8
- Tagged UAT profiles: 6 active
- Tagged UAT active roles: 6
- Organizations: 1
- Divisions: 5
- Departments: 8
- Risks: 4
- Projects: 3

The final non-human closure performed no Auth, profile, role, schema, RLS,
grant, migration, or business-data mutation.

## CAPTCHA Position

Supabase Auth CAPTCHA and the frontend requirement are enabled. The deployed
login remains fail-closed without a valid Turnstile response. Final human
authentication certification is the only open staging security gate.
