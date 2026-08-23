# P3 Staging Manifest

## Targets

- Supabase: `zghsgzrdwbqdrpuxanac`
- Vercel project: `grc-staging`
- Alias: `https://grc-staging-lilac.vercel.app`
- Deployment ID: `dpl_GGRb1aYs1kAGwPPgkottD17j5Lm7`
- Immutable URL: `https://grc-staging-dofgr7yct-ahmeds-6478s-projects.vercel.app`
- State: READY
- Deployment source: first P3 correction `a4d7ed7`
- Current correction RC: `5f81c61ef1d084cbc61322bcebaa4c978af89d04`
- Exact final RC deployed: NO, blocked before final certification deployment

## Environment Contract

- `VITE_SUPABASE_URL`: staging project
- `VITE_SUPABASE_ANON_KEY`: staging publishable/anonymous credential
- `VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED=true`
- `VITE_ALLOW_DEMO_DATA=false`
- Department Import: absent/default-disabled
- CAPTCHA: required and enabled
- Production variable changes: none

No values, secrets, keys, tokens, passwords, or cookies are included here.

## Data Preservation

| Aggregate | Baseline | Post-cleanup |
| --- | ---: | ---: |
| Auth users | 2 | 8 |
| Profiles | 2 | 8 |
| Active roles | 2 | 2 |
| Organizations | 1 | 1 |
| Divisions | 5 | 5 |
| Departments | 8 | 8 |
| Risks | 3 | 3 |
| Projects | 2 | 2 |
| Compliance items | 2 | 2 |

The six additional Auth/profile records are tagged P3 UAT identities. Two are
inactive with disabled credentials. Four are invited with zero active roles
and unfinished first-login provisioning. No pre-existing business record was
deleted or unexpectedly mutated.

