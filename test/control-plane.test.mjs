import test from 'node:test';
import assert from 'node:assert/strict';
import { matches, overlaps, cleanupProof, deriveProject, handoff } from '../src/control-plane.mjs';
import { pages } from '../src/control-github.mjs';
test('glob ownership respects directories and metacharacters',()=>{
  assert(matches('src/canvas/hooks/a.ts','src/canvas/**'));
  assert(!matches('src/canvas/hooks/a.ts','src/canvas/*.ts'));
  assert(matches('src/a.ts','src/'));
  assert(matches('src/a[1].ts','src/a[1].ts'));
});
test('overlap exemptions require both assignments and never override protection',()=>{
  const a={id:'canvas',status:'active',changed_files:['src/camera.ts'],overlap_approvals:[{assignment:'mobile',paths:['src/camera.ts']}]};
  const b={id:'mobile',status:'ACTIVE',changed_files:['src/camera.ts']};
  assert.equal(overlaps([a,b])[0].severity,'collision');
  b.overlap_approvals=[{assignment:'canvas',paths:['src/camera.ts']}];
  assert.equal(overlaps([a,b])[0].severity,'approved');
  b.protected_paths=['src/**'];assert.equal(overlaps([a,b])[0].severity,'protected');
  b.status='COMPLETE';assert.deepEqual(overlaps([a,b]),[]);
});
test('cleanup fails closed for incomplete inventory, unique work, PR, assignment and protection',()=>{
  const branch={name:'task/a',sha:'abc',ahead:0}, project={default_branch:'main'};
  assert(cleanupProof(branch,project,[],[],true).safe);
  assert(!cleanupProof(branch,project,[],[],false).safe);
  assert(!cleanupProof({...branch,ahead:1},project,[],[],true).safe);
  assert(!cleanupProof(branch,project,[],[{head:branch.name}],true).safe);
  assert(!cleanupProof(branch,project,[{branch:branch.name,status:'active'}],[],true).safe);
  assert(!cleanupProof(branch,{...project,cleanup:{protected_branches:[branch.name]}},[],[],true).safe);
});
test('stale QA and unknown owners are attention, not fabricated passes',()=>{
  const p=deriveProject({id:'p',repository:'a/b'},[{id:'a',project:'p',status:'active',branch:'task/a',qa:{head_sha:'old',classification:'PASS'}}],[],{complete:true,branches:[{name:'task/a',sha:'new',ahead:1}],prs:[]});
  assert.equal(p.assignments[0].qa,'STALE_RUN');assert(p.attention.some(a=>a.reason.includes('owner not registered')));
  assert(handoff(p,p.assignments[0]).includes('Exact head SHA: new'));
});
test('pagination includes second page and does not claim partial lists are complete',async()=>{
  let calls=0;const result=await pages(async()=>++calls===1?Array(100).fill({}):[{id:'last'}],'/x?state=open');
  assert.equal(result.length,101);assert.equal(calls,2);
});
