import { expect, it } from 'vitest';
import { describePresentationEvent } from '../src/ui/PresentationUI.js';
it('keeps the upgrading actor explicit when another player is current', () => {
  const actor={id:1,name:'顾田野 AI'},next={id:2,name:'洛晶晶 AI'};
  const state={players:[actor,next],getCurrentPlayer:()=>next,getTile:()=>({name:'蓝湾码头 1号'})};
  const event={type:'PROPERTY_UPGRADED',playerId:1,tileId:1,level:1,cost:550};
  const before=JSON.stringify(event);
  const cues=describePresentationEvent(event,state);
  expect(cues.find(c=>c.kind==='toast')).toMatchObject({title:'建筑升级至 LV 1',detail:'顾田野 AI · 蓝湾码头 1号 · 投资 $550',fullDetail:true});
  expect(cues.find(c=>c.kind==='cash')).toEqual({kind:'cash',playerId:1,amount:-550,label:'建筑升级'});
  expect(JSON.stringify(event)).toBe(before);
});
