# HF-1-R2 Privacy-Suppression Dashboard UX

Date: `2026-08-27`
Hotfix branch: `hotfix/v1.4-super-admin-dashboard-visibility`
Parent certified source: `b1d9d03e3dd730da9080e1cd421eda00d4bf56a6`

This record contains no exact suppressed OVR value, raw OVR content, password,
token, session value, service-role material, or CAPTCHA secret.

## Root Cause And Correction

- The selector `.grc-safe-trend svg` applied the chart's `520px` minimum width
  and `270px` height to every nested SVG, including the privacy notice's Lucide
  lock. The corrected selector targets only the chart-root SVG, while the lock
  is explicitly constrained to `14px`.
- The trend renderer omitted suppressed points when bounds were absent, but it
  still trusted payload labels and numeric bounds when they were present. The
  read model now derives rendering exclusively from the privacy state: only a
  confirmed `zero` or a valid `banded` metric can produce chart coordinates.
- Suppressed metrics are normalized to the canonical `<5` presentation and
  cannot contribute a hidden label, tooltip, ARIA label, DOM attribute, or
  chart coordinate. An all-suppressed trend renders a compact privacy state
  instead of a numeric chart.

## Preserved Contract

- Privacy minimum: `5`.
- Super Admin and Executive: organization-wide privacy-safe aggregate only.
- Lower-role dashboard entitlement: unchanged.
- Raw OVR access, RLS, RPC permissions, Edge authorization, OVR configuration,
  Patch83U, and CAPTCHA: unchanged.
- Confirmed zero remains numeric `0`; suppressed remains `<5`; unavailable and
  restricted states remain distinct.
- Migration `235`: not created.

## Focused Validation

- Dashboard unit contracts: `55/55` PASS.
- HF-1-R2 Super Admin and Executive Playwright scenarios: `2/2` PASS.
- Existing UI-2 governance/policy/SOP visual regression: `3/3` PASS.
- TypeScript validation: PASS.
- Production build: PASS.
- `git diff --check`: PASS.
- Browser write requests during R2 scenarios: none.
- Browser page errors during R2 scenarios: none.
- Desktop light, desktop dark, and `390px` mobile checks: PASS.

The exact final commit, dedicated Staging deployment, hosted Super Admin visual
result, screenshot reference, and CI conclusion are recorded on PR `#130` and
in the final hotfix handoff after deployment. Production changes remain NONE.
