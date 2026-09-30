import { notesInventory, digest } from "./control-notes.mjs";
import { validId, encodePath, readFile, readRecords, registry, inventory } from './control-github.mjs';
import { STATES, statusOf, ACTIVE, cleanupProof, deriveProject, handoff, matches } from './control-plane.mjs';
const ROOT='lrnolivia/loew-runner';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function cleanRecord(value) {return Object.fromEntries(Object.entries(value).filter(([key])=>!key.startsWith('_') && !['changed_files','inventory','attention','health','overlap'].includes(key)));}
export function assignmentUpdate(old, patch, records) {
  const allowed=new Set(['goal','status','owner_agent','domain','tranche','branch','pr','next_action','blocker','depends_on','owned_paths','shared_paths','protected_paths','acceptance_criteria','overlap_approvals']);
  if(Object.keys(patch).some(k=>!allowed.has(k)))fail('Unsupported assignment field');
  const next={...cleanRecord(old),...patch,status:statusOf(patch.status || old.status),last_material_change:new Date().toISOString()};
  if(!STATES.includes(next.status))fail('Invalid assignment status');
  if(!validId(next.id) || !records.projects.some(p=>p.id===next.project))fail('Unknown project or invalid assignment ID');
  const project=records.projects.find(p=>p.id===next.project);
  if(project.frozen && ['READY','ACTIVE'].includes(next.status) && (old._new || statusOf(old.status)!=='ACTIVE'))fail('Project is frozen for new work',409);
  if(next.owner_agent && !records.agents.some(a=>a.id===next.owner_agent && a.project===next.project && a.status!=='retired'))fail('Owner must be a registered active agent in this project');
  for(const key of ['depends_on','owned_paths','shared_paths','protected_paths','acceptance_criteria'])if(next[key] && (!Array.isArray(next[key]) || next[key].some(v=>typeof v!=='string')))fail(`Invalid ${key}`);
  if(next.depends_on?.some(id=>id===next.id || !records.assignments.some(a=>a.id===id && a.project===next.project)))fail('Invalid dependency');
  const map=new Map(records.assignments.map(a=>[a.id,a.depends_on || []]));map.set(next.id,next.depends_on || []);
  function visit(id,trail=new Set()) {if(trail.has(id))fail('Assignment dependency cycle');const t=new Set(trail).add(id);for(const dep of map.get(id)||[])visit(dep,t);}visit(next.id);
  if(next.pr!=null && (!Number.isInteger(next.pr) || next.pr<1))fail('PR must be a positive integer');
  for(const key of ['goal','branch','next_action','blocker','domain','tranche'])if(next[key]!=null && (typeof next[key]!=='string' || next[key].length>12000))fail(`Invalid ${key}`);
  if(next.overlap_approvals && (!Array.isArray(next.overlap_approvals) || next.overlap_approvals.some(v=>!records.assignments.some(a=>a.id===v.assignment && a.project===next.project) || !Array.isArray(v.paths) || v.paths.some(p=>typeof p!=='string'))))fail('Invalid overlap approval');
  if(next.status==='COMPLETE' && statusOf(old.status)!=='COMPLETE')fail('Completion requires a verified promotion record; dashboard cannot manufacture it',409);
  return next;
}
export async function atomicControlWrite(gh, head, files, event) {
  const commit=await gh(`/repos/${ROOT}/git/commits/${head}`);
  const eventId=`${Date.now()}-${crypto.randomUUID()}`;
  const tree=await gh(`/repos/${ROOT}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:commit.tree.sha,tree:[...files,{path:`control-data/events/${eventId}.json`,value:{id:eventId,at:new Date().toISOString(),...event}}].map(f=>({path:f.path,mode:'100644',type:'blob',content:JSON.stringify(f.value,null,2)+'\n'}))})});
  const created=await gh(`/repos/${ROOT}/git/commits`,{method:'POST',body:JSON.stringify({message:`dashboard: ${event.type}`,tree:tree.sha,parents:[head]})});
  await gh(`/repos/${ROOT}/git/refs/heads/control`,{method:'PATCH',body:JSON.stringify({sha:created.sha,force:false})});
  const actual=await gh(`/repos/${ROOT}/git/ref/heads/control`);
  if(actual.object.sha!==created.sha)fail('Control head moved after write; refresh state before continuing',409);
  return {ok:true,control_sha:created.sha,event_id:eventId};
}
export async function mutate(gh, body, actor='dashboard user') {
  const control=await gh(`/repos/${ROOT}/git/ref/heads/control`), head=control.object.sha;
  // Control overlays pinned to the captured head; stale writes cannot overwrite newer ones.
  const main=await gh(`/repos/${ROOT}/git/ref/heads/main`);
  const records=await registry(gh,{controlRef:head,mainRef:main.object.sha});
  const project=records.projects.find(p=>p.id===body.project);if(!project)fail('Unknown project',404);
  const event={type:body.action,project:project.id,actor};
  if(body.action==='assignment') {
    if(!validId(body.id))fail('Invalid assignment ID');
    const old=records.assignments.find(a=>a.id===body.id);
    if(old && old.project!==project.id)fail('Assignment belongs to another project');
    if((old?old._sha:null)!==(body.expected_revision ?? null))fail('Assignment changed; refresh before saving',409);
    const next=assignmentUpdate(old || {id:body.id,project:project.id,status:'READY',_new:true},body.patch || {},records);
    return atomicControlWrite(gh,head,[{path:`control-data/assignments/${next.id}.json`,value:next}],{...event,assignment:next.id,before:old?cleanRecord(old):null,after:next});
  }
  if(body.action==='register-agent') {
    if(!validId(body.agent?.id) || !['pjm','master','worker','human'].includes(body.agent?.role))fail('Invalid agent registration');
    if(body.existing_thread_confirmed!==true)fail('Register an existing user-visible agent; this does not create a chat');
    const old=records.agents.find(a=>a.id===body.agent.id);
    if(old && (old.project!==project.id || old._sha!==body.expected_revision))fail('Agent changed or belongs to another project',409);
    const allowed=['id','name','role','mission','domain','reports_to','runtime','thread_url'];
    if(Object.keys(body.agent).some(k=>!allowed.includes(k)) || allowed.some(k=>body.agent[k]!=null && typeof body.agent[k]!=='string'))fail('Invalid agent fields');
    if(body.agent.reports_to && !records.agents.some(a=>a.id===body.agent.reports_to && a.project===project.id && a.id!==body.agent.id))fail('Reporting parent must exist in project');
    const next={...body.agent,project:project.id,status:'active',can_wake:false,registered_at:new Date().toISOString()};
    return atomicControlWrite(gh,head,[{path:`control-data/agents/${next.id}.json`,value:next}],{...event,agent:next.id});
  }
  if(body.action==='retire-agent') {
    const agent=records.agents.find(a=>a.id===body.agent && a.project===project.id);
    if(!agent || agent._sha!==body.expected_revision || body.confirm!==true)fail('Agent changed or retirement not confirmed',409);
    if(records.assignments.some(a=>a.project===project.id && a.owner_agent===agent.id && ACTIVE.has(statusOf(a.status))))fail('Reassign or archive active work before retiring this agent',409);
    return atomicControlWrite(gh,head,[{path:`control-data/agents/${agent.id}.json`,value:{...cleanRecord(agent),status:'retired',retired_at:new Date().toISOString()}}],event);
  }
  if(body.action==='approve-overlap') {
    const a=records.assignments.find(a=>a.id===body.a && a.project===project.id),b=records.assignments.find(a=>a.id===body.b && a.project===project.id);
    if(!a || !b || a.id===b.id || body.confirm!==true || a._sha!==body.a_revision || b._sha!==body.b_revision)fail('Assignments changed or approval not confirmed',409);
    if(!Array.isArray(body.paths) || !body.paths.length || body.paths.some(p=>typeof p!=='string' || p.includes('*') || [a,b].some(x=>(x.protected_paths || []).some(q=>matches(p,q)))))fail('Approval must name exact unprotected files');
    const inv=await inventory(gh,project);if(!inv.complete)fail('Fresh file evidence required',409);
    const files=x=>inv.prs.find(p=>p.number===x.pr || p.head===x.branch)?.changed_files || inv.branches.find(p=>p.name===x.branch)?.changed_files || [];
    if(body.paths.some(p=>!files(a).includes(p) || !files(b).includes(p)))fail('Approval paths are not current collisions in both assignments',409);
    const updates=[a,b].map(x=>({path:`control-data/assignments/${x.id}.json`,value:{...cleanRecord(x),overlap_approvals:[...(x.overlap_approvals || []).filter(v=>v.assignment!==(x.id===a.id?b.id:a.id)),{assignment:x.id===a.id?b.id:a.id,paths:body.paths,approved_by:actor,at:new Date().toISOString()}]}}));
    return atomicControlWrite(gh,head,updates,{...event,assignments:[a.id,b.id],paths:body.paths});
  }
  if(['create-branch','create-pr','close-pr','run-qa','human-qa'].includes(body.action)) {
    const a=records.assignments.find(a=>a.id===body.assignment && a.project===project.id);
    if(!a || a._sha!==body.expected_revision)fail('Assignment changed; refresh before acting',409);
    const target=`/repos/${project.repository}`, inv=await inventory(gh,project);if(!inv.complete)fail('Fresh complete repository evidence required',409);
    const branch=inv.branches.find(b=>b.name===a.branch),pr=inv.prs.find(p=>p.number===a.pr || p.head===a.branch);
    if(body.action==='human-qa') {
      const actual=pr?.sha || branch?.sha;
      if(!actual || actual!==body.expected_sha || !['PASS','FAIL_PRODUCT'].includes(body.verdict) || typeof body.criterion!=='string' || !body.criterion.trim() || typeof body.evidence!=='string' || !body.evidence.trim())fail('Human QA requires the current exact SHA, criterion and evidence');
      return atomicControlWrite(gh,head,[{path:`control-data/qa/${a.id}.json`,value:{id:a.id,project:project.id,head_sha:actual,classification:body.verdict,source:'human',criterion:body.criterion,evidence:body.evidence,actor,at:new Date().toISOString()}}],{...event,assignment:a.id,head_sha:actual});
    }
    if(body.action==='run-qa') {
      if(!branch || branch.sha!==body.expected_sha || !project.qa?.workflow)fail('Configure a deterministic QA workflow and refresh the exact assignment head',409);
      const intent=await atomicControlWrite(gh,head,[],{...event,type:'qa-request-intent',assignment:a.id,head_sha:branch.sha});
      await gh(`${target}/actions/workflows/${encodeURIComponent(project.qa.workflow)}/dispatches`,{method:'POST',body:JSON.stringify({ref:branch.name,inputs:{artifact_sha:branch.sha}})});
      await atomicControlWrite(gh,intent.control_sha,[],{...event,type:'qa-requested',assignment:a.id,head_sha:branch.sha,workflow:project.qa.workflow});
      return {ok:true,requested:true,head_sha:branch.sha,workflow:project.qa.workflow};
    }
    if(body.confirm!==true)fail('Review and confirm this repository action');
    if(body.action==='create-branch') {
      if(project.frozen || !a.owner_agent)fail('Unfreeze project and assign a registered owner before new repo work',409);
      const name=String(body.branch || '');
      if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,200}$/.test(name) || /\.\.|\/\/|\.lock(?:\/|$)|[./]$/.test(name))fail('Invalid branch name');
      const prefixes=project.implementation?.branch_prefixes || [];if(!prefixes.length || !prefixes.some(p=>name.startsWith(p)) || (project.implementation?.excluded_branches || []).includes(name))fail('Branch must match configured project implementation prefixes');
      if(inv.branches.some(b=>b.name===name) || a.branch)fail('Branch/assignment already linked; refresh and link existing work',409);
      const intent=await atomicControlWrite(gh,head,[],{...event,type:'branch-create-intent',assignment:a.id,branch:name,base_sha:inv.main_sha});
      await gh(`${target}/git/refs`,{method:'POST',body:JSON.stringify({ref:`refs/heads/${name}`,sha:inv.main_sha})});
      return atomicControlWrite(gh,intent.control_sha,[{path:`control-data/assignments/${a.id}.json`,value:{...cleanRecord(a),branch:name,base_sha:inv.main_sha}}],{...event,assignment:a.id,branch:name});
    }
    if(body.action==='create-pr') {
      if(!branch || branch.ahead<1 || pr)fail('A linked branch with unique work and no existing PR is required',409);
      const intent=await atomicControlWrite(gh,head,[],{...event,type:'pr-create-intent',assignment:a.id,branch:branch.name});
      const created=await gh(`${target}/pulls`,{method:'POST',body:JSON.stringify({title:String(a.goal || a.id).slice(0,240),head:branch.name,base:project.default_branch,draft:true,body:handoff(project,{...a,head_sha:branch.sha})})});
      return atomicControlWrite(gh,intent.control_sha,[{path:`control-data/assignments/${a.id}.json`,value:{...cleanRecord(a),pr:created.number}}],{...event,assignment:a.id,pr:created.number});
    }
    if(body.action==='close-pr') {
      if(statusOf(a.status)!=='SUPERSEDED' || !pr || !branch || branch.ahead!==0 || pr.sha!==body.expected_sha || (project.cleanup?.protected_branches || []).includes(branch.name) || /mobile|focus/i.test(branch.name))fail('Only explicitly superseded, unprotected PRs with no unique work may be closed',409);
      const intent=await atomicControlWrite(gh,head,[],{...event,type:'pr-close-intent',pr:pr.number,head_sha:pr.sha});
      await gh(`${target}/pulls/${pr.number}`,{method:'PATCH',body:JSON.stringify({state:'closed'})});
      const actual=await gh(`${target}/pulls/${pr.number}`);if(actual.state!=='closed')fail('PR close outcome unverified; inspect before retrying',409);
      await atomicControlWrite(gh,intent.control_sha,[],{...event,type:'pr-closed',pr:pr.number,head_sha:pr.sha});
      return {ok:true,pr:pr.number,state:'closed'};
    }
  }
  if(body.action==='freeze') {
    if(project._sha!==body.expected_revision)fail('Project changed; refresh before saving',409);
    if(typeof body.frozen!=='boolean')fail('Invalid freeze value');
    return atomicControlWrite(gh,head,[{path:`control-data/projects/${project.id}.json`,value:{id:project.id,frozen:body.frozen}}],event);
  }
  if(body.action==='refresh') {
    const state=await inventory(gh,project);
    if(!state.complete)fail(state.error || 'Incomplete inventory',503);
    return atomicControlWrite(gh,head,[{path:`control-data/snapshots/${project.id}.json`,value:{id:project.id,inventory:state}}],event);
  }
  if(body.action==='consolidate') {
    const snapshots=await readRecords(gh,'control-data/snapshots',head);
    const value=digest(project,records.assignments,records.agents,snapshots.find(s=>s.id===project.id)?.inventory);
    return {...await atomicControlWrite(gh,head,[{path:`control-data/digests/${project.id}.json`,value}],event),digest:value};
  }
  if(body.action==='reconcile') {
    const value={id:project.id,...await notesInventory(gh,project)};
    return {...await atomicControlWrite(gh,head,[{path:`control-data/trackers/${project.id}.json`,value}],event),inventory:value};
  }
  if(body.action==='archive-duplicates') {
    if(body.confirm!==true)fail('Review the proposed archive index first');
    const current=await notesInventory(gh,project);
    if(current.head_sha!==body.expected_sha)fail('Notes changed; reconcile again',409);
    // Archive duplicate references in the canonical index; original Git files remain recoverable.
    const active=records.assignments.filter(a=>a.project===project.id && ACTIVE.has(statusOf(a.status)));
    const safe=current.duplicates.filter(s=>!active.some(a=>(a.notes_sources || []).includes(s.path)));
    const value={id:project.id,head_sha:current.head_sha,archived_references:safe,original_files_preserved:true,at:new Date().toISOString()};
    return {...await atomicControlWrite(gh,head,[{path:`control-data/archives/${project.id}.json`,value}],event),archive:value};
  }
  if(body.action==='cleanup') {
    if(body.confirm!==true || !body.branch || !body.expected_sha || !body.expected_main)fail('Cleanup requires reviewed branch and exact SHAs');
    const inv=await inventory(gh,project), branch=inv.branches.find(b=>b.name===body.branch);
    if(!branch || !inv.complete || inv.main_sha!==body.expected_main || branch.sha!==body.expected_sha)fail('Repository changed; rebuild cleanup ledger',409);
    const proof=cleanupProof(branch,project,records.assignments.filter(a=>a.project===project.id),inv.prs,inv.complete);
    if(!proof.safe)fail(`Deletion blocked: ${proof.reasons.join('; ')}`,409);
    // Record durable intent before the non-idempotent external action. Never blindly retry.
    const intent=await atomicControlWrite(gh,head,[],{...event,type:'cleanup-intent',branch:branch.name,sha:branch.sha,main_sha:inv.main_sha});
    const target=`/repos/${project.repository}`;
    const [current,main,prs]=await Promise.all([gh(`${target}/git/ref/heads/${encodePath(branch.name)}`),gh(`${target}/commits/${encodeURIComponent(project.default_branch)}`),gh(`${target}/pulls?state=open&head=${encodeURIComponent(project.repository.split('/')[0]+':'+branch.name)}&per_page=100`)]);
    if(current.object.sha!==branch.sha || main.sha!==inv.main_sha || prs.length)fail('Repo moved after review; no deletion performed',409);
    let outcome='deleted';try {await gh(`${target}/git/refs/heads/${encodePath(branch.name)}`,{method:'DELETE'});try {await gh(`${target}/git/ref/heads/${encodePath(branch.name)}`);outcome='uncertain: branch remains after deletion';}catch(e){if(e.status!==404)throw e;}} catch(e) {outcome=`uncertain: ${e.message}`;}
    const after=await gh(`/repos/${ROOT}/git/ref/heads/control`);
    const result=await atomicControlWrite(gh,after.object.sha,[],{...event,branch:branch.name,outcome,intent:intent.event_id});
    if(outcome!=='deleted')return {...result,uncertain:true,error:outcome};
    return result;
  }
  fail('Unsupported control action');
}
