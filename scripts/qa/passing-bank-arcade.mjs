import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import { executablePath } from './browser-path.mjs';

const output = '/tmp/dafuweng-qa/bank-arcade';
await mkdir(output, { recursive: true });
process.env.TMPDIR = output;
const server = await createServer({
  cacheDir: output + '/vite',
  plugins: [{
    name: 'observe-bank-arcade',
    transform(code, id) {
      if (id.endsWith('/src/main.js')) return code.replace('new GameController();', 'window.gameQA = new GameController();');
    }
  }],
  server: { host: '127.0.0.1', port: 5245, hmr: false, watch: null }
});
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    if (process.env.QA_WIDTH && width !== Number(process.env.QA_WIDTH)) continue;
    const mobile = width === 390;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    const press = selector => mobile ? page.tap(selector) : page.click(selector);
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => window.gameQA);
    assert.ok(await page.$eval('#load-auto-save-btn', el => el.classList.contains('hidden')));
    await press('[data-map="taiwan-loop"]');
    await page.select('#player-count', '2');
    await page.select('.lobby-seat:nth-child(2) .player-type-select', 'HUMAN');
    await press('#start-game-btn');
    await page.waitForSelector('[data-skip]');
    await press('[data-skip]');
    await page.waitForFunction(() => gameQA.pawnManager.pawns.length === 2 && gameQA.pawnManager.pawns.every(p => p.skin));
    await page.evaluate(() => {
      // Direct a single walk from the fresh spawn through the bank-side fork.
      const roll = gameQA.gameEngine.execute({ type: 'ROLL_DICE', playerId: 0 });
      if (!roll.success) throw Error(roll.reason);
      const observer = new MutationObserver(() => {
        const offer = document.querySelector('.control-panel > .passing-bank-pill');
        if (!offer) return;
        const r = offer.getBoundingClientRect();
        window.bankClearance = document.querySelector('.control-panel').getBoundingClientRect().top - r.bottom;
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      void gameQA.doMovePlayer(11);
    });
    console.log(width + '×' + height, 'walk started');
    await page.waitForSelector('.route-target-bar select');
    await page.select('.route-target-bar select', '12');
    const offer = '#modal-land:not(.hidden) .passing-bank-pill';
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
        && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }, {}, offer);
    console.log(width + '×' + height, 'bank offer docked');
    await press(offer);
    await page.waitForSelector('.bank-center-overlay.is-visible');
    const bank = await page.evaluate(() => ({
      tile: gameQA.gameState.players[0].currentTile,
      before: gameQA.gameState.players[0].deposit,
      amount: Number(document.querySelector('.bank-amount-display input').value),
      clearance: window.bankClearance
    }));
    assert.equal(bank.tile, 13);
    assert.ok(bank.clearance >= 0);
    await page.screenshot({ path: output + '/' + width + '-bank.png' });
    await press('.bank-confirm');
    await page.waitForFunction(bank => gameQA.gameState.players[0].deposit === bank.before + bank.amount, {}, bank);
    await page.waitForSelector('.bank-center-overlay', { hidden: true });
    await press('#btn-land-pass');
    await page.waitForSelector('.hotseat-ready');
    await press('.hotseat-ready');
    await page.evaluate(() => {
      // Target the rare arcade landing via the engine, then use the normal prize and turn flow.
      const moved = gameQA.gameEngine.execute({ type: 'TELEPORT_PLAYER', playerId: 1, payload: { tileId: 23 } });
      if (!moved.success) throw Error(moved.reason);
      gameQA.gameEngine.subscribe(e => { if (e.type === 'MINIGAME_COMPLETED') window.arcadeAward = e; });
      void gameQA.handleTileArrival(moved.tileId);
    });
    await page.waitForSelector('.minigame-start');
    console.log(width + '×' + height, 'deposit settled, arcade ready');
    await page.waitForFunction(() => gameQA.scene3D.backdropPainted);
    const backdropFrame = await page.evaluate(() => gameQA.scene3D.renderer.info.render.frame);
    const input = await page.createCDPSession();
    await page.exposeFunction('aimBasket', async rect => {
      if (mobile) {
        const y = rect.y + rect.height * .84;
        const touch = (type, points) => input.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        await touch('touchStart', [{ x: rect.x + rect.width * .80, y }]);
        await touch('touchMove', [{ x: rect.x + rect.width * .42, y }]);
        await touch('touchEnd', []);
      } else {
        await page.keyboard.press('ArrowLeft');
      }
    });
    await page.exposeFunction('tapPrize', async ({ x, y }) => {
      if (mobile) {
        await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await input.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x, y });
        await input.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x, y });
      }
    });
    await page.evaluate(() => {
      window.arcade = { feedback: [], attempts: 0, drops: 0 };
      let tapping = false;
      const modal = document.querySelector('.minigame-modal');
      const observer = new MutationObserver(() => {
        const stage = modal.querySelector('.sky-coins-stage');
        if (!stage) return;
        const basket = stage.querySelector('.sky-basket');
        if (!arcade.aimed && basket) {
          arcade.aimed = true;
          void window.aimBasket(stage.getBoundingClientRect().toJSON());
        }
        if (!basket) return;
        arcade.basket = basket.style.left;
        const progress = modal.querySelector('.minigame-progress').textContent.match(/\d+/);
        if (progress) arcade.drops = Number(progress[0]);
        const feedback = stage.querySelector('.minigame-feedback').textContent;
        if (feedback !== arcade.feedback.at(-1)) arcade.feedback.push(feedback);
        if (tapping || !arcade.feedback.some(s => s.includes('稳稳接住')) || arcade.feedback.some(s => s.includes('精准命中'))) return;
        if (!arcade.catchPosition) arcade.catchPosition = basket.style.left;
        const coin = [...stage.querySelectorAll('.sky-object:not(.kind-bomb)')].find(el => {
          const y = parseFloat(el.style.top);
          return y > 8 && y < 67;
        });
        if (!coin) return;
        const r = coin.getBoundingClientRect();
        const target = { x: r.x + r.width / 2, y: r.y + r.height / 2 + 6 };
        if (!coin.contains(document.elementFromPoint(target.x, target.y))) return;
        tapping = true;
        arcade.attempts++;
        void window.tapPrize(target).finally(() => { tapping = false; });
      });
      observer.observe(modal, { subtree: true, childList: true });
    });
    // Capture the board before the clock starts: a software compositor can block
    // the renderer during a full-viewport screenshot.
    await page.screenshot({ path: output + '/' + width + '-board-arcade.png', waitForFonts: false });
    await press('.minigame-start');
    await page.waitForSelector('.minigame-claim');
    assert.equal(await page.evaluate(() => gameQA.scene3D.renderer.info.render.frame), backdropFrame);
    const before = await page.evaluate(() => gameQA.gameState.players[1].cardPoints);
    await press('.minigame-claim');
    await page.waitForFunction(() => window.arcadeAward && gameQA.gameState.currentPlayerIndex === 0);
    await page.waitForFunction(frame => gameQA.scene3D.renderer.info.render.frame > frame, {}, backdropFrame);
    const result = await page.evaluate(() => ({
      frameAfterClaim: gameQA.scene3D.renderer.info.render.frame,
      feedback: arcade.feedback, drops: arcade.drops, attempts: arcade.attempts, basket: arcade.catchPosition || arcade.basket,
      score: arcadeAward.score, reward: arcadeAward.reward,
      viewport: [innerWidth, innerHeight], points: gameQA.gameState.players[1].cardPoints, overflow: document.documentElement.scrollWidth - innerWidth
    }));
    console.log(width + '×' + height, JSON.stringify({ bank, backdropFrame, ...result, errors }));
    assert.ok(Math.abs(parseFloat(result.basket) - (mobile ? 42 : 43)) < 1);
    assert.ok(result.feedback.some(s => s.includes('稳稳接住')));
    assert.ok(result.feedback.some(s => s.includes('精准命中')));
    assert.equal(result.points, before + result.reward);
    assert.ok(result.reward > 0);
    assert.deepEqual(result.viewport, [width, height]);
    assert.equal(result.overflow, 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
