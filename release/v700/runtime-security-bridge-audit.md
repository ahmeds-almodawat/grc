# v7.1 Runtime Security Bridge Audit

## Result

```json
{
  "generated_at": "2026-07-17T21:12:58.843Z",
  "db_container": "supabase_db_grc-control-center",
  "db_query_status": "passed_authoritative_live_schema_inventory",
  "db_query_error": null,
  "frontend_rpc_total": 0,
  "authenticated_edge_bridge_call_total": 85,
  "unique_frontend_rpc_total": 0,
  "database_function_total": 388,
  "database_security_definer_functions": 388,
  "authoritative_live_public_security_definer_functions": 383,
  "browser_executable_security_definer_functions": 2,
  "remaining_broad_security_definer_execute_grants": 0,
  "verified_browser_safe_security_definer_execute_grants": 2,
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
  "status": "passed_with_verified_read_only_and_managed_observations",
  "scope_resolution": "Blocking broad-grant scope is the application-owned public schema. Supabase-managed net and supabase_functions functions are printed separately and are not changed by application migrations.",
  "application_broad_security_definer_grants": [],
  "verified_browser_safe_security_definer_grants": [
    {
      "schema": "public",
      "function_name": "current_user_org_id",
      "identity_arguments": "",
      "function_signature": "public.current_user_org_id()",
      "owner": "postgres",
      "language": "plpgsql",
      "security_definer": true,
      "volatility": "stable",
      "public_execute": false,
      "explicit_public_execute": false,
      "public_execute_source": "explicitly_revoked",
      "explicit_anon_execute": false,
      "anon_execute": false,
      "anon_execute_source": "none",
      "explicit_authenticated_execute": true,
      "authenticated_execute": true,
      "authenticated_execute_source": "explicit_grant",
      "explicit_service_role_execute": true,
      "service_role_execute": true,
      "acl_statements": [
        "REVOKE ALL ON FUNCTION \"public\".\"current_user_org_id\"() FROM PUBLIC;",
        "GRANT ALL ON FUNCTION \"public\".\"current_user_org_id\"() TO \"service_role\";",
        "GRANT ALL ON FUNCTION \"public\".\"current_user_org_id\"() TO \"authenticated\";"
      ],
      "final_category": "browser_safe_authenticated_read_only",
      "direct_browser_usage": false,
      "edge_function_usage": false,
      "behavior": "read_only",
      "scope_enforcement": "auth.uid() lookup; null caller returns null",
      "security_mode": "security_definer"
    },
    {
      "schema": "public",
      "function_name": "has_any_role",
      "identity_arguments": "text[]",
      "function_signature": "public.has_any_role(text[])",
      "owner": "postgres",
      "language": "plpgsql",
      "security_definer": true,
      "volatility": "stable",
      "public_execute": true,
      "explicit_public_execute": false,
      "public_execute_source": "implicit_default",
      "explicit_anon_execute": true,
      "anon_execute": true,
      "anon_execute_source": "explicit_grant",
      "explicit_authenticated_execute": true,
      "authenticated_execute": true,
      "authenticated_execute_source": "explicit_grant",
      "explicit_service_role_execute": true,
      "service_role_execute": true,
      "acl_statements": [
        "GRANT ALL ON FUNCTION \"public\".\"has_any_role\"(\"p_roles\" \"text\"[]) TO \"anon\";",
        "GRANT ALL ON FUNCTION \"public\".\"has_any_role\"(\"p_roles\" \"text\"[]) TO \"authenticated\";",
        "GRANT ALL ON FUNCTION \"public\".\"has_any_role\"(\"p_roles\" \"text\"[]) TO \"service_role\";"
      ],
      "final_category": "browser_safe_authenticated_read_only",
      "direct_browser_usage": false,
      "edge_function_usage": false,
      "behavior": "read_only",
      "scope_enforcement": "auth.uid() lookup; null caller returns false",
      "security_mode": "security_definer"
    }
  ],
  "managed_schema_broad_security_definer_grants": [
    {
      "schema": "graphql",
      "function_name": "get_schema_version",
      "identity_arguments": "",
      "function_signature": "graphql.get_schema_version()",
      "owner": "supabase_admin",
      "language": "sql",
      "security_definer": true,
      "volatility": "volatile",
      "public_execute": true,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "final_category": "managed_schema_observation",
      "security_mode": "security_definer",
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
      "owner": "supabase_admin",
      "language": "plpgsql",
      "security_definer": true,
      "volatility": "volatile",
      "public_execute": true,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "final_category": "managed_schema_observation",
      "security_mode": "security_definer",
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
      "function_signature": "net.http_get(text, jsonb, jsonb, integer)",
      "owner": "supabase_admin",
      "language": "plpgsql",
      "security_definer": true,
      "volatility": "volatile",
      "public_execute": false,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "final_category": "managed_schema_observation",
      "security_mode": "security_definer",
      "qualified_function": "net.http_get(text, jsonb, jsonb, integer)",
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
      "function_signature": "net.http_post(text, jsonb, jsonb, jsonb, integer)",
      "owner": "supabase_admin",
      "language": "plpgsql",
      "security_definer": true,
      "volatility": "volatile",
      "public_execute": false,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "final_category": "managed_schema_observation",
      "security_mode": "security_definer",
      "qualified_function": "net.http_post(text, jsonb, jsonb, jsonb, integer)",
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
      "owner": "supabase_functions_admin",
      "language": "plpgsql",
      "security_definer": true,
      "volatility": "volatile",
      "public_execute": false,
      "anon_execute": true,
      "authenticated_execute": true,
      "service_role_execute": true,
      "final_category": "managed_schema_observation",
      "security_mode": "security_definer",
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
          "line": 786
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
          "line": 794
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
          "line": 1823
        },
        {
          "file": "src/lib/userManagementApi.ts",
          "line": 700
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
          "line": 1838
        },
        {
          "file": "src/lib/userManagementApi.ts",
          "line": 715
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
          "line": 2014
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
          "line": 2041
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
- `net.http_get(text, jsonb, jsonb, integer)` - grantees: anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
- `net.http_post(text, jsonb, jsonb, jsonb, integer)` - grantees: anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
- `supabase_functions.http_request()` - grantees: anon, authenticated - Supabase-managed schema observation; do not revoke with an application migration.
