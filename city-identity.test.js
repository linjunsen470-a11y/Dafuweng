import {it,expect,vi} from 'vitest';
import {Window} from 'happy-dom';
import {UIRenderer} from './src/ui/UIRenderer.js';
import {PresentationUI} from './src/ui/PresentationUI.js';

it('maps reordered saved profiles to matching portraits while board numbers follow seats, without mutating saves',()=>{
 const window=new Window();vi.stubGlobal('document',window.document);
 try {
  document.body.innerHTML='<div id="players-list"></div>';
  const state={mapId:'grand-bay',currentPlayerIndex:0,players:[{id:0,profileId:5,name:'自定义名字',cash:20000,color:'#00aa77',avatarAtlas:'/legacy.webp',avatarPosition:'100% 0%'},{id:1,profileId:0,name:'另一位',cash:20000,color:'#ff4757'}],calculateNetWorth:p=>p.cash};
  const before=JSON.stringify(state);const ui=new UIRenderer(state);ui.renderPlayersList();
  expect([...document.querySelectorAll('.player-avatar-img')].map(e=>e.getAttribute('src'))).toEqual(['/assets/city-portraits/5.png','/assets/city-portraits/0.png']);
  expect([...document.querySelectorAll('.city-player-number')].map(e=>e.textContent)).toEqual(['1','2']);
  const portrait=PresentationUI.prototype.portrait(state.players[0],'portrait',state.mapId);expect(portrait.style.backgroundImage).toContain('/city-portraits/5.png');expect(portrait.getAttribute('aria-label')).toBe('自定义名字');
  expect(JSON.stringify(state)).toBe(before);
  state.mapId='city-loop';ui.renderPlayersList();expect(document.querySelector('.city-player-number')).toBe(null);expect(document.querySelector('.player-avatar-atlas').style.backgroundImage).toContain('/legacy.webp');
  const old=PresentationUI.prototype.portrait(state.players[0],'portrait',state.mapId);expect(old.style.backgroundImage).toContain('/legacy.webp');
 }finally{vi.unstubAllGlobals();window.happyDOM.abort();}
});
