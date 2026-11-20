import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const baseline=process.argv.includes('--before'), phase=baseline?'before':'after';
const touchOnly=process.argv.includes('--touch-only');
const server=await createServer({plugins:[{name:'material-review',enforce:'pre',transform(code,id){
  for(const file of ['src/engine/BoardBuilder.js','src/ui/MinimapUI.js']){
    if(baseline && id.endsWith('/'+file))return execFileSync('git',['show','0db51bc:'+file],{encoding:'utf8'});
  }
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:baseline?5283:5284,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && /shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
  await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
  await page.setViewport({width:1440,height:900});
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>window.boardQA);
  if(!touchOnly)for(const [map,tile] of [['taiwan-loop',0],['fortune-crossroads',3],['city-loop',1],['island-fork',2],['grand-bay',12]]){
    const selection=process.argv.find(arg=>arg.startsWith('--maps='));
    if(selection && !selection.slice(7).split(',').includes(map))continue;
    const state=new GameState({seed:1});
    state.setupGame([0,1].map(profileIndex=>({name:['小满','田野'][profileIndex],profileIndex,isAI:false})),80000,{mapId:map});
    state.players[0].currentTile=tile;
    await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),state.createSnapshot());
    await page.waitForFunction(()=>boardQA.pawnManager.pawns.every(p=>p.skin) && document.querySelector('#game-container').dataset.harborArt==='ready');
    await page.screenshot({path:'/tmp/material-'+phase+'-'+map+'.jpg'});
    if(process.argv.includes('--tour')){
      await page.click('#btn-map-overview');
      await page.screenshot({path:'/tmp/tour-'+map+'.jpg'});
      const xy=await page.evaluate(()=>{
        const m=boardQA.minimapUI,r=m.canvas.getBoundingClientRect(),p=m.project(m.mapDefinition.tiles[16].position);
        return [r.left+p.x*r.width/m.canvas.width,r.top+p.y*r.height/m.canvas.height];
      });
      await page.mouse.click(...xy);
      await page.waitForFunction(()=>{const a=boardQA.scene3D,b=boardQA.boardBuilder.tilePositions[16];
        const p=a.targetLookAt || a.controls.target;return Math.hypot(p.x-b.x,p.z-b.z)<1.5;});
      await page.click('#btn-follow-view');
      await page.waitForFunction(()=>{const a=boardQA.scene3D,b=boardQA.boardBuilder.tilePositions[boardQA.gameState.getCurrentPlayer().currentTile];
        const p=a.targetLookAt || a.controls.target;return Math.hypot(p.x-b.x,p.z-b.z)<.5;});
      console.log(map,'overview, navigation to 16, return to pawn');
    }
  }
  if(!baseline && !process.argv.includes('--maps-only')){
    if(!touchOnly){
      const point=await page.evaluate(()=>{
        const m=boardQA.minimapUI, r=m.canvas.getBoundingClientRect();
        const target=m.mapDefinition.tiles[24].position, p=m.project(target);
        return {x:r.left+p.x*r.width/m.canvas.width,y:r.top+p.y*r.height/m.canvas.height,target};
      });
      await page.mouse.click(point.x,point.y);
      await page.waitForFunction(target=>{
        const p=boardQA.scene3D.targetLookAt || boardQA.scene3D.controls.target;
        return Math.hypot(p.x-target.x,p.z-target.z)<1.5;
      },{},point.target);
    }
    await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
    const s=new GameState({seed:1});
    s.setupGame([0,1].map(profileIndex=>({profileIndex,name:'P'+profileIndex,isAI:false})),80000,{mapId:'taiwan-loop'});
    s.players[0].currentTile=5;s.players[1].currentTile=17;
    for(const id of [3,5,7,9])Object.assign(s.propertyManager.getProperty(id),{level:5,owner:1});
    await page.evaluate(snap=>boardQA.restoreGame(snap),s.createSnapshot());
    await page.waitForFunction(()=>boardQA.boardBuilder.buildingMeshes.get(5)?.userData.originalModel && boardQA.pawnManager.pawns.every(p=>p.skin));
    await page.screenshot({path:'/tmp/material-towers.jpg'});
    await page.evaluate(()=>{
      const app=boardQA,r=app.scene3D.renderer,render=r.render;
      r.render=function(...args){render.apply(this,args);const pawn=app.pawnManager.pawns[0];
        if(pawn.mesh.userData.isMoving && pawn.currentTile>=6){
          window.walk={tile:pawn.currentTile,image:this.domElement.toDataURL('image/jpeg',.90)};this.render=render;
        }
      };
    });
    await page.tap('#btn-roll');await page.waitForFunction(()=>window.walk,{timeout:90000});
    const {tile,image}=await page.evaluate(()=>window.walk);
    await writeFile('/tmp/material-walk.jpg',Buffer.from(image.split(',')[1],'base64'));
    console.log('Touch roll from 5, moving towards',tile);
  }
  assert.deepEqual(errors,[]);
}finally{await browser?.close();await server.close();}
