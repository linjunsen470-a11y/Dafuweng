import puppeteer from 'puppeteer-core';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
const server = await createServer({ server: {host:'127.0.0.1',port:5178,strictPort:true} });
await server.listen();
const browser = await puppeteer.launch({executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const page = await browser.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
try {
 await page.setViewport({width:1440,height:900});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
 await page.goto('http://127.0.0.1:5178');
 await page.waitForSelector('#start-game-btn');
 await page.click('#start-game-btn');
 await page.waitForSelector('#hud-layer:not(.hidden)');
 await new Promise(r=>setTimeout(r,1500));
 await page.screenshot({path:'/tmp/dafuweng-desktop.png'});
 await page.click('#btn-stock-market');
 await page.waitForSelector('#modal-stock:not(.hidden)');
 assert(await page.$eval('#hud-layer',e=>e.inert));
 assert(await page.evaluate(()=>document.querySelector('#modal-stock').contains(document.activeElement)));
 // Nested dialogs preserve the underlying window but only expose the top one.
 await page.evaluate(()=>document.getElementById('modal-assets').classList.remove('hidden'));
 await page.waitForFunction(()=>document.getElementById('modal-stock').inert);
 assert.equal(await page.$eval('#modal-stock',e=>getComputedStyle(e).visibility),'hidden');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.getElementById('modal-stock').inert);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.getElementById('hud-layer').inert);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'btn-stock-market');
 // Closing the land decision must run its pass callback exactly once.
 const passes=await page.evaluate(async()=>{
   const {DialogUI}=await import('/src/ui/DialogUI.js');
   const dialog={landModal:document.getElementById('modal-land'), hideLandModal:DialogUI.prototype.hideLandModal}; let count=0;
   DialogUI.prototype.showLandPurchase.call(dialog, {tileData:{name:'测试地块',price:100,tolls:[10,20],buildCost:50},currentLevel:0,onPass:()=>count++});
   document.getElementById('land-modal-close').click(); return count;
 });
 assert.equal(passes,1);
 for(const [width,height,name] of [[1280,720,'compact'],[390,844,'mobile']]) {
  await page.setViewport({width,height}); await new Promise(r=>setTimeout(r,250));
  await page.screenshot({path:`/tmp/dafuweng-${name}.png`});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: dialog isolation, focus restoration, Escape stack, land-close callback, desktop/mobile rendering.');
} finally {await browser.close();await server.close();}
