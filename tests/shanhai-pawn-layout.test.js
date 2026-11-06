import {it,expect} from 'vitest';
import {pawnPlacement,crowdGroups,avoidBadgeOverlap} from '../src/shanhai/SlicePawnLayout.js';
const tile={id:9,position:{x:4,z:7}},pawns=[0,1,2,3].map(playerId=>({playerId,tileId:9,inTransit:false}));
it('four seats stay separated along the screen horizontal axis through camera rotation',()=>{
 for(const camera of [{x:26,z:35},{x:35,z:-26},{x:-26,z:-35},{x:-35,z:26}]){
  const length=Math.hypot(camera.x,camera.z),positions=pawns.map(p=>pawnPlacement(tile,pawns,p.playerId,camera));
  const projected=positions.map(p=>(p.x-tile.position.x)*camera.z/length-(p.z-tile.position.z)*camera.x/length);
  for(let i=1;i<4;i++)expect(projected[i]-projected[i-1]).toBeCloseTo(1.25);
  expect(positions.every(p=>p.scale===1.05&&p.y===.22)).toBe(true);expect(projected.reduce((a,b)=>a+b,0)).toBeCloseTo(0);
 }
});
it('departing pawns leave the stationary group and arrival uses the destination seats',()=>{
 const moving=pawns.map(p=>({...p}));moving[0].inTransit=true;moving[0].tileId=0;
 expect(crowdGroups(moving)[0][1].map(p=>p.playerId)).toEqual([1,2,3]);expect(pawnPlacement(tile,moving,0).count).toBe(4);
 moving[0].destinationTile=9;expect(pawnPlacement(tile,moving,1).count).toBe(4);expect(crowdGroups(moving)[0][1]).toHaveLength(3);
 expect(pawnPlacement({id:1,position:{x:0,z:0}},moving,0)).toMatchObject({count:1,scale:1.4,x:0,z:0});
});
it('moves the group marker away from an ownership badge within the canvas',()=>{
 const box={left:20,right:100,top:80,bottom:124},owner={left:30,right:90,top:90,bottom:112};
 const above=avoidBadgeOverlap(box,[owner],300);expect(above.bottom).toBeLessThan(owner.top);expect(above.top).toBeGreaterThanOrEqual(4);
 const below=avoidBadgeOverlap({left:20,right:100,top:4,bottom:48},[{left:30,right:90,top:0,bottom:20}],300);expect(below.top).toBeGreaterThan(20);expect(below.bottom).toBeLessThan(300);
});
