import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

const output='/tmp/dafuweng-qa';
await mkdir(output,{recursive:true});
const server=await createServer({cacheDir:'node_modules/.vite-performance-qa',plugins:[{
  name:'observe-performances',transform(code,id) {
    if(id.endsWith('/src/main.js')) return code.replace('new GameController();','window.gameQA=new GameController();');
  }
}],server:{host:'127.0.0.1',port:5281,hmr:false,watch:null}});
await server.listen();
let browser;
try {
  browser=await puppeteer.launch({executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium',
    args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const [width,height] of [[1440,900],[390,844]]) {
    const mobile=width===390, context=await browser.createBrowserContext(), page=await context.newPage();
    page.setDefaultTimeout(65000);
    const errors=[];
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width,height,isMobile:mobile,hasTouch:mobile});
    const press=selector=>mobile?page.tap(selector):page.click(selector);
    await page.evaluateOnNewDocument(() => {
      window.modelProgress = false;
      new MutationObserver(records => {
        if (records.some(r => r.target.matches?.('#model-loading progress') && r.target.value > 0)) {
          window.modelProgress = true;
        }
      }).observe(document, {subtree:true, attributes:true, attributeFilter:['max','value']});
    });
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(()=>window.gameQA);
    await press('#start-game-btn');
    await page.waitForSelector('[data-skip]');
    await press('[data-skip]');
    await page.waitForFunction(()=>gameQA.pawnManager.pawns.every(p=>p.skin) && document.getElementById('model-loading').hidden);
    assert.ok(await page.evaluate(() => window.modelProgress), 'model progress reported');
    await press('#btn-toggle-audio');
    assert.equal(await page.evaluate(()=>localStorage.getItem('fortune-empire:audio-muted')),'1');
    await page.reload();
    await page.waitForFunction(()=>window.gameQA?.audioManager.muted === true);
    await press('#start-game-btn');
    await page.waitForFunction(()=>gameQA.pawnManager.pawns.length > 0 &&
      gameQA.pawnManager.pawns.every(p=>p.skin) && document.getElementById('model-loading').hidden);
    await press('#btn-toggle-audio');
    assert.equal(await page.evaluate(()=>gameQA.audioManager.muted), false);
    await page.evaluate(()=>{
      const g=window.gameQA;
      window.opening=g.gameState.createSnapshot();
      window.eventsQA=[];
      const names=new Set(['rent-flight','cartoon-blast','property-celebration','barrier-brake','direction-arrow']);
      const scene=g.scene3D.scene, add=scene.add;
      scene.add=function(...objects) {
        for(const group of objects) if(names.has(group.name)) {
          const resources=new Set();
          group.traverse(mesh=>{
            if(mesh.isInstancedMesh) resources.add(mesh);
            if(mesh.geometry) resources.add(mesh.geometry);
            if(mesh.material) resources.add(mesh.material);
          });
          const report={name:group.name,total:resources.size,released:0};
          for(const item of resources) item.addEventListener('dispose',()=>report.released++);
          eventsQA.push(report);
        }
        return add.apply(this,objects);
      };
      // Only the rare landing/ownership arrangements use V11 snapshots.
      window.scenario=(tile,phase,edit)=>{
        const snapshot=structuredClone(opening);
        snapshot.players[0].currentTile=tile;
        snapshot.phase=phase;
        edit?.(snapshot);
        g.restoreGame(snapshot);
      };
    });
    const hit=await page.evaluate(()=>{
      const g=gameQA;
      const tile=g.boardBuilder.tilePositions[1].clone().project(g.scene3D.camera);
      return {x:(1+tile.x)*innerWidth/2,y:(1-tile.y)*innerHeight/2};
    });
    if(mobile) await page.touchscreen.tap(hit.x,hit.y); else await page.mouse.move(hit.x,hit.y);
    await page.waitForSelector('.board-tip:not([hidden]) .deed-card');
    assert.ok(await page.$eval('.board-tip',el=>{
      const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;
    }));
    await press('#btn-inspect-map');
    await page.select('#map-inspector-select','1');
    await page.waitForSelector('#map-inspector .deed-owner');
    await press('#map-inspector-close');
    const camera = () => page.evaluate(() => ({
      angle: gameQA.scene3D.controls.getAzimuthalAngle(),
      distance: gameQA.scene3D.controls.getDistance()
    }));
    const before = await camera();
    const x = width/2, y = height/2;
    if (mobile) {
      const input = await page.createCDPSession();
      const touch = (type,touchPoints) => input.send('Input.dispatchTouchEvent',{type,touchPoints});
      await touch('touchStart',[{x,y}]);
      await touch('touchMove',[{x:x+55,y}]);
      await touch('touchEnd',[]);
      await touch('touchStart',[{x:x-50,y,id:1},{x:x+50,y,id:2}]);
      await touch('touchMove',[{x:x-23,y,id:1},{x:x+23,y,id:2}]);
      await touch('touchEnd',[]);
      await input.detach();
    } else {
      await page.mouse.move(x,y);
      await page.mouse.down();
      await page.mouse.move(x+55,y,{steps:4});
      await page.mouse.up();
      await page.mouse.wheel({deltaY:240});
    }
    await page.waitForFunction(before => {
      const controls=gameQA.scene3D.controls;
      return Math.abs(controls.getAzimuthalAngle()-before.angle)>.04 &&
        Math.abs(controls.getDistance()-before.distance)>.2;
    },{},before);
    await press('[data-player-id="0"]');
    // The normal controller performs the roll, walk, purchase, and end-turn transition.
    await page.evaluate(()=>gameQA.dialogUI.showRemoteDice(value=>gameQA.handleCardUsage('REMOTE_DICE',0,value)));
    await press('.dice-choice-btn[data-val="1"]');
    await page.waitForSelector('#modal-land:not(.hidden)');
    await press('#btn-land-buy');
    await page.waitForFunction(()=>gameQA.gameState.propertyManager.getProperty(1)?.owner===0);
    await page.evaluate(()=>{
      scenario(1,'LANDING_ACTION',s=>{s.properties.find(([id])=>id===1)[1].owner=0;});
      if(!gameQA.upgradeLand(1,gameQA.gameState.players[0]).success) throw Error('upgrade failed');
      scenario(1,'LANDING_ACTION',s=>{for(const id of [1,3]) s.properties.find(([key])=>key===id)[1].owner=1;});
      const r=gameQA.gameEngine.execute({type:'SETTLE_RENT',playerId:0,payload:{tileId:1}});
      if(!(r.amount>0) || document.querySelectorAll('.board-speech').length!==2) throw Error('rent bubbles missing');
    });
    await page.waitForFunction(()=>gameQA.boardEffects.active.size===0);
    await page.evaluate(()=>{
      const id=gameQA.gameState.mapDefinition.tiles.find(t=>t.type==='CHANCE').id;
      scenario(id,'LANDING_ACTION',s=>{s.rngState=42;});
      void gameQA.handleTileArrival(id);
    });
    await page.waitForSelector('.chance-reveal-overlay.is-revealed');
    await page.waitForSelector('.chance-reveal-overlay',{hidden:true});
    await page.evaluate(()=>{
      scenario(0,'PRE_ROLL_ACTION',s=>{s.players[0].cards.push('MISSILE');s.players[1].currentTile=6;});
      const run=(type,payload)=>{const r=gameQA.gameEngine.execute({type,playerId:0,payload});if(!r.success)throw Error(r.reason);};
      run('USE_CARD',{cardId:'TURN_AROUND',targetId:1});
      run('USE_CARD',{cardId:'MISSILE',targetId:6});
    });
    await page.waitForFunction(()=>!gameQA.pendingPickup && !gameQA.boardEffects.active.size);
    const result=await page.evaluate(async()=>{
      scenario(0,'PRE_ROLL_ACTION');
      const g=gameQA,command=(type,payload)=>{const r=g.gameEngine.execute({type,payload});if(!r.success)throw Error(r.reason);return r;};
      command('USE_CARD',{cardId:'OBSTACLE',targetId:1});
      command('ROLL_DICE',{});command('BEGIN_MOVE',{steps:1});command('ADVANCE_MOVE',{});
      const active=g.boardEffects.active.size;
      g.boardEffects.clear();
      scenario(0,'PRE_ROLL_ACTION',s=>{s.players[0].isAI=true;});
      g.aiPace='skip';
      const count=eventsQA.length;
      command('USE_CARD',{cardId:'TURN_AROUND',targetId:1});
      const quiet=eventsQA.length===count && !g.boardEffects.active.size;
      const names=eventsQA.map(e=>e.name);
      const leaked=eventsQA.filter(e=>e.released!==e.total);
      return {active,quiet,names,leaked,overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.ok(result.active && result.quiet);
    for(const name of ['rent-flight','cartoon-blast','property-celebration','barrier-brake','direction-arrow']) assert.ok(result.names.includes(name),name);
    assert.deepEqual(result.leaked,[]);
    assert.equal(result.overflow,0);
    assert.deepEqual(errors,[]);
    console.log(width+'×'+height,JSON.stringify(result));
    await context.close();
  }
} finally {await browser?.close();await server.close();}
