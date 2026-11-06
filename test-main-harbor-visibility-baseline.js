import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from './src/game/GameState.js';
const report={checks:[],errors:[],limits:['Prepared four-player saves one step before each existing facility; actual roll/dialog/transaction, not a full natural match.','390px Chromium touch viewport with software WebGL, not a physical phone, FPS or subjective audio test.']};
function fixture(tile){const s=new GameState({seed:64});s.setupGame([0,1,2,3].map((profileIndex,i)=>({name:`玩家${i+1}`,profileIndex,isAI:i>0})),60000,{mapId:'grand-bay',initialDeposit:5000});s.boardGods=[];s.roadEntities=[];s.players.forEach(p=>{p.godType=null;p.currentTile=tile;});s.players[0].currentTile=tile;s.players[0].moveLimitThisTurn=1;s.players[0].cardPoints=500;const snap=s.createSnapshot();for(const [id,level] of [[3,1],[6,2],[8,3],[11,4]])Object.assign(snap.properties.find(([i])=>i===id)[1],{owner:1,level});return snap;}
const server=await createServer({plugins:[{name:'test-controller',transform(c,id){if(id.endsWith('/src/main.js'))return c.replace('new GameController();','window.__qaGame = new GameController();');}}],server:{host:'127.0.0.1',port:5198,strictPort:true}});await server.listen();
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,protocolTimeout:180000,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let page;
async function open(tile,mobile=false){page=await browser.newPage();page.setDefaultTimeout(90000);await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);page.on('pageerror',e=>report.errors.push(e.message));const snap=fixture(tile);await page.evaluateOnNewDocument(s=>{localStorage.setItem('fortune-empire:tutorial-seen','1');localStorage.setItem('fortune-empire:auto-save:v1',JSON.stringify(s));},snap);await page.goto('http://127.0.0.1:5198/',{waitUntil:'networkidle0',timeout:120000});await page.click('#load-auto-save-btn');await page.waitForFunction(()=>document.querySelector('#game-container').dataset.harborArt==='ready');await page.waitForFunction(()=>!document.querySelector('.presentation-turn-banner.is-visible'));await page.evaluate(()=>__qaGame.actionSpeed=4);return snap;}
async function hit(selector){return page.$eval(selector,e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&(e===h||e.contains(h));});}
try{
 await open(11);await page.screenshot({path:'qa/harbor-visibility-before-crowd.png'});
 const scan=await page.evaluate(async()=>{
  const {Vector3,Box3,Ray}=await import('/node_modules/three/build/three.module.js');const g=__qaGame,b=g.boardBuilder;
  const scenery=b.mapEnvironmentGroup.children.filter(o=>o.children.some(c=>c.userData.isCityWindow||c.geometry?.type==='DodecahedronGeometry'));
  g.scene3D.scene.updateMatrixWorld(true);
  return g.gameState.mapDefinition.tiles.map(t=>{
   const center=b.tilePositions[t.id];g.scene3D.showStreetView(center);const camera=g.scene3D.camera.position;
   const target=center.clone().add(new Vector3(0,1.45,0)),ray=new Ray(camera,target.clone().sub(camera).normalize()),hit=new Vector3();
   const blockers=scenery.filter(o=>ray.intersectBox(new Box3().setFromObject(o),hit)&&hit.distanceTo(camera)<target.distanceTo(camera)-.35);
   return {tile:t.id,blockers:blockers.map(o=>({kind:o.children.some(c=>c.userData.isCityWindow)?'tower':'tree',position:o.position.toArray()}))};
  }).filter(r=>r.blockers.length).sort((a,b)=>b.blockers.length-a.blockers.length);
 });report.scan=scan;console.log(JSON.stringify(scan.slice(0,8)));
 for(const kind of ['tower','tree']){const found=scan.find(r=>r.blockers.some(b=>b.kind===kind));if(!found)continue;
  await page.evaluate(s=>__qaGame.restoreGame(s),fixture(found.tile));await page.screenshot({path:`qa/harbor-visibility-before-${kind}.png`});report[kind+'Tile']=found.tile;
 }
 await page.close();await open(11,true);await page.screenshot({path:'qa/harbor-visibility-before-mobile.png'});report.success=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await server.close();await fs.writeFile('qa/harbor-visibility-baseline.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
