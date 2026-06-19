# Vercel Staging Deployment SOP

## Purpose

Deploy the frontend to a controlled staging URL for internal validation.

## Controls

- Use staging Supabase URL only.
- Use staging anon key only.
- Do not expose service-role keys.
- Restrict staging access where possible.
- Enable controlled-pilot banner or environment label.
- Confirm no production analytics or patient systems are connected.

## Validation

- Login works for test personas.
- Navigation works across core modules.
- OVR pages show correct confidentiality boundaries.
- Admin functions require privileged persona.
- Evidence/release pages do not imply production readiness.
