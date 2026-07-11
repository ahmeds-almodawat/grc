import fs from 'fs';

const testEnv = process.env.GRC_RLS_TEST_ENV;
const allowStaging = process.env.GRC_RLS_ALLOW_STAGING;
const supabaseUrl = process.env.SUPABASE_URL || '';

const rejectedEnvs = ['production', 'prod', 'live', '', undefined];
const rejectedRef = 'zbrjjecpsrzposhuarcn';

if (rejectedEnvs.includes(testEnv)) {
  console.error(`❌ CRITICAL SAFETY FAILURE: Rejected environment specified or missing: '${testEnv}'`);
  process.exit(1);
}

if (testEnv !== 'local' && testEnv !== 'staging') {
  console.error(`❌ CRITICAL SAFETY FAILURE: Unknown environment specified: '${testEnv}'`);
  process.exit(1);
}

if (testEnv === 'staging' && allowStaging !== 'true') {
  console.error(`❌ CRITICAL SAFETY FAILURE: Staging environment requested without explicit GRC_RLS_ALLOW_STAGING=true`);
  process.exit(1);
}

if (supabaseUrl.includes(rejectedRef)) {
  console.error(`❌ CRITICAL SAFETY FAILURE: Detected explicit production project reference: '${rejectedRef}'. Aborting immediately.`);
  process.exit(1);
}

console.log(`✅ SAFETY CHECK PASSED: Environment is safely configured for non-production tests: ${testEnv}`);
