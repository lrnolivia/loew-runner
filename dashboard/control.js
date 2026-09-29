const root=document.querySelector('#control-section');
let data=null, section='home', selected=null, tab='overview', busy=false;
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const empty=text=>`<p class="control-empty">${esc(text)}</p>`;
const badge=v=>`<span class="control-status" data-state="${esc(v)}">${esc(v)}</span>`;
const table=(heads,rows)=>rows.length?`<div class="control-table-wrap"><table class="control-table"><thead><tr>${heads.map(v=>`<th scope="col">${esc(v)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('No records yet. Nothing has been inferred from old chat reports.');
async function api(url,options) {const r=await fetch(url,{...options,headers:{'Content-Type':'application/json'}});const b=await r.json();if(!r.ok)throw new Error(b.error || 'Request failed');return b;}
function projects() {return table(['project','stage / milestone','status','team','active work','repository truth'],data.projects.map(p=>[
  `<button class="control-link" data-project="${esc(p.id)}">${esc(p.name || p.id)}</button><small>${esc(p.repository)}</small>`,`${esc(p.stage || 'not recorded')}<small>${esc(p.milestone || 'not recorded')}</small>`,badge(p.health),p.agents.length,p.assignments.filter(a=>!['COMPLETE','ARCHIVED','SUPERSEDED'].includes(a.status)).length,p.inventory.complete?`${p.inventory.prs.length} PRs · ${p.inventory.branches.length} branches${p.inventory.stale?' · snapshot':''}`:'not refreshed'
]));}
function attention(items) {return table(['severity','what needs attention','next step'],items.map(a=>[badge(a.severity),`${esc(a.reason)}<small>${esc(a.source)}</small>`,esc(a.action)]));}
function work(items) {return table(['assignment','owner / domain','state','branch / PR','QA','next action'],items.map(a=>[
  `<details><summary>${esc(a.id)}</summary><p>${esc(a.goal)}</p><ul>${(a.acceptance_criteria || []).map(v=>`<li>${esc(v)}</li>`).join('')}</ul><button data-handoff="${esc(a.id)}" data-project-id="${esc(a.project)}">copy Codex handoff</button></details>`,`${esc(a.owner_agent || 'unassigned')}<small>${esc(a.domain || a.tranche || 'not declared')}</small>`,badge(a.status),`${esc(a.branch || 'not linked')}<small>${a.pr?'PR #'+esc(a.pr):'no PR linked'}</small>`,badge(a.qa),esc(a.next_action || 'not recorded')
]));}
function team(items) {return table(['agent','role / runtime','mission / domain','current assignment','reporting / wake'],items.map(a=>[esc(a.name || a.id),`${esc(a.role)}<small>${esc(a.runtime || 'external chat')}</small>`,`${esc(a.mission)}<small>${esc(a.domain)}</small>`,esc(a.current_assignment || 'unassigned'),`${esc(a.reports_to || 'not recorded')}<small>${a.can_wake?'supported automation':'manual handoff; cannot wake chat'}</small>`]));}
function projectView(p) {
  const tabs=['overview','work','team','map','repo','qa','notes','history'];
  let content='';
  if(tab==='overview')content=`<h3>needs attention</h3>${attention(p.attention)}<h3>active work</h3>${work(p.assignments)}`;
  if(tab==='work')content=work(p.assignments);
  if(tab==='team')content=team(p.agents);
  if(tab==='map')content=table(['relationship','evidence','exact paths'],p.overlap.map(e=>[`${esc(e.a)} ↔ ${esc(e.b)}`,`${badge(e.severity)}<small>${esc(e.evidence)}</small>`,e.paths.map(v=>`<code>${esc(v)}</code>`).join('<br>')]))+empty('Declared ownership and changed-file evidence are compared deterministically. Missing ownership is not proof of no conflict.');
  if(tab==='repo')content=`<h3>pull requests</h3>${table(['PR','branch','head SHA','updated'],p.inventory.prs.map(v=>[`<a href="${esc(v.url)}" target="_blank" rel="noopener">#${esc(v.number)} ${esc(v.title)}</a>`,esc(v.head),`<code>${esc(v.sha)}</code>`,esc(v.updated_at)]))}<h3>branch cleanup ledger</h3>${table(['branch','assignment','ahead / behind','disposition / proof'],p.inventory.branches.map(b=>[esc(b.name),esc(b.assignment || 'unlinked'),`${esc(b.ahead)} / ${esc(b.behind)}`,b.cleanup.safe?'DELETE AFTER VERIFICATION':`KEEP / REVIEW<small>${esc(b.cleanup.reasons.join('; '))}</small>`]))}`;
  if(tab==='qa')content=table(['assignment','exact SHA','classification'],p.assignments.map(a=>[esc(a.id),`<code>${esc(a.head_sha || 'unverified')}</code>`,badge(a.qa)]))+empty('NOT_RUN and stale evidence do not count as passes. Provider capacity is handled by infrastructure ownership.');
  if(tab==='notes')content=`<h3>canonical sources</h3>${table(['source','purpose'],[['docs/STATE.md','current verified state'],['assignment JSON','structured work'],['reports/','provenance; needs review before consolidation']].map(r=>r.map(esc)))}<p>Structured consolidation and guarded tracker reconciliation arrive in tranche 3.0-C.</p>`;
  if(tab==='history')content=empty('Audit history is not available yet. No dashboard mutations are enabled in 3.0-A.');
  return `<div class="control-heading"><div><button class="control-link" data-back>all projects</button><h2>${esc(p.name || p.id)}</h2><p>${esc(p.repository)} · ${esc(p.stage || 'stage not recorded')} · ${badge(p.health)}</p></div><div class="control-actions"><button data-refresh-project="${esc(p.id)}" ${busy?'disabled':''}>${busy?'refreshing…':'refresh repository truth'}</button><button data-handoff="" data-project-id="${esc(p.id)}">copy project handoff</button></div></div><p class="control-notice">${p.inventory.complete?`Repository evidence: ${esc(p.inventory.refreshed_at)}${p.inventory.stale?' · saved snapshot; refresh before acting':''}`:`Repository truth unverified: ${esc(p.inventory.error)}. Refresh is read-only.`}</p><nav class="control-tabs" aria-label="Project workspace">${tabs.map(v=>`<button data-project-tab="${v}" aria-current="${tab===v?'page':'false'}">${v}</button>`).join('')}</nav>${content}`;
}
function render() {
  if(!data)return;
  const p=data.projects.find(p=>p.id===selected);
  if(p && section==='projects')root.innerHTML=projectView(p);
  else if(section==='home')root.innerHTML=`<div class="control-heading"><div><h2>what needs you?</h2><p>Live project records. Repository snapshots are refreshed explicitly.</p></div><span>${data.projects.length} projects · zero inference</span></div>${projects()}<h3>needs attention</h3>${attention(data.attention)}`;
  else if(section==='projects')root.innerHTML='<h2>projects</h2>'+projects();
  else if(section==='assignments')root.innerHTML='<h2>assignments</h2>'+work(data.assignments);
  else if(section==='team')root.innerHTML='<h2>team</h2>'+team(data.agents)+empty('First-class agents are registered explicitly. Scheduler jobs live under Infrastructure.');
  else root.innerHTML='<h2>activity</h2>'+empty('No control actions recorded yet.');
}
export async function refreshControl() {
  root.innerHTML=empty('Loading project records…');
  try {data=await api('/api/control');render();}catch(e){root.innerHTML=`<h2>project records unavailable</h2>${empty(e.message)}<button data-retry>try again</button>`;}
}
export async function showControl(value) {section=value;if(!data)await refreshControl();else render();}
root.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el)return;
  if(el.hasAttribute('data-project')) {selected=el.dataset.project;section='projects';tab='overview';render();}
  if(el.hasAttribute('data-back')) {selected=null;render();}
  if(el.hasAttribute('data-project-tab')) {tab=el.dataset.projectTab;render();}
  if(el.hasAttribute('data-retry'))await refreshControl();
  if(el.hasAttribute('data-refresh-project')) {
    busy=true;render();
    try {const p=await api(`/api/control/projects/${encodeURIComponent(el.dataset.refreshProject)}/refresh`);data.projects=data.projects.map(v=>v.id===p.id?p:v);data.assignments=data.projects.flatMap(p=>p.assignments);data.attention=data.projects.flatMap(p=>p.attention);}catch(e){root.innerHTML+=empty(e.message);}finally {busy=false;render();}
  }
  if(el.hasAttribute('data-handoff')) {
    try {const result=await api(`/api/control/projects/${encodeURIComponent(el.dataset.projectId)}/handoff?assignment=${encodeURIComponent(el.dataset.handoff)}`);await navigator.clipboard.writeText(result.text);el.textContent='copied';}catch(e){const area=document.createElement('textarea');area.className='control-packet';area.value=e.message;root.append(area);}
  }
});
