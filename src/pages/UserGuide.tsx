import { BookOpenCheck, ClipboardCheck, FileCheck2, ShieldAlert, Stethoscope, UsersRound } from 'lucide-react';
import { ModuleHeader } from '../components/ModuleHeader';
import { useI18n } from '../i18n/I18nContext';

const guideSections = [
  {
    key: 'executive',
    icon: <ShieldAlert size={22} />,
    steps: ['guide.executive.1', 'guide.executive.2', 'guide.executive.3']
  },
  {
    key: 'manager',
    icon: <UsersRound size={22} />,
    steps: ['guide.manager.1', 'guide.manager.2', 'guide.manager.3']
  },
  {
    key: 'quality',
    icon: <Stethoscope size={22} />,
    steps: ['guide.quality.1', 'guide.quality.2', 'guide.quality.3']
  },
  {
    key: 'auditor',
    icon: <ClipboardCheck size={22} />,
    steps: ['guide.auditor.1', 'guide.auditor.2', 'guide.auditor.3']
  },
  {
    key: 'employee',
    icon: <FileCheck2 size={22} />,
    steps: ['guide.employee.1', 'guide.employee.2', 'guide.employee.3']
  }
];

export function UserGuide() {
  const { t } = useI18n();

  return (
    <section className="page-section guide-page">
      <ModuleHeader
        eyebrow={t('guide.eyebrow')}
        title={t('guide.title')}
        subtitle={t('guide.subtitle')}
      />

      <div className="guide-hero panel">
        <BookOpenCheck size={34} />
        <div>
          <h4>{t('guide.quickStartTitle')}</h4>
          <p>{t('guide.quickStartText')}</p>
        </div>
      </div>

      <div className="guide-grid">
        {guideSections.map(section => (
          <article className="guide-card" key={section.key}>
            <div className="guide-card-icon">{section.icon}</div>
            <h4>{t(`guide.${section.key}.title`)}</h4>
            <ol>
              {section.steps.map(step => <li key={step}>{t(step)}</li>)}
            </ol>
          </article>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h4>{t('guide.governanceRulesTitle')}</h4>
          <p>{t('guide.governanceRulesHint')}</p>
        </div>
        <div className="rule-grid-modern">
          {['evidence', 'delayReason', 'selfApproval', 'qualityClosure', 'auditClosure', 'backup'].map(rule => (
            <div className="rule-tile" key={rule}>
              <strong>{t(`guide.rule.${rule}.title`)}</strong>
              <p>{t(`guide.rule.${rule}.text`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
