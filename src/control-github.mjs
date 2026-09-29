import { deriveProject } from './control-plane.mjs';
const ROOT='lrnolivia/loew-runner';
export const validId = value => /^[a-z0-9][a-z0-9._-]{0,100}$/.test(value || '');
export function transport(token, fetcher=fetch) {
  return async function request(route, options={}) {
    const response=await fetcher(`https://api.github.com${route}`, {...options, headers:{Accept:'application/vnd.github+json','User-Agent':'loew-runner-control','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:`Bearer ${token}`} : {}),...(options.headers || {})}});
    const raw=await response.text(); let data; try {data=raw?JSON.parse(raw):null;} catch {data=null;}
    if (!response.ok) throw Object.assign(new Error(data?.message || `GitHub ${response.status}`),{status:response.status, retry_after:response.headers.get('retry-after')});
    return data;
  };
}
export async function pages(request, route) {
  const result=[];
  for(let page=1;page<=100;page++) {
    const batch=await request(`${route}${route.includes('?')?'&':'?'}per_page=100&page=${page}`);
    if(!Array.isArray(batch)) throw new Error('Invalid GitHub list response');
    result.push(...batch); if(batch.length<100) return result;
  }
  throw new Error('GitHub inventory exceeded pagination limit');
}
export const encodePath = path => path.split('/').map(encodeURIComponent).join('/');
export function decode(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0))); }
export function encode(content) {const bytes=new TextEncoder().encode(content);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export async function readFile(request, file, ref='main', repo=ROOT) {
  const data=await request(`/repos/${repo}/contents/${encodePath(file)}?ref=${encodeURIComponent(ref)}`);
  return {sha:data.sha,text:decode(data.content)};
}
export async function readRecords(request, folder, ref='main') {
  let entries;try {entries=await request(`/repos/${ROOT}/contents/${encodePath(folder)}?ref=${encodeURIComponent(ref)}`);} catch(e) {if(e.status===404)return [];throw e;}
  if(!Array.isArray(entries))throw new Error(`${folder} is not a directory`);
  const records=[];
  for (const entry of entries.filter(e=>e.type==='file' && e.name.endsWith('.json'))) {
    const file=await readFile(request,entry.path,ref);records.push({...JSON.parse(file.text),_sha:file.sha,_path:entry.path});
  }
  return records;
}
export async function registry(request, {controlRef="control"}={}) {
  const [baseProjects,baseAssignments,overrideProjects,overrideAssignments,agents]=await Promise.all([
    readRecords(request,'projects'),readRecords(request,'assignments'),readRecords(request,'control-data/projects',controlRef),readRecords(request,'control-data/assignments',controlRef),readRecords(request,'control-data/agents',controlRef)
  ]);
  const merge=(base,overlay)=>[...new Map([...base,...overlay].map(v=>[v.id,v])).values()];
  return {projects:merge(baseProjects,overrideProjects),assignments:merge(baseAssignments,overrideAssignments),agents};
}
export async function inventory(request, project) {
  const route=`/repos/${project.repository}`;
  try {
    const metadata=await request(route);
    const main=await request(`${route}/commits/${encodeURIComponent(project.default_branch || metadata.default_branch)}`);
    const [branches,prs]=await Promise.all([pages(request,`${route}/branches`),pages(request,`${route}/pulls?state=open`)]);
    const enriched=[];
    for(const b of branches) {
      const c=await request(`${route}/compare/${main.sha}...${b.commit.sha}`);
      enriched.push({name:b.name,sha:b.commit.sha,protected:b.protected,ahead:c.ahead_by,behind:c.behind_by,changed_files:(c.files || []).map(f=>f.filename)});
    }
    const pulls=[];
    for(const p of prs) {
      const files=await pages(request,`${route}/pulls/${p.number}/files`);
      if(files.length!==p.changed_files && p.changed_files!=null)throw new Error(`Incomplete file list for PR ${p.number}`);
      pulls.push({number:p.number,title:p.title,head:p.head.ref,sha:p.head.sha,base:p.base.ref,url:p.html_url,updated_at:p.updated_at,draft:p.draft,changed_files:files.map(f=>f.filename)});
    }
    return {complete:true,main_sha:main.sha,default_branch:metadata.default_branch,branches:enriched,prs:pulls,refreshed_at:new Date().toISOString()};
  } catch(e) {return {complete:false,error:e.message,branches:[],prs:[],refreshed_at:new Date().toISOString()};}
}
export async function controlView(request, {includeInventory=true}={}) {
  const records=await registry(request);
  const projects=[];
  for(const p of records.projects) projects.push(deriveProject(p,records.assignments,records.agents,includeInventory?await inventory(request,p):{complete:false,error:'Repository refresh not requested',branches:[],prs:[]}));
  return {projects,agents:records.agents,assignments:projects.flatMap(p=>p.assignments),attention:projects.flatMap(p=>p.attention),refreshed_at:new Date().toISOString(),zero_ai:true};
}
