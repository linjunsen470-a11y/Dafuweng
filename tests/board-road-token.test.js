import {expect,it} from 'vitest';
import {GameEngine} from '../src/game/GameEngine.js';
import {GameState} from '../src/game/GameState.js';

it('clears the road marker while preserving the clock carried by player zero',()=>{
  const state=new GameState({seed:64});
  state.setupGame([{profileIndex:0,name:'甲'},{profileIndex:1,name:'乙'}]);
  const engine=new GameEngine(state);
  const player=state.players[0];
  const clock={id:'carried',type:'TIME_BOMB',tileId:1,ownerId:1,data:{attachedPlayerId:0}};
  state.roadEntities.push(clock);
  player.items.push('ROBOT_DOLL');
  expect(engine.getItemAction(player,'ROBOT_DOLL').enabled).toBe(false);
  expect(engine.placeRoadEntity(player,'BARRIER',1).success).toBe(true);
  expect(engine.getItemAction(player,'ROBOT_DOLL').targets.map(t=>t.id)).toEqual([1]);
  expect(engine.useItem(player,'ROBOT_DOLL',1).success).toBe(true);
  expect(state.roadEntities).toEqual([clock]);
});
