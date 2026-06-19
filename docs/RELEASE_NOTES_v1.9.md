# GRC Control Center v1.9 — Mega Command, Search & Documents Patch

This is a large patch-only release that connects the platform into a unified executive command system.

## Added

- Executive Command Center
- Global Search Center
- Policy & Document Center
- Cross-module Relationship Map
- Release Candidate Center
- Command summary API layer
- Global search API layer
- Document center API layer
- Relationship map API layer
- Release gate and migration-order API layer
- Bilingual labels for all new pages and navigation
- Modern command UI styling
- New Supabase migration: `021_command_search_documents_release.sql`

## Database additions

- `document_center_items`
- `release_candidate_gates`
- `release_migration_order`
- `v_document_center_items`
- `v_document_center_summary`
- `v_global_search_index`
- `search_grc_global(p_query, p_limit)`
- `v_executive_command_stream`
- `v_executive_command_summary`
- `v_cross_module_relationship_map`
- `v_release_candidate_gates`
- `v_release_migration_order`

## Purpose

The platform now behaves more like a single governance command center instead of separate modules. Executives can see critical items, search across the platform, trace why actions exist, manage documents, and check release readiness before rollout.

## Testing

Tested on a reconstructed project tree:

```bash
npm run typecheck
npm run build
```

Both passed. Vite showed only the normal chunk-size warning.
