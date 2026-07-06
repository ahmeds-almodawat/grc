# Patch 82E Record-Level Dashboard Drilldown Summary

Patch 82E adds frontend-only, actionable drilldown behavior to the Department Control Room.

## Scope

- Department name is no longer the primary click action.
- Non-zero department metric cells are clickable.
- Zero metric cells remain plain/non-clickable.
- Critical Risks count and card actions open the same actionable drilldown.
- Next Action opens the actionable detail.
- The detail explains when linked issue records are not loaded in the current view and routes the user to the correct operational workspace.
- Sidebar navigation labels are cleaned so raw translation keys are not displayed.
- Top bar is less crowded while preserving the product title, pilot context, global search, language toggle, user/profile, and sign out.

## Safety

- Frontend-only.
- No migration added.
- No Supabase migration was applied.
- No RLS, API, RPC, or backend workflow behavior changed.
- No fake/demo records added.
- No production launch wording or production-ready claim added.
- Staging rehearsal remains pending.
