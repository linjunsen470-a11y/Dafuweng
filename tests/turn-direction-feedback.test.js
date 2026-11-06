import {expect,it} from 'vitest';
import {describePresentationEvent} from '../src/ui/PresentationUI.js';
for(const [direction,label] of [[-1,'逆向'],[1,'正向']])it(`reports actual ${label} direction for the chosen target`,()=>{
 const players=[{id:0,name:'林小满',direction:1},{id:1,name:'顾田野',direction}];const before=JSON.stringify(players);
 const cue=describePresentationEvent({type:'CARD_USED',cardId:'TURN_AROUND',playerId:0,targetId:1},{players})[0];
 expect(cue).toMatchObject({title:'转向卡已生效',fullDetail:true});expect(cue.detail).toContain(`顾田野 改为${label}行走`);expect(JSON.stringify(players)).toBe(before);
});
