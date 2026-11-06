import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { preview } from 'vite';

const browserPaths = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const executablePath = browserPaths.find(candidate => fs.existsSync(candidate));
if (!executablePath) throw new Error('No Chromium browser found for PWA verification.');

const server = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
const browser = await puppeteer.launch({ executablePath, headless: 'new', timeout: 120000, args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(120000);
const failures = [];
page.on('pageerror', error => failures.push(error.message));

try {
  console.log('PWA: load production entry and install offline cache.');
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    localStorage.setItem('fortune-empire:tutorial-seen', '1');
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker install timed out.')), 120000))]);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), { timeout: 120000 });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!controlled) throw new Error('Service worker did not control the installed app.');

  console.log('PWA: installed; switch offline and launch a two-player match.');
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#setup-screen', { timeout: 300000 });
  await page.select('#player-count', '2');
  await page.click('#start-game-btn');
  await page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 300000 });
  console.log('PWA: offline game started; save slot 1.');
  await page.click('#btn-pause-game');
  await page.waitForSelector('#modal-pause:not(.hidden)', { timeout: 30000 });
  const saveButton = await page.$('#save-slot-list .save-slot-row .slot-save');
  await saveButton.click();
  const savedRound = await page.evaluate(() => {
    const raw = localStorage.getItem('fortune-empire:slot:v11:1');
    return raw ? JSON.parse(raw).round : null;
  });
  if (savedRound !== 1) throw new Error('Offline V11 save slot was not persisted.');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#setup-screen', { timeout: 300000 });
  const persisted = await page.evaluate(() => Boolean(localStorage.getItem('fortune-empire:slot:v11:1')));
  const caches = await page.evaluate(() => window.caches.keys());
  if (!persisted || !caches.includes('fortune-empire-v5')) throw new Error('Offline refresh did not retain cache/save data.');
  if (failures.length) throw new Error(`PWA page errors: ${failures.join('; ')}`);
  console.log('PWA install, offline launch, offline new game, V11 save, and offline refresh passed.');
} finally {
  await page.setOfflineMode(false).catch(() => {});
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
