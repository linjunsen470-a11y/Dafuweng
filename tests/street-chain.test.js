import {expect,it} from 'vitest';
import {GameState} from '../src/game/GameState.js';
it('quotes a continuous street and splits the rent multiplier at a mortgage',()=>{
  const s=new GameState();s.setMap('grand-bay');
  const m=s.propertyManager;
  for(const id of [1,3,6])m.buyProperty(id,0);
  expect([...m.streetChain(3)].sort()).toEqual([1,3,6]);
  expect(m.calculateToll(6)).toBe(s.getTile(6).tolls[0]*3);
  m.getProperty(3).isMortgaged=true;
  expect(m.streetChain(6).size).toBe(1);
  expect(m.calculateToll(6)).toBe(s.getTile(6).tolls[0]);
});
