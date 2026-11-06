// @vitest-environment happy-dom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {GameState} from './src/game/GameState.js';
import {GameEngine} from './src/game/GameEngine.js';
import {StockUI} from './src/ui/StockUI.js';
function setup(){
 document.body.innerHTML=readFileSync('index.html','utf8').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
 const state=new GameState({seed:64});state.setupGame([{profileIndex:0,name:'玩家',isAI:false},{profileIndex:1,name:'AI',isAI:true}],60000,{mapId:'grand-bay'});state.phase='PRE_ROLL_ACTION';
 const engine=new GameEngine(state),ui=new StockUI(state,{playCoinSound(){}},null,engine);ui.drawChart=()=>{};return {state,engine,ui,company:state.companyManager.get('SUMMIT_MATERIAL'),player:state.players[0]};
}
const card=()=>document.querySelector('[data-company-id="SUMMIT_MATERIAL"]');
it('explains ownership, timing, visible effects and cash source without changing rules',()=>{
 const {state,ui,company}=setup();ui.show(null,'COMPANIES');expect(card().textContent).toContain('远山材料');expect(card().textContent).toContain('最大股东');expect([...card().querySelectorAll('button')].every(b=>b.disabled)).toBe(true);
 company.chairmanId=0;state.phase='LANDING_ACTION';ui.render();expect(card().textContent).toContain('掷骰前');expect([...card().querySelectorAll('button')].every(b=>b.disabled)).toBe(true);
 state.phase='PRE_ROLL_ACTION';company.treasury=400;ui.render();const reserve=card().querySelector('[data-company-policy="RESERVE"]');expect(reserve.disabled).toBe(false);expect(reserve.textContent).toContain('限制经营亏损');expect(reserve.textContent).toContain('金库余 $50');const expansion=card().querySelector('[data-company-policy="EXPANSION"]');expect(expansion.disabled).toBe(true);expect(expansion.textContent).toContain('金库还差 $200');
});
it('charges the real company treasury once, focuses receipt, and preserves policy through save restore',()=>{
 const {state,ui,company,player}=setup();company.chairmanId=0;player.stocks.MINING={shares:10,avgPrice:320};ui.show(null,'COMPANIES');const cash=player.cash,button=card().querySelector('[data-company-policy="RESERVE"]');button.click();button.click();expect(company.treasury).toBe(850);expect(player.cash).toBe(cash);expect(company.policyId).toBe('RESERVE');expect(card().querySelector('button')).toBe(null);expect(document.activeElement).toBe(card().querySelector('.company-active-policy'));expect(card().textContent).toContain('已支出公司金库 $350');
 state.restoreSnapshot(state.createSnapshot());ui.render();expect(state.companyManager.get('SUMMIT_MATERIAL').treasury).toBe(850);expect(card().textContent).toContain('执行中');expect(card().querySelector('button')).toBe(null);
});
