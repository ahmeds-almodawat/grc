import fs from 'fs';
import path from 'path';

const exists = (p) => fs.existsSync(path.resolve(p));
const read = (p) => exists(p) ? fs.readFileSync(path.resolve(p), 'utf8') : '';
const ensureDir = (p) => fs.mkdirSync(path.resolve(p), { recursive: true });
const sql = read('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql');

const checks = [
  { id: 'RISK_RULE_TABLE', label: 'OVR risk calibration table exists', pass: sql.includes('ovr_risk_calibration_rules') },
  { id: 'RISK_VIEW', label: 'OVR calibrated risk view exists', pass: sql.includes('v_v46_ovr_risk_calibration') },
  { id: 'MAJOR_RULE', label: 'Major OVR executive alert rule seeded', pass: sql.includes('OVR_MAJOR_ANY') },
  { id: 'SENTINEL_RULE', label: 'Sentinel escalation rule seeded', pass: sql.includes('OVR_SENTINEL_ANY') },
  { id: 'MEDICATION_RULE', label: 'Medication recurrence rule seeded', pass: sql.includes('OVR_MEDICATION_RECUR') },
  { id: 'FALL_RULE', label: 'Falls recurrence rule seeded', pass: sql.includes('OVR_FALL_RECUR') },
  { id: 'DELAY_RULE', label: 'Closure delay rule seeded', pass: sql.includes('OVR_OVERDUE_CLOSURE') }
];
const passed = checks.filter(c => c.pass).length;
const report = {
  generated_at: new Date().toISOString(),
  title: 'v4.4 OVR Risk Calibration Audit',
  passed,
  total: checks.length,
  score_percent: Math.round((passed / checks.length) * 100),
  checks
};
ensureDir('release');
fs.writeFileSync('release/v44-ovr-risk-calibration-audit.json', JSON.stringify(report, null, 2));
console.log(`v4.4 OVR risk calibration audit: ${passed}/${checks.length} passed (${report.score_percent}%)`);
if (passed < checks.length) process.exitCode = 1;
