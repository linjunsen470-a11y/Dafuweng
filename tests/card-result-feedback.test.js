import {expect,it} from 'vitest';
import {describePresentationEvent} from '../src/ui/PresentationUI.js';
const state={players:[{id:0,name:'林小满'},{id:1,name:'顾田野',turtleTurns:1}],getTile:()=>({name:'蓝湾码头 1号'}),propertyManager:{getProperty:()=>({level:0})}};
it('uses the real catalogue without a state card lookup and shows resulting level zero',()=>{
 const cue=describePresentationEvent({type:'CARD_USED',playerId:0,cardId:'DEMOLISH',targetId:1},state)[0];
 expect(cue).toMatchObject({title:'拆房卡已生效',fullDetail:true});expect(cue.detail).toContain('蓝湾码头 1号 已降至 LV 0');
});
it('reports actual reduced duration rather than assuming three turns',()=>{
 const before=JSON.stringify(state.players);const cue=describePresentationEvent({type:'CARD_USED',playerId:0,cardId:'TURTLE',targetId:1},state)[0];
 expect(cue.detail).toContain('顾田野：剩余 1 回合');expect(JSON.stringify(state.players)).toBe(before);
});
it('does not invent a target outcome when the target cannot be found',()=>{
 const cue=describePresentationEvent({type:'CARD_USED',playerId:0,cardId:'TURTLE',targetId:9},state)[0];expect(cue).toMatchObject({title:'策略卡发动',detail:'林小满 · 乌龟卡',fullDetail:false});
});
