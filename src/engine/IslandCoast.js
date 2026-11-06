import * as THREE from 'three';

// Original low-poly shoreline, outside the existing roads, lots and service yards.
// Coordinates are world X/Z; the same boundary clips the textured city surface.
const COAST_CORNERS = [
 [-65,-28],[-64,-39],[-59,-45],[-46,-46],[-35,-49],[-22,-47],[-5,-48],
 [9,-46],[24,-48],[40,-47],[55,-47],[64,-42],[66,-28],[63,-10],
 [66,3],[64,17],[63,29],[65,36],[60,39],[50,37],[38,37],[27,38],
 [14,37],[2,38],[-10,37],[-25,38],[-40,37],[-53,38],[-62,34],
 [-65,26],[-63,14],[-66,1],[-64,-11]
];
// A short chamfer at each corner removes sharp tips without changing the road layout.
// Limit cuts to 20% of each neighboring edge so short coves keep their shape.
export const ISLAND_OUTLINE = COAST_CORNERS.flatMap((point,index) =>
 [-1,1].map(direction => {
  const neighbor=COAST_CORNERS[(index+direction+COAST_CORNERS.length)%COAST_CORNERS.length];
  const dx=neighbor[0]-point[0],dz=neighbor[1]-point[1];
  const ratio=Math.min(.2,1.6/Math.hypot(dx,dz));
  return [point[0]+dx*ratio,point[1]+dz*ratio];
 })
);
export const COAST_WATER_Y = -.58;
const shape = () => new THREE.Shape(ISLAND_OUTLINE.map(([x,z])=>new THREE.Vector2(x,-z)));
export function createIslandSurfaceGeometry() {
 const geometry=new THREE.ShapeGeometry(shape());
 const p=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+71)/142,(p.getY(i)+43)/92);
 uv.needsUpdate=true;return geometry;
}
export function createIslandCoast() {
 const group=new THREE.Group();group.name='original-island-coast';
 const core=new THREE.Mesh(new THREE.ExtrudeGeometry(shape(),{depth:.65,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:'#8d9d86',roughness:1}));
 core.name='city-island-core';core.rotation.x=-Math.PI/2;core.position.y=-.755;core.receiveShadow=true;group.add(core);
 const vertices=[],colors=[];const rock=new THREE.Color('#94a18c'),sand=new THREE.Color('#dcc795'),wetRock=new THREE.Color('#728f88'),wetSand=new THREE.Color('#b5b49a');
 const push=(point,outer)=>{const [x,z]=point;vertices.push(outer?x*1.065:x,outer?-.72:-.105,outer?-3+(z+3)*1.065:z);const amount=THREE.MathUtils.clamp((z-15)/20,0,1),c=(outer?wetRock:rock).clone().lerp(outer?wetSand:sand,amount);colors.push(c.r,c.g,c.b);};
 for(let i=0;i<ISLAND_OUTLINE.length;i++){
  const a=ISLAND_OUTLINE[i],b=ISLAND_OUTLINE[(i+1)%ISLAND_OUTLINE.length];
  push(a,false);push(b,false);push(a,true);push(b,false);push(b,true);push(a,true);
 }
 const slopeGeometry=new THREE.BufferGeometry();slopeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));slopeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));slopeGeometry.computeVertexNormals();
 const slope=new THREE.Mesh(slopeGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));slope.name='island-coast-slope';slope.receiveShadow=true;group.add(slope);
 return group;
}
