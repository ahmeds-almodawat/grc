import type { Page, Route } from '@playwright/test';
import { PATCH83V_ORGANIZATION_ID, PATCH83V_USER_ID } from './patch83vTestHarness';

const departmentIds = ['dept-quality', 'dept-clinical', 'dept-operations'];
const departments = [
  { id: departmentIds[0], code: 'QPS', name: 'Quality & Patient Safety', name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى', is_active: true },
  { id: departmentIds[1], code: 'CLN', name: 'Clinical Services', name_en: 'Clinical Services', name_ar: 'الخدمات السريرية', is_active: true },
  { id: departmentIds[2], code: 'OPS', name: 'Hospital Operations', name_en: 'Hospital Operations', name_ar: 'عمليات المستشفى', is_active: true },
];
const profiles = [
  { id: PATCH83V_USER_ID, full_name: 'UI Review Admin', full_name_en: 'UI Review Admin', full_name_ar: 'مسؤول مراجعة الواجهة', email: 'ui-review@example.test', job_title: 'Governance Administrator', department_id: departmentIds[0], active_flag: true, is_active: true },
  { id: 'profile-clinical', full_name: 'Dr. Lina Haddad', full_name_en: 'Dr. Lina Haddad', full_name_ar: 'د. لينا حداد', email: 'lina@example.test', job_title: 'Clinical Governance Lead', department_id: departmentIds[1], active_flag: true, is_active: true },
  { id: 'profile-ops', full_name: 'Omar Al-Salem', full_name_en: 'Omar Al-Salem', full_name_ar: 'عمر السالم', email: 'omar@example.test', job_title: 'Operations Manager', department_id: departmentIds[2], active_flag: true, is_active: true },
];
const policyStatuses = ['active', 'draft', 'under_review', 'pending_approval', 'approved', 'active', 'under_revision', 'approved', 'draft', 'active', 'under_review', 'active'] as const;
const sopStatuses = ['active', 'draft', 'under_review', 'pending_approval', 'approved', 'active', 'under_revision', 'approved', 'draft', 'active', 'under_review', 'active'] as const;

export const ui2Policies = policyStatuses.map((status, index) => {
  const number = index + 1;
  const department = departments[index % departments.length];
  const owner = profiles[index % profiles.length];
  return {
    document_id: `policy-${number}`,
    organization_id: PATCH83V_ORGANIZATION_ID,
    document_code: `POL-${String(number).padStart(3, '0')}`,
    document_title: number === 1 ? 'Enterprise Clinical Governance, Patient Safety, and Accountable Decision-Making Policy' : `Governed Institutional Policy ${number}`,
    document_description: 'Controlled institutional policy record used for deterministic UI-2 visual verification.',
    document_status: status,
    workflow_stage: status === 'draft' ? 'preparation' : status === 'under_review' ? 'technical_review' : status === 'pending_approval' ? 'final_approval' : 'effective',
    department_id: department.id,
    department_name: department.name,
    document_owner_id: owner.id,
    document_owner_name: owner.full_name,
    effective_date: status === 'draft' ? null : `2026-${String((index % 6) + 1).padStart(2, '0')}-01`,
    next_review_date: index === 2 ? '2026-08-29' : index === 3 ? '2026-08-10' : `2027-${String((index % 6) + 1).padStart(2, '0')}-01`,
    expiry_date: null,
    criticality_level: index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : 'medium',
    confidentiality_level: 'internal',
    version_id: `policy-version-${number}`,
    version_number: status === 'draft' ? 1 : 2,
    version_label: status === 'draft' ? '1.0' : '2.0',
    is_current_version: true,
    approved_at: status === 'active' || status === 'approved' ? '2026-01-15T08:30:00.000Z' : null,
    locked_at: status === 'active' || status === 'approved' ? '2026-01-15T08:30:00.000Z' : null,
    version_title_en: number === 1 ? 'Enterprise Clinical Governance, Patient Safety, and Accountable Decision-Making Policy' : `Governed Institutional Policy ${number}`,
    version_title_ar: number === 1 ? 'سياسة الحوكمة السريرية وسلامة المرضى واتخاذ القرار المسؤول' : `السياسة المؤسسية المحكومة ${number}`,
    title_en: number === 1 ? 'Enterprise Clinical Governance, Patient Safety, and Accountable Decision-Making Policy' : `Governed Institutional Policy ${number}`,
    title_ar: number === 1 ? 'سياسة الحوكمة السريرية وسلامة المرضى واتخاذ القرار المسؤول' : `السياسة المؤسسية المحكومة ${number}`,
    purpose_en: 'Establish consistent decision rights, accountability, monitoring, and evidence expectations across clinical governance processes.',
    purpose_ar: 'تحديد حقوق اتخاذ القرار والمساءلة والمتابعة ومتطلبات الأدلة ضمن عمليات الحوكمة السريرية.',
    policy_statement_en: 'The hospital shall maintain a governed, risk-based clinical decision framework with documented ownership, escalation, assurance, and periodic review.',
    policy_statement_ar: 'يلتزم المستشفى بإطار سريري محكوم قائم على المخاطر مع توثيق الملكية والتصعيد والضمان والمراجعة الدورية.',
    scope_en: 'All departments, contracted clinical services, committees, and personnel participating in patient care or safety governance.',
    scope_ar: 'جميع الإدارات والخدمات السريرية المتعاقدة واللجان والعاملين المشاركين في رعاية المرضى أو حوكمة السلامة.',
    principles_en: 'Patient safety, accountability, proportionality, transparency, evidence integrity, and continuous improvement.',
    principles_ar: 'سلامة المرضى والمساءلة والتناسب والشفافية وسلامة الأدلة والتحسين المستمر.',
    exceptions_summary_en: 'Exceptions require documented risk assessment and governance approval.',
    exceptions_summary_ar: 'تتطلب الاستثناءات تقييماً موثقاً للمخاطر وموافقة الحوكمة.',
    non_compliance_escalation_en: 'Material non-compliance is escalated to the Clinical Governance Committee and executive sponsor.',
    non_compliance_escalation_ar: 'يتم تصعيد عدم الامتثال الجوهري إلى لجنة الحوكمة السريرية والراعي التنفيذي.',
    content_mode: 'structured',
    transcription_status: 'not_required',
    requirement_count: 5 + (index % 3),
    created_at: '2025-10-01T08:00:00.000Z',
    updated_at: '2026-08-15T11:30:00.000Z',
  };
});

export const ui2Sops = sopStatuses.map((status, index) => {
  const number = index + 1;
  const department = departments[(index + 1) % departments.length];
  const owner = profiles[(index + 1) % profiles.length];
  return {
    document_id: `sop-${number}`,
    organization_id: PATCH83V_ORGANIZATION_ID,
    document_code: `SOP-${String(number).padStart(3, '0')}`,
    document_title: number === 1 ? 'Safe Medication Administration, Independent Double-Check, and Escalation Procedure' : `Governed Standard Operating Procedure ${number}`,
    document_description: 'Controlled operational procedure used for deterministic UI-2 visual verification.',
    document_status: status,
    workflow_stage: status === 'draft' ? 'preparation' : status === 'under_review' ? 'technical_review' : status === 'pending_approval' ? 'final_approval' : 'effective',
    department_id: department.id,
    department_name: department.name,
    document_owner_id: owner.id,
    document_owner_name: owner.full_name,
    effective_date: status === 'draft' ? null : '2026-02-01',
    next_review_date: index === 2 ? '2026-08-30' : index === 3 ? '2026-08-12' : '2027-02-01',
    expiry_date: null,
    criticality_level: index % 4 === 0 ? 'critical' : 'high',
    confidentiality_level: 'internal',
    version_id: `sop-version-${number}`,
    version_number: status === 'draft' ? 1 : 3,
    version_label: status === 'draft' ? '1.0' : '3.0',
    is_current_version: true,
    approved_at: status === 'active' || status === 'approved' ? '2026-01-25T09:00:00.000Z' : null,
    locked_at: status === 'active' || status === 'approved' ? '2026-01-25T09:00:00.000Z' : null,
    version_title_en: number === 1 ? 'Safe Medication Administration, Independent Double-Check, and Escalation Procedure' : `Governed Standard Operating Procedure ${number}`,
    version_title_ar: number === 1 ? 'إجراء إعطاء الدواء الآمن والتحقق المزدوج المستقل والتصعيد' : `إجراء التشغيل القياسي المحكوم ${number}`,
    title_en: number === 1 ? 'Safe Medication Administration, Independent Double-Check, and Escalation Procedure' : `Governed Standard Operating Procedure ${number}`,
    title_ar: number === 1 ? 'إجراء إعطاء الدواء الآمن والتحقق المزدوج المستقل والتصعيد' : `إجراء التشغيل القياسي المحكوم ${number}`,
    process_name_en: number === 1 ? 'Medication Administration and Verification' : `Controlled Clinical Process ${number}`,
    process_name_ar: number === 1 ? 'إعطاء الدواء والتحقق منه' : `العملية السريرية المحكومة ${number}`,
    process_owner_id: owner.id,
    process_owner_name: owner.full_name,
    purpose_en: 'Define the exact sequence, accountability, control checks, evidence records, and escalation required for safe medication administration.',
    purpose_ar: 'تحديد التسلسل الدقيق والمساءلة وفحوصات الضوابط وسجلات الأدلة والتصعيد المطلوب لإعطاء الدواء بأمان.',
    scope_en: 'Inpatient units, emergency services, critical care, pharmacy, and all licensed clinicians administering medication.',
    scope_ar: 'أقسام التنويم والطوارئ والعناية الحرجة والصيدلية وجميع الممارسين المرخصين الذين يعطون الأدوية.',
    primary_policy_version_id: 'policy-version-1',
    primary_policy_document_code: 'POL-001',
    primary_policy_document_title: ui2Policies[0].document_title,
    primary_policy_version_number: 2,
    governance_link_state: 'linked',
    training_required: index % 3 !== 2,
    acknowledgment_required: true,
    competency_assessment_required: index % 2 === 0,
    acknowledgment_sla_days: 14,
    training_renewal_months: 12,
    content_mode: 'structured',
    transcription_status: 'not_required',
    step_count: 6 + (index % 4),
    created_at: '2025-11-01T08:00:00.000Z',
    updated_at: '2026-08-16T10:45:00.000Z',
  };
});

const controls = [
  { id: 'control-1', code: 'CTRL-MED-01', title: 'Patient and medication verification', control_type: 'preventive', key_control: true },
  { id: 'control-2', code: 'CTRL-MED-02', title: 'Independent high-alert medication double-check', control_type: 'preventive', key_control: true },
  { id: 'control-3', code: 'CTRL-MED-03', title: 'Administration record reconciliation', control_type: 'detective', key_control: false },
];

const procedureSteps = [
  ['Confirm the active medication order, indication, allergies, contraindications, and current laboratory results before preparation.', 'تحقق من أمر الدواء الفعال ودواعي الاستخدام والحساسية وموانع الاستعمال ونتائج المختبر الحالية قبل التحضير.', 'Registered Nurse', 'Electronic medication order verification record', 'سجل التحقق الإلكتروني من أمر الدواء', 'Before preparation', 'critical', controls[0]],
  ['Prepare the medication in the designated clean zone and label every prepared dose that is not administered immediately.', 'حضّر الدواء في المنطقة النظيفة المخصصة وضع بطاقة على كل جرعة لا يتم إعطاؤها فوراً.', 'Registered Nurse', 'Medication preparation checklist', 'قائمة التحقق من تحضير الدواء', 'Immediately before administration', 'high', controls[0]],
  ['For high-alert medication, obtain and document an independent double-check by a second authorized clinician.', 'بالنسبة للأدوية عالية الخطورة احصل على تحقق مزدوج مستقل ووثقه من ممارس معتمد ثانٍ.', 'Registered Nurse and Verifying Clinician', 'Independent double-check form', 'نموذج التحقق المزدوج المستقل', 'Before administration', 'critical', controls[1]],
  ['Use two patient identifiers and explain the medication purpose, expected effect, and material precautions to the patient.', 'استخدم معرفين للمريض واشرح غرض الدواء وتأثيره المتوقع والاحتياطات الجوهرية للمريض.', 'Administering Clinician', 'Patient identification and education acknowledgment', 'إقرار التحقق من هوية المريض والتثقيف', 'At bedside', 'critical', controls[0]],
  ['Administer using the prescribed route, rate, and timing while monitoring for an immediate adverse response.', 'أعط الدواء وفق الطريق والمعدل والتوقيت الموصوف مع مراقبة أي استجابة ضارة فورية.', 'Administering Clinician', 'Medication administration record', 'سجل إعطاء الدواء', 'Within prescribed window', 'critical', controls[2]],
  ['Document the administration, outcome, omitted dose reason, and any escalation; notify the prescriber and pharmacy when variance criteria are met.', 'وثق الإعطاء والنتيجة وسبب الجرعة المتروكة وأي تصعيد وأبلغ الطبيب والصيدلية عند تحقق معايير الانحراف.', 'Administering Clinician', 'Medication variance and escalation record', 'سجل انحراف الدواء والتصعيد', 'Within 15 minutes', 'high', controls[2]],
].map((step, index) => ({
  id: `sop-step-${index + 1}`,
  sequence_number: index + 1,
  responsible_role: step[2],
  action_instruction_en: step[0],
  action_instruction_ar: step[1],
  required_control_id: (step[7] as typeof controls[number]).id,
  expected_evidence_record_en: step[3],
  expected_evidence_record_ar: step[4],
  timing_sla_en: step[5],
  timing_sla_ar: null,
  is_decision_point: index === 2 || index === 5,
  decision_criteria_en: index === 2 ? 'High-alert medication classification confirmed' : index === 5 ? 'Variance or adverse response criteria met' : null,
  decision_criteria_ar: null,
  criticality: step[6],
  escalation_trigger_en: index === 5 ? 'Medication variance, omitted critical dose, or suspected adverse drug event' : null,
  escalation_trigger_ar: null,
  escalation_destination_role: index === 5 ? 'Clinical Shift Lead' : null,
  control_library_items: step[7],
}));

const decisions = [
  { id: 'decision-1', organization_id: PATCH83V_ORGANIZATION_ID, decision_code: 'GOV-2026-041', title: 'Approve annual policy review priorities and accountable executive owners', decision_text: 'Approved', due_date: '2026-09-05', priority: 'high', risk_level: 'high', status: 'open', departments: { name_en: 'Quality & Patient Safety', name_ar: null }, owner: { full_name_en: 'UI Review Admin', full_name_ar: null } },
  { id: 'decision-2', organization_id: PATCH83V_ORGANIZATION_ID, decision_code: 'GOV-2026-038', title: 'Close medication safety procedure control-gap remediation', decision_text: 'Completed', due_date: '2026-08-18', priority: 'critical', risk_level: 'critical', status: 'completed', departments: { name_en: 'Clinical Services', name_ar: null }, owner: { full_name_en: 'Dr. Lina Haddad', full_name_ar: null } },
  { id: 'decision-3', organization_id: PATCH83V_ORGANIZATION_ID, decision_code: 'GOV-2026-035', title: 'Validate evidence retention ownership for governed clinical records', decision_text: 'In progress', due_date: '2026-09-12', priority: 'medium', risk_level: 'medium', status: 'in_progress', departments: { name_en: 'Hospital Operations', name_ar: null }, owner: { full_name_en: 'Omar Al-Salem', full_name_ar: null } },
];

function selectedValue(url: URL, key: string) {
  const value = url.searchParams.get(key);
  return value?.startsWith('eq.') ? value.slice(3) : value || '';
}

function documentIdFromVersion(versionId: string) {
  const match = /^(policy|sop)-version-(\d+)$/.exec(versionId);
  return match ? `${match[1]}-${match[2]}` : 'policy-1';
}

function recordForDocument(documentId: string) {
  return documentId.startsWith('sop-')
    ? ui2Sops.find((row) => row.document_id === documentId) || ui2Sops[0]
    : ui2Policies.find((row) => row.document_id === documentId) || ui2Policies[0];
}

function versionForDocument(documentId: string) {
  const row = recordForDocument(documentId);
  return {
    id: row.version_id,
    document_id: row.document_id,
    version_number: row.version_number,
    version_label: row.version_label,
    is_current_version: true,
    effective_date: row.effective_date,
    expiry_date: null,
    approved_by: row.approved_at ? PATCH83V_USER_ID : null,
    approved_at: row.approved_at,
    locked_by: row.locked_at ? PATCH83V_USER_ID : null,
    locked_at: row.locked_at,
    prepared_by: PATCH83V_USER_ID,
    revision_reason: row.document_status === 'draft' ? 'Controlled annual review draft' : 'Approved governance baseline',
    supersedes_version_id: row.version_number > 1 ? `${row.document_id}-previous-version` : null,
  };
}

function controlledDocument(documentId: string) {
  const row = recordForDocument(documentId);
  return {
    id: row.document_id,
    organization_id: row.organization_id,
    document_code: row.document_code,
    document_title: row.document_title,
    document_description: row.document_description,
    document_status: row.document_status,
    workflow_stage: row.workflow_stage,
    department_id: row.department_id,
    document_owner_id: row.document_owner_id,
    effective_date: row.effective_date,
    next_review_date: row.next_review_date,
    expiry_date: row.expiry_date,
    criticality_level: row.criticality_level,
    confidentiality_level: row.confidentiality_level,
    active_flag: true,
    current_version_id: row.version_id,
    departments: { id: row.department_id, name: row.department_name, code: departments.find((department) => department.id === row.department_id)?.code },
    profiles: { id: row.document_owner_id, full_name: row.document_owner_name },
  };
}

const policyRequirements = Array.from({ length: 6 }, (_, index) => ({
  id: `policy-requirement-${index + 1}`,
  sequence_number: index + 1,
  requirement_statement_en: [
    'Department leaders shall maintain documented accountability for policy implementation and annual control assurance.',
    'Material clinical risks shall be assessed before governance decisions are approved or delegated.',
    'Every implementing SOP shall remain linked to the effective governing policy version.',
    'Evidence supporting control operation shall be attributable, reviewable, retained, and protected from unauthorized change.',
    'Exceptions shall include a time-bound scope, risk assessment, compensating controls, and approval authority.',
    'The policy owner shall review performance, incidents, findings, and regulatory change at least annually.',
  ][index],
  requirement_statement_ar: `متطلب حوكمة مؤسسي محكوم رقم ${index + 1}`,
  responsible_role: ['Department Director', 'Clinical Governance Lead', 'Process Owner'][index % 3],
  is_mandatory: index !== 4,
  expected_evidence_en: ['Annual assurance record', 'Approved risk assessment', 'Policy-to-SOP linkage matrix', 'Evidence retention index', 'Approved exception record', 'Annual policy review minutes'][index],
  expected_evidence_ar: null,
  mapped_control_id: controls[index % controls.length].id,
  mapped_control_code: controls[index % controls.length].code,
  linked_accreditation_clause_id: 'clause-1',
  monitoring_frequency: index === 5 ? 'annual' : 'quarterly',
  monitoring_owner_id: profiles[index % profiles.length].id,
  accreditation_clauses: { id: 'clause-1', clause_code: 'LD.4.1', clause_title: 'Leadership governance and accountability', clause_title_ar: 'حوكمة القيادة والمساءلة', criticality: 'high', accreditation_standards: { standard_code: 'CBAHI-2026', framework: 'CBAHI' } },
}));

function analyticsFixture() {
  const band = (label: string) => ({ state: 'banded', label, suppressed: false, lower_bound: 6, upper_bound: 10 });
  const privacy = { model: 'deterministic-bands-daily-v1', minimum_cell_size: 5, exact_values_returned: false, arbitrary_filters_allowed: false, dimension_drilldown_allowed: false, daily_snapshot_immutable: true, suppression_applied: false };
  const trendMonths = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  return {
    snapshot: { snapshot_id: 'ui2-snapshot', snapshot_date: '2026-08-21', generated_at: '2026-08-21T23:00:00.000Z', definition_version: 'ui2-test-v1', privacy_model: 'deterministic-bands-daily-v1' },
    headline: { definition_version: 'ui2-test-v1', query_shape: 'headline_current_period', generated_at: '2026-08-21T23:00:00.000Z', snapshot_date: '2026-08-21', timezone: 'Asia/Riyadh', scope: 'organization', allowed_filters: {}, metrics: { open_ovr: band('11–15'), new_this_month: band('6–10'), overdue_ovr: { count: band('1–5'), unknown_due: band('0') }, major_sentinel: band('1–5'), average_closure_time: { ...band('16–20 days'), denominator: band('11–15') }, closure_within_sla: { ...band('76–80%'), denominator: band('11–15') }, potential_repeat: band('1–5'), corrective_action_required: band('6–10') }, privacy },
    trend: { definition_version: 'ui2-test-v1', query_shape: 'monthly_trend_12', generated_at: '2026-08-21T23:00:00.000Z', snapshot_date: '2026-08-21', timezone: 'Asia/Riyadh', scope: 'organization', allowed_filters: {}, buckets: trendMonths.map((bucket_key, index) => ({ bucket_key, new_reports: band(String(6 + (index % 3) * 5)), closed_reports: band(String(5 + (index % 4) * 4)) })), privacy },
  };
}

async function fulfill(route: Route, response: unknown) {
  const request = route.request();
  const length = Array.isArray(response) ? response.length : response ? 1 : 0;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', 'content-range': length ? `0-${length - 1}/${length}` : '*/0' },
    body: request.method() === 'HEAD' ? '' : JSON.stringify(response),
  });
}

export async function installUi2FixtureData(page: Page) {
  await page.route('**/functions/v1/**', async (route) => {
    const raw = route.request().postData();
    const body = raw ? JSON.parse(raw) as { action?: string } : {};
    if (body.action !== 'ovr_executive_dashboard_analytics') return route.fallback();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, action: body.action, result: analyticsFixture() }) });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) return route.fallback();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() || '';
    const select = url.searchParams.get('select') || '';
    if (table === 'profiles' && select.includes('organizations(name_en)')) return route.fallback();
    if (table === 'v_governed_policy_catalog') return fulfill(route, ui2Policies);
    if (table === 'v_governed_sop_catalog') return fulfill(route, ui2Sops);
    if (table === 'departments') return fulfill(route, departments);
    if (table === 'profiles') return fulfill(route, profiles);
    if (table === 'controls') return fulfill(route, controls);
    if (table === 'accreditation_clauses') return fulfill(route, [{ id: 'clause-1', clause_number: 'LD.4.1', clause_code: 'LD.4.1', title: 'Leadership governance and accountability', clause_title: 'Leadership governance and accountability' }]);
    if (table === 'controlled_documents') return fulfill(route, controlledDocument(selectedValue(url, 'id') || 'policy-1'));
    if (table === 'document_versions') {
      const versionId = selectedValue(url, 'id');
      const documentId = selectedValue(url, 'document_id') || documentIdFromVersion(versionId);
      if (select.includes('controlled_documents')) return fulfill(route, { version_label: '2.0', controlled_documents: { document_code: 'POL-001', document_title: ui2Policies[0].document_title } });
      if (versionId) return fulfill(route, [versionForDocument(documentId)]);
      const current = versionForDocument(documentId);
      return fulfill(route, [current, { ...current, id: `${documentId}-previous-version`, version_number: Math.max(1, current.version_number - 1), version_label: `${Math.max(1, current.version_number - 1)}.0`, is_current_version: false, effective_date: '2025-02-01', approved_at: '2025-01-20T08:00:00.000Z', locked_at: '2025-01-20T08:00:00.000Z', revision_reason: 'Superseded controlled baseline' }]);
    }
    if (table === 'governed_policy_details') return fulfill(route, { ...ui2Policies[0], version_id: selectedValue(url, 'version_id') || 'policy-version-1' });
    if (table === 'policy_requirements') return fulfill(route, policyRequirements);
    if (table === 'governed_sop_details') return fulfill(route, { ...ui2Sops[0], version_id: selectedValue(url, 'version_id') || 'sop-version-1', primary_policy_version_id: 'policy-version-1', primary_policy_version_label: '2.0', profiles: { id: 'profile-clinical', full_name: 'Dr. Lina Haddad' } });
    if (table === 'sop_procedure_steps') return fulfill(route, procedureSteps);
    if (table === 'sop_definitions') return fulfill(route, [{ id: 'definition-1', sequence_number: 1, term_en: 'High-alert medication', term_ar: 'دواء عالي الخطورة', abbreviation: 'HAM', definition_en: 'A medication carrying a heightened risk of significant patient harm when used in error.', definition_ar: 'دواء ينطوي على خطر مرتفع لإحداث ضرر جسيم للمريض عند استخدامه بشكل خاطئ.' }, { id: 'definition-2', sequence_number: 2, term_en: 'Independent double-check', term_ar: 'التحقق المزدوج المستقل', abbreviation: 'IDC', definition_en: 'A second authorized clinician verifies critical elements without influence from the first check.', definition_ar: 'يتحقق ممارس معتمد ثانٍ من العناصر الحرجة بشكل مستقل.' }]);
    if (table === 'sop_role_responsibilities') return fulfill(route, [{ id: 'responsibility-1', sequence_number: 1, role_name: 'Administering Clinician', job_title: null, responsibility_en: 'Verify, prepare, administer, monitor, document, and escalate according to every applicable step.', responsibility_ar: 'التحقق والتحضير والإعطاء والمراقبة والتوثيق والتصعيد وفق كل خطوة مطبقة.', accountable_for_en: 'Safe and complete medication administration', accountable_for_ar: null }, { id: 'responsibility-2', sequence_number: 2, role_name: 'Clinical Shift Lead', job_title: null, responsibility_en: 'Provide immediate escalation support and ensure variance response is initiated.', responsibility_ar: 'تقديم دعم فوري للتصعيد وضمان بدء الاستجابة للانحراف.', accountable_for_en: 'Timely escalation and containment', accountable_for_ar: null }]);
    if (table === 'sop_monitoring_kpis') return fulfill(route, [{ id: 'kpi-1', sequence_number: 1, kpi_name_en: 'Medication administration compliance', kpi_name_ar: 'الامتثال لإعطاء الدواء', target_value: '>= 98%', measurement_frequency: 'monthly', owner_id: 'profile-clinical', description_en: 'Observed compliance with all critical administration steps.', description_ar: null, profiles: { full_name: 'Dr. Lina Haddad' } }]);
    if (table === 'document_version_department_scope') return fulfill(route, departmentIds.map((department_id) => ({ department_id })));
    if (table === 'document_version_role_scope') return fulfill(route, [{ id: 'role-scope-1', role_name: 'Registered Nurse', job_title: 'Clinical Nurse' }, { id: 'role-scope-2', role_name: 'Pharmacist', job_title: 'Clinical Pharmacist' }]);
    if (table === 'document_review_events') return fulfill(route, [{ id: 'event-1', document_id: 'policy-1', version_id: 'policy-version-1', event_type: 'approved', from_status: 'pending_approval', to_status: 'approved', actor_id: PATCH83V_USER_ID, event_note: 'Approved by delegated governance authority.', created_at: '2026-01-15T08:30:00.000Z', profiles: { full_name: 'UI Review Admin' } }]);
    if (table === 'policy_sop_exceptions') return fulfill(route, []);
    if (table === 'governed_document_review_triggers') return fulfill(route, [{ id: 'trigger-1', document_id: 'policy-1', version_id: 'policy-version-1', trigger_type: 'scheduled', source_entity_type: null, source_entity_id: null, triggered_by: PATCH83V_USER_ID, triggered_at: '2026-08-01T08:00:00.000Z', review_owner_id: PATCH83V_USER_ID, due_date: '2027-01-01', status: 'open', outcome: null }]);
    if (table === 'sop_version_risk_links') return fulfill(route, [{ id: 'risk-link-1', sequence_number: 1, risk_id: 'risk-1', relationship_type: 'mitigates', context_note_en: 'Reduces preventable medication administration error exposure.', context_note_ar: null, risks: { id: 'risk-1', risk_code: 'RISK-CLN-014', title: 'Medication administration error', status: 'treating', risk_level: 'critical' } }, { id: 'risk-link-2', sequence_number: 2, risk_id: 'risk-2', relationship_type: 'risk_if_not_followed', context_note_en: 'Failure to perform an independent check may cause serious patient harm.', context_note_ar: null, risks: { id: 'risk-2', risk_code: 'RISK-CLN-021', title: 'High-alert medication control failure', status: 'open', risk_level: 'high' } }]);
    if (table === 'sop_version_accreditation_links') return fulfill(route, [{ id: 'accreditation-link-1', sequence_number: 1, clause_id: 'clause-1', link_strength: 'primary', context_note_en: 'Direct medication management procedure requirement.', context_note_ar: null, accreditation_clauses: { id: 'clause-1', clause_code: 'MM.5.2', clause_title: 'Safe medication administration', clause_title_ar: 'الإعطاء الآمن للدواء', criticality: 'high', accreditation_standards: { standard_code: 'CBAHI-2026', framework: 'CBAHI' } } }]);
    if (table === 'risks') return fulfill(route, Array.from({ length: 10 }, (_, index) => ({ id: `risk-${index + 1}`, organization_id: PATCH83V_ORGANIZATION_ID, department_id: departmentIds[index % 3], risk_code: `RISK-${String(index + 1).padStart(3, '0')}`, title: ['Medication administration error', 'Policy review delay', 'Evidence retention gap'][index % 3], description: 'Deterministic enterprise risk fixture.', category: 'Clinical', owner_id: profiles[index % 3].id, likelihood: (index % 5) + 1, impact: ((index * 2) % 5) + 1, inherent_score: 20, residual_score: 12, risk_level: index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : 'medium', status: 'open', lifecycle_status: 'treatment_in_progress', departments: { name_en: departments[index % 3].name_en, name_ar: departments[index % 3].name_ar }, owner: { full_name_en: profiles[index % 3].full_name_en, full_name_ar: profiles[index % 3].full_name_ar } })));
    if (table === 'committee_decisions') return fulfill(route, decisions);

    if (table === 'projects') return fulfill(route, Array.from({ length: 4 }, (_, index) => ({ id: `project-${index + 1}`, organization_id: PATCH83V_ORGANIZATION_ID, department_id: departmentIds[index % 3], title: ['Medication Safety Improvement Program', 'Accreditation Readiness Portfolio', 'Enterprise Policy Review Cycle', 'Clinical Evidence Digitization'][index], description: 'Strategic governed project.', category: 'governance', source_type: 'management_decision', owner_id: profiles[index % 3].id, sponsor_id: PATCH83V_USER_ID, start_date: `2026-0${index + 1}-01`, target_end_date: `2026-${String(index + 9).padStart(2, '0')}-30`, priority: index === 0 ? 'critical' : 'high', risk_level: index === 0 ? 'critical' : 'medium', status: index === 2 ? 'delayed' : 'in_progress', progress_percent: [72, 58, 39, 84][index], evidence_required: true, closure_approval_required: true, delay_reason: index === 2 ? 'Two owner reviews remain outstanding.' : null, departments: { name_en: departments[index % 3].name_en, name_ar: departments[index % 3].name_ar }, owner: { full_name_en: profiles[index % 3].full_name_en, full_name_ar: profiles[index % 3].full_name_ar } })));
    if (table === 'milestones') return fulfill(route, Array.from({ length: 8 }, (_, index) => ({ id: `milestone-${index + 1}`, organization_id: PATCH83V_ORGANIZATION_ID, project_id: `project-${(index % 4) + 1}`, title: ['Baseline assessment', 'Control design approval', 'Evidence validation', 'Executive closure'][index % 4], description: null, owner_id: profiles[index % 3].id, start_date: `2026-${String((index % 6) + 2).padStart(2, '0')}-01`, due_date: `2026-${String((index % 6) + 6).padStart(2, '0')}-20`, status: index % 4 === 0 ? 'completed' : index % 3 === 0 ? 'delayed' : 'in_progress', progress_percent: [100, 75, 55, 35][index % 4], evidence_required: true, delay_reason: index % 3 === 0 ? 'Awaiting governed review evidence.' : null, owner: { full_name_en: profiles[index % 3].full_name_en, full_name_ar: profiles[index % 3].full_name_ar } })));
    if (table === 'compliance_items') return fulfill(route, Array.from({ length: 9 }, (_, index) => ({ id: `compliance-${index + 1}`, organization_id: PATCH83V_ORGANIZATION_ID, department_id: departmentIds[index % 3], compliance_code: `OBL-${index + 1}`, title: `Governed compliance obligation ${index + 1}`, regulatory_body: ['CBAHI', 'MOH', 'ISO 7101'][index % 3], owner_id: profiles[index % 3].id, due_date: '2026-09-30', expiry_date: null, risk_level: index % 4 === 0 ? 'high' : 'medium', status: index % 3 === 0 ? 'completed' : 'in_progress', departments: { name_en: departments[index % 3].name_en, name_ar: departments[index % 3].name_ar }, owner: { full_name_en: profiles[index % 3].full_name_en, full_name_ar: profiles[index % 3].full_name_ar } })));
    if (table === 'audit_findings') return fulfill(route, [{ id: 'finding-1', organization_id: PATCH83V_ORGANIZATION_ID, responsible_department_id: departmentIds[1], finding_code: 'AF-2026-017', audit_title: 'Medication Management Audit', title: 'Incomplete independent check evidence', description: 'Control evidence was incomplete.', risk_level: 'high', severity_level: 'critical', due_date: '2026-09-15', status: 'open', finding_status: 'corrective_action_in_progress', departments: { name_en: departments[1].name_en, name_ar: departments[1].name_ar } }, { id: 'finding-2', organization_id: PATCH83V_ORGANIZATION_ID, responsible_department_id: departmentIds[0], finding_code: 'AF-2026-011', audit_title: 'Policy Control Audit', title: 'Annual review owner overdue', description: 'Review evidence outstanding.', risk_level: 'medium', severity_level: 'moderate', due_date: '2026-08-15', status: 'open', finding_status: 'management_response_required', departments: { name_en: departments[0].name_en, name_ar: departments[0].name_ar } }]);
    if (table === 'v_pending_approvals_expanded') return fulfill(route, [{ id: 'approval-1', organization_id: PATCH83V_ORGANIZATION_ID, item_type: 'policy', item_id: 'policy-4', item_title: ui2Policies[3].document_title, requested_by_name: 'Dr. Lina Haddad', approver_name: 'UI Review Admin', status: 'pending', request_note: 'Final governance approval required.', decision_note: null, requested_at: '2026-08-19T09:00:00.000Z', decided_at: null }, { id: 'approval-2', organization_id: PATCH83V_ORGANIZATION_ID, item_type: 'sop', item_id: 'sop-4', item_title: ui2Sops[3].document_title, requested_by_name: 'Omar Al-Salem', approver_name: 'UI Review Admin', status: 'pending', request_note: 'Clinical approval required.', decision_note: null, requested_at: '2026-08-20T10:00:00.000Z', decided_at: null }]);
    if (table === 'v_critical_attention_items') return fulfill(route, [{ id: 'attention-1', item_type: 'risk', title: 'Medication administration risk treatment is due', department_name: departments[1].name_en, owner_name: profiles[1].full_name_en, due_date: '2026-08-28', status: 'open', risk_level: 'critical', progress_percent: 62, sort_rank: 1 }, { id: 'attention-2', item_type: 'audit', title: 'Critical finding requires executive closure evidence', department_name: departments[0].name_en, owner_name: profiles[0].full_name_en, due_date: '2026-09-02', status: 'open', risk_level: 'high', progress_percent: 45, sort_rank: 2 }]);
    if (table === 'v_management_control_summary') return fulfill(route, [{ organization_id: PATCH83V_ORGANIZATION_ID, open_escalations: 7, acknowledged_escalations: 4, executive_escalations: 2, critical_escalations: 1, missing_delay_reasons: 3 }]);
    if (table === 'v_live_grc_capa_queue') return fulfill(route, [{ capa_id: 'capa-1', capa_code: 'CAPA-026', title: 'Medication double-check evidence remediation', department_id: departmentIds[1], department_name: departments[1].name_en, owner_id: profiles[1].id, owner_name: profiles[1].full_name_en, due_date: '2026-08-18', status: 'in_progress', queue_signal: 'overdue', risk_level: 'high' }, { capa_id: 'capa-2', capa_code: 'CAPA-031', title: 'Policy review ownership reconciliation', department_id: departmentIds[0], department_name: departments[0].name_en, owner_id: profiles[0].id, owner_name: profiles[0].full_name_en, due_date: '2026-09-01', status: 'verification', queue_signal: 'ready_for_retest', risk_level: 'medium' }]);
    if (table === 'v_executive_grc_summary') return fulfill(route, [{ active_projects: 4, overdue_projects: 1, overdue_milestones: 2, overdue_tasks: 3, critical_open_risks: 3, compliance_expiring_30_days: 4, overdue_audit_findings: 1, pending_approvals: 2, pending_evidence_reviews: 5 }]);

    if (['ovr_reports', 'risk_controls', 'evidence_files'].includes(table)) return fulfill(route, Array.from({ length: table === 'ovr_reports' ? 14 : 9 }, (_, index) => ({ id: `${table}-${index + 1}`, status: index % 3 === 0 ? 'closed' : 'open', is_active: true })));
    return route.fallback();
  });
}
