// @vitest-environment happy-dom
import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BoardEffects } from '../../src/engine/BoardEffects.js';
import { playEffect } from '../../src/engine/EffectTimeline.js';

let effects, view, raf;
beforeEach(() => {
  vi.useFakeTimers();
  raf=vi.fn(()=>42);
  vi.stubGlobal('requestAnimationFrame',raf);
  vi.stubGlobal('cancelAnimationFrame',vi.fn());
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  const points=[new THREE.Vector3(0,0,0),new THREE.Vector3(2,0,2)];
  const pawns=points.map(position=>({position}));
  const players=[{id:0,profileId:0},{id:1,profileId:1}];
  view={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),shakeCamera:vi.fn()};
  effects=new BoardEffects(view,{tilePositions:points,buildingMeshes:new Map()},{getPawnMesh:id=>pawns[id]},
    {players,getCurrentPlayer:()=>players[0],propertyManager:{streetChain:()=>new Set([0,1])}});
});
afterEach(()=>{effects.clear();document.documentElement.className='';vi.useRealTimers();vi.unstubAllGlobals();});
it('cleans up shared GPU resources, instancing buffers and both rent bubbles when frames stop',()=>{
  effects.present({type:'RENT_PAID',playerId:0,ownerId:1,tileId:1,chainSize:2,amount:2800});
  expect(document.querySelectorAll('.board-speech')).toHaveLength(2);
  const coins=view.scene.getObjectByName('rent-flight').children[0];
  expect(coins.count).toBe(20);
  const resources=[coins,coins.geometry,coins.material];
  const released=resources.map(x=>vi.spyOn(x,'dispose'));
  vi.advanceTimersByTime(1700);effects.clear();
  expect(released.every(spy=>spy.mock.calls.length===1)).toBe(true);
  expect(document.querySelector('.board-speech')).toBeNull();
  expect(effects.active.size).toBe(0);
  expect(view.scene.children).toHaveLength(0);
});
it.each(['skip-ai-motion','reduce-motion'])('allocates no effects in %s mode',mode=>{
  document.documentElement.classList.add(mode);
  effects.present({type:'CARD_USED',playerId:0,targetId:1,cardId:'MISSILE'});
  effects.blast(null,0,true);
  expect(raf).not.toHaveBeenCalled();
  expect(view.scene.children).toHaveLength(0);
});
it('allows cancellation before first frame and cleans up exactly once',()=>{
  const draw=vi.fn(), finish=vi.fn();
  const stop=playEffect(400,draw,finish);
  stop();stop();vi.advanceTimersByTime(900);
  expect(draw).not.toHaveBeenCalled();
  expect(finish).toHaveBeenCalledTimes(1);
});
