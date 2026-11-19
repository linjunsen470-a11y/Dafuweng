import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import {createServer} from 'vite';

// Only the seed and read-only controller access differ from the normal new-game entry.
const server=await createServer({plugins:[{name:'observe-opening',transform(code,id){
  if(id.endsWith('/src/main.js'))return code.replace('new GameState();','new GameState({seed:64});').replace('new GameController();','window.boardQA=new GameController();');
}}],server:{host:'127.0.0.1',port:5207,strictPort:true,watch:null,hmr:false}});
await server.listen();
let browser;
try{
  browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setViewport({width:1440,height:900});
  await page.goto('http://127.0.0.1:5207/');
  await page.waitForSelector('.rules-help-ready',{visible:true});await page.click('.rules-help-ready');
  await page.select('#map-select','grand-bay');await page.select('#player-count','4');
  await page.click('#start-game-btn');
  await page.waitForSelector('#btn-roll',{visible:true});
  await page.evaluate(()=>{
    const start=performance.now();
    window.opening={};
    const mark=key=>{opening[key]??=Math.round(performance.now()-start);};
    boardQA.gameEngine.subscribe(event=>mark(event.type));
    for(const [selector,key] of [['.presentation-dice-result','diceLabel'],['.presentation-arrival','arrivalLabel'],['#btn-land-buy','offer']]){
      const check=()=>{if(document.querySelector(selector)?.getBoundingClientRect().width)mark(key);};
      new MutationObserver(check).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    }
  });
  await page.click('#btn-roll');
  await page.waitForSelector('#btn-land-buy',{visible:true,timeout:90000});
  const receipt=await page.evaluate(()=>{
    const s=boardQA.gameState,p=s.players[0];return {tile:p.currentTile,name:s.getTile(p.currentTile).name,cashBefore:p.cash};
  });
  console.log('offer',JSON.stringify(await page.evaluate(()=>opening)));
  await page.click('#btn-land-buy');
  await page.waitForFunction(tile=>boardQA.gameState.propertyManager.getProperty(tile)?.owner===0,{},receipt.tile);
  receipt.cashAfter=await page.evaluate(()=>boardQA.gameState.players[0].cash);
  assert.ok(receipt.cashAfter<receipt.cashBefore);assert.deepEqual(errors,[]);
  const result={receipt,timesMs:await page.evaluate(()=>opening),errors};
  console.log(JSON.stringify(result));
  await writeFile(process.argv[2]||'/tmp/opening-check.json',JSON.stringify(result,null,2)+'\n');
}finally{await browser?.close();await server.close();}
