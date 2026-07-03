import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import { 
  getTrainingPrograms,
  getTrainingAssignmentQueue,
  getOverdueTrainingAssignments,
  getSopAcknowledgmentGaps,
  getCompetencyGaps,
  getTrainingEvidenceIndex,
  getTrainingExecutiveSummary,
  getAccreditationTrainingReadiness
} from '../lib/trainingGovernanceApi';
import { GraduationCap, Award, BookOpen, Clock, FileCheck2, ShieldCheck, HelpCircle } from 'lucide-react';

export function TrainingGovernanceCenter() {
  const auth = useAuth();
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'summary' | 'programs' | 'assignments' | 'gaps' | 'evidence'>('summary');

  // Load Data
  const summary = useAsyncData(getTrainingExecutiveSummary, []);
  const programs = useAsyncData(getTrainingPrograms, []);
  const assignments = useAsyncData(getTrainingAssignmentQueue, []);
  const overdue = useAsyncData(getOverdueTrainingAssignments, []);
  const sopGaps = useAsyncData(getSopAcknowledgmentGaps, []);
  const competencyGaps = useAsyncData(getCompetencyGaps, []);
  const evidence = useAsyncData(getTrainingEvidenceIndex, []);
  const readiness = useAsyncData(getAccreditationTrainingReadiness, []);

  // Bilingual text dictionary
  const text = language === 'ar' ? ar : en;

  const sumData = summary.data || {
    active_programs_count: 0,
    pending_assignments_count: 0,
    completed_assignments_count: 0,
    overdue_assignments_count: 0,
    total_sop_gaps_count: 0,
    competency_fails_count: 0
  };

  return (
    <section className="page-section training-page">
      <div className="section-heading command-hero">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h3>{text.title}</h3>
          <p className="section-subtitle">{text.subtitle}</p>
        </div>
      </div>

      {/* KPI Tiles Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <GraduationCap size={20} />
          <div className="stat-value">{sumData.active_programs_count}</div>
          <div className="stat-label">{text.activePrograms}</div>
        </div>
        <div className="stat-card warning">
          <Clock size={20} />
          <div className="stat-value">{sumData.pending_assignments_count}</div>
          <div className="stat-label">{text.pendingAssignments}</div>
        </div>
        <div className="stat-card success">
          <FileCheck2 size={20} />
          <div className="stat-value">{sumData.completed_assignments_count}</div>
          <div className="stat-label">{text.completedAssignments}</div>
        </div>
        <div className="stat-card danger">
          <Clock size={20} />
          <div className="stat-value">{sumData.overdue_assignments_count}</div>
          <div className="stat-label">{text.overdueAssignments}</div>
        </div>
      </div>

      {/* Inner page horizontal navigation bar */}
      <div className="hub-tab-layout">
        <div className="hub-tab-rail panel">
          <button 
            className={`hub-tab-button ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            {text.tabSummary}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'programs' ? 'active' : ''}`}
            onClick={() => setActiveTab('programs')}
          >
            {text.tabPrograms}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            {text.tabAssignments}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'gaps' ? 'active' : ''}`}
            onClick={() => setActiveTab('gaps')}
          >
            {text.tabGaps}
          </button>
          <button 
            className={`hub-tab-button ${activeTab === 'evidence' ? 'active' : ''}`}
            onClick={() => setActiveTab('evidence')}
          >
            {text.tabEvidence}
          </button>
        </div>

        {/* Tab content panel */}
        <div className="hub-tab-content">
          {activeTab === 'summary' && (
            <div className="tab-pane">
              {/* Accreditation training readiness list */}
              <ModernCard title={text.readinessTitle} subtitle={text.readinessSubtitle}>
                <DataState loading={readiness.loading} error={readiness.error} empty={!readiness.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.programName}</th>
                          <th>{text.department}</th>
                          <th>{text.assigned}</th>
                          <th>{text.completed}</th>
                          <th>{text.overdue}</th>
                          <th>{text.completionRate}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(readiness.data || []).map((row: any) => (
                          <tr key={row.program_id}>
                            <td><strong>{language === 'ar' ? row.program_title_ar || row.program_title : row.program_title}</strong></td>
                            <td>{language === 'ar' ? row.department_name_ar || row.department_name_en : row.department_name_en}</td>
                            <td>{row.total_assigned}</td>
                            <td>{row.total_completed}</td>
                            <td>{row.total_overdue}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: 'var(--border-color)', width: '60px', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ background: 'var(--success-color)', width: `${row.completion_rate}%`, height: '100%' }}></div>
                                </div>
                                <span>{row.completion_rate}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'programs' && (
            <div className="tab-pane">
              <ModernCard title={text.programsTitle} subtitle={text.programsSubtitle}>
                <DataState loading={programs.loading} error={programs.error} empty={!programs.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.programName}</th>
                          <th>{text.trainingType}</th>
                          <th>{text.department}</th>
                          <th>{text.owner}</th>
                          <th>{text.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(programs.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td><strong>{language === 'ar' ? row.title_ar || row.title : row.title}</strong></td>
                            <td><StatusPill tone="neutral">{row.training_type}</StatusPill></td>
                            <td>{language === 'ar' ? row.department_name_ar || row.department_name_en : row.department_name_en || text.allDepartments}</td>
                            <td>{language === 'ar' ? row.owner_name_ar || row.owner_name_en : row.owner_name_en || text.unassigned}</td>
                            <td>
                              <StatusPill tone={row.active ? 'good' : 'neutral'}>
                                {row.active ? text.active : text.inactive}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="tab-pane">
              <ModernCard title={text.assignmentsTitle} subtitle={text.assignmentsSubtitle}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <StatusPill tone="danger">{text.overdueAssignmentsCount}: {overdue.data?.length || 0}</StatusPill>
                </div>
                <DataState loading={assignments.loading} error={assignments.error} empty={!assignments.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.programName}</th>
                          <th>{text.assignedUser}</th>
                          <th>{text.dueDate}</th>
                          <th>{text.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(assignments.data || []).map((row: any) => (
                          <tr key={row.id}>
                            <td>{language === 'ar' ? row.program_title_ar || row.program_title : row.program_title}</td>
                            <td>{language === 'ar' ? row.assigned_user_name_ar || row.assigned_user_name_en : row.assigned_user_name_en || text.unassigned}</td>
                            <td>{row.due_date || text.noDueDate}</td>
                            <td>
                              <StatusPill tone={
                                row.status === 'completed' ? 'good' : 
                                row.status === 'overdue' ? 'danger' : 
                                row.status === 'in_progress' ? 'warning' : 'neutral'
                              }>
                                {row.status}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'gaps' && (
            <div className="tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ModernCard title={text.sopGapsTitle} subtitle={text.sopGapsSubtitle}>
                <DataState loading={sopGaps.loading} error={sopGaps.error} empty={!sopGaps.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.sopName}</th>
                          <th>{text.assignedUser}</th>
                          <th>{text.department}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sopGaps.data || []).map((row: any, i: number) => (
                          <tr key={i}>
                            <td>{language === 'ar' ? row.sop_title_ar || row.sop_title : row.sop_title}</td>
                            <td>{language === 'ar' ? row.user_name_ar || row.user_name_en : row.user_name_en}</td>
                            <td>{language === 'ar' ? row.department_name_ar || row.department_name_en : row.department_name_en}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>

              <ModernCard title={text.competencyGapsTitle} subtitle={text.competencyGapsSubtitle}>
                <DataState loading={competencyGaps.loading} error={competencyGaps.error} empty={!competencyGaps.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.assignedUser}</th>
                          <th>{text.competencyArea}</th>
                          <th>{text.result}</th>
                          <th>{text.score}</th>
                          <th>{text.assessor}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(competencyGaps.data || []).map((row: any, i: number) => (
                          <tr key={i}>
                            <td>{language === 'ar' ? row.user_name_ar || row.user_name_en : row.user_name_en}</td>
                            <td>{row.competency_area || text.unassessed}</td>
                            <td><StatusPill tone={row.result === 'passed' ? 'good' : 'danger'}>{row.result || 'pending'}</StatusPill></td>
                            <td>{row.score !== null ? `${row.score}/100` : '-'}</td>
                            <td>{language === 'ar' ? row.assessor_name_ar || row.assessor_name_en : row.assessor_name_en || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="tab-pane">
              <ModernCard title={text.evidenceTitle} subtitle={text.evidenceSubtitle}>
                <DataState loading={evidence.loading} error={evidence.error} empty={!evidence.data?.length}>
                  <div className="table-wrap">
                    <table className="entity-table">
                      <thead>
                        <tr>
                          <th>{text.fileName}</th>
                          <th>{text.programName}</th>
                          <th>{text.assignedUser}</th>
                          <th>{text.uploadedAt}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(evidence.data || []).map((row: any) => (
                          <tr key={row.evidence_id}>
                            <td><code>{row.file_name}</code></td>
                            <td>{row.program_title}</td>
                            <td>{language === 'ar' ? row.user_name_ar || row.user_name_en : row.user_name_en}</td>
                            <td>{new Date(row.uploaded_at).toLocaleString(language)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DataState>
              </ModernCard>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Translations dictionaries
const en = {
  eyebrow: 'Training & Change Management',
  title: 'Training Governance Center',
  subtitle: 'Governance, standard operating procedure (SOP) acknowledgments, and competency assessments tracker.',
  activePrograms: 'Active Programs',
  pendingAssignments: 'Pending assignments',
  completedAssignments: 'Completed training',
  overdueAssignments: 'Overdue programs',
  tabSummary: 'Readiness & Summary',
  tabPrograms: 'Training Register',
  tabAssignments: 'Assignments Queue',
  tabGaps: 'Compliance Gaps',
  tabEvidence: 'Evidence Ledger',
  readinessTitle: 'Accreditation Readiness Metrics',
  readinessSubtitle: 'Rollout stats and completion percentage for CBAHI and quality orientation courses.',
  programName: 'Program Name',
  department: 'Department',
  assigned: 'Assigned',
  completed: 'Completed',
  overdue: 'Overdue',
  completionRate: 'Completion Rate',
  programsTitle: 'Training Programs Registry',
  programsSubtitle: 'Standard programs, SOPs, compliance obligation lessons, and training materials.',
  trainingType: 'Training Type',
  owner: 'Owner',
  status: 'Status',
  active: 'Active',
  inactive: 'Inactive',
  allDepartments: 'All Departments',
  unassigned: 'Unassigned',
  assignmentsTitle: 'All Training Assignments',
  assignmentsSubtitle: 'Assignments and tasks allocated to individuals or departments.',
  assignedUser: 'Assigned Operator',
  dueDate: 'Due Date',
  noDueDate: 'No due date',
  overdueAssignmentsCount: 'Overdue assignments',
  sopGapsTitle: 'SOP Acknowledgment Gaps',
  sopGapsSubtitle: 'Active users who have not acknowledged latest mandatory SOP/policies.',
  sopName: 'SOP Document',
  competencyGapsTitle: 'Competency Assessments Gaps',
  competencyGapsSubtitle: 'Assessments needing retraining, failures, or users missing assessments.',
  competencyArea: 'Competency Area',
  result: 'Assessment Result',
  score: 'Assessed Score',
  assessor: 'Assessor',
  unassessed: 'Not assessed yet',
  evidenceTitle: 'Training Completion Evidence Index',
  evidenceSubtitle: 'Attached files and PDFs serving as audit-ready compliance proof.',
  fileName: 'File Name',
  uploadedAt: 'Uploaded At'
};

const ar = {
  eyebrow: 'التدريب وإدارة التغيير',
  title: 'مركز حوكمة التدريب الكفاءات',
  subtitle: 'حوكمة التدريب، وإقرارات السياسات والإجراءات القياسية (SOP)، ومتابعة تقييم الكفاءات.',
  activePrograms: 'البرامج النشطة',
  pendingAssignments: 'المهام المعلقة',
  completedAssignments: 'التدريب المكتمل',
  overdueAssignments: 'البرامج المتأخرة',
  tabSummary: 'تقرير الجاهزية والملخص',
  tabPrograms: 'سجل البرامج',
  tabAssignments: 'قائمة المهام والتعيينات',
  tabGaps: 'فجوات الامتثال والالتزام',
  tabEvidence: 'دفتر أدلة الإثبات',
  readinessTitle: 'مؤشرات جاهزية الاعتماد الأكاديمي',
  readinessSubtitle: 'إحصائيات المتابعة ومعدل الاكتمال لدورات التوجيه والجودة الخاصة بـ سباهي (CBAHI).',
  programName: 'اسم البرنامج',
  department: 'القسم',
  assigned: 'تم التعيين',
  completed: 'مكتمل',
  overdue: 'متأخر',
  completionRate: 'معدل الاكتمال',
  programsTitle: 'سجل برامج التدريب والسياسات',
  programsSubtitle: 'البرامج القياسية، إجراءات العمل القياسية (SOP)، ودروس التزامات الامتثال والمواد التدريبية.',
  trainingType: 'نوع التدريب',
  owner: 'المالك',
  status: 'الحالة',
  active: 'نشط',
  inactive: 'غير نشط',
  allDepartments: 'جميع الأقسام',
  unassigned: 'غير معين',
  assignmentsTitle: 'مهام التدريب والتعيينات',
  assignmentsSubtitle: 'المهام والتعيينات الموزعة على الأفراد أو الأقسام.',
  assignedUser: 'الموظف المعين',
  dueDate: 'تاريخ الاستحقاق',
  noDueDate: 'لا يوجد تاريخ استحقاق',
  overdueAssignmentsCount: 'المهام المتأخرة',
  sopGapsTitle: 'فجوات إقرارات السياسات (SOP)',
  sopGapsSubtitle: 'الموظفون النشطون الذين لم يقروا بالسياسات الإلزامية القياسية الأخيرة.',
  sopName: 'وثيقة السياسة (SOP)',
  competencyGapsTitle: 'فجوات تقييم الكفاءات والمهارات',
  competencyGapsSubtitle: 'التقييمات التي تحتاج إعادة تدريب، حالات الرسوب، أو الموظفون غير المقيمين.',
  competencyArea: 'مجال الكفاءة',
  result: 'نتيجة التقييم',
  score: 'درجة التقييم',
  assessor: 'المُقيم',
  unassessed: 'لم يتم تقييمه بعد',
  evidenceTitle: 'سجل أدلة إثبات إتمام التدريب',
  evidenceSubtitle: 'الملفات المرفقة وتقارير PDF التي تعمل كأدلة إثبات جاهزة للتدقيق.',
  fileName: 'اسم الملف',
  uploadedAt: 'تاريخ الرفع'
};
