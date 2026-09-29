import { controlView, transport, readRecords, inventory, registry, validId } from './control-github.mjs';
import { deriveProject, handoff } from './control-plane.mjs';
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function controlApi(request, token) {
  const url=new URL(request.url), gh=transport(token);
  if(request.method!=='GET')return response({error:'Read-only control plane; mutation tranche not enabled.'},405);
  if(url.pathname==='/api/control') {
    const data=await controlView(gh,{includeInventory:false});
    const snapshots=await readRecords(gh,'control-data/snapshots','control');
    data.projects=data.projects.map(p=>{
      const s=snapshots.find(s=>s.id===p.id);
      return s ? deriveProject(p,data.assignments,data.agents,{...s.inventory,stale:true}) : p;
    });
    data.attention=data.projects.flatMap(p=>p.attention);data.assignments=data.projects.flatMap(p=>p.assignments);
    return response(data);
  }
  const match=url.pathname.match(/^\/api\/control\/projects\/([a-z0-9._-]+)\/(refresh|handoff)$/);
  if(match && validId(match[1])) {
    const records=await registry(gh), project=records.projects.find(p=>p.id===match[1]);
    if(!project)return response({error:'Project not found'},404);
    if(match[2]==='refresh')return response(deriveProject(project,records.assignments,records.agents,await inventory(gh,project)));
    const assignment=records.assignments.find(a=>a.id===url.searchParams.get('assignment') && a.project===project.id);
    return response({text:handoff(project,assignment)});
  }
  if(url.pathname==='/api/control/events')return response(await readRecords(gh,'control-data/events','control'));
  return response({error:'Not found'},404);
}
