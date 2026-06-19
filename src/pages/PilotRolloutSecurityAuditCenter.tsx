const isArabic = () => {
  try {
    const value = localStorage.getItem('grc-language') || localStorage.getItem('language') || localStorage.getItem('lang');
    return value === 'ar';
  } catch {
    return false;
  }
};

const cards = [
  { key: 'pilot', en: 'Pilot execution', ar: 'تنفيذ المرحلة التجريبية', score: 85, noteEn: 'Controlled 60–80 user pilot before full rollout.', noteAr: 'مرحلة تجريبية مضبوطة قبل التعميم الكامل.' },
  { key: 'rollout', en: 'Company rollout', ar: 'تعميم الشركة', score: 82, noteEn: 'Wave-based onboarding instead of all users at once.', noteAr: 'تعميم على مراحل بدلاً من جميع المستخدمين مرة واحدة.' },
  { key: 'security', en: 'Security review', ar: 'مراجعة الصلاحيات والأمان', score: 78, noteEn: 'Sensitive roles, RLS, OVR confidentiality, and export access.', noteAr: 'الأدوار الحساسة، الصلاحيات، سرية OVR، وصلاحيات التصدير.' },
  { key: 'audit', en: 'Audit trail hardening', ar: 'تعزيز سجل التدقيق', score: 80, noteEn: 'Proves who changed, approved, closed, and accepted evidence.', noteAr: 'يثبت من عدّل واعتمد وأغلق وقبل الأدلة.' }
];

const actions = [
  { en: 'Run npm run v58:all after applying this pack.', ar: 'شغّل npm run v58:all بعد تطبيق الحزمة.' },
  { en: 'Seed Supabase defaults using seed_v58_pilot_rollout_security_audit_defaults().', ar: 'حمّل بيانات Supabase الافتراضية باستخدام الدالة المخصصة.' },
  { en: 'Resolve critical security findings before pilot go-live.', ar: 'حل ملاحظات الأمان الحرجة قبل تشغيل المرحلة التجريبية.' },
  { en: 'Do not proceed to all 1,000 users without a successful pilot wave.', ar: 'لا تنتقل إلى 1000 مستخدم قبل نجاح المرحلة التجريبية.' }
];

export default function PilotRolloutSecurityAuditCenter() {
  const ar = isArabic();
  const avg = Math.round(cards.reduce((sum, card) => sum + card.score, 0) / cards.length);

  return (
    <main className="space-y-6">
      <section className="hero-card">
        <div>
          <p className="eyebrow">v5.8</p>
          <h1>{ar ? 'مركز التجربة والتعميم والأمان والتدقيق' : 'Pilot, Rollout, Security & Audit Center'}</h1>
          <p className="muted-text">
            {ar
              ? 'هذه الصفحة تجمع آخر طبقة إنتاجية قبل التعميم: التجربة، التعميم، مراجعة الصلاحيات، وسجل التدقيق.'
              : 'This page groups the final pre-rollout layer: pilot execution, rollout control, security review, and audit trail hardening.'}
          </p>
        </div>
        <div className="score-orb">
          <strong>{avg}%</strong>
          <span>{ar ? 'جاهزية تقديرية' : 'Estimated readiness'}</span>
        </div>
      </section>

      <section className="grid auto-grid">
        {cards.map((card) => (
          <article key={card.key} className="metric-card">
            <div className="flex-between">
              <h3>{ar ? card.ar : card.en}</h3>
              <span className="badge">{card.score}%</span>
            </div>
            <div className="mini-progress"><span style={{ width: `${card.score}%` }} /></div>
            <p className="muted-text">{ar ? card.noteAr : card.noteEn}</p>
          </article>
        ))}
      </section>

      <section className="panel-card">
        <h2>{ar ? 'خطوات التنفيذ' : 'Execution steps'}</h2>
        <div className="stack-list">
          {actions.map((action, index) => (
            <div key={index} className="list-row">
              <span className="step-dot">{index + 1}</span>
              <span>{ar ? action.ar : action.en}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
