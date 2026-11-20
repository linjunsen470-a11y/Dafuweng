import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { boardHudFraction } from './board-clearance.mjs';
import { executablePath } from './browser-path.mjs';

const output = '/tmp/dafuweng-qa';
await mkdir(output, { recursive: true });
process.env.TMPDIR = output;
const server = await createServer({
  cacheDir:output + '/vite-hand-tray',
  plugins: [{ name:'observe-pawn-focus', transform(code, id) {
    if (id.endsWith('/src/main.js')) return code.replace('new GameController();', 'window.gameQA = new GameController();');
  } }],
  server: { host:'127.0.0.1', port:5274, hmr:false, watch:null }
});
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({executablePath,
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for (const [width, height] of [[1440,900],[390,844]]) {
    if (process.env.QA_WIDTH && width !== Number(process.env.QA_WIDTH)) continue;
    const mobile = width === 390;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.setViewport({width,height,isMobile:mobile,hasTouch:mobile});
    const press = selector => mobile ? page.tap(selector) : page.click(selector);
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForSelector('[data-profile="0"]');
    const checkWidth = async () => assert.equal(await page.evaluate(() => Math.max(innerWidth, document.documentElement.scrollWidth)), width);
    await checkWidth();
    const portraits = await page.$$eval('#character-roster i, #character-preview i', async nodes => {
      await Promise.all(nodes.map(async node => {
        const picture = new Image();
        picture.src = /^url\("(.*)"\)$/.exec(getComputedStyle(node).backgroundImage)?.[1] ?? '';
        await picture.decode();
      }));
      return nodes.length;
    });
    assert.equal(portraits, await page.$$eval('#character-roster button', buttons => buttons.length + 1));
    const titleLines = await page.$eval('#setup-game-title', el => {
      const range = document.createRange();
      range.selectNodeContents(el.firstChild);
      return range.getClientRects().length;
    });
    assert.equal(titleLines, 1, 'lobby title wraps into the map preview');
    await page.screenshot({path:output + '/lobby-' + width + '.png'});
    await press('[data-profile="1"]');
    assert.deepEqual(await page.$$eval('.player-profile-select', controls => controls.map(s => s.value)), ['1','0','2','3']);
    await press('#start-game-btn');
    await page.waitForSelector('.onboarding-guide');
    assert.equal(await page.$eval('#round-count', el => el.textContent), '1');
    if (mobile) await press('[data-skip]');
    else { await press('[data-next]'); await press('[data-next]'); await press('[data-next]'); }
    await page.waitForSelector('.onboarding-guide', {hidden:true});
    await checkWidth();
    const measureTray = async state => {
      const hud = await page.evaluate(boardHudFraction);
      const tray = await page.$eval('.hand-tray', el => {
        const rect = el.getBoundingClientRect();
        return rect.width * rect.height / (innerWidth * innerHeight);
      });
      console.log(width, state, 'tray', (100 * tray).toFixed(2) + '%', 'HUD', (100 * hud).toFixed(2) + '%');
      assert.ok(hud <= (mobile ? .23 : .17), 'HUD area exceeds limit');
      return tray;
    };
    const expanded = await measureTray('expanded');
    const images = await page.$$eval('#tray-cards img, #players-list .player-avatar-img', async nodes => {
      await Promise.all(nodes.map(image => image.decode()));
      return nodes.length;
    });
    assert.equal(images, await page.$$eval('#tray-cards button, #players-list .player-card', buttons => buttons.length));
    console.log(width, 'decoded lobby portraits', portraits, 'and HUD images', images);
    assert.equal(await page.$$eval('.quick-tools button', b => b.length), 5);
    const visibleCards = await page.$$eval('#tray-cards button', cards => cards.filter(c => c.offsetWidth > 0).length);
    assert.ok(mobile ? visibleCards > 6 : visibleCards === 6);
    await press('#tray-toggle');
    assert.equal(await page.$eval('#tray-cards', el => el.hidden), true);
    assert.ok(await measureTray('collapsed') < expanded);
    await press('#tray-toggle');
    await press('#btn-ai-pace');
    assert.equal(await page.$eval('#ai-pace', el => el.value), '2');
    for (const id of [0,1,2,3]) {
      await press(`[data-player-id="${id}"]`);
      assert.ok(await page.evaluate(id => {
        const {scene3D, pawnManager} = window.gameQA;
        const pos = pawnManager.getPawnMesh(id).position;
        return (scene3D.targetLookAt || scene3D.controls.target).distanceTo(pos) < .05;
      }, id), 'camera focus on pawn ' + id);
    }
    await page.screenshot({path:output + '/hand-tray-' + width + '.png'});
    const remote = '#tray-cards [data-key="CARD:REMOTE_DICE"]';
    if (mobile) {
      const touch = await page.createCDPSession();
      const point = await page.$eval(remote, el => {
        const r = el.getBoundingClientRect();
        return {x:r.left + r.width / 2, y:r.top + r.height / 2};
      });
      // A software GPU may take a full second to acknowledge touchStart.
      // Set the physical event times so a short tap and a hold stay distinct.
      const gesture = async hold => {
        const started = Date.now() / 1000;
        await touch.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[point], timestamp:started});
        if (hold) await page.waitForSelector('#tray-hint:not([hidden])', {visible:true});
        await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[], timestamp:started + (hold ? .65 : .08)});
      };
      await gesture(true);
      assert.equal(await page.$eval('#modal-remote-dice', el => el.classList.contains('hidden')), true);
      await gesture(false);
    } else {
      await page.hover(remote);
      await page.waitForSelector('#tray-hint:not([hidden])', {visible:true});
      const fits = await page.$eval(remote, async button => {
        await Promise.all(button.getAnimations().map(animation => animation.finished));
        const card = button.getBoundingClientRect(), tray = button.parentElement.getBoundingClientRect();
        return card.top >= tray.top && card.bottom <= tray.bottom;
      });
      assert.ok(fits, 'hovered card clipped by the scrolling tray');
      await press(remote);
    }
    await page.waitForSelector('#modal-remote-dice:not(.hidden)');
    await press('.dice-choice-btn[data-val="1"]');
    await page.waitForFunction(() => window.gameQA.gameState.players[0].currentTile === 1 &&
      !window.gameQA.gameState.players[0].cards.includes('REMOTE_DICE'), {timeout:45000});
    await page.reload();
    await page.waitForSelector('[data-profile="0"]');
    await press('#start-game-btn');
    await page.waitForSelector('#hud-layer:not(.hidden)');
    assert.equal(await page.$('.onboarding-guide'), null);
    assert.deepEqual(errors, []);
    console.log(width, 'two-click start, four pawn targets, card consumption, first-run guide and overflow passed');
    await context.close();
  }
} finally { await browser?.close(); await server.close(); }
