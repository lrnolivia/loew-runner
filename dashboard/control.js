const root=document.querySelector('#control-section');
let data=null, section='home', selected=null, tab='overview', busy=false;
let dialog=null, notice='';
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
  `<details><summary>${esc(a.id)}</summary><button data-edit-assignment="${esc(a.id)}">manage assignment</button>${a.branch?(!a.pr?`<button data-create-pr="${esc(a.id)}">create draft PR</button>`:a.status==='SUPERSEDED'?`<button data-close-pr="${esc(a.id)}">review PR close</button>`:''):`<button data-create-branch="${esc(a.id)}">create branch</button>`}<p>${esc(a.goal)}</p><ul>${(a.acceptance_criteria || []).map(v=>`<li>${esc(v)}</li>`).join('')}</ul><button data-handoff="${esc(a.id)}" data-project-id="${esc(a.project)}">copy Codex handoff</button></details>`,`${esc(a.owner_agent || 'unassigned')}<small>${esc(a.domain || a.tranche || 'not declared')}</small>`,badge(a.status),`${esc(a.branch || 'not linked')}<small>${a.pr?'PR #'+esc(a.pr):'no PR linked'}</small>`,badge(a.qa),esc(a.next_action || 'not recorded')
]));}
function team(items) {return table(['agent','role / runtime','mission / domain','current assignment','reporting / wake'],items.map(a=>[`${esc(a.name || a.id)}<small>${esc(a.status || 'active')}</small><button data-retire="${esc(a.id)}">retire</button>`,`${esc(a.role)}<small>${esc(a.runtime || 'external chat')}</small>`,`${esc(a.mission)}<small>${esc(a.domain)}</small>`,esc(a.current_assignment || 'unassigned'),`${esc(a.reports_to || 'not recorded')}<small>${a.can_wake?'supported automation':'manual handoff; cannot wake chat'}</small>`]));}
function projectView(p) {
  const tabs=['overview','work','team','map','repo','qa','notes','history'];
  let content='';
  if(tab==='overview')content=`<h3>needs attention</h3>${attention(p.attention)}<h3>active work</h3>${work(p.assignments)}`;
  if(tab==='work')content=`<button data-create-assignment="${esc(p.id)}">new assignment</button>`+work(p.assignments);
  if(tab==='team')content=`<button data-register-agent="${esc(p.id)}">register existing agent</button>`+team(p.agents);
  if(tab==='map')content='<h3>ownership and reporting</h3>'+table(['agent','reports to','domain','assignment / paths'],p.agents.map(a=>[esc(a.name || a.id),esc(a.reports_to || 'not recorded'),esc(a.domain),p.assignments.filter(v=>v.owner_agent===a.id).map(v=>`${esc(v.id)}<small>${esc((v.owned_paths || []).join(', ') || 'paths not declared')}</small>`).join('<br>')]))+'<h3>overlap evidence</h3>'+table(['relationship','evidence','exact paths'],p.overlap.map(e=>[`${esc(e.a)} ↔ ${esc(e.b)}`,`${badge(e.severity)}<small>${esc(e.evidence)}</small>${e.severity==='collision'?`<button data-approve-a="${esc(e.a)}" data-approve-b="${esc(e.b)}" data-project-id="${esc(p.id)}">review shared files</button>`:''}`,e.paths.map(v=>`<code>${esc(v)}</code>`).join('<br>')]))+empty('Declared ownership and changed-file evidence are compared deterministically. Missing ownership is not proof of no conflict.');
  if(tab==='repo')content=`<h3>pull requests</h3>${table(['PR','branch','head SHA','updated'],p.inventory.prs.map(v=>[`<a href="${esc(v.url)}" target="_blank" rel="noopener">#${esc(v.number)} ${esc(v.title)}</a>`,esc(v.head),`<code>${esc(v.sha)}</code>`,esc(v.updated_at)]))}<h3>branch cleanup ledger</h3>${table(['branch','assignment','ahead / behind','disposition / proof'],p.inventory.branches.map(b=>[esc(b.name),esc(b.assignment || 'unlinked'),`${esc(b.ahead)} / ${esc(b.behind)}`,b.cleanup.safe?`<button data-cleanup="${esc(b.name)}" data-project-id="${esc(p.id)}">review safe deletion</button>`:`KEEP / REVIEW<small>${esc(b.cleanup.reasons.join('; '))}</small>`]))}`;
  if(tab==='qa')content=`<div class="control-actions">${p.assignments.map(a=>`<button data-run-qa="${esc(a.id)}" ${p.qa?.workflow?'':'disabled'}>run ${esc(a.id)} QA</button><button data-human-qa="${esc(a.id)}">record human QA</button>`).join('')}</div>`+table(['assignment','exact SHA','classification'],p.assignments.map(a=>[esc(a.id),`<code>${esc(a.head_sha || 'unverified')}</code>`,badge(a.qa)]))+empty('NOT_RUN and stale evidence do not count as passes. Provider capacity is handled by infrastructure ownership.');
  if(tab==='notes') {
    const tracker=data.trackers?.find(v=>v.id===p.id), digest=data.digests?.find(v=>v.id===p.id);
    content=`<div class="control-actions"><button data-consolidate="${esc(p.id)}">consolidate status</button><button data-reconcile="${esc(p.id)}">reconcile trackers</button>${tracker?`<button data-archive="${esc(p.id)}">review duplicate archive</button>`:''}<button data-copy-digest="${esc(p.id)}">copy status</button></div><h3>canonical structured digest</h3>${digest?`<pre class="control-json">${esc(JSON.stringify(digest,null,2))}</pre>`:empty('No digest generated yet. Consolidation uses structured records only; contradictory prose stays under review.')}<h3>notes and tracker index</h3>${tracker?table(['source','status','superseded by'],tracker.sources.map(s=>[esc(s.path),badge(s.status),esc(s.superseded_by || (s.canonical?'canonical configured source':'needs human review'))])):empty('Reconcile to inventory configured sources and identify exact duplicates. Original files stay intact. Semantic conflicts cannot be auto-archived.')}`;
  }
  if(tab==='history')content=table(['when','action','actor'],(data.events || []).filter(e=>e.project===p.id).sort((a,b)=>b.at.localeCompare(a.at)).map(e=>[esc(e.at),esc(e.type),esc(e.actor)]));
  return `<div class="control-heading"><div><button class="control-link" data-back>all projects</button><h2>${esc(p.name || p.id)}</h2><p>${esc(p.repository)} · ${esc(p.stage || 'stage not recorded')} · ${badge(p.health)}</p></div><div class="control-actions"><button data-freeze="${esc(p.id)}">${p.frozen?'unfreeze new work':'freeze new work'}</button><button data-refresh-project="${esc(p.id)}" ${busy?'disabled':''}>${busy?'refreshing…':'refresh repository truth'}</button><button data-handoff="" data-project-id="${esc(p.id)}">copy project handoff</button></div></div><p class="control-notice">${p.inventory.complete?`Repository evidence: ${esc(p.inventory.refreshed_at)}${p.inventory.stale?' · saved snapshot; refresh before acting':''}`:`Repository truth unverified: ${esc(p.inventory.error)}. Refresh is read-only.`}</p><nav class="control-tabs" aria-label="Project workspace">${tabs.map(v=>`<button data-project-tab="${v}" aria-current="${tab===v?'page':'false'}">${v}</button>`).join('')}</nav>${content}`;
}
function render() {
  if(!data)return;
  const p=data.projects.find(p=>p.id===selected);
  if(p && section==='projects')root.innerHTML=projectView(p);
  else if(section==='home')root.innerHTML=`<div class="control-heading"><div><h2>what needs you?</h2><p>Live project records. Repository snapshots are refreshed explicitly.</p></div><span>${data.projects.length} projects · zero inference</span></div>${projects()}<h3>needs attention</h3>${attention(data.attention)}`;
  else if(section==='projects')root.innerHTML='<h2>projects</h2>'+projects();
  else if(section==='assignments')root.innerHTML='<h2>assignments</h2>'+data.projects.map(p=>`<button data-create-assignment="${esc(p.id)}">new ${esc(p.name || p.id)} assignment</button>`).join(' ')+work(data.assignments);
  else if(section==='team')root.innerHTML='<h2>team</h2>'+data.projects.map(p=>`<button data-register-agent="${esc(p.id)}">register ${esc(p.name || p.id)} agent</button>`).join(' ')+team(data.agents)+empty('First-class agents are registered explicitly. Scheduler jobs live under Infrastructure.');
  else root.innerHTML='<h2>activity</h2>'+table(['when','project','action','actor'],(data.events || []).sort((a,b)=>b.at.localeCompare(a.at)).map(e=>[esc(e.at),esc(e.project),esc(e.type),esc(e.actor)]));
  if(notice)root.insertAdjacentHTML('afterbegin',`<p role="alert" class="control-notice">${esc(notice)}</p>`);
}
export async function refreshControl() {
  notice='';root.innerHTML=empty('Loading project records…');
  try {data=await api('/api/control');[data.events,data.digests,data.trackers,data.infrastructure]=await Promise.all(['/api/control/events','/api/control/digests','/api/control/trackers','/api/control/infrastructure'].map(api));render();}catch(e){root.innerHTML=`<h2>project records unavailable</h2>${empty(e.message)}<button data-retry>try again</button>`;}
}
export async function showControl(value) {section=value;if(!data)await refreshControl();else render();}
root.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el)return;
  if(el.hasAttribute('data-project')) {selected=el.dataset.project;section='projects';tab='overview';render();}
  if(el.hasAttribute('data-back')) {selected=null;render();}
  if(el.hasAttribute('data-project-tab')) {tab=el.dataset.projectTab;render();}
  if(el.hasAttribute('data-edit-assignment'))editAssignment(data.assignments.find(a=>a.id===el.dataset.editAssignment));
  if(el.hasAttribute('data-create-assignment'))editAssignment({project:el.dataset.createAssignment,status:'READY'});
  if(el.hasAttribute('data-register-agent'))registerAgent(el.dataset.registerAgent);
  if(el.hasAttribute('data-freeze')) {
    const p=data.projects.find(p=>p.id===el.dataset.freeze);
    confirmAction(`${p.frozen?'Unfreeze':'Freeze'} new work in ${p.name || p.id}?`, 'This gates new assignments and assignment starts. It does not pause existing scheduler jobs.', {action:'freeze',project:p.id,expected_revision:p._sha,frozen:!p.frozen});
  }
  if(el.hasAttribute('data-cleanup')) {
    const p=data.projects.find(p=>p.id===el.dataset.projectId), b=p.inventory.branches.find(b=>b.name===el.dataset.cleanup);
    confirmAction(`Delete ${b.name}?`, `Zero unique commits against main ${p.inventory.main_sha}. No open PR or active assignment. Runner rechecks the exact head ${b.sha} immediately before deletion.`, {action:'cleanup',project:p.id,branch:b.name,expected_sha:b.sha,expected_main:p.inventory.main_sha,confirm:true});
  }
  if(el.hasAttribute('data-consolidate') || el.hasAttribute('data-reconcile')) {
    el.disabled=true;
    try {await action({action:el.hasAttribute('data-consolidate')?'consolidate':'reconcile',project:el.dataset.consolidate || el.dataset.reconcile});await refreshControl();}catch(e){packet('action could not complete',e.message);}finally{el.disabled=false;}
  }
  if(el.hasAttribute('data-copy-digest')) {const d=data.digests.find(d=>d.id===el.dataset.copyDigest);if(d)await copyPacket(JSON.stringify(d,null,2),el);else packet('status not yet consolidated','Click consolidate status first.');}
  if(el.hasAttribute('data-archive')) {
    const t=data.trackers.find(t=>t.id===el.dataset.archive);
    confirmAction('Archive exact duplicate references?',`${t.duplicates.length} duplicate sources found. Active assignment references are excluded. Originals stay in Git; only the consolidated archive index changes. Prose conflicts stay under review.`,{action:'archive-duplicates',project:t.id,expected_sha:t.head_sha,confirm:true});
  }
  if(el.hasAttribute('data-retire')) {
    const a=data.agents.find(a=>a.id===el.dataset.retire);confirmAction(`Retire ${a.name || a.id}?`,'This retires the registered role, not the underlying chat. Active assignments must be reassigned first.',{action:'retire-agent',project:a.project,agent:a.id,expected_revision:a._sha,confirm:true});
  }
  if(el.hasAttribute('data-approve-a')) {
    const p=data.projects.find(p=>p.id===el.dataset.projectId),a=p.assignments.find(a=>a.id===el.dataset.approveA),b=p.assignments.find(a=>a.id===el.dataset.approveB),edge=p.overlap.find(e=>e.a===a.id && e.b===b.id);
    confirmAction('Approve these shared files?',edge.paths.join(', ')+'. Protection cannot be overridden; fresh collisions must still exist.',{action:'approve-overlap',project:p.id,a:a.id,b:b.id,a_revision:a._sha,b_revision:b._sha,paths:edge.paths,confirm:true});
  }
  if(el.hasAttribute('data-human-qa'))humanQA(data.assignments.find(a=>a.id===el.dataset.humanQa));
  if(el.hasAttribute('data-run-qa')) {
    const a=data.assignments.find(a=>a.id===el.dataset.runQa);confirmAction('Run exact-head deterministic QA?',`${a.branch} at ${a.head_sha}. A request is not a pass; workflow/Inspector evidence must be ingested separately.`,{action:'run-qa',project:a.project,assignment:a.id,expected_revision:a._sha,expected_sha:a.head_sha});
  }
  if(el.hasAttribute('data-create-branch')) {
    const a=data.assignments.find(a=>a.id===el.dataset.createBranch);drawer('create task branch',field('branch name','branch')+'<p>Starts from fresh authoritative main, matches project policy, and links the assignment. No product files are written.</p>',f=>action({action:'create-branch',project:a.project,assignment:a.id,expected_revision:a._sha,branch:f.get('branch'),confirm:true}));
  }
  if(el.hasAttribute('data-create-pr') || el.hasAttribute('data-close-pr')) {
    const a=data.assignments.find(a=>a.id===(el.dataset.createPr || el.dataset.closePr));confirmAction(el.hasAttribute('data-close-pr')?'Close superseded PR?':'Create a draft PR?',el.hasAttribute('data-close-pr')?'Requires explicit SUPERSEDED state and no remaining unique branch work. Protected lanes stay closed to this action.':'Creates one draft PR from the linked assignment branch, then links its number.',{action:el.hasAttribute('data-close-pr')?'close-pr':'create-pr',project:a.project,assignment:a.id,expected_revision:a._sha,expected_sha:a.head_sha,confirm:true});
  }
  if(el.hasAttribute('data-retry'))await refreshControl();
  if(el.hasAttribute('data-refresh-project')) {
    busy=true;render();
    try {await action({action:'refresh',project:el.dataset.refreshProject});await refreshControl();}catch(e){notice=e.message;}finally {busy=false;render();}
  }
  if(el.hasAttribute('data-handoff')) {
    try {const result=await api(`/api/control/projects/${encodeURIComponent(el.dataset.projectId)}/handoff?assignment=${encodeURIComponent(el.dataset.handoff)}`);await copyPacket(result.text,el);}catch(e){packet('handoff could not load',e.message);}
  }
});

async function action(body) {const result=await api('/api/control/actions',{method:'POST',body:JSON.stringify(body)});if(result.uncertain)throw new Error(result.error+' — inspect state before retrying');return result;}
function drawer(title,content,onSave) {
  dialog?.remove();dialog=document.createElement('dialog');dialog.className='control-drawer';
  dialog.innerHTML=`<form><h2>${esc(title)}</h2>${content}<p class="control-form-error" role="alert"></p><div class="control-actions"><button type="button" data-cancel>cancel</button><button type="submit">confirm and save</button></div></form>`;
  document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=dialog.querySelector('[type=submit]');submit.disabled=true;try {await onSave(new FormData(e.target));dialog.close();await refreshControl();}catch(e){dialog.querySelector('[role=alert]').textContent=e.message;}finally{submit.disabled=false;}};
}
function field(label,name,value='',type='text') {return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}"></label>`;}
function lines(label,name,value=[]) {return `<label>${esc(label)}<textarea name="${name}">${esc(value.join('\n'))}</textarea></label>`;}
function editAssignment(a) {
  const states=['READY','ACTIVE','WAITING_QA','DEFERRED','BLOCKED','HUMAN_QA','SUPERSEDED','ARCHIVED'];
  drawer(a.id?'manage assignment':'new assignment', `${a.id?`<p>${esc(a.id)}</p>`:field('assignment ID','id')}${field('goal','goal',a.goal)}<label>status<select name="status">${states.map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}</select></label><label>owner<select name="owner_agent"><option value="">unassigned</option>${data.agents.filter(v=>v.project===a.project).map(v=>`<option value="${esc(v.id)}" ${a.owner_agent===v.id?'selected':''}>${esc(v.name || v.id)}</option>`).join('')}</select></label>${field('domain','domain',a.domain)}${field('branch','branch',a.branch)}${field('PR number (optional)','pr',a.pr,'number')}${field('next action','next_action',a.next_action)}${lines('owned paths — one pattern per line','owned_paths',a.owned_paths)}${lines('protected paths — one pattern per line','protected_paths',a.protected_paths)}${lines('dependencies — assignment IDs, one per line','depends_on',a.depends_on)}${lines('acceptance criteria — one per line','acceptance_criteria',a.acceptance_criteria)}<p>Changes are audited. Completion requires verified promotion evidence.</p>`, async f=>{
    const patch=Object.fromEntries(['goal','status','owner_agent','domain','branch','next_action'].map(k=>[k,String(f.get(k))]));patch.pr=f.get('pr')?Number(f.get('pr')):null;
    for(const k of ['owned_paths','protected_paths','acceptance_criteria','depends_on'])patch[k]=String(f.get(k)).split('\n').map(s=>s.trim()).filter(Boolean);
    await action({action:'assignment',project:a.project,id:a.id || f.get('id'),expected_revision:a._sha || null,patch});
  });
}
function registerAgent(project) {
  drawer('register an existing agent',`${field('stable agent ID','id')}${field('display name','name')}<label>role<select name="role"><option>worker</option><option>master</option><option>pjm</option><option>human</option></select></label>${field('mission','mission')}${field('domain','domain')}${field('runtime (codex, chatgpt, runner, human…)','runtime','codex')}${field('existing thread URL (optional)','thread_url')}<label class="control-check"><input type="checkbox" name="confirmed" required>this is an existing user-visible agent; registration does not create or wake a chat</label>`,async f=>{
    const agent=Object.fromEntries(['id','name','role','mission','domain','runtime','thread_url'].map(k=>[k,String(f.get(k))]));await action({action:'register-agent',project,agent,existing_thread_confirmed:f.has('confirmed')});
  });
}
function confirmAction(title,explanation,body) {drawer(title,`<p>${esc(explanation)}</p>`,()=>action(body));}

function packet(title,text) {const area=document.createElement('section');area.className='control-packet-panel';area.innerHTML=`<h3>${esc(title)}</h3><textarea class="control-packet" readonly aria-label="Generated packet">${esc(text)}</textarea>`;root.append(area);area.querySelector('textarea').focus();area.querySelector('textarea').select();}
async function copyPacket(text,button) {try {await navigator.clipboard.writeText(text);if(button)button.textContent='copied';}catch{packet('copy this packet',text);}}

export async function showInfrastructure() {
  const surface=document.querySelector('#capacity-section');surface.innerHTML=empty('Loading infrastructure records…');
  try {
    const records=await api('/api/control/infrastructure');
    const providers=['github-actions','cloudflare-builds','browser-run','composio','inspector','runner-scheduler'];
    surface.innerHTML=`<h2>infrastructure</h2><p>Capacity and retry policy belong to the infrastructure owner. Missing or expired measurements stay unknown.</p>${table(['provider','state','usage / concurrency','retry / reset','evidence'],providers.map(id=>{
      const p=records.find(v=>v.id===id), fresh=p?.observed_at && p?.expires_at && Date.parse(p.expires_at)>Date.now();
      return [esc(id),badge(fresh?p.status:'unknown'),fresh?esc(p.usage_label || 'not measured'):'not measured',fresh?esc(p.retry_after || p.reset_at || 'not recorded'):'not recorded',p?`${esc(p.source || 'source missing')}<small>${esc(p.observed_at)}${fresh?'':' · measurement stale/unverified'}</small>`:'no authoritative record'];
    }))}<h3>deferred execution</h3>${table(['work','classification','retry after','source'],records.flatMap(v=>(v.deferred || []).map(q=>[esc(q.assignment || q.id),badge(q.classification || 'unclassified'),esc(q.retry_after || 'not recorded'),esc(q.source || v.id)])))}<h3>automations</h3><p>Scheduled jobs below remain available. They are separate from registered project Team members.</p>`;
  } catch(e) {surface.innerHTML=empty(`Infrastructure records unavailable: ${e.message}`);}
}

function humanQA(a) {
  drawer('record human QA',`<p>Exact artifact: ${esc(a.head_sha || 'unverified')}. Missing head or evidence cannot be recorded as a pass.</p><label>verdict<select name="verdict"><option value="FAIL_PRODUCT">fails criterion</option><option value="PASS">passes criterion</option></select></label>${field('acceptance criterion','criterion')}${field('evidence / screenshot / reproduction record','evidence')}`,f=>action({action:'human-qa',project:a.project,assignment:a.id,expected_revision:a._sha,expected_sha:a.head_sha,verdict:f.get('verdict'),criterion:f.get('criterion'),evidence:f.get('evidence')}));
}
