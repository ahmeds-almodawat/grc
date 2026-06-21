# Apply v9.8 First-Run Pilot Bootstrap

This helper repairs the local first-run lockout for an auth user that already exists in local Supabase. It creates or reuses the pilot organization and departments, upserts the public profile, and creates or reactivates one active `super_admin` / `global` role.

It is for local development and controlled pilot testing only. It does not create `auth.users`, change RLS, modify migrations, update approval JSON, or declare the platform production ready.

## Windows PowerShell: standard pilot user

Open PowerShell in the project directory and run:

```powershell
Set-Location "C:\Users\molte\Downloads\grc-control-center"
npx supabase start
$env:NODE_ENV = "development"
npm run pilot:first-run-bootstrap
npm run typecheck
npm run build
```

The auth user must already exist in local Supabase Studio:

```text
http://127.0.0.1:54323
Authentication > Users > pilot.admin@almodawat.test
```

## Windows PowerShell: custom names

```powershell
Set-Location "C:\Users\molte\Downloads\grc-control-center"
$env:NODE_ENV = "development"
node scripts/v98-bootstrap-pilot-admin.mjs --allow-local-bootstrap --email "pilot.admin@almodawat.test" --full-name-en "Pilot Administrator" --full-name-ar "مدير البرنامج التجريبي"
node scripts/v98-verify-first-run-bootstrap.mjs --allow-local-bootstrap --email "pilot.admin@almodawat.test"
```

The command is idempotent. It is safe to rerun against the same local Supabase stack; it does not duplicate the required departments or the active matching role.

## Test the real authenticated user

The real login flow cannot be tested while the local auth bypass is enabled. In `.env.local`, set:

```dotenv
VITE_AUTH_BYPASS_LOCAL=false
```

Restart Vite after changing the value:

```powershell
npm run dev
```

Sign in as `pilot.admin@almodawat.test`, then confirm these menus are visible:

- Admin Hub
- Departments
- Access Control
- Import Export

The completed admin setup UI now provides:

- `Access Control` → `Create user`
- `Departments` → `Create department`

`Create user` securely calls the local `privileged-action` Edge Function. It creates the Supabase Auth account server-side, then creates the profile and initial role in one controlled flow. The service-role key is never included in the browser bundle.

After pulling this patch into an already-running local stack, restart the application:

```powershell
Set-Location "C:\Users\molte\Downloads\grc-control-center"
npx supabase start
npm run pilot:first-run-bootstrap
npm run dev
```

If the session was open before bootstrap, sign out and sign in again, or perform a hard refresh so `AuthProvider` reloads the profile and role.

## Generated local evidence

Successful execution writes:

- `release/v98/first-run-bootstrap-report.md`
- `release/v98/first-run-bootstrap-verification.md`

These files are local technical evidence only. They are not management, IT, Quality, security, or production approvals.

## Safety failures

If local Supabase is not running, start it:

```powershell
npx supabase start
```

If the script reports `V98_AUTH_USER_NOT_FOUND`, create the user in local Supabase Studio first. The bootstrap intentionally refuses to insert directly into `auth.users`.

With `NODE_ENV=production`, the script refuses to run unless `--allow-local-bootstrap` is explicitly provided. Even with that flag, it only targets the Docker container labeled for this local Supabase project.
