import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
const baseline=process.argv.includes('--baseline');
const report={kind:baseline?'prior-build baseline':'regional scenery browser check',checks:[],errors:[]};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5186,strictPort:true}});
let browser;
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 await page.setViewport({width:1600,height:1100});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.goto('http://127.0.0.1:5186/shanhai.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shanhai?.ready);
 await page.click('#start-button');await page.waitForFunction(()=>window.shanhai.active&&!window.shanhai.busy);
 // Wait for the turn banner to leave and the visible canvas to render.
 await page.waitForFunction(()=>!document.querySelector('#turn-banner').classList.contains('show')&&window.shanhai.scene.renderer.info.render.frame>4);
 report.metrics=await page.evaluate(()=>({...window.shanhai.scene.metrics}));
 await page.screenshot({path:`qa/neighborhoods-${baseline?'before':'after'}.png`});
 report.checks.push('Original scene loaded, started and rendered with no asset or WebGL errors.');
 if(!baseline){
  report.regionModels=await page.evaluate(()=>window.shanhai.scene.regionalScenery);
  assert.equal(report.regionModels.length,12);assert.equal(report.regionModels.filter(m=>m.landmark).length,3);
  const old=JSON.parse(await fs.readFile('qa/neighborhoods-baseline.json','utf8'));
  report.change={calls:report.metrics.calls-old.metrics.calls,triangles:report.metrics.triangles-old.metrics.triangles};
  assert.ok(report.change.calls<=25);assert.ok(report.change.triangles<=65000);
  await page.click('#remote-button');await page.click('[data-step="1"]');await page.waitForFunction(()=>!window.shanhai.busy);
  await page.click('#decision-button');await page.waitForFunction(()=>!window.shanhai.busy);
  assert.equal(await page.evaluate(()=>window.shanhai.session.state.propertyManager.getProperty(1).owner),0);
  report.checks.push('Actual remote-dice move and purchase succeed with new art; static-scene draw/triangle overhead stays within the modest budget.');
  // Presentation-only fixture: show all building tiers, without modifying game
  // state, cash, ownership, save data or the user's actual progress.
  report.propertyFixture=await page.evaluate(()=>{
   const {session,scene}=window.shanhai;const stable=s=>JSON.stringify(s,(key,value)=>['savedAt','generatedAt'].includes(key)?undefined:value);const before=stable(session.snapshot());
   scene.syncProperties({players:session.state.players,propertyManager:{getProperty(id){const p=session.state.propertyManager.getProperty(id);return p?{...p,owner:id%2,level:1+id%4}:null;}}});
   return {frame:scene.renderer.info.render.frame,unchanged:stable(session.snapshot())===before,description:'Presentation-only tier/region fixture; not earned gameplay progress.'};
  });assert.equal(report.propertyFixture.unchanged,true);
  await page.waitForFunction(frame=>window.shanhai.scene.renderer.info.render.frame>frame+1,{},report.propertyFixture.frame);
  await page.screenshot({path:'qa/neighborhoods-property-fixture.png'});
  await page.click('#view-zoom');await page.screenshot({path:'qa/neighborhoods-detail-fixture.png'});await page.click('#view-home');
  await page.evaluate(()=>window.shanhai.scene.syncProperties(window.shanhai.session.state));
  report.checks.push('Presentation-only populated board verifies all region colors and building tiers; game/save state unchanged.');
  await page.setViewport({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  const resizeFrame=await page.evaluate(()=>window.shanhai.scene.renderer.info.render.frame);
  await page.waitForFunction(frame=>matchMedia('(max-width:680px)').matches&&getComputedStyle(document.querySelector('.topbar')).height==='67px'&&window.shanhai.scene.renderVisible&&window.shanhai.scene.renderer.info.render.frame>frame+2,{},resizeFrame);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'qa/neighborhoods-mobile.png'});
  report.checks.push('390px board and interface render without horizontal overflow.');
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}
finally{
 await browser?.close();await new Promise(r=>server.httpServer.close(r));
 await fs.writeFile(`qa/neighborhoods-${baseline?'baseline':'browser-report'}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
