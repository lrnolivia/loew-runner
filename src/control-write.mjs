import { validId, encodePath, readFile, registry, inventory } from './control-github.mjs';
import { STATES, statusOf, ACTIVE, cleanupProof, deriveProject } from './control-plane.mjs';
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
  const records=await registry(gh,{controlRef:head});
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
  if(body.action==='freeze') {
    if(project._sha!==body.expected_revision)fail('Project changed; refresh before saving',409);
    if(typeof body.frozen!=='boolean')fail('Invalid freeze value');
    return atomicControlWrite(gh,head,[{path:`control-data/projects/${project.id}.json`,value:{...cleanRecord(project),frozen:body.frozen}}],event);
  }
  if(body.action==='refresh') {
    const state=await inventory(gh,project);
    if(!state.complete)fail(state.error || 'Incomplete inventory',503);
    return atomicControlWrite(gh,head,[{path:`control-data/snapshots/${project.id}.json`,value:{id:project.id,inventory:state}}],event);
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
    let outcome='deleted';try {await gh(`${target}/git/refs/heads/${encodePath(branch.name)}`,{method:'DELETE'});} catch(e) {outcome=`uncertain: ${e.message}`;}
    const after=await gh(`/repos/${ROOT}/git/ref/heads/control`);
    const result=await atomicControlWrite(gh,after.object.sha,[],{...event,branch:branch.name,outcome,intent:intent.event_id});
    if(outcome!=='deleted')return {...result,uncertain:true,error:outcome};
    return result;
  }
  fail('Unsupported control action');
}
