import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });
const sql = `-- v4.2 RLS persona smoke-test template\n-- Run after creating dedicated test users in Supabase Auth.\n-- Replace UUID placeholders with real auth.users ids.\n\n-- 1) Register test personas in profiles/user_roles using your real organization id.\n-- 2) Login as each persona in the app.\n-- 3) Confirm allowed/denied behavior from the v42 RLS Persona Test Lab report.\n\nselect * from v_v42_rls_persona_matrix order by persona_code, expected_behavior;\nselect * from v_v42_rls_test_case_queue order by priority, persona_code;\n\n-- Hard stop query examples:\n-- Employees with non-assigned global access\nselect * from user_roles where role in ('employee','viewer') and scope = 'global' and is_active = true;\n\n-- Sensitive global roles for review\nselect * from user_roles where role in ('super_admin','executive','governance_admin') and scope = 'global' and is_active = true;\n\n-- Pending RLS test results\nselect * from rls_persona_test_runs where result = 'pending' order by created_at desc;\n`;
fs.writeFileSync(path.join(releaseDir, 'v42-rls-persona-smoke-test.sql'), sql);
console.log('Generated release/v42-rls-persona-smoke-test.sql');
