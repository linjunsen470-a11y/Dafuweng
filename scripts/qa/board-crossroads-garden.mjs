import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';
import {GameState} from '../../src/game/GameState.js';

const baseline=process.argv.includes('--before');
const server=await createServer({plugins:[{name:'inspect-game',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.boardQA = new GameController();');
}}],server:{port:5206,host:'127.0.0.1',strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try {
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.setViewport({width:1440,height:900});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('fortune-empire:tutorial-seen','1'));
  await page.goto('http://127.0.0.1:5206/');
  await page.waitForFunction(()=>window.boardQA);
  const s=new GameState({seed:64});
  s.setupGame([{name:'丹尼',profileIndex:12,isAI:false},{name:'棠果',profileIndex:9,isAI:false}],60000,{mapId:'fortune-crossroads'});
  s.players[0].vehicle='MOTOR';s.players[1].vehicle='CAR';s.players[1].currentTile=1;
  s.players[0].moveLimitThisTurn=1;s.boardGods=[];
  await page.evaluate(snapshot=>boardQA.restoreGame(snapshot),s.createSnapshot());
  await page.waitForFunction(()=>boardQA.pawnManager.pawns.every(p=>p.ride && p.skin?.name==='Ride'));
  await page.evaluate(()=>boardQA.scene3D.showOverview());
  const stem=baseline?'/tmp/crossroads-before':'/tmp/crossroads-after';
  await page.screenshot({path:stem+'.png'});
  const seats=await page.evaluate(async()=>{
    const Vector3=boardQA.scene3D.camera.position.constructor;
    const app=boardQA,view=app.scene3D;
    const info=app.pawnManager.pawns.map(p=>{
      const joints=[];p.skin.figure.traverse(o=>{if(o.isBone && /leg/.test(o.name))joints.push(p.ride.worldToLocal(o.getWorldPosition(new Vector3())).toArray());});
      return {model:p.skin.model,kind:p.rideKind,joints};
    });
    const p=app.pawnManager.pawns[0].mesh.position;
    view.controls.minDistance=3;
    view.camera.position.copy(p).add(new Vector3(3.3,1.9,2.5));
    view.controls.target.copy(p).y+=.95;view.controls.update();
    return info;
  });
  await page.screenshot({path:stem+'-seat.png'});
  console.log(JSON.stringify(seats));
  if(!baseline){
    await page.evaluate(()=>{
      const view=boardQA.scene3D, p=boardQA.pawnManager.pawns[1].mesh.position;
      view.camera.position.copy(p);view.camera.position.x+=3.3;view.camera.position.y+=1.9;view.camera.position.z+=2.5;
      view.controls.target.copy(p).y+=.95;view.controls.update();
    });
    await page.screenshot({path:'/tmp/crossroads-after-car.png'});
    await page.evaluate(()=>boardQA.scene3D.showOverview());
    await page.click('#btn-roll');
    await page.waitForFunction(()=>boardQA.gameState.players[0].currentTile===1,{timeout:60000});
    assert.deepEqual(errors,[]);
    await writeFile('qa/review/crossroads-garden-checks.json',JSON.stringify({map:s.mapDefinition.id,seats,rolledTo:1,errors},null,2)+'\n');
  }
} finally { await browser?.close();await server.close(); }
