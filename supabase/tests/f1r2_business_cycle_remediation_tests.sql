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
select is((select owner_id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),'project owner aligns to assignment');
select is((select created_by from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(11),'creator remains Quality actor');
select is((select sponsor_id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(11),'sponsor remains explicit');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'accepted',null)$$,'F1R2_ONLY_ASSIGNEE_MAY_RESPOND','unrelated user cannot accept assignment');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'accepted',null)$$,'P3 accepts project assignment');
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

select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2')),'declined',null)$$,'F1R2_DECLINE_REASON_REQUIRED','decline requires a reason');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2')),'declined','Workload conflict')$$,'assignee declines with reason');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M2'),pg_temp.f2_uuid(14),'controlled reassignment')$$,'authorized owner reassigns declined milestone');
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

select ok(exists(select 1 from public.acc_v13_list_eligible_approvers(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where id=pg_temp.f2_uuid(13)),'P4 is an eligible approver');
select ok(not exists(select 1 from public.acc_v13_list_eligible_approvers(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where id in(pg_temp.f2_uuid(12),pg_temp.f2_uuid(14))),'requester and P5 excluded');
select lives_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'F2 approval')$$,'item-scoped approval request succeeds');
select throws_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(12),(select id from public.approvals where request_note='F2 approval'),'approved','self')$$,'F1R2_APPROVAL_DECISION_DENIED','requester cannot decide approval');
select lives_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(13),(select id from public.approvals where request_note='F2 approval'),'approved','approved')$$,'P4 approves');
select lives_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'F2 rejection')$$,'a new governed approval review may be requested');
select lives_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(13),(select id from public.approvals where request_note='F2 rejection'),'rejected','needs revision')$$,'P4 may reject with an audit decision');
select lives_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'F2 resubmission')$$,'rejected work may be resubmitted');
select lives_ok($$select public.f1r2_decide_approval(pg_temp.f2_uuid(13),(select id from public.approvals where request_note='F2 resubmission'),'approved','revision accepted')$$,'P4 approves the resubmission');

insert into public.evidence_files(id,organization_id,project_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at) values
  (pg_temp.f2_uuid(100),pg_temp.f2_uuid(1),(select id from public.projects where title='F2 Corrective project'),'project.txt','f2/project.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now());
insert into public.evidence_files(id,organization_id,milestone_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
select pg_temp.f2_uuid((101+row_number() over())::integer),pg_temp.f2_uuid(1),id,title||'.txt','f2/'||title||'.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now() from public.milestones where title in('M1','M2');
insert into public.evidence_files(id,organization_id,task_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
select pg_temp.f2_uuid((103+row_number() over())::integer),pg_temp.f2_uuid(1),id,title||'.txt','f2/'||title||'.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now() from public.tasks where title in('T1','T2');
select is((select count(*)::integer from public.evidence_links where evidence_file_id in(select id from public.evidence_files where file_path like 'f2/%')),5,'each upload has one canonical evidence link');
select is((select count(distinct evidence_file_id)::integer from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'))),5,'project pack aggregates project, milestones, and tasks without duplicates');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(13),pg_temp.f2_uuid(100),'view')$$,'exact approver can inspect project evidence');
select throws_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(14),pg_temp.f2_uuid(100),'view')$$,'F1R2_EVIDENCE_ACCESS_DENIED','P5 cannot inspect evidence');
select pg_catalog.set_config('request.jwt.claim.role','anon',true);
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'))$$,'F1R2_SERVICE_ROLE_REQUIRED','anonymous callers cannot execute the protected pack');
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',id,'closed',100,null) from public.tasks where title in('T1','T2')$$,'tasks close');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'milestone',id,'closed',100,null) from public.milestones where title in('M1','M2')$$,'milestones close');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'closed',100,null)$$,'project closes');
select ok((select closed_at is not null and closed_by=pg_temp.f2_uuid(12) from public.projects where title='F2 Corrective project'),'project closure facts populated');
select is((select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'closed',100,null)->>'replayed'),'true','repeated project close is idempotent');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.projects where title='F2 Corrective project') and action='f1r2_project_closed'),1,'project closure event is emitted exactly once');
select ok(public.can_close_ovr((select id from public.ovr_reports where logging_number='F2-OVR')),'OVR prerequisites are satisfied');
select lives_ok($$select public.f1r2_finalize_corrective_ovr(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'Corrective actions verified','level_1','Quality closure complete','f2-close-1')$$,'Quality final verdict closes corrective OVR');
select is((select status::text from public.ovr_reports where logging_number='F2-OVR'),'closed','OVR is closed');
select ok((select final_verdict_at is not null and closed_at is not null and closed_by=pg_temp.f2_uuid(11) from public.ovr_reports where logging_number='F2-OVR'),'OVR verdict and closure attribution persist');
select is((select public.f1r2_finalize_corrective_ovr(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'Corrective actions verified','level_1','Quality closure complete','f2-close-1')->>'replayed'),'true','repeated OVR closure returns the authoritative prior result');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.ovr_reports where logging_number='F2-OVR') and action='f1r2_ovr_closed'),1,'OVR closure event emitted exactly once');

select * from finish();
rollback;
