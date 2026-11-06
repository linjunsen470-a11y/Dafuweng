// @vitest-environment happy-dom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {StockUI} from './src/ui/StockUI.js';

it('keeps the displayed trade permissions aligned with landing, pre-roll and debtor rules',()=>{
 document.body.innerHTML=readFileSync('index.html','utf8').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
 const state=new GameState({seed:64});state.setupGame([{profileIndex:0,name:'玩家',isAI:false},{profileIndex:1,name:'AI',isAI:true}],60000,{mapId:'grand-bay'});
 const engine=new GameEngine(state),ui=new StockUI(state,{playCoinSound(){}},null,engine);ui.drawChart=()=>{};
 const player=state.players[0];player.currentTile=32;
 state.phase='LANDING_ACTION';ui.show();const cash=player.cash;
 document.querySelector('#btn-stock-buy').click();expect(player.cash).toBe(cash);expect(document.querySelector('#btn-stock-buy').disabled).toBe(true);expect(document.querySelector('#stock-trade-guidance').textContent).toContain('掷骰前');
 state.phase='PRE_ROLL_ACTION';ui.render();document.querySelector('#stock-trade-amount').value='1';document.querySelector('#btn-stock-buy').click();expect(player.cash).toBeLessThan(cash);expect(player.stocks.TECH.shares).toBe(1);
 state.phase='DEBT_SETTLEMENT';state.pendingDebt={debtorId:player.id};ui.render();expect(document.querySelector('#btn-stock-buy').disabled).toBe(true);expect(document.querySelector('#btn-stock-sell').disabled).toBe(false);const debtorCash=player.cash;document.querySelector('#btn-stock-sell').click();expect(player.cash).toBeGreaterThan(debtorCash);
});
