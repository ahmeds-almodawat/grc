import fs from 'fs';
import path from 'path';

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return walk(p);
    return /\.(tsx|ts|css)$/.test(d.name) ? [p] : [];
  });
};
const ensureDir = (p) => fs.mkdirSync(path.resolve(p), { recursive: true });
const files = walk('src');
const suspicious = [];
const englishLiteral = />\s*[A-Z][A-Za-z][^<{]{4,}\s*</g;
for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  const matches = [...txt.matchAll(englishLiteral)].map(m => m[0].replace(/[<>]/g, '').trim()).filter(s => !s.includes('{'));
  if (matches.length) suspicious.push({ file, samples: matches.slice(0, 8), count: matches.length });
}
const dictText = fs.existsSync('src/i18n/I18nContext.tsx') ? fs.readFileSync('src/i18n/I18nContext.tsx','utf8') : '';
const checks = [
  { id: 'I18N_CONTEXT_EXISTS', label: 'I18n context exists', pass: fs.existsSync('src/i18n/I18nContext.tsx') },
  { id: 'AR_LABELS_PRESENT', label: 'Arabic labels present in i18n context', pass: /[\u0600-\u06FF]/.test(dictText) },
  { id: 'V46_DICTIONARY_EXISTS', label: 'v4.6 dictionary helper exists', pass: fs.existsSync('src/i18n/v46Dictionaries.ts') },
  { id: 'TRANSLATION_REGISTRY_SQL', label: 'Translation registry exists in SQL', pass: fs.existsSync('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql') && fs.readFileSync('supabase/migrations/034_v46_ovr_bilingual_rtl_production_hardening.sql','utf8').includes('i18n_translation_coverage_items') },
  { id: 'HARDCODED_ENGLISH_REVIEW', label: 'Hardcoded English literal review generated', pass: true }
];
const passed = checks.filter(c => c.pass).length;
const report = { generated_at: new Date().toISOString(), title: 'v4.5 i18n Deep Audit', passed, total: checks.length, score_percent: Math.round((passed/checks.length)*100), suspicious_hardcoded_english: suspicious.slice(0, 60), checks };
ensureDir('release');
fs.writeFileSync('release/v45-i18n-deep-audit.json', JSON.stringify(report, null, 2));
console.log(`v4.5 i18n audit: ${passed}/${checks.length} base checks passed. Hardcoded-English review items: ${suspicious.length}`);
if (!checks[0].pass || !checks[1].pass) process.exitCode = 1;
