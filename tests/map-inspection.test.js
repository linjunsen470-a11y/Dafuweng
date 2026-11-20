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

it('shows the actual street multiplier, owner, level and quote at the next level without upgrading', () => {
  const { state, engine } = game();
  const manager = state.propertyManager;
  for (const id of [1, 3, 6, 8]) manager.buyProperty(id, 1);
  manager.getProperty(1).level = 2;
  const before = state.createSnapshot();
  const info = describeMapTile(state, engine, 1);
  expect(info.deed).toMatchObject({ owner: '顾田野', level: 2, multiplier: 4, chainLabel: '4 块连片 · 同色垄断' });
  expect({ ...state.createSnapshot(), savedAt: before.savedAt }).toEqual(before);
  manager.upgradeProperty(1);
  expect(describeMapTile(state, engine, 1).deed.rent).toBe(info.deed.next);
  manager.buyProperty(13, 1);
  manager.buyProperty(15, 1, 'PARK');
  const preview = describeMapTile(state, engine, 13).deed.next;
  manager.upgradeProperty(13);
  expect(preview).toBe(Math.round(manager.calculateToll(13, state.newsEffect, state.priceIndex, state.players[0]) * 1.2));
});

it('shows the same visitor and mode exemptions for current and projected rent', () => {
  const { state, engine } = game();
  const manager = state.propertyManager;
  manager.buyProperty(15, 1, 'GAS_STATION');
  const deed = () => describeMapTile(state, engine, 15).deed;
  expect(deed()).toMatchObject({ rent: 0, next: 0 });
  state.players[0].vehicle = 'CAR';
  expect(deed().next).toBeGreaterThan(deed().rent);
  manager.upgradeProperty(15);
  expect(deed().next).toBeNull();
  manager.getProperty(15).isMortgaged = true;
  expect(deed()).toMatchObject({ rentLabel: '抵押停租', rent: 0, next: null });
  manager.getProperty(15).isMortgaged = false;
  state.gameMode = 'TEAM';
  state.players.forEach(p => { p.teamId = 0; });
  expect(deed()).toMatchObject({ rentLabel: '队友免租', rent: 0, next: null });
  state.gameMode = 'HEAT';
  expect(deed()).toMatchObject({ rent: null, next: null });
});
