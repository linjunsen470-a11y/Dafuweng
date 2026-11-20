import assert from 'node:assert/strict';
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {GameState} from '../../src/game/GameState.js';

const server=await createServer({cacheDir:'node_modules/.vite-deed-review',server:{host:'127.0.0.1',port:5297,hmr:false,watch:null},
  plugins:[{name:'inspect-deed',transform(code,id){
    if(id.endsWith('/src/main.js'))return code.replace('new GameController();','window.gameReview=new GameController();');
  }}]});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const mobile of (process.argv.includes('--desktop-only')?[false]:[true,false])){
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error' && /shader|WebGLProgram/i.test(m.text()))errors.push(m.text());});
    await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});
    await page.evaluateOnNewDocument(()=>{if(location.protocol==='http:')localStorage.setItem('fortune-empire:tutorial-seen','1');});
    await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>window.gameReview);
    const state=new GameState({seed:7});
    state.setupGame([0,1].map(profileIndex=>({profileIndex,isAI:false})),80000,{mapId:'grand-bay'});
    const tile=mobile?26:3;
    state.players[0].currentTile=tile;state.phase='LANDING_ACTION';
    if(!mobile){state.propertyManager.buyProperty(tile,0);state.propertyManager.getProperty(tile).level=4;}
    await page.evaluate(s=>gameReview.restoreGame(s),state.createSnapshot());
    await page.waitForFunction(()=>gameReview.pawnManager.pawns.every(p=>p.skin) && document.querySelector('#game-container').dataset.harborArt==='ready');
    await page.evaluate(id=>{void gameReview.handleTileArrival(id);},tile);
    const action=mobile?'#btn-land-buy':'#btn-land-upgrade';
    await page.waitForSelector(action,{visible:true});
    await page.waitForFunction(()=>document.querySelector('.land-modal-box').getAnimations().every(a=>a.playState==='finished'));
    const coverage=await page.$eval('.land-modal-box',box=>box.getBoundingClientRect().height/innerHeight);
    const kind=mobile?'purchase':'upgrade';
    await page.screenshot({path:'/tmp/deed-'+kind+'.jpg'});
    if(mobile)assert.ok(coverage<.37,'decision obscures parcel');
    const press=selector=>mobile?page.tap(selector):page.click(selector);
    await press('#land-investment-details summary');
    assert.ok(await page.$eval('#land-investment-details',el=>el.open));
    await page.waitForSelector('#land-cash-after',{visible:true});await press('#land-investment-details summary');
    await press(action);
    await page.waitForFunction(({id,upgrade})=>{
      const prop=gameReview.gameState.propertyManager.getProperty(id);
      return prop.owner===0 && (!upgrade || prop.level===5);
    },{},{id:tile,upgrade:!mobile});
    console.log(kind,Math.round(1000*coverage)/10+'% of viewport height, transaction confirmed');
    if(!mobile){
      await page.waitForSelector('.hotseat-ready',{visible:true});await page.click('.hotseat-ready');
      await page.waitForFunction(()=>gameReview.boardBuilder.buildingMeshes.get(3)?.userData.originalModel==='res_harbor_5');
      // Rotate away from the active pawn's sightline so the normal cutaway
      // does not hide the upgraded facade in the inspection frame.
      await page.mouse.move(805,460);
      await page.mouse.down();
      await page.mouse.move(1135,460,{steps:12});
      await page.mouse.up();
      await page.waitForFunction(()=>{
        const house=gameReview.boardBuilder.buildingMeshes.get(3);
        return house.scale.y===1 && !house.userData.isPawnOccluder;
      },{timeout:10000});
      await page.screenshot({path:'/tmp/deed-upgraded.jpg'});
    }
    assert.deepEqual(errors,[]);await page.close();
  }
}finally{await browser?.close();await server.close();}
