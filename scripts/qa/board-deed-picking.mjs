import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { executablePath } from './browser-path.mjs';

const output = '/tmp/dafuweng-qa';
await mkdir(output, { recursive: true });
process.env.TMPDIR = output;
const server = await createServer({
  cacheDir: output + '/.vite-deed-picking',
  server: { host: '127.0.0.1', port: 0, watch: null, hmr: false },
  plugins: [{ name: 'observe-deed-picking', transform(code, id) {
    if (id.endsWith('/src/main.js')) return code.replace('new GameController();', 'window.gameQA = new GameController();');
  } }]
});
await server.listen();

// The panel occupies part of the mobile board. Prefer the purchased parcel,
// then choose another visible parcel distinct from the initial selection.
async function tilePoint(page, insideInspector) {
  return page.evaluate(async insideInspector => {
    const { boardBuilder, scene3D, gameState, mapInspector, pawnManager } = window.gameQA;
    const { boardPicker } = await import('/src/ui/BoardPointing.js');
    const pick = boardPicker(scene3D, boardBuilder, pawnManager, gameState);
    const canvas = scene3D.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const radius = navigator.maxTouchPoints ? 16 : 2;
    const contact = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]];
    const candidates = insideInspector ? gameState.mapDefinition.tiles.filter(tile =>
      tile.type === 'PROPERTY' && tile.id !== mapInspector.selected).map(tile => tile.id) : [1];
    for (const id of candidates) {
      for (const [dx, dz] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const position = boardBuilder.tilePositions[id].clone();
        position.x += dx;
        position.z += dz;
        position.project(scene3D.camera);
        if (Math.abs(position.z) > 1) continue;
        const x = Math.round(rect.x + (1 + position.x) * rect.width / 2);
        const y = Math.round(rect.y + (1 - position.y) * rect.height / 2);
        if (contact.every(([ox, oy]) => document.elementFromPoint(x + ox, y + oy) === canvas) && pick(x, y)?.id === id) {
          return { x, y, id };
        }
      }
    }
    throw Error('No visible target parcel');
  }, insideInspector);
}

async function checkCard(page, container, width, stage, tileId = 1) {
  const selector = container + ` .deed-card[data-tile-id="${tileId}"]`;
  await page.waitForSelector(selector, { visible: true });
  const result = await page.$eval(selector, async (card, container) => {
    const state = window.gameQA.gameState;
    const id = Number(card.dataset.tileId);
    const prop = state.propertyManager.getProperty(id);
    const viewport = card.closest(container).getBoundingClientRect();
    const overlap = [...document.querySelectorAll('.top-bar, .left-panel, .control-panel, #turn-indicator')].filter(el => {
      const box = el.getBoundingClientRect();
      return viewport.left < box.right && viewport.right > box.left && viewport.top < box.bottom && viewport.bottom > box.top;
    }).map(el => el.className);
    const fields = {};
    for (const name of ['owner-name', 'level', 'rent', 'chain']) {
      const el = card.querySelector('.deed-' + name);
      const box = el?.getBoundingClientRect();
      if (!box?.width || box.bottom > viewport.bottom + 1 || box.top < viewport.top - 1) throw Error('Clipped deed ' + name);
      fields[name] = el.innerText;
    }
    if (prop.owner != null) {
      const image = new Image();
      const css = getComputedStyle(card.querySelector('.deed-portrait')).backgroundImage;
      image.src = css.match(/^url\("(.*)"\)$/)?.[1] || '';
      await image.decode();
    }
    return {
      id, fields, overlap, ownerId: prop.owner, owner: state.players[prop.owner]?.name, level: prop.level,
      quote: card.querySelector('.deed-rent strong').textContent,
      toll: state.propertyManager.calculateToll(id, state.newsEffect, state.priceIndex, state.getCurrentPlayer()),
      onScreen: viewport.left >= 0 && viewport.right <= innerWidth && viewport.top >= 0 && viewport.bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth
    };
  }, container);
  assert.ok(result.onScreen, 'Deed should fit in the viewport');
  assert.equal(result.overflow, 0);
  assert.deepEqual(result.overlap, [], 'Deed should clear the permanent HUD');
  assert.equal(result.ownerId, stage !== 'vacant' && tileId === 1 ? 0 : null);
  assert.ok(result.fields['owner-name'].includes(result.owner || '无主'));
  assert.ok(result.fields.level.includes('Lv.' + result.level));
  assert.equal(result.quote, '$' + result.toll.toLocaleString());
  assert.ok(result.fields.chain.includes('无连片加成'));
  console.log(width, stage, JSON.stringify(result));
  if (stage !== 'vacant') await page.screenshot({ path: output + '/deed-' + stage + '-' + width + '.png' });
}

let browser;
try {
  browser = await puppeteer.launch({
    executablePath, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    if (process.env.QA_WIDTH && width !== Number(process.env.QA_WIDTH)) continue;
    const mobile = width === 390;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    page.setDefaultTimeout(60000);
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    const press = async selector => {
      await page.waitForSelector(selector, { visible: true });
      if (mobile) await page.tap(selector);
      else await page.click(selector);
    };
    const pick = async (insideInspector = false) => {
      const { x, y, id } = await tilePoint(page, insideInspector);
      console.log(width, insideInspector ? 'inspector pick' : 'board pick', id, { x, y });
      if (mobile) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      return id;
    };
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForSelector('[data-profile="0"]');
    assert.equal(await page.$('#load-auto-save-btn:not(.hidden), #load-manual-save-btn:not(.hidden)'), null);
    await press('.lobby-advanced summary');
    await page.select('#player-count', '2');
    await page.select('.lobby-seat:nth-child(2) .player-type-select', 'HUMAN');
    await press('#start-game-btn');
    await press('.onboarding-guide [data-skip]');
    await page.waitForFunction(() => window.gameQA.pawnManager.pawns.every(pawn => pawn.skin) &&
      !window.gameQA.scene3D.targetCameraPos && !window.gameQA.scene3D.targetLookAt);
    const tip = '.board-tip:not([hidden])';
    await pick();
    if (!mobile) await page.hover('#btn-inspect-map');
    await checkCard(page, tip, width, 'vacant');
    if (mobile) await pick();
    else await page.keyboard.press('Escape');
    await page.waitForSelector('.board-tip', { hidden: true });

    // A normal opening card lands the first player on the inspected parcel.
    const remote = '#tray-cards [data-key="CARD:REMOTE_DICE"]';
    if (mobile) {
      const point = await page.$eval(remote, el => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      const input = await page.createCDPSession();
      const start = Date.now() / 1000;
      await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point], timestamp: start });
      await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: start + .08 });
      await input.detach();
    } else await press(remote);
    await press('.dice-choice-btn[data-val="1"]');
    await press('#btn-land-buy');
    await press('.hotseat-ready');
    await page.waitForFunction(() => {
      const g = window.gameQA;
      return g.gameState.getCurrentPlayer().id === 1 && g.gameState.phase === 'PRE_ROLL_ACTION' &&
        !g.scene3D.targetCameraPos && !g.scene3D.targetLookAt;
    });
    await pick();
    await checkCard(page, tip, width, 'owned');
    await press('#btn-inspect-map');
    await page.waitForSelector('.board-tip', { hidden: true });
    const selectorIsOpen = () => page.$eval('#map-inspector-select', select => select.matches(':open'));
    assert.equal(await selectorIsOpen(), false, 'Opening the inspector should leave the board visible');
    const inspectedId = await pick(true);
    await checkCard(page, '#map-inspector', width, 'inspector', inspectedId);
    assert.equal(await selectorIsOpen(), false, 'Picking a tile should leave the native selector closed');
    await press('#map-inspector-close');
    await page.waitForSelector('#map-inspector', { hidden: true });
    assert.ok(await page.$eval('#btn-roll', button => !button.disabled));
    assert.deepEqual(await page.evaluate(() => gameQA.gameState.players.map(player => player.currentTile)), [1, 0]);
    assert.deepEqual(errors, []);
    console.log(width + '×' + height, 'physical pick, purchase, handoff, close passed, 0 console errors');
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
