import puppeteer from 'puppeteer-core';
import fs from 'fs';

const paths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`
];

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

    console.log('\n--- Step 2: Inspecting Setup Screen ---');
    await page.waitForSelector('#setup-screen', { timeout: 5000 });

    console.log('\n--- Step 3: Clicking "开启富翁之旅" to enter Game HUD ---');
    const startBtn = await page.$('#start-game-btn');
    if (!startBtn) throw new Error('Start game button not found!');
    await startBtn.click();

    await page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 5000 });
    console.log('✅ Game HUD successfully entered.');

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
    await page.waitForSelector('#modal-shop.hidden', { timeout: 3000 });
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

    console.log('\n--- Step 7: Testing Dice Roll (Click & Space bar) and Movement & AI Turns ---');
    console.log('Clicking "掷骰子" button for Player 1 turn...');
    await page.click('#btn-roll');

    for (let turn = 1; turn <= 12; turn++) {
      await new Promise(r => setTimeout(r, 2000));

      // Handle Land Modal if present
      const landModalVisible = await page.evaluate(() => {
        const el = document.getElementById('modal-land');
        return el && !el.classList.contains('hidden');
      });

      if (landModalVisible) {
        console.log(`[Turn ${turn}] 🏡 Land purchase modal open. Responding...`);
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
        return banner.includes('孙小美') || (rollBtn && !rollBtn.disabled && rollBtn.offsetWidth > 0);
      });

      if (isHumanTurn) {
        console.log(`[Turn ${turn}] 🎲 Human player active. Pressing Space key to roll...`);
        await page.keyboard.press('Space');
      } else {
        const activeTurnText = await page.evaluate(() => document.getElementById('turn-indicator')?.textContent || '');
        console.log(`[Turn ${turn}] 🤖 Current turn: ${activeTurnText.trim()}`);
      }
    }

    console.log('\n--- Step 8: Audio & View reset button tests ---');
    await page.click('#btn-toggle-audio');
    console.log('✅ Mute/Unmute button toggled.');
    await page.click('#btn-reset-view');
    console.log('✅ Reset 3D camera view button clicked.');

    console.log('\n🎉 ALL GAMEPLAY TESTS COMPLETED!');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    pageErrors.push(err.toString());
    process.exitCode = 1;
  } finally {
    await browser.close();

    console.log('\n================ FULL TEST REPORT ================');
    console.log(`Total Console Messages logged: ${logs.length}`);
    console.log(`Network / HTTP Errors (${networkErrors.length}):`);
    networkErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    console.log(`JS Console Errors (${errors.length}):`);
    errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    console.log(`Page Uncaught Errors (${pageErrors.length}):`);
    pageErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
    console.log('==================================================\n');
  }
}

runTest();
