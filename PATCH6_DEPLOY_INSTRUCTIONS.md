# Patch 6: Accreditation & Quality Operating Layer

## Purpose

Patch 6 moves the platform from accreditation structure toward daily operating work.

It adds:

- Licensed/current standards import governance without embedding copyrighted CBAHI/JCI text
- Accreditation requirement ownership and department readiness
- Measurable element scoring and evidence status
- Quality indicator definitions and measurements
- Patient/system/department/document/environment tracer rounds
- Tracer observations and high-risk findings
- OVR/tracer/mock-survey/indicator/audit finding RCA-to-CAPA cases
- Committee decisions
- Survey evidence packs
- UI page: Quality Operating Layer
- Quality/Safety hub integration
- Explicit Patch 5 workflow-kernel RLS policies so static RLS proof can read them

## Apply

Extract this ZIP to:

```powershell
C:\Users\molte\Downloads
```

Then run:

```powershell
cd C:\Users\molte\Downloads\grc-control-center

git checkout main
git pull
git checkout -b patch-6-accreditation-quality-operating-layer

powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch6_grc_changes\scripts\apply-patch6.ps1"
```

If you copied the scripts into the repo `scripts` folder, this script can still locate the extracted patch folder under Downloads:

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\apply-patch6.ps1"
```

## Verify

```powershell
cd C:\Users\molte\Downloads\grc-control-center
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\patch6_grc_changes\scripts\verify-patch6.ps1"
```

If you copied scripts into the repo:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\molte\Downloads\grc-control-center\scripts\verify-patch6.ps1"
```

## Full Gate

```powershell
npm ci
npm run typecheck
npm run build
npm run test:unit
npx playwright install --with-deps
npm run test:e2e
npm audit --audit-level=high
npm run v64:rls-strict
npm run proof:all
npm run v672:capture
npm run v700:v65-audit
```

## Supabase

Local:

```powershell
supabase db reset
```

Staging:

```powershell
supabase db push
```

## Commit

```powershell
git status
git diff --stat

git add supabase/migrations/067_patch6_accreditation_quality_operating_layer.sql src/lib/qualityAccreditationOperatingApi.ts src/pages/QualityAccreditationOperatingCenter.tsx src/App.tsx README.md release/v66 release/v700 release/v64 release/v661

git commit -m "Patch 6: add accreditation and quality operating layer"
git push -u origin patch-6-accreditation-quality-operating-layer
```

Open a PR into `main`.

## Important

Do not load CBAHI/JCI copyrighted standards text into this patch. Use this patch to import licensed organization-owned standards content later through controlled import batches.
