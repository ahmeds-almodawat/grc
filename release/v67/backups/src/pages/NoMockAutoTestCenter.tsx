const isArabic = () => {
  try {
    const value = localStorage.getItem('grc-language') || localStorage.getItem('language') || localStorage.getItem('lang');
    return value === 'ar';
  } catch {
    return false;
  }
};

const phases = [
  { n: 1, en: 'Local build', ar: 'البناء المحلي', cmd: 'npm run test:phase1', score: 95, noteEn: 'Typecheck, production build, and dist output.', noteAr: 'فحص TypeScript وبناء الإنتاج وملفات dist.' },
  { n: 2, en: 'No-mock audit', ar: 'تدقيق البيانات التجريبية', cmd: 'npm run test:phase2', score: 88, noteEn: 'Find mock/demo/fallback/sample data before pilot.', noteAr: 'اكتشاف البيانات التجريبية أو الاحتياطية قبل التجربة.' },
  { n: 3, en: 'Migration artifacts', ar: 'ملفات الترحيل', cmd: 'npm run test:phase3', score: 90, noteEn: 'Verify migration files and v5.9 schema artifact.', noteAr: 'التحقق من ملفات الترحيل وملف v5.9.' },
  { n: 4, en: 'Workflow artifacts', ar: 'مسارات العمل', cmd: 'npm run test:phase4', score: 87, noteEn: 'Check OVR, risk, audit, compliance, export, and pilot modules.', noteAr: 'فحص وحدات OVR والمخاطر والتدقيق والامتثال والتصدير والتجربة.' },
  { n: 5, en: 'Backup/restore proof', ar: 'إثبات النسخ والاستعادة', cmd: 'npm run test:phase5', score: 82, noteEn: 'Run local backup and restore dry-run proof scripts.', noteAr: 'تشغيل سكربتات إثبات النسخ والاستعادة محلياً.' },
  { n: 6, en: 'Pilot readiness', ar: 'جاهزية التجربة', cmd: 'npm run test:phase6', score: 84, noteEn: 'Verify pilot, rollout, and security review artifacts.', noteAr: 'التحقق من ملفات التجربة والتعميم ومراجعة الأمان.' }
];

const rules = [
  { en: 'No silent fallback data in production screens.', ar: 'لا توجد بيانات احتياطية صامتة في شاشات الإنتاج.' },
  { en: 'Demo/training data must be visibly labelled and environment-gated.', ar: 'بيانات التدريب يجب أن تكون واضحة ومقيدة بالبيئة.' },
  { en: 'Real pilot data must be reviewed before import.', ar: 'بيانات التجربة الحقيقية يجب مراجعتها قبل الاستيراد.' },
  { en: 'Strict no-mock mode must pass before production pilot.', ar: 'وضع منع البيانات التجريبية الصارم يجب أن ينجح قبل تجربة الإنتاج.' }
];

export default function NoMockAutoTestCenter() {
  const ar = isArabic();
  const avg = Math.round(phases.reduce((sum, p) => sum + p.score, 0) / phases.length);

  return (
    <main className="space-y-6">
      <section className="hero-card">
        <div>
          <p className="eyebrow">v5.9</p>
          <h1>{ar ? 'مركز منع البيانات التجريبية والاختبار المرحلي' : 'No-Mock & Phased Auto-Test Center'}</h1>
          <p className="muted-text">
            {ar
              ? 'هذه الطبقة تمنع الاعتماد على بيانات تجريبية صامتة وتحوّل الاختبار إلى مراحل واضحة قبل التجربة والإنتاج.'
              : 'This layer blocks silent mock/demo fallback behavior and turns validation into clear phases before pilot and production.'}
          </p>
        </div>
        <div className="score-orb">
          <strong>{avg}%</strong>
          <span>{ar ? 'جاهزية الاختبار' : 'Test readiness'}</span>
        </div>
      </section>

      <section className="grid auto-grid">
        {phases.map((phase) => (
          <article key={phase.n} className="metric-card">
            <div className="flex-between">
              <h3>{ar ? phase.ar : phase.en}</h3>
              <span className="badge">P{phase.n}</span>
            </div>
            <p className="muted-text">{ar ? phase.noteAr : phase.noteEn}</p>
            <code className="code-chip">{phase.cmd}</code>
            <div className="mini-progress"><span style={{ width: `${phase.score}%` }} /></div>
          </article>
        ))}
      </section>

      <section className="panel-card">
        <h2>{ar ? 'أوامر التشغيل' : 'Run commands'}</h2>
        <div className="stack-list">
          <div className="list-row"><span className="step-dot">1</span><code>node scripts/v59-install-test-scripts.mjs</code></div>
          <div className="list-row"><span className="step-dot">2</span><code>npm run v59:plan</code></div>
          <div className="list-row"><span className="step-dot">3</span><code>npm run test:phases</code></div>
          <div className="list-row"><span className="step-dot">4</span><code>npm run no-mock:fail</code></div>
        </div>
      </section>

      <section className="panel-card">
        <h2>{ar ? 'قواعد الإنتاج' : 'Production rules'}</h2>
        <div className="stack-list">
          {rules.map((rule, index) => (
            <div key={index} className="list-row">
              <span className="step-dot">{index + 1}</span>
              <span>{ar ? rule.ar : rule.en}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
