const env = process.env.GRC_LOCAL_BASELINE_ENV;
const host = process.env.DB_HOST || 'localhost';
const projectRef = process.env.SUPABASE_PROJECT_REF || '';

if (env !== 'local') {
  console.error('❌ Expected GRC_LOCAL_BASELINE_ENV=local');
  process.exit(1);
}

if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error('❌ Expected host localhost or 127.0.0.1');
  process.exit(1);
}

if (projectRef === 'zbrjjecpsrzposhuarcn') {
  console.error('❌ Rejected production project ref zbrjjecpsrzposhuarcn');
  process.exit(1);
}

const forbiddenEnvs = ['production', 'prod', 'live', 'staging'];
if (forbiddenEnvs.includes(process.env.NODE_ENV) || forbiddenEnvs.includes(process.env.SUPABASE_ENV)) {
  console.error('❌ Rejected production or staging environments');
  process.exit(1);
}

console.log('✅ Local baseline environment checks passed.');
