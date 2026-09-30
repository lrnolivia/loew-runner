import test from 'node:test';
import assert from 'node:assert/strict';
import { controlApi } from '../src/control-api.mjs';
import { atomicControlWrite, mutate } from '../src/control-write.mjs';
test('mutations reject absent token, cross-origin and non-JSON before touching GitHub',async()=>{
  const url='https://runner.test/api/control/actions';
  assert.equal((await controlApi(new Request(url,{method:'POST'}),null)).status,503);
  assert.equal((await controlApi(new Request(url,{method:'POST',headers:{Origin:'https://attacker.test'}}),'test')).status,403);
  assert.equal((await controlApi(new Request(url,{method:'POST',headers:{Origin:'https://runner.test'}}),'test')).status,415);
});
test('atomic control write persists event in same tree and never force-updates',async()=>{
  const calls=[];
  const gh=async(route,options={})=>{const body=options.body?JSON.parse(options.body):null;calls.push({route,body});
    if(route.endsWith('/git/commits/old'))return {tree:{sha:'base'}};
    if(route.endsWith('/git/trees'))return {sha:'tree'};
    if(route.endsWith('/git/commits'))return {sha:'new'};
    if(route.includes('/git/ref/'))return {object:{sha:'new'}};
    return {};
  };
  await atomicControlWrite(gh,'old',[{path:'control-data/assignments/a.json',value:{id:'a'}}],{type:'assignment'});
  const tree=calls.find(c=>c.route.endsWith('/git/trees')).body.tree;
  assert.equal(tree.length,2);assert(tree[1].path.startsWith('control-data/events/'));
  assert.equal(calls.find(c=>c.route.includes('/git/refs/')).body.force,false);
  assert.deepEqual(calls.find(c=>c.route.endsWith('/git/commits')).body.parents,['old']);
});
test('stale assignment revision prevents all writes',async()=>{
  const gh=async(route,options={})=>{
    assert(!options.method,'stale input must not write');
    if(route.includes('/git/ref/'))return {object:{sha:'head'}};
    if(route.includes('/contents/projects?'))return [{type:'file',name:'p.json',path:'projects/p.json'}];
    if(route.includes('/contents/assignments?'))return [{type:'file',name:'a.json',path:'assignments/a.json'}];
    if(route.includes('/contents/projects/p.json'))return {sha:'project-sha',content:Buffer.from(JSON.stringify({id:'p',repository:'a/b'})).toString('base64')};
    if(route.includes('/contents/assignments/a.json'))return {sha:'latest',content:Buffer.from(JSON.stringify({id:'a',project:'p',status:'READY'})).toString('base64')};
    throw Object.assign(new Error('not found'),{status:404});
  };
  await assert.rejects(()=>mutate(gh,{action:'assignment',project:'p',id:'a',expected_revision:'stale',patch:{status:'ACTIVE'}}),/changed/);
});
test('preview controls cannot mutate shared production state',async()=>{
  const r=await controlApi(new Request('https://preview.test/api/control/actions',{method:'POST',headers:{Origin:'https://preview.test','Content-Type':'application/json'},body:'{}'}),'token',{allowWrites:false});
  assert.equal(r.status,403);assert.match((await r.json()).error,/Preview/);
});
