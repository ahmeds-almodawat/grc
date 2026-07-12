# Patch 83Q managed-schema review

These five observations are separate from user-remediable findings and are intentionally unchanged:

| Signature | Owner | Purpose/disposition |
|---|---|---|
| `graphql.get_schema_version()` | `supabase_admin` | Supabase pg_graphql schema-version helper |
| `graphql.increment_schema_version()` | `supabase_admin` | Supabase pg_graphql schema-version maintenance |
| `net.http_get(text, jsonb, jsonb, integer)` | `supabase_admin` | Supabase pg_net extension HTTP helper |
| `net.http_post(text, jsonb, jsonb, jsonb, integer)` | `supabase_admin` | Supabase pg_net extension HTTP helper |
| `supabase_functions.http_request()` | `supabase_functions_admin` | Supabase database-webhook trigger helper |

Ownership and managed schema establish platform control. Migration 170 contains no reference to `graphql`, `net`, or `supabase_functions`.
