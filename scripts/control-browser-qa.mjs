// Isolated deterministic UI harness: mocked GitHub/control responses, no credentials or writes.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!/^\/(?:index.html|app.js|control.js|styles.css)?$/.test(pathname)){res.writeHead(404);return res.end();}
  const file=pathname==='/'?'index.html':pathname.slice(1);
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(await fs.readFile(path.join('dashboard',file)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
await fs.mkdir('qa-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[], actions=[];
const assignment={id:'canvas-parity',project:'field',status:'ACTIVE',owner_agent:'canvas',domain:'canvas',goal:'Preserve world geometry',branch:'canvas/parity',pr:42,head_sha:'abcdef',qa:'NOT_RUN',owned_paths:['src/canvas/**'],acceptance_criteria:['Preserve positions'],next_action:'Verify exact preview',_sha:'rev1'};
const project={id:'field',name:'field',repository:'lrnolivia/field',default_branch:'main',stage:'Stage 0',milestone:'convergence',health:'attention',_sha:'projectrev',agents:[{id:'canvas',name:'Canvas',role:'worker',project:'field',mission:'canvas correctness',domain:'canvas',reports_to:'master',can_wake:false}],assignments:[assignment],inventory:{complete:true,main_sha:'mainsha',refreshed_at:new Date().toISOString(),prs:[{number:42,title:'parity',head:'canvas/parity',sha:'abcdef',url:'https://github.com/lrnolivia/field/pull/42'}],branches:[{name:'merged/task',sha:'branchsha',ahead:0,behind:1,cleanup:{safe:true,reasons:[]}}]},overlap:[{a:'canvas-parity',b:'mobile',severity:'collision',evidence:'changed files',paths:['src/camera.ts']}],attention:[{project:'field',severity:'warning',reason:'QA not run',source:'canvas-parity',action:'Run exact QA'}]};
const fixture={projects:[project],agents:project.agents,assignments:[assignment],attention:project.attention,zero_ai:true};
try {
  for(const viewport of [{width:1440,height:960},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const u=new URL(route.request().url()),method=route.request().method();let body=[];
      if(u.pathname==='/api/control')body=fixture;
      else if(u.pathname==='/api/control/actions') {const input=route.request().postDataJSON();actions.push(input);body={ok:true};}
      else if(u.pathname.endsWith('/handoff'))body={text:'Exact head SHA: abcdef\nNext action: verify parity'};
      else if(u.pathname==='/api/control/events')body=[{id:'event',project:'field',type:'assignment',actor:'human',at:'2026-09-29T23:00:00Z'}];
      else if(u.pathname==='/api/workers')body=[];
      else if(u.pathname==='/api/visual/runs')body={runs:[]};
      else if(u.pathname==='/api/visual')body={items:[]};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(origin);
    await page.getByRole('heading',{name:'what needs you?'}).waitFor();
    assert.equal(await page.locator('#workers-section').isVisible(),false,'automations are hidden outside Infrastructure');
    await page.getByText('CONNECTED',{exact:true}).waitFor();
    await page.getByRole('button',{name:'field',exact:true}).click();
    await page.getByRole('button',{name:'map',exact:true}).click();
    await page.getByText('src/camera.ts',{exact:true}).waitFor();
    await page.screenshot({path:`qa-artifacts/map-${viewport.width}.png`,fullPage:true});
    await page.getByRole('button',{name:'work',exact:true}).click();
    await page.getByText('canvas-parity',{exact:true}).click();
    await page.getByRole('button',{name:'manage assignment'}).click();
    await page.getByLabel('next action',{exact:true}).fill('Run deterministic parity QA');
    await page.getByRole('button',{name:'confirm and save'}).click();
    await page.locator('dialog').waitFor({state:'detached'});
    assert.equal(actions.at(-1).expected_revision,'rev1');
    assert.equal(actions.at(-1).patch.next_action,'Run deterministic parity QA');
    await page.getByRole('button',{name:'freeze new work'}).click();
    assert.equal(await page.locator('dialog').count(),1);
    await page.getByRole('button',{name:'cancel',exact:true}).click();
    await page.getByRole('button',{name:'repo',exact:true}).click();
    await page.getByRole('button',{name:'review safe deletion'}).click();
    assert.match(await page.locator('dialog').innerText(),/branchsha/);
    await page.getByRole('button',{name:'cancel',exact:true}).click();
    await page.getByRole('button',{name:'infrastructure',exact:true}).click();
    await page.getByText('github-actions',{exact:true}).waitFor();
    await page.screenshot({path:`qa-artifacts/infrastructure-${viewport.width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'no page horizontal overflow');
    await context.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile('qa-artifacts/result.json',JSON.stringify({pass:true,artifact_sha:process.env.QA_SHA || 'local unbound',viewports:[1440,390],write_scope:'fixture only; backend separately tested',actions:actions.length,page_errors:errors},null,2));
} finally {await browser.close();server.close();}
