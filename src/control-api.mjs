import { notesInventory } from "./control-notes.mjs";
import { mutate } from "./control-write.mjs";
import { controlView, transport, readRecords, inventory, registry, validId } from './control-github.mjs';
import { deriveProject, handoff } from './control-plane.mjs';
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function controlApi(request, token, {allowWrites=true}={}) {
  const url=new URL(request.url), gh=transport(token);
  if (request.method==='POST' && url.pathname==='/api/control/actions') {
    if(!allowWrites)return response({error:'Preview control writes are disabled. Use the authenticated production dashboard.'},403);
    if(!token)return response({error:'GitHub write token required'},503);
    if(request.headers.get('Origin')!==url.origin)return response({error:'Same-origin dashboard request required'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return response({error:'JSON request required'},415);
    const text=await request.text();if(text.length>100000)return response({error:'Request too large'},413);
    let body;try {body=JSON.parse(text);}catch{return response({error:'Invalid JSON'},400);}
    try {return response(await mutate(gh,body,request.headers.get('Cf-Access-Authenticated-User-Email') || 'dashboard user'));}catch(e){return response({error:e.message},e.status || 500);}
  }
  if(request.method!=='GET')return response({error:'Unsupported request'},405);
  if(url.pathname==='/api/control') {
    const records=await registry(gh);
    const snapshots=await readRecords(gh,'control-data/snapshots','control');
    const projects=records.projects.map(p=>{
      const saved=snapshots.find(s=>s.id===p.id);
      const state=saved?{...saved.inventory,stale:true}:{complete:false,error:'Repository refresh not requested',branches:[],prs:[]};
      return deriveProject(p,records.assignments,records.agents,state);
    });
    const data={projects,agents:records.agents,assignments:projects.flatMap(p=>p.assignments),attention:projects.flatMap(p=>p.attention),refreshed_at:new Date().toISOString(),zero_ai:true};
    return response(data);
  }
  const match=url.pathname.match(/^\/api\/control\/projects\/([a-z0-9._-]+)\/(refresh|handoff|notes)$/);
  if(match && validId(match[1])) {
    const records=await registry(gh), project=records.projects.find(p=>p.id===match[1]);
    if(!project)return response({error:'Project not found'},404);
    if(match[2]==='notes')return response(await notesInventory(gh,project));
    if(match[2]==='refresh')return response(deriveProject(project,records.assignments,records.agents,await inventory(gh,project)));
    const assignment=records.assignments.find(a=>a.id===url.searchParams.get('assignment') && a.project===project.id);
    return response({text:handoff(project,assignment)});
  }
  if(url.pathname==='/api/control/infrastructure')return response(await readRecords(gh,'control-data/infrastructure','control'));
  if(url.pathname==='/api/control/digests')return response(await readRecords(gh,'control-data/digests','control'));
  if(url.pathname==='/api/control/trackers')return response(await readRecords(gh,'control-data/trackers','control'));
  if(url.pathname==='/api/control/events')return response(await readRecords(gh,'control-data/events','control'));
  return response({error:'Not found'},404);
}
