-- F1-R2 disposable full-cycle regression. All mutations roll back.
begin;
create extension if not exists pgtap;
select no_plan();
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

create or replace function pg_temp.f2_uuid(p integer) returns uuid language sql immutable as $$
  select ('f1960000-0000-4000-8000-'||lpad(p::text,12,'0'))::uuid
$$;

create or replace function pg_temp.f2_set_jwt_actor(p_actor_id uuid) returns text
language plpgsql
as $$
declare v_email text; v_session_id uuid;
begin
  select lower(p.email) into v_email from public.profiles p where p.id=p_actor_id;
  select s.id into v_session_id from auth.sessions s where s.user_id=p_actor_id order by s.created_at desc,s.id limit 1;
  perform pg_catalog.set_config('request.jwt.claim.sub',p_actor_id::text,true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object(
    'sub',p_actor_id,'email',v_email,'session_id',v_session_id,
    'app_metadata',jsonb_build_object('credential_version',1)
  )::text,true);
  perform pg_catalog.set_config('request.headers','{"x-patch83u-frontend-contract-version":"patch83u-frontend-auth-first-v1"}',true);
  return p_actor_id::text;
end;
$$;

insert into public.organizations(id,name_en) values(pg_temp.f2_uuid(1),'F1-R2 disposable organization'),(pg_temp.f2_uuid(2),'F1-R2 other organization');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,created_at,updated_at)
select id,'authenticated','authenticated',email,'',now(),'{"credential_version":1}'::jsonb,now(),now() from (values
  (pg_temp.f2_uuid(10),'p1@example.test'),(pg_temp.f2_uuid(11),'p2@example.test'),
  (pg_temp.f2_uuid(12),'p3@example.test'),(pg_temp.f2_uuid(13),'p4@example.test'),
  (pg_temp.f2_uuid(14),'p5@example.test'),(pg_temp.f2_uuid(15),'other@example.test'),
  (pg_temp.f2_uuid(16),'p6@example.test'),(pg_temp.f2_uuid(17),'p7@example.test'),
  (pg_temp.f2_uuid(18),'auditor@example.test'),(pg_temp.f2_uuid(19),'approver-only@example.test')
) u(id,email);
insert into public.profiles(id,organization_id,employee_no,full_name_en,email,is_active,user_status)
select id,case when id=pg_temp.f2_uuid(15) then pg_temp.f2_uuid(2) else pg_temp.f2_uuid(1) end,'F2-'||right(id::text,4),name,email,true,'active'
from (values
  (pg_temp.f2_uuid(10),'Reporter P1','p1@example.test'),(pg_temp.f2_uuid(11),'Quality P2','p2@example.test'),
  (pg_temp.f2_uuid(12),'Owner P3','p3@example.test'),(pg_temp.f2_uuid(13),'Approver P4','p4@example.test'),
  (pg_temp.f2_uuid(14),'Unrelated P5','p5@example.test'),(pg_temp.f2_uuid(15),'Other org','other@example.test'),
  (pg_temp.f2_uuid(16),'Admin P6','p6@example.test'),(pg_temp.f2_uuid(17),'Milestone owner P7','p7@example.test'),
  (pg_temp.f2_uuid(18),'Read-only auditor','auditor@example.test'),(pg_temp.f2_uuid(19),'Approver only','approver-only@example.test')
) p(id,name,email);
insert into public.user_credential_states(user_id,organization_id,auth_email,identity_mode,credential_state,requested_lifecycle,credential_version)
select id,organization_id,lower(email),'legacy_verified','active','active',1 from public.profiles where id::text like 'f1960000-%'
on conflict(user_id) do update set organization_id=excluded.organization_id,auth_email=excluded.auth_email,identity_mode=excluded.identity_mode,credential_state=excluded.credential_state,requested_lifecycle=excluded.requested_lifecycle,credential_version=excluded.credential_version;
insert into auth.sessions(id,user_id,created_at,updated_at)
select pg_temp.f2_uuid(1000+n),pg_temp.f2_uuid(10+n),now(),now() from generate_series(0,9) n;
-- Exercise the assignment RLS together with the real enforced Patch83U JWT,
-- session, profile, and credential gates.  The transaction rolls this back.
set local session_replication_role=replica;
insert into public.patch83u_runtime_control(
  singleton,enforcement_state,prepared_at,activated_at,compatible_edge_contract_version,
  compatible_frontend_contract_version,preflight_hash,designated_super_admin_id,state_version,
  activation_provenance,legacy_bridge_id,legacy_bridge_applied_at
) values(
  true,'enforced',now(),now(),'patch83u-edge-auth-first-v1','patch83u-frontend-auth-first-v1',
  repeat('0',64),pg_temp.f2_uuid(16),5,'legacy_migration_bridge','f1r2:test-runtime',now()
) on conflict(singleton) do update set
  enforcement_state=excluded.enforcement_state,prepared_at=excluded.prepared_at,prepared_by=null,
  activated_at=excluded.activated_at,activated_by=null,compatible_edge_contract_version=excluded.compatible_edge_contract_version,
  compatible_frontend_contract_version=excluded.compatible_frontend_contract_version,
  compatibility_attested_at=null,compatibility_attested_by=null,preflight_hash=excluded.preflight_hash,
  designated_super_admin_id=excluded.designated_super_admin_id,state_version=excluded.state_version,
  activation_provenance=excluded.activation_provenance,legacy_bridge_id=excluded.legacy_bridge_id,
  legacy_bridge_applied_at=excluded.legacy_bridge_applied_at;
set local session_replication_role=origin;
insert into public.divisions(id,organization_id,name_en,code) values(pg_temp.f2_uuid(20),pg_temp.f2_uuid(1),'F2 Division','F2-D');
insert into public.departments(id,organization_id,division_id,name_en,code) values(pg_temp.f2_uuid(21),pg_temp.f2_uuid(1),pg_temp.f2_uuid(20),'F2 Department','F2-DEP');
insert into public.departments(id,organization_id,division_id,name_en,code) values(pg_temp.f2_uuid(22),pg_temp.f2_uuid(1),pg_temp.f2_uuid(20),'F2 Other Department','F2-OTHER');
insert into public.departments(id,organization_id,name_en,code) values(pg_temp.f2_uuid(23),pg_temp.f2_uuid(2),'Cross-org Department','F2-XORG');
insert into public.departments(id,organization_id,division_id,name_en,code,is_active) values(pg_temp.f2_uuid(24),pg_temp.f2_uuid(1),pg_temp.f2_uuid(20),'Inactive Department','F2-INACTIVE',false);
update public.profiles set division_id=pg_temp.f2_uuid(20),department_id=pg_temp.f2_uuid(21) where organization_id=pg_temp.f2_uuid(1);
set local session_replication_role=replica;
insert into public.user_roles(user_id,role,scope,organization_id,department_id,is_active) values
  (pg_temp.f2_uuid(10),'employee','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(11),'governance_admin','global',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(12),'project_owner','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(13),'department_manager','department',pg_temp.f2_uuid(1),pg_temp.f2_uuid(21),true),
  (pg_temp.f2_uuid(13),'executive','global',pg_temp.f2_uuid(2),null,true),
  (pg_temp.f2_uuid(14),'employee','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(15),'employee','assigned_only',pg_temp.f2_uuid(2),null,true),
  (pg_temp.f2_uuid(16),'super_admin','global',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(17),'milestone_owner','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(18),'auditor','global',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(19),'employee','assigned_only',pg_temp.f2_uuid(1),null,true),
  (pg_temp.f2_uuid(19),'executive','global',pg_temp.f2_uuid(1),null,true);
set local session_replication_role=origin;

select throws_ok($$select public.f1r2_create_ovr_report(pg_temp.f2_uuid(10),jsonb_build_object('department_id',pg_temp.f2_uuid(23),'brief_description','Cross-org department','status','submitted'))$$,'F1R2_OVR_DEPARTMENT_INVALID','cross-organization OVR department is denied');
select throws_ok($$select public.f1r2_create_ovr_report(pg_temp.f2_uuid(10),jsonb_build_object('department_id',pg_temp.f2_uuid(24),'brief_description','Inactive department','status','submitted'))$$,'F1R2_OVR_DEPARTMENT_INVALID','inactive OVR department is denied');
select throws_ok($$select public.f1r2_create_ovr_report(pg_temp.f2_uuid(10),jsonb_build_object('department_id',pg_temp.f2_uuid(999),'brief_description','Unknown department','status','submitted'))$$,'F1R2_OVR_DEPARTMENT_INVALID','unknown OVR department is denied');

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
select is((select owner_id from public.projects where title='F2 Corrective project'),null::uuid,'pending project assignment grants no owner authority');
select is((select created_by from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(11),'creator remains Quality actor');
select is((select sponsor_id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(11),'sponsor remains explicit');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'accepted',null)$$,'F1R2_ONLY_ASSIGNEE_MAY_RESPOND','unrelated user cannot accept assignment');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'active',10,null)$$,'F1R2_PENDING_PROJECT_EXECUTION_DENIED','pending project assignee cannot update project status');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='F2 Corrective project'),'active',10,null)$$,'F1R2_PENDING_PROJECT_EXECUTION_DENIED','project creator cannot activate while owner acknowledgement is pending');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='F2 Corrective project'),'at_risk',10,null)$$,'F1R2_PENDING_PROJECT_EXECUTION_DENIED','project sponsor cannot begin execution while owner acknowledgement is pending');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(13),'project',(select id from public.projects where title='F2 Corrective project'),'delayed',10,'pending owner')$$,'F1R2_PENDING_PROJECT_EXECUTION_DENIED','scoped manager cannot begin execution while owner acknowledgement is pending');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(16),'project',(select id from public.projects where title='F2 Corrective project'),'active',10,null)$$,'F1R2_PENDING_PROJECT_EXECUTION_DENIED','Super Admin ordinary status action cannot bypass pending owner acknowledgement');
select is((select status::text from public.projects where title='F2 Corrective project'),'draft','denied pending execution attempts leave project draft');
select is((select owner_id from public.projects where title='F2 Corrective project'),null::uuid,'denied pending execution attempts leave owner uninstalled');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','Pending owner child'))$$,'F1R2_CHILD_CREATE_DENIED','pending project assignee cannot create child work');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(14),'pending owner reassign')$$,'F1R2_ASSIGNMENT_NOT_AUTHORIZED','pending project assignee cannot reassign the project');
select throws_ok($$select public.acc_v13_request_approval(pg_temp.f2_uuid(12),pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(13),'pending owner approval')$$,'ACC_V13_APPROVAL_REQUESTER_NOT_AUTHORIZED','pending project assignee cannot request owner approval');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),'accepted',null)$$,'P3 accepts project assignment');
select is((select owner_id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),'accepted project assignment installs the owner');
select is((select old_data->>'status' from public.audit_logs where action='f1r2_assignment_accepted' and record_id=(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project'))),'pending','pending to accepted audit records the true old state');
select is((select status::text from public.projects where title='F2 Corrective project'),'active','project acceptance is the only initial activation transition');

-- Pending assignments disclose only decision context, never business evidence
-- or descendant hierarchy.  Independent entitlements are exercised elsewhere.
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Pending privacy project','department_id',pg_temp.f2_uuid(21),'owner_id',pg_temp.f2_uuid(12)))$$,'pending-evidence project fixture is created');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='Pending privacy project'),'title','Pending privacy milestone','owner_id',pg_temp.f2_uuid(17)))$$,'pending milestone fixture is created by independent project creator');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'task',jsonb_build_object('project_id',(select id from public.projects where title='Pending privacy project'),'milestone_id',(select id from public.milestones where title='Pending privacy milestone'),'title','Pending privacy task','assigned_to',pg_temp.f2_uuid(14)))$$,'pending task fixture is created by independent project creator');
insert into public.evidence_files(id,organization_id,project_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at) values
  (pg_temp.f2_uuid(450),pg_temp.f2_uuid(1),(select id from public.projects where title='Pending privacy project'),'pending-project.txt','f2r3/pending-project.txt','accepted','accepted',true,pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),now());
insert into public.evidence_files(id,organization_id,milestone_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at) values
  (pg_temp.f2_uuid(451),pg_temp.f2_uuid(1),(select id from public.milestones where title='Pending privacy milestone'),'pending-milestone.txt','f2r3/pending-milestone.txt','accepted','accepted',true,pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),now());
insert into public.evidence_files(id,organization_id,task_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at) values
  (pg_temp.f2_uuid(452),pg_temp.f2_uuid(1),(select id from public.tasks where title='Pending privacy task'),'pending-task.txt','f2r3/pending-task.txt','accepted','accepted',true,pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),now());
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='Pending privacy project'))$$,'F1R2_EVIDENCE_PACK_DENIED','pending project assignee cannot retrieve the project evidence pack');
select throws_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(12),pg_temp.f2_uuid(450),'view')$$,'F1R2_EVIDENCE_ACCESS_DENIED','pending project assignee cannot view project evidence');
select throws_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(12),pg_temp.f2_uuid(451),'view')$$,'F1R2_EVIDENCE_ACCESS_DENIED','pending project assignee cannot view milestone evidence');
select throws_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(12),pg_temp.f2_uuid(452),'view')$$,'F1R2_EVIDENCE_ACCESS_DENIED','pending project assignee cannot view task evidence');
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(17),'milestone',(select id from public.milestones where title='Pending privacy milestone'))$$,'F1R2_EVIDENCE_PACK_DENIED','pending milestone assignee cannot retrieve milestone evidence');
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='Pending privacy task'))$$,'F1R2_EVIDENCE_PACK_DENIED','pending task assignee cannot retrieve task evidence');

select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(12));
set local role authenticated;
select is((select count(*)::integer from public.projects where title='Pending privacy project'),1,'pending project assignee receives the exact project decision context');
select is((select count(*)::integer from public.milestones where title='Pending privacy milestone'),0,'pending project assignment does not expose child milestones');
select is((select count(*)::integer from public.tasks where title='Pending privacy task'),0,'pending project assignment does not expose child tasks');
select is((select count(*)::integer from public.evidence_files where id in(pg_temp.f2_uuid(450),pg_temp.f2_uuid(451),pg_temp.f2_uuid(452))),0,'pending project assignment grants no direct evidence RLS access');
reset role;
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(17));
set local role authenticated;
select is((select count(*)::integer from public.projects where title='Pending privacy project'),1,'pending milestone assignee receives minimum parent project context');
select is((select count(*)::integer from public.milestones where title='Pending privacy milestone'),1,'pending milestone assignee receives the exact milestone decision context');
select is((select count(*)::integer from public.tasks where title='Pending privacy task'),0,'pending milestone assignment does not expose child tasks');
reset role;
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(14));
set local role authenticated;
select is((select count(*)::integer from public.projects where title='Pending privacy project'),1,'pending task assignee receives minimum parent project context');
select is((select count(*)::integer from public.milestones where title='Pending privacy milestone'),1,'pending task assignee receives minimum parent milestone context');
select is((select count(*)::integer from public.tasks where title='Pending privacy task'),1,'pending task assignee receives the exact task decision context');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Pending privacy project')),'accepted',null)$$,'pending project assignee accepts privacy fixture');
select is((select count(*)::integer from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='Pending privacy project'))),3,'accepted project assignment grants the authorized evidence hierarchy');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(17),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='Pending privacy milestone')),'accepted',null)$$,'pending milestone assignee accepts');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(17),pg_temp.f2_uuid(451),'view')$$,'accepted milestone assignment grants exact milestone evidence');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Pending privacy task')),'accepted',null)$$,'pending task assignee accepts');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(14),pg_temp.f2_uuid(452),'view')$$,'accepted task assignment grants exact task evidence');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Declined privacy project','department_id',pg_temp.f2_uuid(21),'owner_id',pg_temp.f2_uuid(12)))$$,'declined-evidence project fixture is created');
insert into public.evidence_files(id,organization_id,project_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at) values
  (pg_temp.f2_uuid(453),pg_temp.f2_uuid(1),(select id from public.projects where title='Declined privacy project'),'declined-project.txt','f2r3/declined-project.txt','accepted','accepted',true,pg_temp.f2_uuid(11),pg_temp.f2_uuid(13),now());
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Declined privacy project')),'declined','Not available')$$,'project assignee declines privacy fixture');
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='Declined privacy project'))$$,'F1R2_EVIDENCE_PACK_DENIED','declined project assignment grants no evidence pack');

select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'project',jsonb_build_object('title','Owner scope escape','department_id',pg_temp.f2_uuid(22)))$$,'F1R2_PROJECT_CREATE_DENIED','assigned-only project owner cannot create arbitrary organization-wide projects');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(13),'project',jsonb_build_object('title','Department scope escape','department_id',pg_temp.f2_uuid(22)))$$,'F1R2_PROJECT_CREATE_DENIED','department manager cannot create outside the matching department');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Decline handoff project','department_id',pg_temp.f2_uuid(21),'owner_id',pg_temp.f2_uuid(12)))$$,'Quality creates a pending handoff fixture');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Decline handoff project')),'declined','Capacity unavailable')$$,'pending project assignee may decline');
select is((select owner_id from public.projects where title='Decline handoff project'),null::uuid,'declined project retains no owner');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='Decline handoff project'),'active',10,null)$$,'F1R2_ASSIGNMENT_ACCEPTANCE_REQUIRED','declined project assignee loses status authority');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='Decline handoff project'),pg_temp.f2_uuid(14),'declined reassign attempt')$$,'F1R2_ASSIGNMENT_NOT_AUTHORIZED','declined project assignee loses reassignment authority');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Decline handoff project'),pg_temp.f2_uuid(13),'manager handoff')$$,'creator retains safe handoff authority');
select is((select owner_id from public.projects where title='Decline handoff project'),null::uuid,'replacement remains non-owner while pending');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(13),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Decline handoff project') and status='pending'),'accepted',null)$$,'replacement assignee accepts');
select is((select owner_id from public.projects where title='Decline handoff project'),pg_temp.f2_uuid(13),'accepted replacement becomes owner');
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(12));
set local role authenticated;
select is((select count(*)::integer from public.ovr_reports where logging_number='F2-OVR'),0,'corrective-project assignment does not expose source OVR and fails closed');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

-- Terminal assignment guards and atomic pending-project cancellation.
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Terminal container project','department_id',pg_temp.f2_uuid(21)))$$,'terminal fixture container is created');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Terminal container project'),'active',0,null)$$,'terminal fixture container is activated');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Closed assignment project','department_id',pg_temp.f2_uuid(21),'owner_id',pg_temp.f2_uuid(12)))$$,'closed project begins with a pending assignment');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Cancelled assignment project','department_id',pg_temp.f2_uuid(21),'owner_id',pg_temp.f2_uuid(12)))$$,'cancelled project begins with a pending assignment');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Atomic cancellation project','department_id',pg_temp.f2_uuid(21),'owner_id',pg_temp.f2_uuid(12)))$$,'atomic cancellation project begins pending');
set local session_replication_role=replica;
update public.projects set status='closed',updated_by=pg_temp.f2_uuid(11) where title='Closed assignment project';
update public.projects set status='cancelled',updated_by=pg_temp.f2_uuid(11) where title='Cancelled assignment project';
set local session_replication_role=origin;
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Closed assignment project'),pg_temp.f2_uuid(14),'terminal assignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','closed project rejects a new assignment');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Closed assignment project'),pg_temp.f2_uuid(13),'terminal reassignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','closed project rejects reassignment');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Closed assignment project')),'accepted',null)$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','closed project rejects a stale pending response');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Cancelled assignment project'),pg_temp.f2_uuid(14),'terminal assignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','cancelled project rejects a new assignment');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Cancelled assignment project'),pg_temp.f2_uuid(13),'terminal reassignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','cancelled project rejects reassignment');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Cancelled assignment project')),'declined','terminal')$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','cancelled project rejects a stale pending response');

select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Atomic cancellation project'),'cancelled',0,null)$$,'authorized controller atomically cancels a pending project');
select is((select status::text from public.projects where title='Atomic cancellation project'),'cancelled','pending project becomes cancelled');
select is((select status from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Atomic cancellation project')),'cancelled','project cancellation cancels the pending assignment in the same transaction');
select is((select owner_id from public.projects where title='Atomic cancellation project'),null::uuid,'project cancellation leaves no installed owner');
select is((select count(*)::integer from public.f1r2_list_my_work(pg_temp.f2_uuid(12)) where title='Atomic cancellation project'),0,'cancelled proposal disappears from assignee My Work');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Atomic cancellation project')),'accepted',null)$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','cancelled project assignment cannot be accepted by ID');
select is((select count(*)::integer from public.audit_logs where action='f1r2_assignment_cancelled' and record_id=(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Atomic cancellation project'))),1,'project cancellation emits one linked assignment-cancellation audit event');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='Terminal container project'),'title','Closed assignment milestone','owner_id',pg_temp.f2_uuid(17)))$$,'closed milestone begins pending');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='Terminal container project'),'title','Cancelled assignment milestone','owner_id',pg_temp.f2_uuid(17)))$$,'cancelled milestone begins pending');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='Terminal container project'),'title','Terminal task container'))$$,'terminal task container milestone is created');
set local session_replication_role=replica;
update public.milestones set status='closed',updated_by=pg_temp.f2_uuid(11) where title='Closed assignment milestone';
update public.milestones set status='cancelled',updated_by=pg_temp.f2_uuid(11) where title='Cancelled assignment milestone';
set local session_replication_role=origin;
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'milestone',(select id from public.milestones where title='Closed assignment milestone'),pg_temp.f2_uuid(14),'terminal assignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','closed milestone rejects assignment');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(17),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='Closed assignment milestone')),'accepted',null)$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','closed milestone rejects response');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'milestone',(select id from public.milestones where title='Cancelled assignment milestone'),pg_temp.f2_uuid(14),'terminal assignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','cancelled milestone rejects assignment');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(17),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='Cancelled assignment milestone')),'declined','terminal')$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','cancelled milestone rejects response');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'task',jsonb_build_object('project_id',(select id from public.projects where title='Terminal container project'),'milestone_id',(select id from public.milestones where title='Terminal task container'),'title','Closed assignment task','assigned_to',pg_temp.f2_uuid(14)))$$,'closed task begins pending');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'task',jsonb_build_object('project_id',(select id from public.projects where title='Terminal container project'),'milestone_id',(select id from public.milestones where title='Terminal task container'),'title','Cancelled assignment task','assigned_to',pg_temp.f2_uuid(14)))$$,'cancelled task begins pending');
set local session_replication_role=replica;
update public.tasks set status='closed',updated_by=pg_temp.f2_uuid(11) where title='Closed assignment task';
update public.tasks set status='cancelled',updated_by=pg_temp.f2_uuid(11) where title='Cancelled assignment task';
update public.work_item_assignments set status='legacy_unverified' where item_type='task' and item_id=(select id from public.tasks where title='Closed assignment task');
set local session_replication_role=origin;
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'task',(select id from public.tasks where title='Closed assignment task'),pg_temp.f2_uuid(13),'terminal assignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','closed task rejects assignment');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Closed assignment task')),'accepted',null)$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','terminal legacy-unverified task cannot fabricate acknowledgement');
select throws_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'task',(select id from public.tasks where title='Cancelled assignment task'),pg_temp.f2_uuid(13),'terminal assignment')$$,'F1R2_TERMINAL_WORK_ITEM_ASSIGNMENT_DENIED','cancelled task rejects assignment');
select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Cancelled assignment task')),'declined','terminal')$$,'F1R2_TERMINAL_WORK_ITEM_RESPONSE_DENIED','cancelled task rejects response');

select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Cancelled assignment project'),'draft',0,null)$$,'governed reopen moves the cancelled project out of terminal state');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Cancelled assignment project'),pg_temp.f2_uuid(13),'post-reopen assignment')$$,'assignment succeeds only after governed reopen');
select is((select status from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Cancelled assignment project') order by assigned_at desc,id desc limit 1),'pending','post-reopen assignment is a new pending proposal');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','M1','owner_id',pg_temp.f2_uuid(12),'start_date','2026-08-15','due_date','2026-08-25','evidence_required',true))$$,'M1 schedule creation succeeds');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','M2','owner_id',pg_temp.f2_uuid(12),'start_date','2026-08-16','due_date','2026-08-26','evidence_required',true))$$,'M2 schedule creation succeeds');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'title','Bad dates','owner_id',pg_temp.f2_uuid(12),'start_date','2026-08-20','due_date','2026-08-19'))$$,'F1R2_INVALID_DATE_ORDER','inverted milestone dates fail closed');
select is((select start_date::text from public.milestones where title='M1'),'2026-08-15','milestone start persists');
select is((select due_date::text from public.milestones where title='M2'),'2026-08-26','milestone due persists');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M1'),'title','T1','assigned_to',pg_temp.f2_uuid(12),'start_date','2026-08-15','due_date','2026-08-24','evidence_required',true))$$,'T1 schedule creation succeeds');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M2'),'title','T2','assigned_to',pg_temp.f2_uuid(12),'start_date','2026-08-16','due_date','2026-08-25','evidence_required',true))$$,'T2 schedule creation succeeds');
select is((select start_date::text from public.tasks where title='T1'),'2026-08-15','task start persists');
select is((select due_date::text from public.tasks where title='T2'),'2026-08-25','task due persists');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Task contract project','department_id',pg_temp.f2_uuid(21)))$$,'task contract fixture project is created');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Task contract project'),'active',5,null)$$,'generic project with no assignment retains established creator-controlled activation');
select is((select status::text from public.projects where title='Task contract project'),'active','generic unassigned project activates without fabricating an assignment');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='Task contract project'),'title','Task contract milestone'))$$,'task contract fixture milestone is created');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'task',jsonb_build_object('project_id',(select id from public.projects where title='Task contract project'),'milestone_id',(select id from public.milestones where title='Task contract milestone'),'title','Distinct owner and assignee','owner_id',pg_temp.f2_uuid(13),'assigned_to',pg_temp.f2_uuid(12)))$$,'task accepts distinct accountable owner and execution assignee');
select is((select owner_id from public.tasks where title='Distinct owner and assignee'),pg_temp.f2_uuid(13),'task accountable owner persists exactly');
select is((select assigned_to from public.tasks where title='Distinct owner and assignee'),null::uuid,'pending execution assignee is not live authority');
select is((select assignee_id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Distinct owner and assignee')),pg_temp.f2_uuid(12),'selected execution assignee persists exactly in the assignment ledger');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Distinct owner and assignee')),'accepted',null)$$,'execution assignee accepts distinct-owner task');
select is((select assigned_to from public.tasks where title='Distinct owner and assignee'),pg_temp.f2_uuid(12),'accepted execution assignee persists exactly');
select is((select owner_id from public.tasks where title='Distinct owner and assignee'),pg_temp.f2_uuid(13),'acceptance does not overwrite accountable owner');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(13),'task',(select id from public.tasks where title='Distinct owner and assignee'),'in_progress',10,null)$$,'F1R2_ASSIGNEE_IMPERSONATION_DENIED','accountable owner cannot impersonate a different accepted execution assignee');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Relationship project B','department_id',pg_temp.f2_uuid(21)))$$,'relationship fixture project B is created');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'milestone',jsonb_build_object('project_id',(select id from public.projects where title='Relationship project B'),'title','Milestone B'))$$,'relationship fixture milestone B is created');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='Milestone B'),'title','Wrong parent pair'))$$,'F1R2_TASK_MILESTONE_PROJECT_MISMATCH','task cannot combine Project A with Milestone B');
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',pg_temp.f2_uuid(999),'title','Unknown milestone parent'))$$,'F1R2_TASK_MILESTONE_PROJECT_MISMATCH','unknown milestone task parent is denied');
insert into public.projects(id,organization_id,title,category,source_type,status,priority,risk_level,created_by,updated_by) values(pg_temp.f2_uuid(400),pg_temp.f2_uuid(2),'Cross org project','test','manual','draft','medium','medium',pg_temp.f2_uuid(15),pg_temp.f2_uuid(15));
insert into public.milestones(id,organization_id,project_id,title,status,created_by,updated_by) values(pg_temp.f2_uuid(401),pg_temp.f2_uuid(2),pg_temp.f2_uuid(400),'Cross org milestone','not_started',pg_temp.f2_uuid(15),pg_temp.f2_uuid(15));
select throws_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',pg_temp.f2_uuid(401),'title','Cross org parent'))$$,'F1R2_TASK_MILESTONE_PROJECT_MISMATCH','cross-organization milestone task is denied');
select is((select count(*)::integer from public.f1r2_search_eligible_participants(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'task_owner','Bulk candidate',100)),55,'contextual participant search finds eligible candidates beyond the first fifty rows');
select is((select role_scope_label from public.f1r2_search_eligible_participants(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'task_owner','Approver P4',100) where id=pg_temp.f2_uuid(13)),'department_manager / department','participant labels omit unrelated cross-organization roles');
select throws_ok($$select public.f1r2_search_eligible_participants(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='T1'),'task_owner','',100)$$,'F1R2_PARTICIPANT_SEARCH_DENIED','unrelated employee cannot enumerate contextual candidates');

-- Actual authenticated-role RLS proof: an assignment relationship is never
-- sufficient without an active profile and active governed credential.
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(12));
set local role authenticated;
select is((select count(*)::integer from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='F2 Corrective project')),1,'active P3 can read the accepted project assignment');
select is((select count(*)::integer from public.projects where title='F2 Corrective project'),1,'active P3 can read the accepted project');
select is((select count(*)::integer from public.milestones where project_id=(select id from public.projects where title='F2 Corrective project')),2,'active P3 accepted project relationship exposes project milestones');
select is((select count(*)::integer from public.tasks where project_id=(select id from public.projects where title='F2 Corrective project')),2,'active P3 accepted project relationship exposes project tasks');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
set local session_replication_role=replica;
update public.profiles set is_active=false,user_status='inactive' where id=pg_temp.f2_uuid(12);
set local session_replication_role=origin;
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*)::integer from public.work_item_assignments where assignee_id=pg_temp.f2_uuid(12)),0,'deactivated P3 valid-JWT fixture cannot read assignment rows');
select is((select count(*)::integer from public.projects where title='F2 Corrective project'),0,'deactivated P3 valid-JWT fixture cannot read assigned project');
select is((select count(*)::integer from public.milestones where project_id=(select id from public.projects where title='F2 Corrective project')),0,'deactivated P3 valid-JWT fixture cannot read assigned milestones');
select is((select count(*)::integer from public.tasks where project_id=(select id from public.projects where title='F2 Corrective project')),0,'deactivated P3 valid-JWT fixture cannot read assigned tasks');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
set local session_replication_role=replica;
update public.profiles set is_active=true,user_status='active' where id=pg_temp.f2_uuid(12);
set local session_replication_role=origin;
update public.user_credential_states set credential_state='admin_reset_change_required' where user_id=pg_temp.f2_uuid(12);
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*)::integer from public.work_item_assignments where assignee_id=pg_temp.f2_uuid(12)),0,'non-active P3 credential valid-JWT fixture cannot read assignment rows');
select is((select count(*)::integer from public.projects where title='F2 Corrective project'),0,'non-active P3 credential valid-JWT fixture cannot read assigned project');
select is((select count(*)::integer from public.milestones),0,'non-active P3 credential valid-JWT fixture cannot read assigned milestones');
select is((select count(*)::integer from public.tasks),0,'non-active P3 credential valid-JWT fixture cannot read assigned tasks');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
update public.user_credential_states set credential_state='active' where user_id=pg_temp.f2_uuid(12);
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select is((select count(*)::integer from public.projects where title='F2 Corrective project'),1,'reactivated P3 fixture regains exact accepted project access');
reset role;
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(14));
set local role authenticated;
select is((select count(*)::integer from public.projects where title='F2 Corrective project'),0,'P5 has no assignment-derived access to the unrelated corrective project');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(12),'task',jsonb_build_object('project_id',(select id from public.projects where title='F2 Corrective project'),'milestone_id',(select id from public.milestones where title='M1'),'title','Privacy leaf','assigned_to',pg_temp.f2_uuid(14),'start_date','2026-08-17','due_date','2026-08-22','evidence_required',false))$$,'P5 privacy assignment fixture is created');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Privacy leaf')),'accepted',null)$$,'P5 accepts only its task');
select is((select count(*)::integer from public.f1r2_list_project_assignments(pg_temp.f2_uuid(14),(select id from public.projects where title='F2 Corrective project'))),2,'child-only assignee sees own row plus restricted project context, not sibling assignments');
select ok(not exists(select 1 from public.f1r2_list_project_assignments(pg_temp.f2_uuid(14),(select id from public.projects where title='F2 Corrective project')) where assignee_name='Owner P3'),'child-only assignee cannot see parent or sibling participant identity');
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(14));
set local role authenticated;
select is((select count(*)::integer from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Privacy leaf')),1,'real authenticated RLS exposes the exact P5 assignment row');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
select ok(position('f1r2_actor_can_manage_item' in (select pg_get_expr(polqual,polrelid) from pg_policy where polname='work_item_assignments_exact_read'))=0,'authenticated assignment RLS contains no service-only helper');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='Privacy leaf'),'cancelled',0,null)$$,'P5 can cancel only its accepted task through the governed status path');

select throws_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2')),'declined',null)$$,'F1R2_DECLINE_REASON_REQUIRED','decline requires a reason');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2')),'declined','Workload conflict')$$,'assignee declines with reason');
select is((select owner_id from public.milestones where title='M2'),null::uuid,'declined milestone retains no owner authority');
select is((select old_data->>'status' from public.audit_logs where action='f1r2_assignment_declined' and record_id=(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2') and status='declined')),'pending','pending to declined audit records the true old state');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M2'),pg_temp.f2_uuid(13),'controlled reassignment')$$,'authorized owner reassigns declined milestone to an eligible scoped manager');
select is((select status from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2') order by assigned_at,id limit 1),'superseded','declined history becomes superseded without deletion');
select lives_ok($$select public.f1r2_cancel_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='milestone' and item_id=(select id from public.milestones where title='M2') and status='pending'),'scope changed')$$,'authorized owner cancels pending assignment');
select is((select owner_id from public.milestones where title='M2'),null::uuid,'pending cancellation clears aligned owner');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M2'),pg_temp.f2_uuid(12),'return to owner')$$,'cancelled milestone can be assigned again');

select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'task',jsonb_build_object('project_id',(select id from public.projects where title='Task contract project'),'milestone_id',(select id from public.milestones where title='Task contract milestone'),'title','Declined task handoff','assigned_to',pg_temp.f2_uuid(14)))$$,'task decline fixture begins pending');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(14),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Declined task handoff')),'declined','Cannot perform task')$$,'task assignee declines');
select is((select assigned_to from public.tasks where title='Declined task handoff'),null::uuid,'declined task retains no execution assignee');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(14),'task',(select id from public.tasks where title='Declined task handoff'),'in_progress',10,null)$$,'F1R2_ASSIGNMENT_ACCEPTANCE_REQUIRED','declined task assignee loses execution authority');
select lives_ok($$select public.f1r2_assign_work_item(pg_temp.f2_uuid(11),'task',(select id from public.tasks where title='Declined task handoff'),pg_temp.f2_uuid(13),'safe task replacement')$$,'project controller reassigns declined task');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(13),(select id from public.work_item_assignments where item_type='task' and item_id=(select id from public.tasks where title='Declined task handoff') and status='pending'),'accepted',null)$$,'replacement task assignee accepts');
select is((select assigned_to from public.tasks where title='Declined task handoff'),pg_temp.f2_uuid(13),'accepted replacement becomes execution assignee');

insert into public.tasks(id,organization_id,project_id,title,owner_id,assigned_to,status,progress_percent,created_by,updated_by)
values(pg_temp.f2_uuid(410),pg_temp.f2_uuid(1),(select id from public.projects where title='Task contract project'),'Legacy acknowledgement fixture',pg_temp.f2_uuid(12),pg_temp.f2_uuid(12),'not_started',0,pg_temp.f2_uuid(12),pg_temp.f2_uuid(12));
insert into public.work_item_assignments(id,organization_id,item_type,item_id,project_id,milestone_id,task_id,assignee_id,assigned_by,status)
values(
  pg_temp.f2_uuid(411),pg_temp.f2_uuid(1),'task',pg_temp.f2_uuid(410),
  (select id from public.projects where title='Task contract project'),null,pg_temp.f2_uuid(410),
  pg_temp.f2_uuid(12),pg_temp.f2_uuid(12),'legacy_unverified'
);
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),pg_temp.f2_uuid(411),'accepted',null)$$,'legacy assignment can be explicitly acknowledged');
select is((select old_data->>'status' from public.audit_logs where action='f1r2_assignment_accepted' and record_id=pg_temp.f2_uuid(411)),'legacy_unverified','legacy acceptance audit records the true old state');

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
select ok((select required_for_closure from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where evidence_file_id=pg_temp.f2_uuid(100)),'project pack initially reflects the authoritative required-evidence flag');
update public.projects set evidence_required=false where title='F2 Corrective project';
select ok(not (select required_for_closure from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where evidence_file_id=pg_temp.f2_uuid(100)),'project pack recomputes a later parent requirement change instead of showing stale link metadata');
update public.projects set evidence_required=true where title='F2 Corrective project';
select ok((select required_for_closure from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project')) where evidence_file_id=pg_temp.f2_uuid(100)),'restored project requirement is immediately authoritative in the pack');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(13),pg_temp.f2_uuid(100),'view')$$,'exact approver can inspect project evidence');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(13),pg_temp.f2_uuid(104),'view')$$,'project approver can inspect descendant task evidence');
select throws_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(14),pg_temp.f2_uuid(100),'view')$$,'F1R2_EVIDENCE_ACCESS_DENIED','P5 cannot inspect evidence');
select is((select count(*)::integer from public.f1r2_get_evidence_pack(pg_temp.f2_uuid(10),'ovr',(select id from public.ovr_reports where logging_number='F2-OVR'))),1,'OVR reporter pack includes direct OVR evidence but not corrective hierarchy without project entitlement');
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'ovr',(select id from public.ovr_reports where logging_number='F2-OVR'))$$,'F1R2_EVIDENCE_PACK_DENIED','corrective project owner cannot infer source OVR evidence');

insert into public.evidence_files(id,organization_id,task_id,file_name,file_path,status,review_status,is_current_version,uploaded_by,reviewed_by,reviewed_at)
values(pg_temp.f2_uuid(107),pg_temp.f2_uuid(1),(select id from public.tasks where title='T1'),'relink.txt','f2/relink.txt','accepted','accepted',true,pg_temp.f2_uuid(12),pg_temp.f2_uuid(11),now());
select pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
select pg_temp.f2_set_jwt_actor(pg_temp.f2_uuid(12));
set local role authenticated;
select throws_like($$update public.evidence_files set task_id=(select id from public.tasks where title='T2'),updated_by=pg_temp.f2_uuid(12) where id=pg_temp.f2_uuid(107)$$,'%permission denied for table evidence_files%','browser-authorized uploader cannot directly rewrite an evidence parent');
reset role;
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$update public.evidence_files set task_id=(select id from public.tasks where title='T2'),updated_by=pg_temp.f2_uuid(11) where id=pg_temp.f2_uuid(107)$$,'F1R2_EVIDENCE_RELINK_ACTOR_CONTEXT_REQUIRED','service context cannot relink without protected authoritative actor context');
select lives_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(11),pg_temp.f2_uuid(107),'task',(select id from public.tasks where title='T2'),'Quality-corrected canonical work parent')$$,'verified P2 service action relinks P3 evidence');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true and is_primary=true),1,'relink leaves exactly one active canonical parent');
select ok((select linked_item_id=(select id from public.tasks where title='T2') from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true),'relink activates only the new task parent');
select ok(exists(select 1 from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and linked_item_id=(select id from public.tasks where title='T1') and is_active=false),'relink explicitly retires the old task parent');
select is((select count(*)::integer from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_relinked'),1,'one canonical relink emits exactly one audit event');
select is((select actor_id from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_relinked'),pg_temp.f2_uuid(11),'relink audit attributes the verified P2 actor rather than P3 uploader');
select ok((select old_data ? 'parent_id' and new_data ? 'parent_id' and not (new_data ? 'file_path') from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_relinked'),'relink audit contains parent facts without file path content');
select pg_catalog.set_config('f1r2.verified_evidence_actor_id',pg_temp.f2_uuid(11)::text,true);
select pg_catalog.set_config('f1r2.evidence_relink_reason','governed ambiguity regression',true);
update public.evidence_files set project_id=(select id from public.projects where title='F2 Corrective project'),updated_by=pg_temp.f2_uuid(11) where id=pg_temp.f2_uuid(107);
select pg_catalog.set_config('f1r2.verified_evidence_actor_id','',true);
select pg_catalog.set_config('f1r2.evidence_relink_reason','',true);
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true),0,'ambiguous source row fails closed with no active evidence link');
select ok(exists(select 1 from public.f1r2_evidence_link_reconciliation where evidence_file_id=pg_temp.f2_uuid(107)),'ambiguous evidence is queued for reconciliation');
select is((select count(*)::integer from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_link_reconciliation_required'),1,'ambiguous transition emits one reconciliation audit event');
select is((select actor_id from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_link_reconciliation_required'),pg_temp.f2_uuid(11),'governed ambiguous transition retains the verified P2 actor');
select lives_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(11),pg_temp.f2_uuid(107),'task',(select id from public.tasks where title='T2'),'Restore one authoritative parent after reconciliation')$$,'protected relink restores the canonical task parent');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(107) and is_active=true and linked_item_type='task'),1,'corrected evidence restores one canonical task link');
select is((select count(*)::integer from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_reconciliation_resolved'),1,'reconciliation resolution emits exactly one dedicated audit event');
select is((select actor_id from public.audit_logs where record_id=pg_temp.f2_uuid(107) and action='f1r2_evidence_reconciliation_resolved'),pg_temp.f2_uuid(11),'reconciliation audit records the verified governance actor');

-- Source and target mutation authority are independent.  Manager B may manage
-- its target but may not take evidence from Manager/Owner A's source.
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Relink source project A','department_id',pg_temp.f2_uuid(22),'owner_id',pg_temp.f2_uuid(12)))$$,'cross-source Project A is created');
select lives_ok($$select public.f1r2_respond_work_item_assignment(pg_temp.f2_uuid(12),(select id from public.work_item_assignments where item_type='project' and item_id=(select id from public.projects where title='Relink source project A')),'accepted',null)$$,'Project A owner accepts');
select lives_ok($$select public.f1r2_create_work_item(pg_temp.f2_uuid(11),'project',jsonb_build_object('title','Relink target project B','department_id',pg_temp.f2_uuid(21)))$$,'cross-source Project B is created');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(11),'project',(select id from public.projects where title='Relink target project B'),'active',0,null)$$,'Project B is activated');
insert into public.evidence_files(id,organization_id,project_id,file_name,file_path,status,review_status,is_current_version,uploaded_by)
values(pg_temp.f2_uuid(460),pg_temp.f2_uuid(1),(select id from public.projects where title='Relink source project A'),'cross-source.txt','f2r4/cross-source.txt','submitted','submitted',true,pg_temp.f2_uuid(12));
select throws_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(13),pg_temp.f2_uuid(460),'project',(select id from public.projects where title='Relink target project B'),'target-only manager attack')$$,'F1R2_EVIDENCE_RELINK_DENIED','target-only Manager B cannot take evidence from Project A');
select is((select project_id from public.evidence_files where id=pg_temp.f2_uuid(460)),(select id from public.projects where title='Relink source project A'),'denied cross-source relink leaves evidence parent unchanged');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(460) and linked_item_id=(select id from public.projects where title='Relink source project A') and is_active=true),1,'denied cross-source relink leaves source link active');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(460) and linked_item_id=(select id from public.projects where title='Relink target project B')),0,'denied cross-source relink creates no target link');
select is((select count(*)::integer from public.f1r2_evidence_link_reconciliation where evidence_file_id=pg_temp.f2_uuid(460)),0,'denied cross-source relink creates no reconciliation mutation');
select is((select count(*)::integer from public.audit_logs where record_id=pg_temp.f2_uuid(460) and action in('f1r2_evidence_relinked','f1r2_evidence_reconciliation_resolved')),0,'denied cross-source relink creates no relink audit event');
select lives_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(11),pg_temp.f2_uuid(460),'project',(select id from public.projects where title='Relink target project B'),'governance-authorized source and target correction')$$,'governance actor with source and target authority relinks A to B');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(460) and is_active=true and is_primary=true),1,'governed cross-source relink leaves one canonical active link');
select ok(exists(select 1 from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(460) and linked_item_id=(select id from public.projects where title='Relink source project A') and is_active=false),'governed cross-source relink retires Project A link');
select ok(exists(select 1 from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(460) and linked_item_id=(select id from public.projects where title='Relink target project B') and is_active=true),'governed cross-source relink activates Project B link');
select is((select actor_id from public.audit_logs where record_id=pg_temp.f2_uuid(460) and action='f1r2_evidence_relinked'),pg_temp.f2_uuid(11),'cross-source relink audit records Governance actor G');

-- An unlocked uploader satisfies source authority only; accepted target work
-- authority is independently required.
insert into public.evidence_files(id,organization_id,task_id,file_name,file_path,status,review_status,is_current_version,uploaded_by)
values(pg_temp.f2_uuid(461),pg_temp.f2_uuid(1),(select id from public.tasks where title='T1'),'uploader-relink.txt','f2r4/uploader-relink.txt','submitted','submitted',true,pg_temp.f2_uuid(12));
select lives_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(12),pg_temp.f2_uuid(461),'task',(select id from public.tasks where title='T2'),'uploader with accepted source and target assignments')$$,'uploader with independent accepted target authority may relink');
select is((select actor_id from public.audit_logs where record_id=pg_temp.f2_uuid(461) and action='f1r2_evidence_relinked'),pg_temp.f2_uuid(12),'uploader relink audit records the actual P3 actor');

-- Auditor and approver entitlements remain read-only for relink purposes.
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(18),pg_temp.f2_uuid(106),'view')$$,'auditor retains governed OVR evidence view');
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(18),pg_temp.f2_uuid(106),'download')$$,'auditor retains governed OVR evidence download');
select throws_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(18),pg_temp.f2_uuid(106),'project',(select id from public.projects where title='Relink target project B'),'auditor mutation attempt')$$,'F1R2_EVIDENCE_RELINK_DENIED','auditor-only actor cannot relink evidence');
select is((select ovr_report_id from public.evidence_files where id=pg_temp.f2_uuid(106)),(select id from public.ovr_reports where logging_number='F2-OVR'),'auditor denial leaves the OVR evidence parent unchanged');
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note)
values(pg_temp.f2_uuid(463),pg_temp.f2_uuid(1),(select id from public.projects where title='Relink target project B'),pg_temp.f2_uuid(11),pg_temp.f2_uuid(19),'pending','approver-only evidence fixture');
update public.user_roles set is_active=false where user_id=pg_temp.f2_uuid(19) and role='executive' and organization_id=pg_temp.f2_uuid(1);
select lives_ok($$select public.acc_v13_authorize_evidence_access(pg_temp.f2_uuid(19),pg_temp.f2_uuid(460),'view')$$,'approver-only actor retains read access to target evidence');
select throws_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(19),pg_temp.f2_uuid(460),'project',(select id from public.projects where title='Relink source project A'),'approver mutation attempt')$$,'F1R2_EVIDENCE_RELINK_DENIED','approver-only actor cannot relink evidence');
select is((select project_id from public.evidence_files where id=pg_temp.f2_uuid(460)),(select id from public.projects where title='Relink target project B'),'approver denial leaves the canonical target unchanged');

-- No-active-parent reconciliation requires a governance mutation role and a
-- reason; ordinary target management is insufficient.
insert into public.evidence_files(id,organization_id,project_id,file_name,file_path,status,review_status,is_current_version,uploaded_by)
values(pg_temp.f2_uuid(462),pg_temp.f2_uuid(1),(select id from public.projects where title='Relink target project B'),'reconciliation.txt','f2r4/reconciliation.txt','submitted','submitted',true,pg_temp.f2_uuid(13));
select pg_catalog.set_config('f1r2.verified_evidence_actor_id',pg_temp.f2_uuid(11)::text,true);
select pg_catalog.set_config('f1r2.evidence_relink_reason','create governed ambiguous fixture',true);
update public.evidence_files set task_id=(select id from public.tasks where title='T2'),updated_by=pg_temp.f2_uuid(11) where id=pg_temp.f2_uuid(462);
select pg_catalog.set_config('f1r2.verified_evidence_actor_id','',true);
select pg_catalog.set_config('f1r2.evidence_relink_reason','',true);
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(462) and is_active=true),0,'ambiguous fixture has no active canonical parent');
select throws_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(13),pg_temp.f2_uuid(462),'project',(select id from public.projects where title='Relink target project B'),'ordinary manager reconciliation attempt')$$,'F1R2_EVIDENCE_RECONCILIATION_DENIED','ordinary project manager cannot resolve evidence reconciliation');
select is((select num_nonnulls(project_id,milestone_id,task_id,ovr_report_id,audit_finding_id,risk_id,compliance_item_id) from public.evidence_files where id=pg_temp.f2_uuid(462)),2,'denied reconciliation leaves evidence parent columns unchanged');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(462) and is_active=true),0,'denied reconciliation leaves active-link count unchanged');
select is((select count(*)::integer from public.f1r2_evidence_link_reconciliation where evidence_file_id=pg_temp.f2_uuid(462)),1,'denied reconciliation preserves the existing queue row');
select is((select count(*)::integer from public.audit_logs where record_id=pg_temp.f2_uuid(462) and action='f1r2_evidence_reconciliation_resolved'),0,'denied reconciliation creates no resolution audit');
select lives_ok($$select public.f1r2_relink_evidence_parent(pg_temp.f2_uuid(11),pg_temp.f2_uuid(462),'project',(select id from public.projects where title='Relink target project B'),'governance reconciliation with verified reason')$$,'governance administrator resolves ambiguous evidence');
select is((select count(*)::integer from public.evidence_links where evidence_file_id=pg_temp.f2_uuid(462) and is_active=true and is_primary=true),1,'governance reconciliation restores exactly one canonical link');
select is((select count(*)::integer from public.audit_logs where record_id=pg_temp.f2_uuid(462) and action='f1r2_evidence_reconciliation_resolved'),1,'governance reconciliation writes exactly one resolution audit');
select is((select actor_id from public.audit_logs where record_id=pg_temp.f2_uuid(462) and action='f1r2_evidence_reconciliation_resolved'),pg_temp.f2_uuid(11),'reconciliation resolution audit records the verified Governance actor');

insert into public.risks(id,organization_id,title,created_by,updated_by)
values(pg_temp.f2_uuid(420),pg_temp.f2_uuid(1),'Requirement flag risk',pg_temp.f2_uuid(11),pg_temp.f2_uuid(11));
insert into public.compliance_items(id,organization_id,title,created_by,updated_by)
values(pg_temp.f2_uuid(421),pg_temp.f2_uuid(1),'Requirement flag compliance',pg_temp.f2_uuid(11),pg_temp.f2_uuid(11));
insert into public.audit_findings(id,organization_id,title,description,created_by,updated_by)
values(pg_temp.f2_uuid(422),pg_temp.f2_uuid(1),'Requirement flag audit finding','Disposable requirement flag fixture',pg_temp.f2_uuid(11),pg_temp.f2_uuid(11));
insert into public.evidence_requirements(id,organization_id,requirement_code,linked_item_type,linked_item_id,requirement_title,required_for_gate,gate_status,is_active,created_by) values
  (pg_temp.f2_uuid(423),pg_temp.f2_uuid(1),'F2-RISK-CLOSE','risk',pg_temp.f2_uuid(420),'Risk closure evidence','closure','pending',true,pg_temp.f2_uuid(11)),
  (pg_temp.f2_uuid(424),pg_temp.f2_uuid(1),'F2-COMP-APPROVE','compliance',pg_temp.f2_uuid(421),'Compliance approval evidence','approval','pending',true,pg_temp.f2_uuid(11)),
  (pg_temp.f2_uuid(425),pg_temp.f2_uuid(1),'F2-AUDIT-CLOSE','audit_finding',pg_temp.f2_uuid(422),'Audit closure evidence','closure','pending',true,pg_temp.f2_uuid(11)),
  (pg_temp.f2_uuid(426),pg_temp.f2_uuid(1),'F2-AUDIT-APPROVE','audit_finding',pg_temp.f2_uuid(422),'Audit approval evidence','approval','pending',true,pg_temp.f2_uuid(11));
select ok((select required_for_closure from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'))),'project requirement flags use the shared projection');
select ok((select required_for_closure from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'milestone',(select id from public.milestones where title='M1'))),'milestone requirement flags use the shared projection');
select ok((select required_for_closure from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'task',(select id from public.tasks where title='T1'))),'task requirement flags use the shared projection');
select ok((select required_for_closure from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'ovr',(select id from public.ovr_reports where logging_number='F2-OVR'))),'OVR requirement flags use the shared projection');
select ok((select required_for_closure and not required_for_approval from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'risk',pg_temp.f2_uuid(420))),'risk requirement flags use the shared projection');
select ok((select not required_for_closure and required_for_approval from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'compliance',pg_temp.f2_uuid(421))),'compliance requirement flags use the shared projection');
select ok((select required_for_closure and required_for_approval from public.f1r2_evidence_requirement_flags(pg_temp.f2_uuid(1),'audit_finding',pg_temp.f2_uuid(422))),'audit-finding requirement flags use the shared projection');

insert into public.evidence_requirements(id,organization_id,requirement_code,linked_item_type,linked_item_id,requirement_title,required_for_gate,gate_status,is_active,created_by)
values(pg_temp.f2_uuid(108),pg_temp.f2_uuid(1),'F2-REQ','project',(select id from public.projects where title='F2 Corrective project'),'Exact closure evidence requirement','closure','pending',true,pg_temp.f2_uuid(11));
select ok(not public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),true),'active unsatisfied evidence requirement blocks closure despite accepted files');
update public.evidence_requirements set gate_status='satisfied' where id=pg_temp.f2_uuid(108);
select ok(public.f1r2_item_evidence_satisfied(pg_temp.f2_uuid(1),'project',(select id from public.projects where title='F2 Corrective project'),true),'satisfied active evidence requirement permits the exact item gate');
select pg_catalog.set_config('request.jwt.claim.role','anon',true);
select throws_ok($$select public.f1r2_get_evidence_pack(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'))$$,'F1R2_SERVICE_ROLE_REQUIRED','anonymous callers cannot execute the protected pack');
select pg_catalog.set_config('request.jwt.claim.role','service_role',true);

select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='Distinct owner and assignee'),'closed',100,null)$$,'accepted execution assignee closes distinct-owner task');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(13),'task',(select id from public.tasks where title='Declined task handoff'),'closed',100,null)$$,'accepted replacement closes reassigned task');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',pg_temp.f2_uuid(410),'closed',100,null)$$,'acknowledged legacy assignee closes legacy task');
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
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at,decided_at)
values(pg_temp.f2_uuid(440),pg_temp.f2_uuid(1),(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),pg_temp.f2_uuid(13),'rejected','post-dispute rejected gate',statement_timestamp()+interval '1 hour',statement_timestamp()+interval '1 hour 1 minute');
select throws_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'quality_final_review',jsonb_build_object('final_verdict','Unsafe bypass attempt','quality_manager_comments','Should not persist','confirmed_severity_level','level_1'))$$,'F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET','legacy revised-verdict route cannot bypass the current corrective gates');
select throws_ok($$select public.f1r2_finalize_corrective_ovr(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'Corrective actions reverified','level_1','Quality review repeated','f2-final-2-denied')$$,'F1R2_OVR_CLOSURE_PREREQUISITES_NOT_MET','revised guarded Quality verdict is denied after a newer rejected approval');
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at,decided_at)
values(pg_temp.f2_uuid(441),pg_temp.f2_uuid(1),(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),pg_temp.f2_uuid(13),'approved','post-dispute restored gate',statement_timestamp()+interval '2 hours',statement_timestamp()+interval '2 hours 1 minute');
select lives_ok($$select public.f1r2_finalize_corrective_ovr(pg_temp.f2_uuid(11),(select id from public.ovr_reports where logging_number='F2-OVR'),'Corrective actions reverified','level_1','Quality review repeated','f2-final-2')$$,'restored prerequisites permit the guarded revised Quality verdict');
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at,decided_at)
values(pg_temp.f2_uuid(442),pg_temp.f2_uuid(1),(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),pg_temp.f2_uuid(13),'rejected','post-verdict reporter gate rejection',statement_timestamp()+interval '3 hours',statement_timestamp()+interval '3 hours 1 minute');
select throws_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(10),(select id from public.ovr_reports where logging_number='F2-OVR'),'closed','{}'::jsonb)$$,'V98_OVR_ACCEPTED_EVIDENCE_OR_CLOSED_ACTION_REQUIRED','reporter acceptance rechecks and denies a newly invalidated current gate');
insert into public.approvals(id,organization_id,project_id,requested_by,approver_id,status,request_note,requested_at,decided_at)
values(pg_temp.f2_uuid(443),pg_temp.f2_uuid(1),(select id from public.projects where title='F2 Corrective project'),pg_temp.f2_uuid(12),pg_temp.f2_uuid(13),'approved','post-verdict reporter gate restored',statement_timestamp()+interval '4 hours',statement_timestamp()+interval '4 hours 1 minute');
select lives_ok($$select public.v98_update_ovr_workflow(pg_temp.f2_uuid(10),(select id from public.ovr_reports where logging_number='F2-OVR'),'closed','{}'::jsonb)$$,'original reporter accepts and closes the revised verdict');
select is((select status::text from public.ovr_reports where logging_number='F2-OVR'),'closed','OVR closes only after reporter acceptance');
select ok((select reporter_response='accepted' and closed_at is not null and closed_by=pg_temp.f2_uuid(10) from public.ovr_reports where logging_number='F2-OVR'),'reporter-only closure facts persist');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.ovr_reports where logging_number='F2-OVR') and action='f1r2_ovr_final_verdict'),2,'initial and revised guarded Quality verdicts each emit exactly one audit event');

select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'in_progress',90,null)$$,'F1R2_CLOSED_PROJECT_CHILD_MUTATION_DENIED','closed project blocks child task reopening');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M1'),'in_progress',100,null)$$,'F1R2_CLOSED_PROJECT_CHILD_MUTATION_DENIED','closed project blocks milestone reopening');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'project',(select id from public.projects where title='F2 Corrective project'),'active',100,null)$$,'authorized controller reopens the project first');
select throws_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'in_progress',90,null)$$,'F1R2_CLOSED_MILESTONE_TASK_MUTATION_DENIED','closed milestone still blocks its child after project reopen');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'milestone',(select id from public.milestones where title='M1'),'in_progress',100,null)$$,'authorized controller reopens the milestone second');
select lives_ok($$select public.acc_v13_update_work_item_status(pg_temp.f2_uuid(12),'task',(select id from public.tasks where title='T1'),'in_progress',90,null)$$,'accepted execution assignee reopens the task last');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.projects where title='F2 Corrective project') and action='f1r2_project_reopened'),1,'project reopen is audited once');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.milestones where title='M1') and action='f1r2_milestone_reopened'),1,'milestone reopen is audited once');
select is((select count(*)::integer from public.audit_logs where record_id=(select id from public.tasks where title='T1') and action='f1r2_task_reopened'),1,'task reopen is audited once');

select * from finish();
rollback;
