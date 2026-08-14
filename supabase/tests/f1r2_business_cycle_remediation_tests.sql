-- F1-R2 disposable full-cycle regression. All mutations roll back.
begin;
create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

create or replace function pg_temp.f2_uuid(p integer) returns uuid language sql immutable as $$
  select ('f1960000-0000-4000-8000-'||lpad(p::text,12,'0'))::uuid
$$;

insert into public.organizations(id,name_en) values(pg_temp.f2_uuid(1),'F1-R2 disposable organization'),(pg_temp.f2_uuid(2),'F1-R2 other organization');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,created_at,updated_at)
select id,'authenticated','authenticated',email,'',now(),'{"credential_version":1}'::jsonb,now(),now() from (values
  (pg_temp.f2_uuid(10),'p1@example.test'),(pg_temp.f2_uuid(11),'p2@example.test'),
  (pg_temp.f2_uuid(12),'p3@example.test'),(pg_temp.f2_uuid(13),'p4@example.test'),
  (pg_temp.f2_uuid(14),'p5@example.test'),(pg_temp.f2_uuid(15),'other@example.test')
) u(id,email);
insert into public.profiles(id,organization_id,employee_no,full_name_en,email,is_active,user_status)
select id,case when id=pg_temp.f2_uuid(15) then pg_temp.f2_uuid(2) else pg_temp.f2_uuid(1) end,'F2-'||right(id::text,4),name,email,true,'active'
from (values
  (pg_temp.f2_uuid(10),'Reporter P1','p1@example.test'),(pg_temp.f2_uuid(11),'Quality P2','p2@example.test'),
  (pg_temp.f2_uuid(12),'Owner P3','p3@example.test'),(pg_temp.f2_uuid(13),'Approver P4','p4@example.test'),
  (pg_temp.f2_uuid(14),'Unrelated P5','p5@example.test'),(pg_temp.f2_uuid(15),'Other org','other@example.test')
) p(id,name,email);
insert into public.user_credential_states(user_id,organization_id,auth_email,identity_mode,credential_state,requested_lifecycle,credential_version)
select id,organization_id,lower(email),'legacy_verified','active','active',1 from public.profiles where id::text like 'f1960000-%'
on conflict(user_id) do update set organization_id=excluded.organization_id,auth_email=excluded.auth_email,identity_mode=excluded.identity_mode,credential_state=excluded.credential_state,requested_lifecycle=excluded.requested_lifecycle,credential_version=excluded.credential_version;
insert into public.divisions(id,organization_id,name_en,code) values(pg_temp.f2_uuid(20),pg_temp.f2_uuid(1),'F2 Division','F2-D');
insert into public.departments(id,organization_id,division_id,name_en,code) values(pg_temp.f2_uuid(21),pg_temp.f2_uuid(1),pg_temp.f2_uuid(20),'F2 Department','F2-DEP');
insert into public.departments(id,organization_id,division_id,name_en,code) values(pg_temp.f2_uuid(22),pg_temp.f2_uuid(1),pg_temp.f2_uuid(20),'F2 Other Department','F2-OTHER');
update public.profiles set division_id=pg_temp.f2_uuid(20),department_id=pg_temp.f2_uuid(21) where organization_id=pg_temp.f2_uuid(1);
set local session_replication_role=replica;
insert into public.user_roles(user_id,role,scope,organization_id,department_id,is_active) values
  (pg_temp.f2_uuid(10),'employee','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(11),'governance_admin','global',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(12),'project_owner','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(13),'department_manager','department',pg_temp.f2_uuid(1),pg_temp.f2_uuid(21),true),
  (pg_temp.f2_uuid(14),'employee','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(15),'employee','assigned_only',pg_temp.f2_uuid(2),null,true);
set local session_replication_role=origin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,created_at,updated_at)
select pg_temp.f2_uuid(200+n),'authenticated','authenticated','bulk-'||n||'@example.test','',now(),'{}'::jsonb,now(),now()
from generate_series(0,54) n;
insert into public.profiles(id,organization_id,employee_no,full_name_en,email,is_active,user_status,division_id,department_id)
select pg_temp.f2_uuid(200+n),pg_temp.f2_uuid(1),'BULK-'||n,'Bulk candidate '||lpad(n::text,2,'0'),'bulk-'||n||'@example.test',true,'active',pg_temp.f2_uuid(20),pg_temp.f2_uuid(21)
from generate_series(0,54) n;
set local session_replication_role=replica;
insert into public.user_roles(user_id,role,scope,organization_id,is_active)
select pg_temp.f2_uuid(200+n),'employee','assigned_only',pg_temp.f2_uuid(1),true from generate_series(0,54) n;
set local session_replication_role=origin;

select lives_ok($$
  select public.f1r2_create_ovr_report(pg_temp.f2_uuid(10),jsonb_build_object(
    'logging_number','F2-OVR','occurrence_date','2026-08-14','occurrence_time','13:45:12',
    'notification_at','2026-08-14T14:05','occurrence_location','Disposable lab','involved_person_type','employee','department_id',pg_temp.f2_uuid(21),
    'brief_description','F1-R2 exact persistence fixture','occurrence_category','other','severity_level','level_1',
    'create_linked_action_plan',true,'corrective_action_required',true,'status','submitted'
  ))
$$,'OVR protected creation succeeds');

select is((select occurrence_date::text from public.ovr_reports where logging_number='F2-OVR'),'2026-08-14','occurrence date persists');
select is((select occurrence_time::text from public.ovr_reports where logging_number='F2-OVR'),'13:45:12','occurrence time persists');
select is((select notification_at at time zone 'Asia/Riyadh' from public.ovr_reports where logging_number='F2-OVR')::text,'2026-08-14 14:05:00','notification preserves Riyadh wall time');
select ok((select corrective_action_required from public.ovr_reports where logging_number='F2-OVR'),'corrective-action-required persists true');

select throws_ok($$
  select public.f1r2_create_corrective_project(pg_temp.f2_uuid(11),jsonb_build_object('ovr_report_id',(select id from public.ovr_reports where logging_number='F2-OVR'),'sponsor_id',pg_temp.f2_uuid(11),'start_date','2026-08-14','target_end_date','2026-09-14'))
$$,'F1R2_EXPLICIT_OWNER_REQUIRED','corrective project requires explicit owner');

select lives_ok($$
  select public.f1r2_create_corrective_project(pg_temp.f2_uuid(11),jsonb_build_object(
    'ovr_report_id',(select id from public.ovr_reports where logging_number='F2-OVR'),
    'owner_id',pg_temp.f2_uuid(12),'sponsor_id',pg_temp.f2_uuid(11),
    'start_date','2026-08-14','target_end_date','2026-09-14','title','F2 Corrective project'
  ))
$$,'Quality routes corrective project explicitly');

select is((select status from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'pending','project assignment begins pending');
select is((select status::text from public.projects where title='F2 Corrective project'),'draft','corrective project stays draft until its owner accepts');
select is((select owner_id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),'project owner aligns to assignment');
select is((select created_by from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(11),'creator remains Quality actor');
select is((select sponsor_id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(11),'sponsor remains explicit');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'accepted',null)$$,'F1R2_ONLY_ASSIGNEE_MAY_RESPOND','unrelated user cannot accept assignment');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'accepted',null)$$,'P3 accepts project assignment');
select is((select status::text from public.projects where title='F2 Corrective project'),'active','project acceptance is the only initial activation transition');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'project',jsonb_build_object('title','Owner scope escape','department_id',pg_temp.f2_uuid(22)))$$,'F1R2_PROJECT_CREATE_DENIED','assigned-only project owner cannot create arbitrary organization-wide projects');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(13),'project',jsonb_build_object('title','Department scope escape','department_id',pg_temp.f2_uuid(22)))$$,'F1R2_PROJECT_CREATE_DENIED','department manager cannot create outside the matching department');
select pg_catalog.set_config('request.jwt.claim.sub',pg_temp.f2_uuid(12)::text,true);
set local role authenticated;
select throws_like($$select count(*) from public.ovr_reports where logging_number='F2-OVR'$$,'%permission denied%','corrective-project assignment does not expose source OVR and fails closed');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','M1','owner_id',pg_temp.f2_uuid(12),'start_date','2026-08-15','due_date','2026-08-25','evidence_required',true))$$,'M1 schedule creation succeeds');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','M2','owner_id',pg_temp.f2_uuid(12),'start_date','2026-08-16','due_date','2026-08-26','evidence_required',true))$$,'M2 schedule creation succeeds');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','Bad dates','owner_id',pg_temp.f2_uuid(12),'start_date','2026-08-20','due_date','2026-08-19'))$$,'F1R2_INVALID_DATE_ORDER','inverted milestone dates fail closed');
select is((select start_date::text from public.milestones where title='M1'),'2026-08-15','milestone start persists');
select is((select due_date::text from public.milestones where title='M2'),'2026-08-26','milestone due persists');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M1'),'title','T1','assigned_to',pg_temp.f2_uuid(12),'start_date','2026-08-15','due_date','2026-08-24','evidence_required',true))$$,'T1 schedule creation succeeds');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M2'),'title','T2','assigned_to',pg_temp.f2_uuid(12),'start_date','2026-08-16','due_date','2026-08-25','evidence_required',true))$$,'T2 schedule creation succeeds');
select is((select start_date::text from public.tasks where title='T1'),'2026-08-15','task start persists');
select is((select due_date::text from public.tasks where title='T2'),'2026-08-25','task due persists');
select is((select count(*)::integer from public.f1r2_search_eligible_participants(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'task_owner','Bulk candidate',100)),55,'contextual participant search finds eligible candidates beyond the first fifty rows');
select throws_ok($$select public.f1r2_search_eligible_participants(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='T1'),'task_owner','',100)$$,'F1R2_PARTICIPANT_SEARCH_DENIED','unrelated employee cannot enumerate contextual candidates');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M1'),'title','Privacy leaf','assigned_to',pg_temp.f2_uuid(14),'start_date','2026-08-17','due_date','2026-08-22','evidence_required',false))$$,'P5 privacy assignment fixture is created');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Privacy leaf')),'accepted',null)$$,'P5 accepts only its task');
select is((select count(*)::integer from public.f1r2_list_project_assignments(pg_temp.f2_uuid(14),(select id from public.projects where title='F2 Corrective project'))),2,'child-only assignee sees own row plus restricted project context, not sibling assignments');
select ok(not exists(select 1 from public.f1r2_list_project_assignments(pg_temp.f2_uuid(14),(select id from public.projects where title='F2 Corrective project')) where assignee_name='Owner P3'),'child-only assignee cannot see parent or sibling participant identity');
select pg_catalog.set_config('request.jwt.claim.sub',pg_temp.f2_uuid(14)::text,true);
set local role authenticated;
select is((select count(*)::integer from public.work_item_assignments),1,'real authenticated RLS exposes only P5 own assignment row');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
select ok(position('f1r2_actor_can_manage_item' in (select pg_get_expr(polqual,polrelid) from pg_policy where polname='work_item_assignments_exact_read'))=0,'authenticated assignment RLS contains no service-only helper');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='Privacy leaf'),'cancelled',0,null)$$,'P5 can cancel only its accepted task through the governed status path');

select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2')),'declined',null)$$,'F1R2_DECLINE_REASON_REQUIRED','decline requires a reason');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2')),'declined','Workload conflict')$$,'assignee declines with reason');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M2'),pg_temp.f2_uuid(13),'controlled reassignment')$$,'authorized owner reassigns declined milestone to an eligible scoped manager');
select is((select status from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2') order by assigned_at,id limit 1),'superseded','declined history becomes superseded without deletion');
select lives_ok($$select public.f1r2_cancel_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2') and status='pending'),'scope changed')$$,'authorized owner cancels pending assignment');
select is((select owner_id from public.milestones where title='M2'),null::uuid,'pending cancellation clears aligned owner');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M2'),pg_temp.f2_uuid(12),'return to owner')$$,'cancelled milestone can be assigned again');

select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),id,'accepted',null) from public.work_item_assignments where assignee_id=pg_temp.f2_uuid(12) and item_type in('milestone','task') and status='pending'$$,'P3 accepts milestone and task assignments');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T2'),pg_temp.f2_uuid(15),'cross org')$$,'F1R2_ASSIGNEE_NOT_ELIGIBLE','cross-organization assignment denied');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='T1'),'in_progress',10,null)$$,'F1R2_STATUS_UPDATE_DENIED','unrelated employee cannot mutate assigned task');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'in_progress',90,null)$$,'T1 progress 90 accepted');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T2'),'in_progress',40,null)$$,'T2 progress 40 accepted');
select is((select progress_percent from public.milestones where title='M1'),90::numeric,'M1 derives 90 from T1');
select is((select progress_percent from public.milestones where title='M2'),40::numeric,'M2 derives 40 from T2');
select is((select progress_percent from public.projects where title='F2 Corrective project'),65::numeric,'project derives 65 without double counting');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'in_progress',101,null)$$,'F1R2_PROGRESS_OUT_OF_RANGE','progress above 100 denied');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M1'),'title','Cancelled leaf','assigned_to',pg_temp.f2_uuid(12),'start_date','2026-08-17','due_date','2026-08-23'))$$,'cancelled-child fixture is created');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Cancelled leaf')),'accepted',null)$$,'cancelled-child fixture is accepted');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='Cancelled leaf'),'cancelled',100,null)$$,'cancelled leaf transitions through the protected path');
select is((select progress_percent from public.milestones where title='M1'),90::numeric,'cancelled child is excluded from milestone progress');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.tasks where title='T1') and action='f1r2_status_progress_updated'),1,'one task update invokes one auditable business transition');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'closed',100,null)$$,'F1R2_CLOSURE_PREREQUISITES_NOT_MET','task closure fails without accepted exact evidence');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M1'),'closed',100,null)$$,'F1R2_CLOSURE_PREREQUISITES_NOT_MET','milestone closure fails while required child work remains open');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'closed',100,null)$$,'F1R2_CLOSURE_PREREQUISITES_NOT_MET','project closure fails while child, evidence, and approval gates are incomplete');

select ok(exists(select 1 from public.acc_v13_list_eligible_approvers(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where id=pg_temp.f2_uuid(13)),'P4 is an eligible approver');
select ok(not exists(select 1 from public.acc_v13_list_eligible_approvers(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where id in(pg_temp.f2_uuid(12),pg_temp.f2_uuid(14))),'requester and P5 excluded');
select lives_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'F2 approval')$$,'item-scoped approval request succeeds');
select throws_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(12),(select id from public.approvals where request_note='F2 approval'),'approved','self')$$,'F1R2_APPROVAL_DECISION_DENIED','requester cannot decide approval');
select lives_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(13),(select id from public.approvals where request_note='F2 approval'),'approved','approved')$$,'P4 approves');
select lives_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'F2 rejection')$$,'a new governed approval review may be requested');
select lives_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(13),(select id from public.approvals where request_note='F2 rejection'),'rejected','needs revision')$$,'P4 may reject with an audit decision');
select lives_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'F2 resubmission')$$,'rejected work may be resubmitted');
select lives_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(13),(select id from public.approvals where request_note='F2 resubmission'),'approved','revision accepted')$$,'P4 approves the resubmission');

insert into public.projects(id,organization_id,title,division_id,department_id,status,evidence_required,closure_approval_required,created_by,updated_by)
values(pg_temp.f2_uuid(80),pg_temp.f2_uuid(1),'Exact gate matrix',pg_temp.f2_uuid(20),pg_temp.f2_uuid(21),'completed_pending_approval',false,true,pg_temp.f2_uuid(11),pg_temp.f2_uuid(11));
select ok(not public.f1r2_latest_approval_satisfied('project',pg_temp.f2_uuid(80),true),'approval-required item fails closed when no approval exists');
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at)
values(pg_temp.f2_uuid(81),pg_temp.f2_uuid(1),pg_temp.f2_uuid(80),pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),'pending','matrix pending','2026-08-15T08:00:00Z');
select ok(not public.f1r2_latest_approval_satisfied('project',pg_temp.f2_uuid(80),true),'pending latest approval blocks closure');
update public.approvals set status='approved',decided_at='2026-08-15T08:05:00Z' where id=pg_temp.f2_uuid(81);
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at,decided_at)
values(pg_temp.f2_uuid(82),pg_temp.f2_uuid(1),pg_temp.f2_uuid(80),pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),'rejected','matrix rejected','2026-08-15T09:00:00Z','2026-08-15T09:05:00Z');
select ok(not public.f1r2_latest_approval_satisfied('project',pg_temp.f2_uuid(80),true),'older approval cannot override a newer rejection');
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at,decided_at)
values(pg_temp.f2_uuid(83),pg_temp.f2_uuid(1),pg_temp.f2_uuid(80),pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),'approved','matrix final approval','2026-08-15T10:00:00Z','2026-08-15T10:05:00Z');
select ok(public.f1r2_latest_approval_satisfied('project',pg_temp.f2_uuid(80),true),'latest approved decision satisfies the exact approval gate');
select ok(public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',pg_temp.f2_uuid(80),false),'optional evidence does not block closure');
select ok(not public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',pg_temp.f2_uuid(80),true),'required evidence fails closed without accepted exact evidence');

insert into public.evidence_files(id,organization_id,project_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at) values
  (pg_temp.f2_uuid(100),pg_temp.f2_uuid(1),(select id from public.projects where title='F2 Corrective project'),'project.txt','f2/project.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now());
insert into public.evidence_files(id,organization_id,milestone_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
select pg_temp.f2_uuid((101+row_number() over())::integer),pg_temp.f2_uuid(1),id,title||'.txt','f2/'||title||'.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now() from public.milestones where title in('M1','M2');
insert into public.evidence_files(id,organization_id,task_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
select pg_temp.f2_uuid((103+row_number() over())::integer),pg_temp.f2_uuid(1),id,title||'.txt','f2/'||title||'.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now() from public.tasks where title in('T1','T2');
insert into public.evidence_files(id,organization_id,ovr_report_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
values(pg_temp.f2_uuid(106),pg_temp.f2_uuid(1),(select id from public.ovr_reports where logging_number='F2-OVR'),'ovr.txt','f2/ovr.txt','accepted','accepted',true,pg_temp.f2_uuid(10),pg_temp.f2_uuid(11),now());
select is((select count(*)::integer from public.evidence_links where evidence_file_id in(select id from public.evidence_files where file_path like 'f2/%')),6,'each upload has one canonical evidence link');
select is((select count(distinct evidence_file_id)::integer from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'))),5,'project pack aggregates project, milestones, and tasks without duplicates');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(13),pg_temp.f2_uuid(100),'view')$$,'exact approver can inspect project evidence');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(13),pg_temp.f2_uuid(104),'view')$$,'project approver can inspect descendant task evidence');
select throws_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(14),pg_temp.f2_uuid(100),'view')$$,'F1R2_EVIDENCE_ACCESS_DENIED','P5 cannot inspect evidence');
select is((select count(*)::integer from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(10),'ovr',(select id from public.ovr_reports where logging_number='F2-OVR'))),1,'OVR reporter pack includes direct OVR evidence but not corrective hierarchy without project entitlement');
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'ovr',(select id from public.ovr_reports where logging_number='F2-OVR'))$$,'F1R2_EVIDENCE_PACK_DENIED','corrective project owner cannot infer source OVR evidence');

insert into public.evidence_files(id,organization_id,task_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
values(pg_temp.f2_uuid(107),pg_temp.f2_uuid(1),(select id from public.tasks where title='T1'),'relink.txt','f2/relink.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now());
update public.evidence_files set task_id=(select id from public.tasks where title='T2') where id=pg_temp.f2_uuid(107);
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true and is_primary=true),1,'relink leaves exactly one active canonical parent');
select ok((select linked_item_id=(select id from public.tasks where title='T2') from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true),'relink activates only the new task parent');
select ok(exists(select 1 from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and linked_item_id=(select id from public.tasks where title='T1') and is_active=false),'relink explicitly retires the old task parent');
update public.evidence_files set project_id=(select id from public.projects where title='F2 Corrective project') where id=pg_temp.f2_uuid(107);
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true),0,'ambiguous source row fails closed with no active evidence link');
select ok(exists(select 1 from public.f1r2_evidence_link_reconciliation where evidence_file_id=pg_temp.f2_uuid(107)),'ambiguous evidence is queued for reconciliation');
update public.evidence_files set project_id=null where id=pg_temp.f2_uuid(107);
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true and linked_item_type='task'),1,'corrected evidence restores one canonical task link');

insert into public.evidence_requirements(id,organization_id,requirement_code,linked_item_type,linked_item_id,requirement_title,required_for_gate,gate_status,is_active,created_by)
values(pg_temp.f2_uuid(108),pg_temp.f2_uuid(1),'F2-REQ','project',(select id from public.projects where title='F2 Corrective project'),'Exact closure evidence requirement','closure','pending',true,pg_temp.f2_uuid(11));
select ok(not public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),true),'active unsatisfied evidence requirement blocks closure despite accepted files');
update public.evidence_requirements set gate_status='satisfied' where id=pg_temp.f2_uuid(108);
select ok(public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),true),'satisfied active evidence requirement permits the exact item gate');
select pg_catalog.set_config('request.jwt.claim.role','anon',true);
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'))$$,'F1R2_SERVICE_ROLE_REQUIRED','anonymous callers cannot execute the protected pack');
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',id,'closed',100,null) from public.tasks where title in('T1','T2')$$,'tasks close');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'milestone',id,'closed',100,null) from public.milestones where title in('M1','M2')$$,'milestones close');
select ok(public.f1r2_latest_approval_satisfied('project',(select id from public.projects where title='F2 Corrective project'),true),'project retains an exact latest approved decision before closure');
select ok(public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),true),'project retains exact accepted evidence before closure');
select is((select progress_percent from public.projects where title='F2 Corrective project'),100::numeric,'closed children roll project progress to 100 exactly once');
select ok(public.f1r2_can_close_work_item('project',(select id from public.projects where title='F2 Corrective project')),'combined project closure gate is satisfied');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'closed',100,null)$$,'project closes');
select ok((select closed_at is not null and closed_by=pg_temp.f2_uuid(12) from public.projects where title='F2 Corrective project'),'project closure facts populated');
select is((select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'closed',100,null)->>'replayed'),'true','repeated project close is idempotent');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.projects where title='F2 Corrective project') and action='f1r2_project_closed'),1,'project closure event is emitted exactly once');
select ok(public.can_close_ovr((select id from public.ovr_reports where logging_number='F2-OVR')),'OVR prerequisites are satisfied');
select lives_ok($$select public.f1r2_finalize_corrective_ovr(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'Corrective actions verified','level_1','Quality closure complete','f2-final-1')$$,'Quality final verdict moves corrective OVR to reporter review');
select is((select status::text from public.ovr_reports where logging_number='F2-OVR'),'quality_final_review','Quality final verdict preserves the reporter decision stage');
select ok((select final_verdict_at is not null and quality_closed_by=pg_temp.f2_uuid(11) and closed_at is null and closed_by is null from public.ovr_reports where logging_number='F2-OVR'),'Quality verdict attribution persists without fabricating reporter closure');
select is((select public.f1r2_finalize_corrective_ovr(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'Corrective actions verified','level_1','Quality closure complete','f2-final-1')->>'replayed'),'true','repeated Quality verdict returns the authoritative prior result');
select throws_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'closed','{}'::jsonb)$$,'V98_OVR_REPORTER_ACCEPTANCE_REQUIRED','Quality cannot bypass the reporter closure decision');
select lives_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(10),(select id from public.ovr_reports where logging_number='F2-OVR'),'disputed',jsonb_build_object('note','Reporter requests another Quality review'))$$,'reporter may dispute the Quality verdict');
select is((select status::text from public.ovr_reports where logging_number='F2-OVR'),'disputed','reporter dispute is persisted');
select lives_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'reopened','{}'::jsonb)$$,'Quality reopens a reporter dispute');
select lives_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'quality_final_review',jsonb_build_object('final_verdict','Corrective actions reverified','quality_manager_comments','Quality review repeated','confirmed_severity_level','level_1'))$$,'Quality issues a revised verdict after dispute');
select lives_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(10),(select id from public.ovr_reports where logging_number='F2-OVR'),'closed','{}'::jsonb)$$,'original reporter accepts and closes the revised verdict');
select is((select status::text from public.ovr_reports where logging_number='F2-OVR'),'closed','OVR closes only after reporter acceptance');
select ok((select reporter_response='accepted' and closed_at is not null and closed_by=pg_temp.f2_uuid(10) from public.ovr_reports where logging_number='F2-OVR'),'reporter-only closure facts persist');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.ovr_reports where logging_number='F2-OVR') and action='f1r2_ovr_final_verdict'),1,'F2-R1 Quality finalizer emits one idempotent verdict audit event');

select * from finish();
rollback;
