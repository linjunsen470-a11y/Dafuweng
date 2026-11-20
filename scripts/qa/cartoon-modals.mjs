import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';

const output = '/tmp/dafuweng-qa';
await mkdir(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0, hmr: false } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const mobile = width === 390;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile });
    const press = async selector => {
      await page.waitForSelector(selector, { visible: true });
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return el.contains(hit) && !el.closest('.modal-box')?.getAnimations().some(animation => animation.playState === 'running');
      }, {}, selector);
      if (mobile) await page.tap(selector);
      else await page.click(selector);
    };
    await page.goto(server.resolvedUrls.local[0]);
    await press('.rules-help-ready');
    await press('#start-game-btn');
    await page.waitForSelector('#btn-roll:enabled', { visible: true });
    for (const [name, open, close] of [
      ['stock', '#btn-stock-market', '#stock-modal-close'],
      ['inventory', '#btn-use-card', '#inventory-modal-close'],
      ['shop', '#btn-card-shop', '#shop-modal-close'],
      ['assets', '#btn-assets', '#asset-modal-close'],
      ['pause', '#btn-pause-game', '#btn-resume-game']
    ]) {
      if (mobile && ['assets', 'pause'].includes(name)) await press('#btn-mobile-tools');
      await press(open);
      const modal = '#modal-' + name;
      await page.waitForSelector(modal + ':not(.hidden)');
      await page.waitForFunction(selector => document.querySelector(selector).getAnimations().every(animation => animation.playState === 'finished'), {}, modal + ' .modal-box');
      if (name === 'stock') {
        await press('#stock-chart-mode');
        assert.equal(await page.$eval('#stock-chart-mode', el => el.getAttribute('aria-pressed')), 'true');
      }
      if (name === 'inventory' || name === 'shop') {
        const clippedActions = await page.$$eval(modal + ' .strategy-card button', buttons =>
          buttons.filter(button => button.getBoundingClientRect().bottom > button.closest('article').getBoundingClientRect().bottom + 1).length);
        assert.equal(clippedActions, 0, name + ' clipped actions');
        if (name === 'shop') await press('#shop-filter-tabs [data-card-filter="ITEM"]');
        const pictures = await page.$$eval(modal + ' .strategy-card-art img', images =>
          Promise.all(images.map(async image => { await image.decode(); return image.getAttribute('src'); })));
        assert.ok(pictures.length > 0);
        assert.ok(!(await page.$eval(modal, el => el.innerText)).includes('undefined'));
        assert.ok(pictures.every(path => path.endsWith('.svg')));
      }
      if (name === 'assets') {
        await press('[data-asset-tab="DISTRICTS"]');
        await page.waitForSelector('#asset-district-panel:not(.hidden)');
        await press('[data-asset-tab="RANKING"]');
      }
      const layout = await page.$eval(modal + ' .modal-box', box => {
        const rect = box.getBoundingClientRect();
        return {
          left: rect.left, right: rect.right, width: innerWidth,
          overflow: Math.max(document.documentElement.scrollWidth - innerWidth, box.scrollWidth - box.clientWidth),
          paint: getComputedStyle(box).backgroundImage
        };
      });
      assert.equal(layout.width, width);
      assert.ok(layout.left >= -1 && layout.right <= layout.width + 1 && layout.overflow <= 1, JSON.stringify({ name, layout }));
      assert.ok(layout.paint.includes('255, 251, 235'), name + ' paper panel');
      await page.screenshot({ path: output + '/' + name + '-' + width + '.png' });
      if (name === 'shop') {
        await press('#shop-card-grid [data-entry-key="ITEM:MOTOR"] .strategy-primary');
        await page.waitForSelector('.card-acquisition.is-visible');
        const art = await page.$eval('.card-acquisition-art', image => image.getAttribute('src'));
        assert.equal(art, '/assets/item_motor.svg');
        await page.waitForSelector('.card-acquisition', { hidden: true });
      }
      await press(close);
      await page.waitForSelector(modal, { hidden: true });
      console.log(width + '×' + height, name, 'horizontal overflow', layout.overflow);
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await press('#btn-use-card');
    const entry = '#inventory-card-grid [data-entry-key="ITEM:MOTOR"]';
    await page.waitForSelector(entry);
    const reducedDuration = await page.$eval('#modal-inventory .modal-box', box => parseFloat(getComputedStyle(box).animationDuration));
    assert.ok(reducedDuration < .001, 'Reduced motion must suppress the spring');
    await press(entry + ' .strategy-primary');
    await page.waitForSelector('.presentation-impact-card[src="/assets/item_motor.svg"]');
    await page.waitForSelector('.presentation-impact-card', { hidden: true });
    assert.equal(await page.$eval('#dice-count-select', select => select.value), '2');
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
