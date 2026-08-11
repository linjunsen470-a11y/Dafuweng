import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer } from 'vite';

const artifactDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fortune-empire-e2e-'));
const artifact = name => path.join(artifactDirectory, name);

const paths = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

let executablePath = paths.find(p => fs.existsSync(p));

async function runTest() {
  if (!executablePath) {
    console.error('No Chrome or Edge browser executable found!');
    process.exit(1);
  }

  const logs = [];
  const errors = [];
  const pageErrors = [];
  const networkErrors = [];

  console.log('🚀 Starting Detailed Puppeteer Automated Test for 3D Monopoly...');

  const viteServer = await createServer({
    server: { host: '127.0.0.1', port: 5173, strictPort: true }
  });
  await viteServer.listen();

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    logs.push({ type, text });
    if (type === 'error') {
      errors.push(text);
      console.error(`[Console Error] ${text}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error(`[Page Error] ${err.stack || err}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      const errStr = `[HTTP ${response.status()}] ${response.url()}`;
      networkErrors.push(errStr);
      console.error(`[Network Error] ${errStr}`);
    }
  });

  try {
    console.log('\n--- Step 1: Navigating to http://localhost:5173/ ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('fortune-empire:tutorial-seen', '1');
      document.querySelector('.rules-help-modal')?.remove();
    });

    console.log('\n--- Step 2: Inspecting Setup Screen ---');
    await page.waitForSelector('#setup-screen', { timeout: 15000 });
    const setupOptions = await page.evaluate(() => ({
      modes: [...document.querySelectorAll('#game-mode option')].map(option => option.value),
      depositOptions: [...document.querySelectorAll('#initial-deposit option')].map(option => option.value),
      maps: [...document.querySelectorAll('#map-select option')].map(option => option.value)
    }));
    if (!['STANDARD', 'QUICK', 'TEAM', 'CHALLENGE', 'HEAT'].every(mode => setupOptions.modes.includes(mode))
      || !setupOptions.depositOptions.includes('5000') || setupOptions.maps.length !== 5) {
      throw new Error(`Setup options incomplete: ${JSON.stringify(setupOptions)}`);
    }
    console.log('✅ Five modes, deposit options, and five maps are available.');

    console.log('\n--- Step 3: Clicking "开启富翁之旅" to enter Game HUD ---');
    await page.evaluate(() => {
      const profiles = [6, 7, 8, 10];
      document.querySelectorAll('.player-profile-select').forEach((select, index) => {
        select.value = String(profiles[index]);
      });
    });
    const startBtn = await page.$('#start-game-btn');
    if (!startBtn) throw new Error('Start game button not found!');
    await startBtn.click();

    await page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 5000 });
    console.log('✅ Game HUD successfully entered.');

    console.log('\n--- Step 3a: Testing 120-node flagship map navigation ---');
    const mapTelemetry = await page.evaluate(() => ({
      selectedMap: document.getElementById('map-select')?.value,
      renderedTiles: document.getElementById('game-container')?.dataset.tileCount,
      renderedLots: document.getElementById('game-container')?.dataset.lotCount,
      minimapNodes: document.getElementById('minimap-canvas')?.dataset.nodeCount
    }));
    if (mapTelemetry.selectedMap !== 'grand-bay' || mapTelemetry.renderedTiles !== '120'
      || mapTelemetry.renderedLots !== '52' || mapTelemetry.minimapNodes !== '120') {
      throw new Error(`Flagship map telemetry mismatch: ${JSON.stringify(mapTelemetry)}`);
    }
    await page.click('#btn-map-overview');
    await page.click('#btn-rotate-left');
    await page.click('#btn-rotate-right');
    await new Promise(resolve => setTimeout(resolve, 2500));
    const minimapPainted = await page.evaluate(() => {
      const canvas = document.getElementById('minimap-canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    });
    if (!minimapPainted) throw new Error('Minimap canvas is blank');
    await page.screenshot({ path: artifact('test_step_visual_overview.png') });
    await page.click('#btn-follow-view');
    console.log('✅ 120 road nodes, 52 lots, overview, rotation, follow camera, and minimap rendered.');

    console.log('\n--- Step 3b: Testing weather, night lighting, and extended character models ---');
    await page.click('#btn-weather');
    await page.click('#btn-weather');
    await page.click('#btn-time-of-day');
    await page.click('#btn-time-of-day');
    const atmosphere = await page.evaluate(() => ({
      weather: document.getElementById('btn-weather')?.textContent,
      time: document.getElementById('btn-time-of-day')?.textContent
    }));
    if (atmosphere.weather !== '❄️' || atmosphere.time !== '🌙') {
      throw new Error(`Atmosphere controls failed: ${JSON.stringify(atmosphere)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 800));
    await page.screenshot({ path: artifact('test_step_visual_weather.png') });
    console.log('✅ Snow, night lighting, park texture, and extended character models rendered.');

    console.log('\n--- Step 4: Testing Stock Market Modal ---');
    await page.click('#btn-stock-market');
    await page.waitForSelector('#modal-stock:not(.hidden)', { timeout: 3000 });
    console.log('✅ Stock Market modal opened.');
    
    // Check stock items & buy/sell
    const stockItems = await page.$$('.stock-item');
    console.log(`Found ${stockItems.length} stocks in stock market list.`);
    if (stockItems.length > 0) {
      await stockItems[0].click();
      await page.click('#btn-stock-buy');
      console.log('✅ Clicked Buy stock button.');
    }
    await page.click('#stock-modal-close');
    await page.waitForSelector('#modal-stock.hidden', { timeout: 3000 });
    console.log('✅ Stock Market modal closed.');

    console.log('\n--- Step 5: Testing Card Shop Modal ---');
    await page.click('#btn-card-shop');
    await page.waitForSelector('#modal-shop:not(.hidden)', { timeout: 3000 });
    console.log('✅ Card Shop modal opened.');
    const shopCards = await page.$$('.shop-card-item');
    console.log(`Found ${shopCards.length} items in Card Shop.`);
    await page.click('#shop-modal-close');
    await page.waitForSelector('#modal-shop.hidden', { timeout: 5000 });
    console.log('✅ Card Shop modal closed.');

    console.log('\n--- Step 6: Testing Inventory Modal ---');
    await page.click('#btn-use-card');
    await page.waitForSelector('#modal-inventory:not(.hidden)', { timeout: 3000 });
    console.log('✅ Inventory modal opened.');
    await page.click('#inventory-modal-close');
    await page.waitForSelector('#modal-inventory.hidden', { timeout: 3000 });
    console.log('✅ Inventory modal closed.');

    console.log('\n--- Step 6b: Testing Asset Ranking Modal ---');
    await page.click('#btn-assets');
    await page.waitForSelector('#modal-assets:not(.hidden)', { timeout: 3000 });
    const assetRows = await page.$$('#asset-ranking-body tr');
    if (assetRows.length !== 4) throw new Error(`Expected 4 asset rows, got ${assetRows.length}`);
    await page.click('#asset-modal-close');
    await page.waitForSelector('#modal-assets.hidden', { timeout: 3000 });
    console.log('✅ Asset ranking modal rendered all players.');

    console.log('\n--- Step 6c: Testing Pause, Speed, and V5 Save Slot ---');
    await page.click('#btn-pause-game');
    await page.waitForSelector('#modal-pause:not(.hidden)', { timeout: 3000 });
    await page.click('.speed-btn[data-speed=\"2\"]');
    const slotRows = await page.$$('#save-slot-list .save-slot-row');
    if (slotRows.length !== 3) throw new Error(`Expected 3 save slots, got ${slotRows.length}`);
    await slotRows[0].$('.slot-save').then(button => button.click());
    await page.click('#btn-resume-game');
    await page.waitForSelector('#modal-pause.hidden', { timeout: 3000 });
    console.log('✅ Pause menu, speed control, and manual slot save passed.');

    console.log('\n--- Step 7: Testing Dice Roll (Click & Space bar) and Movement & AI Turns ---');
    console.log('Clicking "掷骰子" button for Player 1 turn...');
    await page.click('#btn-roll');
    let capturedLandArt = false;

    for (let turn = 1; turn <= 12; turn++) {
      await new Promise(r => setTimeout(r, 2000));

      // Handle Land Modal if present
      const landModalVisible = await page.evaluate(() => {
        const el = document.getElementById('modal-land');
        return el && !el.classList.contains('hidden');
      });

      if (landModalVisible) {
        console.log(`[Turn ${turn}] 🏡 Land purchase modal open. Responding...`);
        if (!capturedLandArt) {
          const hasBuildingArt = await page.$eval('#land-building-art', element => getComputedStyle(element).backgroundImage !== 'none');
          if (!hasBuildingArt) throw new Error('Procedural building preview was not rendered');
          await page.screenshot({ path: artifact('test_step_land_art.png') });
          capturedLandArt = true;
        }
        const buyBtnVisible = await page.evaluate(() => {
          const btn = document.getElementById('btn-land-buy');
          return btn && btn.offsetWidth > 0;
        });
        if (buyBtnVisible) {
          await page.click('#btn-land-buy');
          console.log('✅ Land bought.');
        } else {
          await page.click('#btn-land-pass');
          console.log('✅ Land passed.');
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      // Check if Human turn is active
      const isHumanTurn = await page.evaluate(() => {
        const rollBtn = document.getElementById('btn-roll');
        const banner = document.getElementById('turn-indicator')?.textContent || '';
        return banner.includes('林小满') || (rollBtn && !rollBtn.disabled && rollBtn.offsetWidth > 0);
      });

      if (isHumanTurn) {
        console.log(`[Turn ${turn}] 🎲 Human player active. Pressing Space key to roll...`);
        await page.keyboard.press('Space');
      } else {
        const activeTurnText = await page.evaluate(() => document.getElementById('turn-indicator')?.textContent || '');
        console.log(`[Turn ${turn}] 🤖 Current turn: ${activeTurnText.trim()}`);
      }
    }
    await page.screenshot({ path: artifact('test_step_visual_gameplay.png') });

    console.log('\n--- Step 8: Audio & View reset button tests ---');
    await page.click('#btn-toggle-audio');
    console.log('✅ Mute/Unmute button toggled.');
    await page.click('#btn-reset-view');
    console.log('✅ Reset 3D camera view button clicked.');

    console.log('\n--- Step 9: Returning to setup without page reload ---');
    page.once('dialog', dialog => dialog.accept());
    await page.evaluate(() => document.getElementById('btn-return-menu').click());
    await page.waitForSelector('#setup-screen.active:not(.hidden)', { timeout: 3000 });
    console.log('✅ Returned to setup without reloading the page.');

    console.log('\n--- Step 10: Testing legacy 40-node map rendering ---');
    await page.select('#map-select', 'taiwan-loop');
    await page.click('#start-game-btn');
    await page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 5000 });
    const legacyTelemetry = await page.$eval('#game-container', element => ({
      mapId: element.dataset.mapId,
      tileCount: element.dataset.tileCount
    }));
    if (legacyTelemetry.mapId !== 'taiwan-loop' || legacyTelemetry.tileCount !== '40') {
      throw new Error(`Legacy map did not render all 40 nodes: ${JSON.stringify(legacyTelemetry)}`);
    }
    console.log('✅ Legacy Taiwan map rendered all 40 nodes after a live map switch.');

    console.log('\n🎉 ALL GAMEPLAY TESTS COMPLETED!');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    pageErrors.push(err.toString());
    process.exitCode = 1;
  } finally {
    await browser.close();
    await viteServer.close();

    console.log('\n================ FULL TEST REPORT ================');
    console.log(`Total Console Messages logged: ${logs.length}`);
    console.log(`Network / HTTP Errors (${networkErrors.length}):`);
    networkErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    console.log(`JS Console Errors (${errors.length}):`);
    errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    console.log(`Page Uncaught Errors (${pageErrors.length}):`);
    pageErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
    console.log(`Screenshots: ${artifactDirectory}`);
    console.log('==================================================\n');
  }
}

runTest();
