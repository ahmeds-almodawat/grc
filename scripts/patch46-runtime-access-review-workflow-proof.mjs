import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase/migrations/106_patch46_runtime_access_review_signoff_closure.sql');
const registryPath = path.join(root, 'src/lib/runtimeActionRegistry.ts');
const outDir = path.join(root, 'release/patch46');
const outPath = path.join(outDir, 'patch46-workflow-proof.json');
const sql = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const registry = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : '';
const lower = `${sql}\n${registry}`.toLowerCase();

const requiredStatuses = ['pending', 'approved', 'approved_with_limitation', 'rejected', 'expired', 'superseded'];
const workflowTokens = [
  'reviewer_role',
  'reviewer_user_id',
  'due_at',
  'limitation_summary',
  'evidence_reference',
  'risk_acceptance_required',
  'is_overdue',
  'blocker_reason',
  'access_review_readiness_status',
  'ready_with_limitations',
  'pending_high_risk_signoffs',
  'direct_browser_exception',
];

const checks = [
  { name: 'required signoff statuses represented', passed: requiredStatuses.every(status => lower.includes(status)) },
  ...workflowTokens.map(token => ({ name: `workflow token exists: ${token}`, passed: lower.includes(token) })),
  { name: 'closure evidence required for terminal signoff decisions', passed: lower.includes('closure evidence required') && lower.includes("p_signoff_status in ('approved', 'approved_with_limitation', 'rejected')") },
  { name: 'approved-with-limitation requires limitation summary', passed: lower.includes('limitation summary required') },
  { name: 'pending critical/high reviews block readiness', passed: lower.includes('pending_high_risk_signoffs > 0') && lower.includes("risk_level in ('critical', 'high')") },
  { name: 'direct browser RPC exception remains tracked', passed: registry.includes("actionName: 'search_grc_global'") && registry.includes('directBrowserException: true') },
  { name: 'no blanket auto-approval', passed: !/signoff_status\s*=\s*'approved'[\s\S]{0,120}from public\.runtime_action_reviews/i.test(sql) },
  { name: 'event ledger records signoff lifecycle', passed: lower.includes('runtime_action_review_signoff_events') && lower.includes('signoff_created') && lower.includes('signoff_status_updated') },
];

const failed = checks.filter(check => !check.passed);
const result = {
  patch: '46',
  checked_at: new Date().toISOString(),
  strict_passed: failed.length === 0,
  check_count: checks.length,
  failed_count: failed.length,
  failed,
  required_statuses: requiredStatuses,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
if (!result.strict_passed) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
