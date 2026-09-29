import { readFile, encodePath } from './control-github.mjs';
import { statusOf } from './control-plane.mjs';
export async function notesInventory(gh, project) {
  const main=await gh(`/repos/${project.repository}/commits/${encodeURIComponent(project.default_branch || 'main')}`);
  const tree=await gh(`/repos/${project.repository}/git/trees/${main.commit.tree.sha}?recursive=1`);
  if(tree.truncated)throw new Error('Source inventory truncated; reconciliation cannot claim completeness');
  const configured=project.notes_sources || ['WORKER_CONTEXT.md','NOTES.md','docs/STATE.md','reports/'];
  const sources=tree.tree.filter(v=>v.type==='blob' && configured.some(p=>p.endsWith('/')?v.path.startsWith(p):v.path===p)).map(v=>({path:v.path,sha:v.sha,canonical:(project.canonical_notes_sources || ['docs/STATE.md']).includes(v.path),status:'needs-review'}));
  const byHash=new Map();for(const s of sources){const list=byHash.get(s.sha)||[];list.push(s);byHash.set(s.sha,list);}
  const duplicates=[];
  for(const group of byHash.values())if(group.length>1) {
    const canonical=group.find(s=>s.canonical) || [...group].sort((a,b)=>a.path.localeCompare(b.path))[0];
    for(const s of group)if(s!==canonical){s.status='exact-duplicate';s.superseded_by=canonical.path;duplicates.push(s);}
  }
  return {project:project.id,repository:project.repository,head_sha:main.sha,sources,duplicates,missing:configured.filter(p=>!sources.some(s=>p.endsWith('/')?s.path.startsWith(p):s.path===p)),needs_review:sources.filter(s=>s.status==='needs-review' && !s.canonical),refreshed_at:new Date().toISOString(),complete:true};
}
export function digest(project, assignments, agents, snapshot) {
  const active=assignments.filter(a=>a.project===project.id && !['COMPLETE','ARCHIVED','SUPERSEDED'].includes(statusOf(a.status)));
  const team=agents.filter(a=>a.project===project.id);
  return {id:project.id,at:new Date().toISOString(),stage:project.stage || 'not recorded',milestone:project.milestone || 'not recorded',agents:team.map(a=>({id:a.id,mission:a.mission,domain:a.domain})),assignments:active.map(a=>({id:a.id,status:statusOf(a.status),owner:a.owner_agent || 'unassigned',branch:a.branch || null,pr:a.pr || null,blocker:a.blocker || null,next_action:a.next_action || 'not recorded',acceptance_criteria:a.acceptance_criteria || []})),repository_snapshot:snapshot || null,verification:'Structured registry plus dated repository evidence only. Prose reports are not interpreted.',unresolved:active.filter(a=>!a.owner_agent || ['BLOCKED','HUMAN_QA'].includes(statusOf(a.status))).map(a=>a.id)};
}
