# v7.1 Runtime Security Bridge Audit

## Result

```json
{
  "generated_at": "2026-06-28T09:26:59.096Z",
  "db_container": "supabase_db_grc-control-center",
  "db_query_status": "passed",
  "db_query_error": null,
  "frontend_rpc_total": 1,
  "authenticated_edge_bridge_call_total": 12,
  "unique_frontend_rpc_total": 1,
  "database_function_total": 203,
  "database_security_definer_functions": 52,
  "remaining_broad_security_definer_execute_grants": 0,
  "managed_schema_broad_security_definer_observations": 5,
  "service_role_only_rpc_called_by_frontend": 0,
  "service_role_only_rpc_without_bridge_plan": 0,
  "reviewed_service_role_only_rpc_catalog_count": 20,
  "reviewed_rpc_edge_bridged_count": 7,
  "bridge_artifacts": {
    "edge_function": true,
    "service_dispatcher_migration": true,
    "real_persona_proof": true
  },
  "critical_runtime_security_findings": 0,
  "status": "passed",
  "scope_resolution": "Blocking broad-grant scope is the application-owned public schema. Supabase-managed net and supabase_functions functions are printed separately and are not changed by application migrations.",
  "application_broad_security_definer_grants": [],
  "managed_schema_broad_security_definer_grants": [
    {
      "schema": "graphql",
      "function_name": "get_schema_version",
      "identity_arguments": "",
      "function_signature": "graphql.get_schema_version()",
      "security_mode": "security_definer",
      "public_execute": true,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "qualified_function": "graphql.get_schema_version()",
      "broad_grantees": [
        "public",
        "anon",
        "authenticated"
      ],
      "disposition": "Supabase-managed schema observation; do not revoke with an application migration."
    },
    {
      "schema": "graphql",
      "function_name": "increment_schema_version",
      "identity_arguments": "",
      "function_signature": "graphql.increment_schema_version()",
      "security_mode": "security_definer",
      "public_execute": true,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "qualified_function": "graphql.increment_schema_version()",
      "broad_grantees": [
        "public",
        "anon",
        "authenticated"
      ],
      "disposition": "Supabase-managed schema observation; do not revoke with an application migration."
    },
    {
      "schema": "net",
      "function_name": "http_get",
      "identity_arguments": "url text, params jsonb, headers jsonb, timeout_milliseconds integer",
      "function_signature": "net.http_get(text,jsonb,jsonb,integer)",
      "security_mode": "security_definer",
      "public_execute": false,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "qualified_function": "net.http_get(text,jsonb,jsonb,integer)",
      "broad_grantees": [
        "anon",
        "authenticated"
      ],
      "disposition": "Supabase-managed schema observation; do not revoke with an application migration."
    },
    {
      "schema": "net",
      "function_name": "http_post",
      "identity_arguments": "url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer",
      "function_signature": "net.http_post(text,jsonb,jsonb,jsonb,integer)",
      "security_mode": "security_definer",
      "public_execute": false,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "qualified_function": "net.http_post(text,jsonb,jsonb,jsonb,integer)",
      "broad_grantees": [
        "anon",
        "authenticated"
      ],
      "disposition": "Supabase-managed schema observation; do not revoke with an application migration."
    },
    {
      "schema": "supabase_functions",
      "function_name": "http_request",
      "identity_arguments": "",
      "function_signature": "supabase_functions.http_request()",
      "security_mode": "security_definer",
      "public_execute": false,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "qualified_function": "supabase_functions.http_request()",
      "broad_grantees": [
        "anon",
        "authenticated"
      ],
      "disposition": "Supabase-managed schema observation; do not revoke with an application migration."
    }
  ],
  "reviewed_service_role_only_rpc_catalog": [
    {
      "rpc_name": "refresh_automation_intelligence",
      "v700_reviewed_frontend_file": "src/lib/automationApi.ts",
      "v700_reviewed_frontend_line": 220,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Run from scheduled/server automation; the browser should only read refreshed results.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "seed_release_factory_defaults",
      "v700_reviewed_frontend_file": "src/lib/consolidationApi.ts",
      "v700_reviewed_frontend_line": 119,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "remove_from_frontend_seed_release_tool",
      "recommendation": "Keep default seeding in an explicit local/release operator tool.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "create_board_pack_snapshot",
      "v700_reviewed_frontend_file": "src/lib/enterpriseApi.ts",
      "v700_reviewed_frontend_line": 173,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/enterpriseApi.ts",
          "line": 174
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Require an authenticated Edge Function that validates board-pack role and tenant scope.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "record_backup_schedule_run",
      "v700_reviewed_frontend_file": "src/lib/enterpriseApi.ts",
      "v700_reviewed_frontend_line": 202,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Backup scheduler state must be written by trusted server automation.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "seed_final_release_defaults",
      "v700_reviewed_frontend_file": "src/lib/finalizationApi.ts",
      "v700_reviewed_frontend_line": 155,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "remove_from_frontend_seed_release_tool",
      "recommendation": "Keep release seeding in an explicit operator-only tool.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "refresh_escalation_events",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 370,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Refresh escalation events from scheduled/server automation; the browser should query results.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "acknowledge_escalation_event",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 376,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/grcApi.ts",
          "line": 477
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Validate tenant, role, and event state in an authenticated Edge Function.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "resolve_escalation_event",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 382,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/grcApi.ts",
          "line": 485
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Validate tenant, role, and workflow transition in an authenticated Edge Function.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "assign_user_role",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 986,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/grcApi.ts",
          "line": 1067
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Enforce organization scope and privilege-escalation protections in an authenticated admin Edge Function.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "deactivate_user_role",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 1002,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/grcApi.ts",
          "line": 1082
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Enforce organization scope and last-admin invariants in an authenticated admin Edge Function.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "update_ovr_workflow",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 1226,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/grcApi.ts",
          "line": 1289
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Apply explicit OVR access, transition, and confidentiality checks in an authenticated Edge Function.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "create_ovr_corrective_action_project",
      "v700_reviewed_frontend_file": "src/lib/grcApi.ts",
      "v700_reviewed_frontend_line": 1241,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": true,
      "authenticated_edge_bridge_locations": [
        {
          "file": "src/lib/grcApi.ts",
          "line": 1316
        }
      ],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "convert_to_edge_function",
      "recommendation": "Verify OVR access and create only tenant-scoped records in an authenticated Edge Function.",
      "remediation_status": "authenticated_edge_function_bridge_present"
    },
    {
      "rpc_name": "create_system_health_snapshot",
      "v700_reviewed_frontend_file": "src/lib/hardeningApi.ts",
      "v700_reviewed_frontend_line": 149,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Create snapshots from trusted monitoring automation and expose results read-only.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "generate_due_reminders",
      "v700_reviewed_frontend_file": "src/lib/operationsApi.ts",
      "v700_reviewed_frontend_line": 178,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Generate reminders from scheduled/server automation.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "seed_v33_production_proof_defaults",
      "v700_reviewed_frontend_file": "src/lib/productionProofApi.ts",
      "v700_reviewed_frontend_line": 106,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "remove_from_frontend_seed_release_tool",
      "recommendation": "Keep proof-data seeding in an explicit operator tool.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "seed_v31_finish_fast_defaults",
      "v700_reviewed_frontend_file": "src/lib/productionReadinessApi.ts",
      "v700_reviewed_frontend_line": 167,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "remove_from_frontend_seed_release_tool",
      "recommendation": "Keep finish-fast defaults in an explicit release operator tool.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "start_restore_dry_run",
      "v700_reviewed_frontend_file": "src/lib/releaseOpsApi.ts",
      "v700_reviewed_frontend_line": 215,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Run restore verification only from trusted local/server tooling.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "run_ultra_release_preflight",
      "v700_reviewed_frontend_file": "src/lib/releaseOpsApi.ts",
      "v700_reviewed_frontend_line": 221,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "keep_server_only",
      "recommendation": "Run release preflight from trusted CI/operator tooling and expose the result read-only.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "seed_staging_validation_defaults",
      "v700_reviewed_frontend_file": "src/lib/stabilizationApi.ts",
      "v700_reviewed_frontend_line": 198,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "remove_from_frontend_seed_release_tool",
      "recommendation": "Keep staging fixture seeding in explicit local staging tooling.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    },
    {
      "rpc_name": "seed_default_qa_test_cases",
      "v700_reviewed_frontend_file": "src/lib/testingApi.ts",
      "v700_reviewed_frontend_line": 169,
      "current_frontend_call_present": false,
      "current_frontend_locations": [],
      "authenticated_edge_bridge_present": false,
      "authenticated_edge_bridge_locations": [],
      "current_security_mode": "security_definer",
      "current_grant_status": {
        "public": false,
        "anon": false,
        "authenticated": false,
        "service_role": true
      },
      "recommended_action": "remove_from_frontend_seed_release_tool",
      "recommendation": "Keep QA fixture seeding in a test/operator tool.",
      "remediation_status": "direct_browser_call_removed_or_guarded"
    }
  ]
}
```

## Service-role-only RPCs still called by frontend

None detected.

## Reviewed v7.0 service-role-only RPC catalog

- `refresh_automation_intelligence` - reviewed at `src/lib/automationApi.ts:220` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `seed_release_factory_defaults` - reviewed at `src/lib/consolidationApi.ts:119` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **remove_from_frontend_seed_release_tool** - direct_browser_call_removed_or_guarded
- `create_board_pack_snapshot` - reviewed at `src/lib/enterpriseApi.ts:173` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `record_backup_schedule_run` - reviewed at `src/lib/enterpriseApi.ts:202` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `seed_final_release_defaults` - reviewed at `src/lib/finalizationApi.ts:155` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **remove_from_frontend_seed_release_tool** - direct_browser_call_removed_or_guarded
- `refresh_escalation_events` - reviewed at `src/lib/grcApi.ts:370` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `acknowledge_escalation_event` - reviewed at `src/lib/grcApi.ts:376` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `resolve_escalation_event` - reviewed at `src/lib/grcApi.ts:382` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `assign_user_role` - reviewed at `src/lib/grcApi.ts:986` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `deactivate_user_role` - reviewed at `src/lib/grcApi.ts:1002` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `update_ovr_workflow` - reviewed at `src/lib/grcApi.ts:1226` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `create_ovr_corrective_action_project` - reviewed at `src/lib/grcApi.ts:1241` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **convert_to_edge_function** - authenticated_edge_function_bridge_present
- `create_system_health_snapshot` - reviewed at `src/lib/hardeningApi.ts:149` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `generate_due_reminders` - reviewed at `src/lib/operationsApi.ts:178` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `seed_v33_production_proof_defaults` - reviewed at `src/lib/productionProofApi.ts:106` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **remove_from_frontend_seed_release_tool** - direct_browser_call_removed_or_guarded
- `seed_v31_finish_fast_defaults` - reviewed at `src/lib/productionReadinessApi.ts:167` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **remove_from_frontend_seed_release_tool** - direct_browser_call_removed_or_guarded
- `start_restore_dry_run` - reviewed at `src/lib/releaseOpsApi.ts:215` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `run_ultra_release_preflight` - reviewed at `src/lib/releaseOpsApi.ts:221` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **keep_server_only** - direct_browser_call_removed_or_guarded
- `seed_staging_validation_defaults` - reviewed at `src/lib/stabilizationApi.ts:198` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **remove_from_frontend_seed_release_tool** - direct_browser_call_removed_or_guarded
- `seed_default_qa_test_cases` - reviewed at `src/lib/testingApi.ts:169` - security_definer - grants={"public":false,"anon":false,"authenticated":false,"service_role":true} - **remove_from_frontend_seed_release_tool** - direct_browser_call_removed_or_guarded

## Managed-schema broad SECURITY DEFINER observations

- `graphql.get_schema_version()` - grantees: public, anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
- `graphql.increment_schema_version()` - grantees: public, anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
- `net.http_get(text,jsonb,jsonb,integer)` - grantees: anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
- `net.http_post(text,jsonb,jsonb,jsonb,integer)` - grantees: anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
- `supabase_functions.http_request()` - grantees: anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
