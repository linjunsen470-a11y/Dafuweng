import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {preview} from 'vite';
const report={kind:'real browser audio output and preferences',checks:[],recordings:[],errors:[],subjectiveListening:'Not completed: this environment has no available listening endpoint. Rendered PCM checks are not a listening verdict.'};
const server=await preview({build:{outDir:'dist-shanhai'},preview:{host:'127.0.0.1',port:5203,strictPort:true}});let browser;
function wav(samples,rate){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);samples.forEach((s,i)=>b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),44+i*2));return b;}
try{
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,ignoreDefaultArgs:['--mute-audio'],timeout:120000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();page.setDefaultTimeout(60000);await page.setViewport({width:390,height:844});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluateOnNewDocument(()=>{Date.now=()=>314;});
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
 const ready=()=>page.waitForFunction(()=>window.shanhai?.ready),idle=()=>page.waitForFunction(()=>!window.shanhai.busy&&!window.shanhai.session.currentPlayer.isAI);
 const close=()=>page.click('.modal-close');
 const meter=async()=>{await page.evaluate(()=>{
  const a=window.shanhai.audio,c=a.context;const music=c.createMediaElementSource(a.music);music.connect(c.destination);
  const sum=c.createGain();music.connect(sum);a.gain.connect(sum);
  const recorder=c.createScriptProcessor(2048,1,1);sum.connect(recorder);recorder.connect(c.destination);
  window.soundProbe={blocks:[],rate:c.sampleRate,recorder,music,sum};
  recorder.onaudioprocess=e=>{const p=window.soundProbe;p.blocks.push(Array.from(e.inputBuffer.getChannelData(0)));if(p.blocks.length>1400)p.blocks.shift();};
 });};
 const capture=async(seconds=1,path=null)=>{
  const settle=await page.evaluate(()=>window.shanhai.audio.context.currentTime+.2);await page.waitForFunction(t=>window.shanhai.audio.context.currentTime>t,{},settle);
  const duration=await page.evaluate(seconds=>{const p=window.soundProbe;p.blocks=[];return Math.ceil(seconds*p.rate/2048);},seconds);
  await page.waitForFunction(n=>window.soundProbe.blocks.length>=n,{},duration);
  const d=await page.evaluate(()=>{const p=window.soundProbe,samples=p.blocks.flat();let sum=0,peak=0;for(const v of samples){sum+=v*v;peak=Math.max(peak,Math.abs(v));}return{samples,rate:p.rate,rms:Math.sqrt(sum/samples.length),peak};});
  if(path){await fs.writeFile(path,wav(d.samples,d.rate));report.recordings.push(path);}delete d.samples;return d;
 };
 for(const map of ['coast','highland']){
  await page.goto(`http://127.0.0.1:5203/shanhai.html?map=${map}`,{waitUntil:'domcontentloaded'});await ready();
  assert.equal(await page.evaluate(()=>window.shanhai.audio.unlocked),false);
  await page.click('#start-button');await page.waitForFunction(()=>window.shanhai.audio.buffers.size===13&&window.shanhai.audio.context.state==='running');
  if(map==='highland'){assert.equal(await page.evaluate(()=>window.shanhai.audio.musicEnabled),false);assert.equal(await page.$eval('#music-toggle',e=>e.getAttribute('aria-label')),'开启背景音乐');await page.click('#music-toggle');await page.click('#sfx-toggle');}
  await page.waitForFunction(()=>window.shanhai.audio.music.currentTime>.1&&!window.shanhai.audio.music.paused);
  await meter();const music=await capture(8,`qa/chapter-sound-${map}-playback.wav`);assert.ok(music.rms>.001&&music.peak<1);assert.match(await page.evaluate(()=>window.shanhai.audio.music.src),new RegExp(map==='coast'?'saltwind-promenade':'maple-tea-waltz'));
  const loop=await page.evaluate(()=>{const m=window.shanhai.audio.music;m.currentTime=m.duration-.4;return m.duration;});await page.waitForFunction(()=>window.shanhai.audio.music.currentTime<2);const loopOutput=await capture(.5);assert.ok(loopOutput.rms>.0001);
  await page.click('#music-toggle');const mute=await capture(.5);assert.equal(mute.peak,0);assert.equal(await page.evaluate(()=>window.shanhai.audio.music.paused),true);
  await page.click('#audio-settings');await page.focus('#sfx-volume');await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.equal(await page.$eval('#sfx-level',e=>e.textContent),'1%');
  await page.$eval('#sfx-volume',e=>{e.value=35;e.dispatchEvent(new Event('input',{bubbles:true}));});await page.$eval('#music-volume',e=>{e.value=18;e.dispatchEvent(new Event('input',{bubbles:true}));});
  const tones={};for(const name of ['dice','purchase','event-success','event-fail']){await page.evaluate(()=>window.soundProbe.blocks=[]);await page.click(`[data-sound="${name}"]`);await page.waitForFunction(()=>window.soundProbe.blocks.length>16);const d=await page.evaluate(()=>{const p=window.soundProbe,samples=p.blocks.flat();return{samples,rate:p.rate,peak:Math.max(...p.blocks.map(b=>Math.max(...b.map(Math.abs))))};});assert.ok(d.peak>.001,`${name} emits PCM`);tones[name]=d.peak;if(map==='coast'){const path=`qa/chapter-sound-${name}-playback.wav`;await fs.writeFile(path,wav(d.samples,d.rate));report.recordings.push(path);}}
  await page.click('#sfx-enabled');await page.click('[data-sound="dice"]');assert.match(await page.$eval('#sound-status',e=>e.textContent),/静音/);const silence=await capture(.5);assert.equal(silence.peak,0);
  const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('shanhai:audio')));assert.deepEqual(prefs,{musicEnabled:false,sfxEnabled:false,musicVolume:.18,sfxVolume:.35});
  if(map==='coast')await page.screenshot({path:'qa/chapter-sound-mobile.png'});
  await close();await page.click('#sfx-toggle');await page.click('#remote-button');await page.click('[data-step="1"]');await idle();
  assert.equal(await page.evaluate(()=>window.shanhai.session.currentPlayer.currentTile),1);
  const buy=await page.$('#decision-button');assert.ok(buy,'land purchase offered');await buy.click();await idle();assert.ok(await page.evaluate(()=>window.shanhai.audio.lastPlayed.has('purchase')));
  await page.click('#end-turn-button');await idle();await page.click('#supply-button');await page.click('#remote-button');await page.click('[data-step="3"]');await idle();assert.equal(await page.evaluate(()=>window.shanhai.session.focus.kind),'ISLAND_EVENT');await page.click('.event-choice');assert.equal(await page.evaluate(()=>window.shanhai.session.focus.kind),'EVENT_DONE');assert.ok(await page.evaluate(()=>window.shanhai.audio.lastPlayed.has('event-success')||window.shanhai.audio.lastPlayed.has('event-fail')));
  await page.click('#sfx-toggle');await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal(await page.$eval('#sfx-toggle',e=>e.getAttribute('aria-label')),'开启音效');await page.click('#resume-button');assert.equal(await page.evaluate(()=>window.shanhai.audio.music.paused),true);assert.equal(await page.evaluate(()=>window.shanhai.audio.sfxVolume),.35);
  report.checks.push({map,music,loopDuration:loop,loopOutput,mute,tones,silence,gameplay:'actual remote die, purchase, AI turn and chosen event; reload preserves game and muted audio'});
 }
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.success=false;report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));await fs.writeFile('qa/chapter-sound-browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
