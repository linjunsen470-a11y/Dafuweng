import {expect,it} from 'vitest';
import {GameState} from '../src/game/GameState.js';
import {GameEngine} from '../src/game/GameEngine.js';
import {describeMapTile} from '../src/ui/MapInspector.js';
function game(){const state=new GameState({seed:123});state.setupGame([{profileIndex:0,name:'林小满',isAI:false},{profileIndex:1,name:'顾田野',isAI:true}],20000,{mapId:'grand-bay'});return {state,engine:new GameEngine(state)};}
it('quotes owned, mortgaged and vacant property without consuming state or random numbers',()=>{
 const {state,engine}=game(),p=state.propertyManager.getProperty(1);Object.assign(p,{owner:1,level:2});
 const before=JSON.stringify({rng:state.rng,players:state.players,properties:[...state.propertyManager.properties]});
 const model=describeMapTile(state,engine,1);expect(model.lines.join(' ')).toContain('顾田野');expect(model.lines.join(' ')).toContain('$1,200');
 expect(JSON.stringify({rng:state.rng,players:state.players,properties:[...state.propertyManager.properties]})).toBe(before);
 p.isMortgaged=true;expect(describeMapTile(state,engine,1).lines).toContain('已抵押 · 暂不收租');
 expect(describeMapTile(state,engine,6).lines.join(' ')).toContain('$1,122');
});
it('follows real branch connections and direction, including road hazards',()=>{
 const {state,engine}=game();expect(describeMapTile(state,engine,12).links.map(x=>x.id)).toEqual(state.mapRuntime.getNextOptions(12,1));
 state.players[0].direction=-1;state.roadEntities.push({type:'BARRIER',tileId:12});
 const m=describeMapTile(state,engine,12);expect(m.direction).toBe('逆向');expect(m.links.map(x=>x.id)).toEqual(state.mapRuntime.getNextOptions(12,-1));expect(m.lines.join(' ')).toContain('路障');
});

it('does not offer standard rental quotes for heat mode or teammate visits',()=>{
 const {state,engine}=game();Object.assign(state.propertyManager.getProperty(1),{owner:1,level:2});
 state.gameMode='HEAT';expect(describeMapTile(state,engine,1).lines.join(' ')).toContain('补给规则');expect(describeMapTile(state,engine,6).lines.join(' ')).not.toContain('购价');
 state.gameMode='TEAM';state.players.forEach(p=>p.teamId=0);const lines=describeMapTile(state,engine,1).lines.join(' ');expect(lines).toContain('停留不付租金');expect(lines).not.toContain('牌价');
});

it('keeps the posted rent separate from actual god and card shield settlements',()=>{
 for(const effect of ['god','card']){
  const {state,engine}=game();Object.assign(state.propertyManager.getProperty(1),{owner:1,level:2});const player=state.players[0];
  if(effect==='god')player.godType='GREAT_FORTUNE';else player.rentShieldActiveThisTurn=true;
  const before=JSON.stringify({players:state.players,rng:state.rng});const lines=describeMapTile(state,engine,1).lines.join(' ');
  expect(lines).toContain('$1,200（非最终实收）');expect(lines).toContain('落地时仍有效则免租');expect(JSON.stringify({players:state.players,rng:state.rng})).toBe(before);
  const cash=player.cash;expect(engine.settleRent(player,1)).toMatchObject({type:'RENT_WAIVED',amount:0});expect(player.cash).toBe(cash);
 }
});
