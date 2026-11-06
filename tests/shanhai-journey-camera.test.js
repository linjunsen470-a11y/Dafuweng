import {it,expect} from 'vitest';import {OrthographicCamera,Vector3} from 'three';import {journeyCameraFrame} from '../src/shanhai/SliceJourneyCamera.js';import {SHANHAI_COAST_MAP,SHANHAI_HIGHLAND_MAP} from '../src/shanhai/SliceMap.js';
const camera=(w,h,target=new Vector3())=>{const span=w/h<1?24:19.5,c=new OrthographicCamera(-span*w/h,span*w/h,span,-span,.1,180);c.position.copy(target).add(new Vector3(-30,34,0));c.zoom=2;c.lookAt(target);c.updateProjectionMatrix();c.updateMatrixWorld();return c;};
it('fits both boards after a clipped near view on desktop and phone, preserving heading',()=>{
 for(const map of [SHANHAI_COAST_MAP,SHANHAI_HIGHLAND_MAP])for(const [w,h] of [[756,720],[390,430]]){const t=map.tiles[0].position,target=new Vector3(t.x,.6,t.z),c=camera(w,h,target),offset=c.position.clone().sub(target);const before=c.position.clone(),zoom=c.zoom;
 const g=journeyCameraFrame(c,target,map.tiles,[0,1,2,3,4,5,6],w,h);expect(g).toBeTruthy();expect(c.position).toEqual(before);expect(c.zoom).toBe(zoom);expect(g.position.clone().sub(g.target).distanceTo(offset)).toBeLessThan(1e-8);
 c.position.copy(g.position);c.zoom=g.zoom;c.lookAt(g.target);c.updateProjectionMatrix();c.updateMatrixWorld();expect(journeyCameraFrame(c,g.target,map.tiles,map.tiles.map(t=>t.id),w,h)).toBeNull();expect(g.zoom).toBeGreaterThan(.35);
 }
});
it('does not move an already visible short route or act on an empty/hidden viewport',()=>{
 const tiles=SHANHAI_HIGHLAND_MAP.tiles,target=new Vector3(tiles[0].position.x,2,tiles[0].position.z),c=camera(1100,844,target);c.zoom=.9;c.updateProjectionMatrix();expect(journeyCameraFrame(c,target,tiles,[0],1100,844)).toBeNull();expect(journeyCameraFrame(c,target,tiles,[],1100,844)).toBeNull();expect(journeyCameraFrame(c,target,tiles,[4],0,844)).toBeNull();
});
