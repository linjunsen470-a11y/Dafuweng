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
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
const failures = [];
page.on('pageerror', error => failures.push(error.message));

try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    localStorage.setItem('fortune-empire:tutorial-seen', '1');
    await navigator.serviceWorker.ready;
  });
  await page.reload({ waitUntil: 'networkidle0' });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  if (!controlled) throw new Error('Service worker did not control the installed app.');

  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#setup-screen', { timeout: 5000 });
  await page.select('#player-count', '2');
  await page.click('#start-game-btn');
  await page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 5000 });
  await page.click('#btn-pause-game');
  await page.waitForSelector('#modal-pause:not(.hidden)', { timeout: 3000 });
  const saveButton = await page.$('#save-slot-list .save-slot-row .slot-save');
  await saveButton.click();
  const savedRound = await page.evaluate(() => {
    const raw = localStorage.getItem('fortune-empire:slot:v9:1');
    return raw ? JSON.parse(raw).round : null;
  });
  if (savedRound !== 1) throw new Error('Offline V9 save slot was not persisted.');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#setup-screen', { timeout: 5000 });
  const persisted = await page.evaluate(() => Boolean(localStorage.getItem('fortune-empire:slot:v9:1')));
  const caches = await page.evaluate(() => window.caches.keys());
  if (!persisted || !caches.includes('fortune-empire-v5')) throw new Error('Offline refresh did not retain cache/save data.');
  if (failures.length) throw new Error(`PWA page errors: ${failures.join('; ')}`);
  console.log('PWA install, offline launch, offline new game, V9 save, and offline refresh passed.');
} finally {
  await page.setOfflineMode(false).catch(() => {});
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
