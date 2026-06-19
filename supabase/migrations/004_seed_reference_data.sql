-- =========================================================
-- GRC Control Center - Migration 004
-- Safe reference/demo data without auth users
-- =========================================================

with org as (
  select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1
)
insert into public.divisions (organization_id, name_en, name_ar, code)
select id, 'Executive', 'الإدارة التنفيذية', 'EXEC' from org
union all select id, 'Medical', 'القطاع الطبي', 'MED' from org
union all select id, 'Finance & Administration', 'المالية والإدارة', 'FINADMIN' from org
union all select id, 'Operations', 'التشغيل', 'OPS' from org
union all select id, 'Governance, Risk & Compliance', 'الحوكمة والمخاطر والالتزام', 'GRC' from org
on conflict do nothing;

with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1),
div_fin as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'FINADMIN'),
div_grc as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'GRC'),
div_med as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'MED'),
div_ops as (select d.id from public.divisions d join org on d.organization_id = org.id where d.code = 'OPS')
insert into public.departments (organization_id, division_id, name_en, name_ar, code)
select org.id, div_fin.id, 'Finance', 'المالية', 'FIN' from org, div_fin
union all select org.id, div_fin.id, 'Human Resources', 'الموارد البشرية', 'HR' from org, div_fin
union all select org.id, div_grc.id, 'Governance & Compliance', 'الحوكمة والالتزام', 'GOVCOMP' from org, div_grc
union all select org.id, div_grc.id, 'Internal Audit', 'المراجعة الداخلية', 'AUDIT' from org, div_grc
union all select org.id, div_med.id, 'Nursing', 'التمريض', 'NURS' from org, div_med
union all select org.id, div_med.id, 'Quality & Patient Safety', 'الجودة وسلامة المرضى', 'QUALITY' from org, div_med
union all select org.id, div_ops.id, 'Engineering & Projects', 'الهندسة والمشاريع', 'ENG' from org, div_ops
union all select org.id, div_ops.id, 'Information Technology', 'تقنية المعلومات', 'IT' from org, div_ops
on conflict do nothing;

-- Sample risks/action items with null owners. Assign owners later from the UI.
with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1),
fin as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'FIN'),
grc as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'GOVCOMP'),
eng as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'ENG')
insert into public.risks (organization_id, risk_code, title, description, category, department_id, likelihood, impact, residual_likelihood, residual_impact, risk_level, status, next_review_date)
select org.id, 'RISK-FIN-001', 'Delayed government payer collections', 'Collections delayed 6-8 months may pressure salary and supplier payments.', 'financial'::public.risk_category, fin.id, 5, 5, 4, 5, 'critical'::public.risk_level, 'open'::public.risk_status, current_date + 30 from org, fin
union all select org.id, 'RISK-GRC-001', 'Authority matrix not fully documented', 'Undefined approval limits may create inconsistent approvals.', 'compliance'::public.risk_category, grc.id, 4, 4, 3, 4, 'high'::public.risk_level, 'open'::public.risk_status, current_date + 45 from org, grc
union all select org.id, 'RISK-ENG-001', 'Civil Defense compliance evidence expiry', 'Expired or missing evidence may create regulatory exposure.', 'facility_engineering'::public.risk_category, eng.id, 4, 5, 3, 5, 'critical'::public.risk_level, 'open'::public.risk_status, current_date + 15 from org, eng
on conflict do nothing;

with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1),
fin as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'FIN'),
grc as (select d.id from public.departments d join org on d.organization_id = org.id where d.code = 'GOVCOMP')
insert into public.projects (organization_id, title, description, category, source_type, department_id, start_date, target_end_date, priority, risk_level, status, progress_percent)
select org.id, 'Weekly cash forecast and collection escalation', 'Build weekly cash visibility and payer escalation process.', 'finance_control', 'risk'::public.source_type, fin.id, current_date, current_date + 45, 'critical'::public.priority_level, 'critical'::public.risk_level, 'active'::public.project_status, 15 from org, fin
union all select org.id, 'Company authority matrix implementation', 'Create, approve and publish approval authority matrix.', 'governance', 'policy_gap'::public.source_type, grc.id, current_date, current_date + 60, 'high'::public.priority_level, 'high'::public.risk_level, 'active'::public.project_status, 10 from org, grc
on conflict do nothing;

with org as (select id from public.organizations where name_en = 'Al Modawat Specialized Medical Company' limit 1)
insert into public.compliance_items (organization_id, compliance_code, title, regulatory_body, requirement_type, expiry_date, reminder_days_before, risk_level, status)
select id, 'COMP-MOH-001', 'MOH license renewal tracking', 'Ministry of Health', 'License', current_date + 90, 45, 'critical'::public.risk_level, 'in_progress'::public.compliance_status from org
union all select id, 'COMP-CIVIL-001', 'Civil Defense certificate evidence', 'Civil Defense', 'Certificate', current_date + 30, 30, 'critical'::public.risk_level, 'due_soon'::public.compliance_status from org
on conflict do nothing;
