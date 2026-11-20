import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { executablePath } from './browser-path.mjs';

async function checkBoardAmbience(page, press, width) {
  await page.waitForFunction(() => document.querySelector('#game-container').dataset.harborArt === 'ready');
  await press('#btn-map-overview');
  const budget = await page.evaluate(async () => {
    const renderer = gameQA.scene3D.renderer;
    const calls = [], triangles = [];
    for (let i = 0; i < 12; i++) {
      await new Promise(requestAnimationFrame);
      calls.push(renderer.info.render.calls);
      triangles.push(renderer.info.render.triangles);
    }
    calls.sort((a, b) => a - b);
    triangles.sort((a, b) => a - b);
    return { samples: calls.length, minCalls: calls[0], medianCalls: calls[6], maxCalls: calls[11], medianTriangles: triangles[6] };
  });
  console.log(width, 'Grand Bay overview', JSON.stringify(budget));

  await press('#btn-mobile-tools');
  await press('#btn-follow-view');
  for (let i = 0; i < 2; i++) {
    await press('#btn-mobile-tools');
    await press('#btn-time-of-day');
  }
  const readFrames = async () => {
    const {surfaceTime} = await import('/src/engine/BoardSurfaceArt.js');
    const board = gameQA.boardBuilder;
    const lamp = board.mapEnvironmentGroup.getObjectByName('bay-promenade').children.find(mesh => mesh.userData.isPromenadeLamp);
    const frames = [];
    for (let i = 0; i < 5; i++) {
      await new Promise(requestAnimationFrame);
      frames.push({
        sea: surfaceTime.value, lantern: board.ambience.lantern.rotation.y,
        spray: board.ambience.spray.instanceMatrix.version, lamp: lamp.material.emissiveIntensity
      });
    }
    return frames;
  };
  const assertMotion = async animated => {
    const frames = await page.evaluate(readFrames);
    for (const [effect, first] of Object.entries(frames[0])) {
      assert.ok(Number.isFinite(first), effect + ' was not sampled');
      assert.equal(frames.some(frame => frame[effect] !== first), animated, effect);
    }
  };
  await assertMotion(true);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion', value:'reduce'}]);
  await assertMotion(false);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion', value:'no-preference'}]);
  // board-performances.mjs separately exercises the AI command that sets this flag.
  await page.evaluate(() => document.documentElement.classList.add('skip-ai-motion'));
  await assertMotion(false);
  await page.evaluate(() => document.documentElement.classList.remove('skip-ai-motion'));
  await assertMotion(true);
  console.log(width, 'Sea, spray, lantern and promenade lamps moved, froze for reduce/skip, then resumed');

  if (width === 1440) {
    for (const name of ['quay-fountain-spray', 'lighthouse-lantern']) {
      await page.evaluate(async name => {
        const view = gameQA.scene3D;
        const target = view.scene.getObjectByName(name);
        const point = target.getWorldPosition(target.position.clone());
        view.showOverview();
        view.camera.position.copy(point).addScalar(9);
        view.controls.target.copy(point);
        view.controls.update();
        await new Promise(requestAnimationFrame);
      }, name);
      await page.screenshot({path:'/tmp/dafuweng-qa/'+name+'-night-1440.png'});
    }
  }
}

const output = '/tmp/dafuweng-qa';
await mkdir(output, {recursive:true});
process.env.TMPDIR = output;
const server = await createServer({
  cacheDir: output + '/vite-board-ambience',
  plugins: [{name:'observe-ambience', transform(code, id) {
    if (id.endsWith('/src/main.js')) return code.replace('new GameState();', 'new GameState({seed:64});')
      .replace('new GameController();', 'window.gameQA = new GameController();');
  }}],
  server: {host:'127.0.0.1', port:5289, hmr:false, watch:null}
});
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({executablePath, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const mobile = width === 390;
    const context = await browser.createBrowserContext(), page = await context.newPage();
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(90000);
    await page.setViewport({width, height, isMobile:mobile, hasTouch:mobile});
    const press = selector => mobile ? page.tap(selector) : page.click(selector);
    await page.goto(server.resolvedUrls.local[0], {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.gameQA);
    assert.equal(await page.evaluate(() => localStorage.length), 0);
    await press('#start-game-btn');
    await page.waitForSelector('[data-skip]', {visible:true});
    await press('[data-skip]');
    await page.waitForFunction(() => gameQA.pawnManager.pawns.length === 4 && gameQA.pawnManager.pawns.every(p => p.skin));
    await checkBoardAmbience(page, press, width);
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
