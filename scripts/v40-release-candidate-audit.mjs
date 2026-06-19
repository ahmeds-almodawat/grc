import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
fs.mkdirSync(releaseDir, { recursive: true });
const exists = (p) => fs.existsSync(path.join(root, p));
const readJson = (p) => exists(p) ? JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')) : null;

const pkg = readJson('package.json') || {};
const requiredScripts = ['typecheck', 'build', 'doctor:consolidation', 'supabase:verify', 'rls:lab'];
const missingScripts = requiredScripts.filter((s) => !pkg.scripts?.[s]);

const requiredDocs = [
  'docs/V39_CONSOLIDATION_AUDIT.md',
  'docs/V40_RELEASE_CANDIDATE_PROTOCOL.md',
  'docs/V41_FRESH_SUPABASE_INSTALL_VERIFIER.md',
  'docs/V42_RLS_PERSONA_TEST_LAB.md'
];
const missingDocs = requiredDocs.filter((d) => !exists(d));

const distReady = exists('dist/index.html');
const envPresent = exists('.env') || exists('.env.local') || process.env.VITE_SUPABASE_URL;
const consolidatedBundle = exists('supabase/_consolidated/ALL_MIGRATIONS_ORDERED.sql');

const gates = [
  { code: 'LOCAL_BUILD', label: 'Local build artifacts exist', status: distReady ? 'pass' : 'warning', note: distReady ? 'dist/index.html found' : 'Run npm run build before release.' },
  { code: 'SCRIPTS', label: 'Required npm scripts registered', status: missingScripts.length ? 'blocked' : 'pass', note: missingScripts.join(', ') || 'All required scripts exist.' },
  { code: 'DOCS', label: 'Release candidate docs present', status: missingDocs.length ? 'blocked' : 'pass', note: missingDocs.join(', ') || 'All required docs exist.' },
  { code: 'ENV', label: 'Environment configured', status: envPresent ? 'pass' : 'warning', note: envPresent ? 'Environment file or variables detected.' : 'No .env/.env.local detected in this local folder.' },
  { code: 'MIGRATION_BUNDLE', label: 'Consolidated migration bundle exists', status: consolidatedBundle ? 'pass' : 'warning', note: consolidatedBundle ? 'Migration bundle found.' : 'Run the final release factory scripts to generate bundle.' }
];

const blocked = gates.filter((g) => g.status === 'blocked').length;
const warnings = gates.filter((g) => g.status === 'warning').length;
const score = Math.max(0, Math.round(100 - blocked * 30 - warnings * 10));
const report = { generated_at: new Date().toISOString(), score, gates };
fs.writeFileSync(path.join(releaseDir, 'v40-release-candidate-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(releaseDir, 'v40-release-candidate-audit.md'), `# v4.0 Release Candidate Audit\n\nScore: **${score}%**\n\n${gates.map((g) => `## ${g.code} — ${g.status.toUpperCase()}\n${g.label}\n\n${g.note}`).join('\n\n')}\n`);
console.log(`v4.0 release candidate audit score: ${score}%`);
if (blocked) process.exitCode = 1;
