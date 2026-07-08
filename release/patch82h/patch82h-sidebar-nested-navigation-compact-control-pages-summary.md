# Patch 82H — Sidebar Nested Navigation and Compact Control Pages

Patch 82H is a frontend-only UX polish patch for pilot usability.

## Patch 82H-1 corrective note

Patch 82H-1 moves the sidebar and compact User Management styles into the actually loaded `src/styles.css`, removes the unused root CSS apply bundle, and makes the direct User Management route render the compact page without the old Control Pages hub wrapper.

## Patch 82H-2 corrective note

Patch 82H-2 removes the remaining redundant User Management entry path into the old in-page Control Pages hub. The Admin & Organization sidebar parent now opens User Management directly, the underlying hub route remains available, and the User Management content area is expanded with larger KPI cards, wider filters, and a wider roster table.

## Scope

- Moves subsidiary page navigation into an expandable left-sidebar navigation tree.
- Keeps the left sidebar visible and scrollable so page scrolling does not leave an empty navigation area.
- Expands the main content area to use the space recovered from removing in-page subsidiary navigation.
- Removes redundant User Management in-page subsidiary navigation and horizontal control-page card navigation from the normal Admin & Organization entry path.
- Redesigns the User Management Center into a compact control page with breadcrumb, action row, compact KPI cards, collapsible filters, bulk actions, and a denser user roster.
- Keeps user roster primary actions visible as View and Edit while moving secondary actions into a More actions menu.

## Safety

- No migrations.
- No Supabase schema changes.
- No RLS changes.
- No backend/API contract changes.
- No auth, role, or route guard changes.
- No fake/demo data.
- No production readiness or launch claim.
