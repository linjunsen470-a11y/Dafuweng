import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const directory = path.resolve('qa');
await fs.mkdir(directory, { recursive: true });
const report = { startedAt: new Date().toISOString(), tests: [], pageErrors: [], consoleErrors: [], networkErrors: [], screenshotErrors: [] };
let server, browser, page;
const test = async (name, run) => {
  const started = Date.now();
  try { const details = await run(); report.tests.push({ name, success: true, ms: Date.now()-started, details }); console.log(`PASS ${name}`); }
  catch (error) { report.tests.push({ name, success: false, ms: Date.now()-started, error: error.stack }); throw error; }
};
const inspect = () => page.evaluate(() => ({ snapshot: window.shanhai.session.snapshot(), busy: window.shanhai.busy, active: window.shanhai.active }));
const idle = () => page.waitForFunction(() => window.shanhai?.active && !window.shanhai.busy && (window.shanhai.session.state.phase==='GAME_OVER'||!window.shanhai.session.currentPlayer.isAI), { timeout: 120000 });
const shot = async name => {
  try { return await page.screenshot({path:path.join(directory,`shanhai-${name}.png`),fullPage:name.includes('mobile')}); }
  catch(error){report.screenshotErrors.push({name,error:String(error)});console.warn(`Screenshot unavailable: ${name}: ${error.message}`);}
};
try {
  server = await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5181,strictPort:true}});
  browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH || '/usr/bin/chromium', headless: true, timeout: 120000, protocolTimeout:60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  page = await browser.newPage();
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => report.pageErrors.push(error.stack || String(error)));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
  page.on('response', response => { if (response.status() >= 400) report.networkErrors.push({ url: response.url(), status: response.status() }); });
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto('http://127.0.0.1:5181/shanhai.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await test('loads real WebGL scene and original character assets', async () => {
    await page.waitForFunction(() => window.shanhai?.ready, { timeout: 120000 });
    assert.equal(await page.$eval('#start-button', b => b.disabled), false);
    // The broken cached-material path drew only ~19k triangles and lost the island.
    await page.waitForFunction(()=>window.shanhai.scene.metrics?.triangles>100000);

    await fs.writeFile(path.join(directory,'shanhai-render-diagnostics.json'),JSON.stringify(await page.evaluate(()=>{
      const s=window.shanhai.scene;return {metrics:s.metrics,children:s.scenery.children.map(m=>({color:m.material?.color?.getHexString(),visible:m.visible,count:m.geometry?.attributes.position.count})),programs:s.renderer.info.programs.map(p=>({name:p.name,diagnostics:p.diagnostics}))};
    }),null,2));
    await shot('welcome-desktop');
    return page.evaluate(() => ({ canvas: { width: document.querySelector('canvas').width, height: document.querySelector('canvas').height }, renderer: window.shanhai.scene.renderer.info.render }));
  });
  await test('starts with real UI and purchases using a consumed remote dice card', async () => {
    await page.click('#start-button'); await idle();
    await page.click('#remote-button'); await page.click('[data-step="1"]'); await idle();
    const before = await inspect();
    assert.equal(before.snapshot.players[0].currentTile, 1);
    assert.equal(before.snapshot.players[0].cards.includes('REMOTE_DICE'), false);
    assert.equal(before.snapshot.slice.focus.kind, 'PURCHASE');
    const cost = before.snapshot.slice.focus.cost;
    await page.click('#decision-button', { clickCount: 2, delay: 10 }); await idle();
    const after = await inspect();
    const property = after.snapshot.properties.find(([id]) => id === 1)[1];
    assert.equal(property.owner, 0);
    assert.equal(property.level, 0);
    assert.equal(after.snapshot.players[0].cash, before.snapshot.players[0].cash - cost);
    assert.equal(after.snapshot.slice.focus.kind, 'DONE');
    await shot('purchase-desktop');
    return { tile: 1, beforeCash: before.snapshot.players[0].cash, afterCash: after.snapshot.players[0].cash, cost, doubleClickChargedOnce: true };
  });
  await test('plays three full human and AI rounds through click controls', async () => {
    const rounds = [];
    await page.click('#end-turn-button'); await idle();
    for (let i = 0; i < 3; i++) {
      await page.waitForSelector('#roll-button'); await page.click('#roll-button'); await idle();
      let state = await inspect();
      if (state.snapshot.slice.pendingEvent) { await page.click('[data-event-choice]:not([disabled])'); await idle(); state = await inspect(); }
      if (state.snapshot.slice.focus?.kind === 'PURCHASE' || state.snapshot.slice.focus?.kind === 'UPGRADE') {
        const enabled = await page.$eval('#decision-button', b => !b.disabled);
        await page.click(enabled ? '#decision-button' : '#skip-button'); await idle();
        if (!enabled) { rounds.push((await inspect()).snapshot.round); continue; }
      }
      if (await page.$('#end-turn-button')) { await page.click('#end-turn-button'); await idle(); }
      state = await inspect(); rounds.push(state.snapshot.round);
      assert.equal(state.snapshot.currentPlayerIndex, 0);
      assert.equal(state.snapshot.phase, 'PRE_ROLL_ACTION');
    }
    assert.ok(rounds.at(-1) >= 4);
    await shot('playing-desktop');
    return { rounds };
  });
  await test('exchanges real points once and previews destinations before consuming a card', async()=>{
    const before=(await inspect()).snapshot.players[0];
    const cost=await page.evaluate(()=>window.shanhai.session.getRemoteSupply().cost);
    await page.click('#supply-button',{clickCount:2,delay:10});
    const after=(await inspect()).snapshot.players[0];
    assert.equal(after.cardPoints,before.cardPoints-cost);
    assert.equal(after.cards.filter(c=>c==='REMOTE_DICE').length,1);
    await page.click('#remote-button');
    const options=await page.$$eval('[data-step]',buttons=>buttons.map(b=>b.textContent));
    assert.equal(options.length,6);assert.ok(options.every(text=>text.length>6));
    await shot('route-planning');await page.click('.modal-close');
    assert.equal((await inspect()).snapshot.players[0].cards.filter(c=>c==='REMOTE_DICE').length,1);
    return {cost,beforePoints:before.cardPoints,afterPoints:after.cardPoints,options};
  });
  await test('manual save and reload restore exact economy, dice RNG and ownership', async () => {
    await page.click('#save-button');
    const before = (await inspect()).snapshot;
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.shanhai?.ready, { timeout: 120000 });
    await page.waitForSelector('#resume-button:not([hidden])'); await page.click('#resume-button'); await idle();
    const after = (await inspect()).snapshot;
    for (const key of ['players', 'properties', 'rngState', 'round', 'currentPlayerIndex', 'phase', 'slice']) assert.deepEqual(after[key], before[key], key);
    await shot('restored-desktop');
    return { round: after.round, playerCash: after.players.map(p => p.cash), rngState: after.rngState };
  });
  await test('music and sound effects switch independently', async () => {
    const before = await page.evaluate(() => ({ music: window.shanhai.audio.musicEnabled, sfx: window.shanhai.audio.sfxEnabled }));
    await page.click('#music-toggle');
    assert.deepEqual(await page.evaluate(() => ({ music: window.shanhai.audio.musicEnabled, sfx: window.shanhai.audio.sfxEnabled })), { music: !before.music, sfx: before.sfx });
    await page.click('#sfx-toggle');
    assert.deepEqual(await page.evaluate(() => ({ music: window.shanhai.audio.musicEnabled, sfx: window.shanhai.audio.sfxEnabled })), { music: !before.music, sfx: !before.sfx });
    await page.click('#music-toggle'); await page.click('#sfx-toggle');
    await page.waitForFunction(()=>window.shanhai.audio.context?.state==='running'&&window.shanhai.audio.buffers.size===8&&window.shanhai.audio.music?.currentTime>.1);
    return page.evaluate(()=>({independent:true,context:window.shanhai.audio.context.state,decodedEffects:window.shanhai.audio.buffers.size,musicTime:window.shanhai.audio.music.currentTime,musicDuration:window.shanhai.audio.music.duration}));
  });
  await test('mobile viewport contains controls without horizontal overflow', async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    // Switching mobile/touch emulation reloads Chromium's page.
    await page.waitForFunction(() => window.shanhai?.ready, {timeout:120000});
    if (!await page.evaluate(()=>window.shanhai.active)) {
      await page.click('#resume-button');await idle();
    }
    await page.waitForSelector('#roll-button');
    const layout = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, body: document.body.scrollWidth,
      roll: (() => { const r = document.querySelector('#roll-button').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })() }));
    assert.ok(layout.width <= layout.viewport + 1, JSON.stringify(layout));
    assert.ok(layout.body <= layout.viewport + 1, JSON.stringify(layout));
    assert.ok(layout.roll.left >= 0 && layout.roll.right <= layout.viewport + 1, JSON.stringify(layout));
    await shot('mobile');
    await page.click('#roll-button'); await idle();
    await shot('mobile-landing');
    return layout;
  });
  await test('finishes a real complete match through UI and replays from the result screen',async()=>{
    let turns=0;
    while((await inspect()).snapshot.phase!=='GAME_OVER'&&turns++<60){
      if(await page.$('#roll-button'))await page.click('#roll-button');
      else if(await page.$('#decision-button')){
        const enabled=await page.$eval('#decision-button',b=>!b.disabled);
        await page.click(enabled?'#decision-button':'#skip-button');
      }else if(await page.$('[data-event-choice]:not([disabled])')){await page.click('[data-event-choice]:not([disabled])');await idle();
      }else if(await page.$('#end-turn-button'))await page.click('#end-turn-button');
      else throw new Error('No playable action before match ended');
      await idle();
    }
    const end=(await inspect()).snapshot;
    assert.equal(end.phase,'GAME_OVER');assert.ok(end.winnerId!==null);
    if(!await page.$('#replay-button'))await page.click('#action-buttons button');
    await page.waitForSelector('#replay-button');await shot('complete-match');
    await page.click('#replay-button');await idle();
    assert.equal((await inspect()).snapshot.round,1);
    assert.equal((await inspect()).snapshot.phase,'PRE_ROLL_ACTION');
    return {round:end.round,winnerId:end.winnerId,uiActions:turns,replay:true};
  });
  for(const failure of ['webgl','storage']){
    await test(`real browser ${failure} failure remains recoverable`,async()=>{
      const fault=await browser.newPage(),errors=[];fault.on('pageerror',e=>errors.push(e.message));
      try{
        await fault.setViewport({width:800,height:700});
        await fault.evaluateOnNewDocument(kind=>{
          if(kind==='storage')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Test denied storage','SecurityError');}});
          else {const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};}
        },failure);
        await fault.goto('http://127.0.0.1:5181/shanhai.html',{waitUntil:'domcontentloaded',timeout:120000});
        if(failure==='webgl'){
          await fault.waitForSelector('#retry-loading');assert.equal(await fault.$eval('#start-button',b=>b.disabled),true);
        }else{
          await fault.waitForFunction(()=>window.shanhai?.ready,{timeout:120000});await fault.click('#start-button');
          await fault.waitForSelector('#roll-button');assert.ok((await fault.$eval('#save-status',e=>e.textContent)).includes('无法保存'));
          await fault.click('#menu-button');await fault.click('#confirm-menu');assert.equal(await fault.evaluate(()=>window.shanhai.active),true);
        }
        assert.deepEqual(errors,[]);return {handled:true,uncaughtErrors:errors};
      }finally{await fault.close();}
    });
  }
  assert.deepEqual(report.pageErrors, [], 'Uncaught browser errors');
  assert.deepEqual(report.networkErrors, [], 'Failed asset requests');
  report.success = true;
} catch (error) {
  report.success = false; report.error = error.stack || String(error); console.error(error);
  if (page) await shot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(directory, 'shanhai-browser-report.json'), JSON.stringify(report, null, 2));
  await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));
}
