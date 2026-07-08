# Patch 82F Employee ID Login Alias Summary

Patch 82F adds a small pilot usability improvement to the sign-in screen.

## Scope

- The login identifier label now reads "Email or Employee ID".
- Users can enter a full email address or an employee ID.
- Employee ID entries are normalized internally to the Almodawat email domain before the existing Supabase Auth password sign-in call.
- Email input is trimmed and lowercased before authentication.
- Password behavior is unchanged and still required.

## Safety Notes

- No Supabase migration was added.
- No Supabase Auth backend behavior was changed.
- No RLS, API, RPC, or service-role behavior was changed.
- No password bypass, password storage, fake data, seed data, or production launch behavior was added.
