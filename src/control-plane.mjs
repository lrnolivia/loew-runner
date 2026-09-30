// Pure, runtime-independent project truth. No inference or provider scheduling.
export const ACTIVE = new Set(['READY','ACTIVE','WAITING_QA','DEFERRED','BLOCKED','HUMAN_QA']);
export const STATES = [...ACTIVE, 'COMPLETE','SUPERSEDED','ARCHIVED'];
export const statusOf = value => String(value || 'READY').toUpperCase().replaceAll('-', '_');
export function matches(file, pattern) {
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const expression = escaped.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${expression}${pattern.endsWith('/') ? '.*' : ''}$`).test(file);
}
const paths = (a, key) => a[key] || a.ownership?.[key] || [];
export function overlaps(assignments) {
  const active = assignments.filter(a => ACTIVE.has(statusOf(a.status)));
  const result = [];
  for (let i=0; i<active.length; i++) for (let j=i+1; j<active.length; j++) {
    const a=active[i], b=active[j];
    const af=a.changed_files || [], bf=b.changed_files || [];
    const collision=af.filter(f=>bf.includes(f));
    const protectedFiles=[...af.filter(f=>paths(b,'protected_paths').some(p=>matches(f,p))), ...bf.filter(f=>paths(a,'protected_paths').some(p=>matches(f,p)))];
    const prefix=p=>p.split('*')[0];
    const declared=paths(a,'owned_paths').filter(p=>paths(b,'owned_paths').some(q=>p===q || prefix(p).startsWith(prefix(q)) || prefix(q).startsWith(prefix(p))));
    const potential=[...af.filter(f=>paths(b,'owned_paths').some(p=>matches(f,p))), ...bf.filter(f=>paths(a,'owned_paths').some(p=>matches(f,p)))];
    const files=[...new Set([...collision,...protectedFiles,...declared,...potential])];
    if (!files.length) continue;
    const approved=collision.length && collision.every(f=>[a,b].every(x=>(x.overlap_approvals || []).some(v=>v.assignment===(x===a?b.id:a.id) && (v.paths || []).some(p=>matches(f,p)))));
    result.push({a:a.id,b:b.id,paths:files,severity:protectedFiles.length?'protected':collision.length?(approved?'approved':'collision'):'potential', evidence: collision.length ? 'changed files' : 'declared ownership'});
  }
  return result;
}
export function cleanupProof(branch, project, assignments, prs, inventoryComplete) {
  const reasons=[];
  if (!inventoryComplete) reasons.push('Inventory incomplete');
  if(project.reorganization?.preserve_active_workstreams?.includes('mobile-focus') && /mobile|focus/i.test(branch.name))reasons.push('Protected Mobile lane');
  if (branch.name===project.default_branch || branch.protected || (project.cleanup?.protected_branches || []).includes(branch.name) || (project.implementation?.excluded_branches || []).includes(branch.name)) reasons.push('Protected/default branch');
  if (prs.some(p=>p.head===branch.name)) reasons.push('Open pull request');
  if (assignments.some(a=>a.branch===branch.name && ACTIVE.has(statusOf(a.status)))) reasons.push('Active assignment');
  if (branch.ahead!==0) reasons.push(branch.ahead==null?'Unique commits not verified':'Unique commits remain');
  if (!branch.sha) reasons.push('Missing branch SHA');
  return {safe:reasons.length===0,reasons};
}
export function deriveProject(project, assignments, agents, inventory) {
  const work=assignments.filter(a=>a.project===project.id).map(a=>{
    const pr=inventory.prs.find(p=>p.number===a.pr || p.head===a.branch);
    const branch=inventory.branches.find(b=>b.name===a.branch);
    return {...a,status:statusOf(a.status),pr:a.pr || pr?.number,head_sha:pr?.sha || branch?.sha || a.head_sha, changed_files:pr?.changed_files || branch?.changed_files || [],qa:!a.qa ? 'NOT_RUN' : a.qa.head_sha!==(pr?.sha || branch?.sha || a.head_sha) ? 'STALE_RUN' : a.qa.classification || 'NOT_RUN'};
  });
  const team=agents.filter(a=>a.project===project.id);
  const overlap=overlaps(work), attention=[];
  const add=(severity,reason,source,action)=>attention.push({severity,reason,source,action,project:project.id});
  if (!inventory.complete) add('warning','Repository inventory unavailable or incomplete',inventory.error || 'GitHub','Refresh truth');
  for (const a of work.filter(a=>ACTIVE.has(a.status))) {
    if (!team.some(t=>t.id===a.owner_agent)) add('warning',`${a.id}: owner not registered`,a.id,'Assign an owner');
    if (!a.branch) add('warning',`${a.id}: branch not linked`,a.id,'Link branch');
    else if (inventory.complete && !inventory.branches.some(b=>b.name===a.branch)) add('error',`${a.id}: branch missing`,a.id,'Review assignment');
    if (a.qa==='STALE_RUN') add('warning',`${a.id}: QA belongs to an older SHA`,a.id,'Recheck exact SHA');
    if (['BLOCKED','HUMAN_QA','DEFERRED'].includes(a.status)) add(a.status==='BLOCKED'?'error':'warning',`${a.id}: ${a.status.toLowerCase()}`,a.blocker || a.next_action || a.id,'Review work');
  }
  if (overlap.length===0 && work.some(a=>ACTIVE.has(a.status) && !(a.owned_paths || []).length)) add('warning','Overlap coverage incomplete: owned paths not declared',project.id,'Declare assignment ownership');
  for (const edge of overlap) add(edge.severity==='approved'?'info':edge.severity==='potential'?'warning':'error',`${edge.a} overlaps ${edge.b}: ${edge.severity}`,edge.paths.join(', '),'Review overlap');
  const branches=inventory.branches.map(b=>({...b,assignment:work.find(a=>a.branch===b.name)?.id,cleanup:cleanupProof(b,project,work,inventory.prs,inventory.complete)}));
  for (const b of branches.filter(b=>b.name!==project.default_branch && !b.assignment)) add('warning',`${b.name}: no assignment`,b.name,b.cleanup.safe?'Review safe cleanup':'Account for unique work');
  for (const b of branches) {
    if(b.behind>(project.repo_policy?.stale_behind_threshold || 30))add('warning',`${b.name}: ${b.behind} commits behind main`,b.name,'Review freshness');
    const prefixes=project.implementation?.branch_prefixes || [];
    if(b.name!==project.default_branch && prefixes.length && !prefixes.some(p=>b.name.startsWith(p)) && !(project.implementation?.excluded_branches || []).includes(b.name))add('warning',`${b.name}: outside current implementation prefixes`,b.name,'Review naming; preserve unique work');
    if(b.files_complete===false)add('warning',`${b.name}: changed-file evidence exceeds compare limit`,b.name,'Use full PR/source evidence before overlap decisions');
  }
  for (const p of inventory.prs) if (!work.some(a=>a.pr===p.number || a.branch===p.head)) add('warning',`PR #${p.number}: no assignment`,p.title,'Link assignment');
  return {...project,assignments:work,agents:team,inventory:{...inventory,branches},overlap,attention,health:attention.some(a=>a.severity==='error')?'blocked':attention.some(a=>a.severity==='warning')?'attention':'healthy'};
}
export function handoff(project, assignment) {
  const a=assignment || {};
  return [`# ${a.id || project.id} — handoff`, `Project: ${project.name || project.id}`, `Repository: ${project.repository}`, `Owner: ${a.owner_agent || 'unassigned'}`, `Goal: ${a.goal || project.milestone || 'Review project state'}`, `Status: ${a.status || project.health}`, `Branch: ${a.branch || 'not linked'}`, `PR: ${a.pr || 'not linked'}`, `Exact head SHA: ${a.head_sha || project.inventory?.main_sha || 'unverified'}`, `Dependencies: ${(a.depends_on || []).join(', ') || 'none recorded'}`, `Owned paths: ${paths(a,'owned_paths').join(', ') || 'not declared'}`, `Protected paths: ${paths(a,'protected_paths').join(', ') || 'not declared'}`, 'Acceptance criteria:', ...(a.acceptance_criteria || []).map(v=>`- ${v}`), `QA: ${typeof a.qa==='object'?JSON.stringify(a.qa):a.qa || 'NOT_RUN'}`, `Validation: ${JSON.stringify(a.validation || project.validation || 'not recorded')}`, `Runtime QA criteria: ${JSON.stringify(a.runtime_qa || project.qa || 'not recorded')}`, `Plan/context: ${a.plan || 'AGENTS.md and docs/STATE.md'}`, `Blockers: ${a.blocker || 'none recorded'}`, `Next action: ${a.next_action || 'Refresh live truth and follow the active assignment.'}`, 'Read AGENTS.md and current Runner authority before execution. Preserve unrelated and protected work. Arbitrary chats cannot be awakened by this packet.'].join('\n');
}
