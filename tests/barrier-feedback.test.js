import {expect,it} from 'vitest';
import {describePresentationEvent} from '../src/ui/PresentationUI.js';
it('explains barrier placement without claiming an opponent-only trap',()=>{
 const state={players:[],getTile:()=>({name:'蓝湾码头 1号'})};
 const cue=describePresentationEvent({type:'ROAD_ENTITY_CHANGED',entity:{type:'BARRIER',tileId:1}},state)[0];
 expect(cue).toMatchObject({title:'路障已设置',fullDetail:true});expect(cue.detail).toContain('自己也会触发');expect(cue.detail).toContain('蓝湾码头 1号');
 expect(describePresentationEvent({type:'ROAD_ENTITY_CHANGED',tileId:1,removed:true},state)).toEqual([]);
});

import {GameEngine} from '../src/game/GameEngine.js';
it('publishes the placed barrier while consuming exactly one inventory item',()=>{
 const player={id:0,items:['BARRIER','BARRIER']};let removed=0;
 const entity={type:'BARRIER',tileId:1,ownerId:0};
 const facade={state:{assetRevision:0,inventoryManager:{getDefinition:()=>({}),removeItem:p=>{p.items.splice(0,1);removed++;}}},placeRoadEntity:()=>({success:true,type:'ROAD_ENTITY_CHANGED',entity})};
 const result=GameEngine.prototype.useItem.call(facade,player,'BARRIER',1);
 expect(result.events).toContainEqual({type:'ROAD_ENTITY_CHANGED',entity});expect(removed).toBe(1);expect(player.items).toEqual(['BARRIER']);expect(facade.state.assetRevision).toBe(1);
});
