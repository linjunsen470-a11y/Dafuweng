import {Vector3} from 'three';
const samples=tiles=>tiles.flatMap(t=>[-1.5,1.5].flatMap(x=>[-1.5,1.5].flatMap(z=>[.2,4].map(y=>new Vector3(t.position.x+x,y,t.position.z+z)))));
/** Only repair clipped travel views. Fit the board without changing its viewing direction. */
export function journeyCameraFrame(camera,target,tiles,routeIds,width,height){
 if(!width||!height)return null;
 camera.updateMatrixWorld();
 const route=samples(tiles.filter(t=>routeIds.includes(t.id))),mx=Math.min(.25,24/width*2),my=Math.min(.55,76/height*2);
 if(!route.length||route.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<=1-mx&&Math.abs(q.y)<=1-my&&q.z>=-1&&q.z<=1;}))return null;
 const points=samples(tiles),center=new Vector3();
 center.set((Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,2.1,(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2);
 const position=camera.position.clone().sub(target).add(center),candidate=camera.clone();candidate.position.copy(position);candidate.zoom=1;candidate.lookAt(center);candidate.updateProjectionMatrix();candidate.updateMatrixWorld();
 const bounds=points.map(p=>p.clone().project(candidate));
 const zoom=.98*Math.min(1,(1-mx)/Math.max(...bounds.map(p=>Math.abs(p.x))),(1-my)/Math.max(...bounds.map(p=>Math.abs(p.y))));
 return {position,target:center,zoom};
}
