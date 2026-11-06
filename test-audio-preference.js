import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
const mode=process.argv.includes('--final')?'final':'baseline';
const report={errors:[],scope:'Actual load-save gesture, mute click, reload/load, unmute click. Analysed Web Audio signal only; no subjective listening.'};
const fixture=JSON.parse(await fs.readFile('qa/continuity-initial-save.json','utf8'));
const server=await createServer({plugins:[{name:'qa-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame=new GameController();');}}],server:{host:'127.0.0.1',port:5240,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=user-gesture-required']});
let page;
async function sample(frames=15){return page.evaluate(async(frames)=>{const a=__qaGame.audioManager;let peak=0;const analyser=a.ctx?.createAnalyser();if(analyser){a.masterCompressor.connect(analyser);const data=new Float32Array(analyser.fftSize);for(let i=0;i<frames;i++){await new Promise(r=>setTimeout(r,30));analyser.getFloatTimeDomainData(data);for(const v of data)peak=Math.max(peak,Math.abs(v));}a.masterCompressor.disconnect(analyser);analyser.disconnect();}const b=document.querySelector('#btn-toggle-audio');return {muted:a.muted,context:a.ctx?.state||null,theme:a.currentTheme,musicGain:a.musicGain?.gain.value,sfxGain:a.sfxGain?.gain.value,musicVolume:a.musicVolume,sfxVolume:a.sfxVolume,peak,icon:b.textContent,label:b.getAttribute('aria-label'),pressed:b.getAttribute('aria-pressed')};},frames);}
try{
 page=await browser.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));await page.setViewport({width:1280,height:800});
 await page.evaluateOnNewDocument(s=>{if(!localStorage.getItem('fortune-empire:auto-save:v1'))localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));localStorage.setItem('fortune-empire:tutorial-seen','1');},fixture);
 await page.goto('http://127.0.0.1:5240/',{waitUntil:'networkidle0',timeout:120000});report.beforeGesture=await sample();await page.click('#load-auto-save-btn');await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');report.playing=await sample();
 await page.click('#btn-toggle-audio');await new Promise(r=>setTimeout(r,500));report.muted=await sample();
 await page.reload({waitUntil:'networkidle0',timeout:120000});report.reloadBeforeGesture=await sample();await page.click('#load-auto-save-btn');await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');report.reloaded=await sample();await page.screenshot({path:`qa/audio-preference-${mode}-reloaded.png`});
 if(mode==='final'){assert.equal(report.reloaded.muted,true);assert.equal(report.reloaded.icon,'🔇');assert.equal(report.reloaded.pressed,'true');assert.ok(report.reloaded.peak<1e-6);await page.click('#btn-toggle-audio');await new Promise(r=>setTimeout(r,500));report.unmuted=await sample(110);assert.equal(report.unmuted.muted,false);assert.equal(report.unmuted.context,'running');assert.ok(report.unmuted.peak>1e-6);}
 assert.equal(report.playing.context,'running');assert.ok(report.playing.peak>1e-6);assert.ok(report.muted.peak<1e-6);assert.equal(report.errors.length,0);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await server.close();await fs.writeFile(`qa/audio-preference-${mode}-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
