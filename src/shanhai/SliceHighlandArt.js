import * as THREE from 'three-modern';

// Original low-poly geometry. Shared palette and primitive buffers keep the
// existing static batcher effective; no textures, animation or gameplay state.
const palette={stone:'#8d8d7b',plaster:'#e9dbb8',wood:'#76543a',slate:'#485d60',brick:'#b36547',tile:'#8b513f',pine:'#58765d',tea:'#89974d',amber:'#ca8b35',red:'#bc613a',window:'#b6cebf'};
const materials=Object.fromEntries(Object.entries(palette).map(([name,color])=>{const m=new THREE.MeshStandardMaterial({color,roughness:.95});m.name=`mountain-${name}`;return [name,m];}));
const cube=new THREE.BoxGeometry(1,1,1),cone=new THREE.ConeGeometry(1,1,7),ball=new THREE.IcosahedronGeometry(1,0);
function part(parent,geometry,color,x,y,z,sx,sy,sz){const mesh=new THREE.Mesh(geometry,materials[color]);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
const box=(g,c,x,y,z,w,h,d)=>part(g,cube,c,x,y,z,w,h,d);
function roof(g,c,x,y,z,w,d){
 for(const side of [-1,1]){const r=box(g,c,x+side*w*.24,y,z,w*.56,.12,d);r.rotation.z=side*-.38;}
 box(g,c,x,y+w*.1,z,.14,.13,d+.04);
}
function house(district,level,market=false){
 const g=new THREE.Group();g.name=market?`mountain_exchange_${level}`:`mountain_${district}_${level}`;
 const body=district==='kiln'?'brick':district==='ridge'?'stone':'plaster',top=district==='kiln'?'tile':'slate';
 const height=.72+Math.min(level,3)*.35,w=level>=3?1.75:1.48;
 box(g,'stone',0,.15,0,2.04,.3,1.92);box(g,body,0,.3+height/2,-.1,w,height,1.3);
 roof(g,top,0,.3+height+.15,-.1,w+.35,1.82);
 for(const x of [-w/2+.09,w/2-.09])box(g,'wood',x,.3+height/2,.57,.1,height,.12);
 box(g,'wood',0,.69,.58,.3,.74,.06);
 for(const x of [-.46,.46]){box(g,'wood',x,.97,.57,.38,.45,.09);box(g,'window',x,.97,.63,.27,.34,.02);}
 // Windows on rear and side elevations keep outward-facing lots readable.
 for(const y of level>=3?[.94,1.58]:[.94]){
  for(const x of [-.43,.43]){box(g,'wood',x,y,-.77,.37,.4,.06);box(g,'window',x,y,-.805,.25,.28,.02);}
  for(const side of [-1,1]){box(g,'wood',side*(w/2+.025),y,-.08,.06,.4,.37);box(g,'window',side*(w/2+.06),y,-.08,.02,.28,.25);}
 }
 box(g,'wood',0,.48,-.775,w,.075,.055);
 if(level>=2){
  box(g,'wood',0,1.29,.83,w+.17,.1,.5);roof(g,top,0,1.92,.73,w+.25,.75);
  for(const x of [-.62,0,.62])box(g,'wood',x,1.55,1.02,.055,.45,.055);
  box(g,'wood',0,1.75,1.02,w+.05,.055,.055);
 }
 if(level>=3){
  const wing=box(g,body,-.78,.7,-.25,.52,.8,1.6);roof(g,top,wing.position.x,1.2,-.25,.7,1.8);
  box(g,'plaster',0,.44,1.09,.88,.15,.24); // front threshold stays behind the ownership pips
 }
 if(level>=4){
  box(g,body,0,2.5,-.1,.95,.55,1.03);roof(g,top,0,2.93,-.1,1.23,1.43);
  for(const x of [-.25,.25])for(const z of [-.63,.43])box(g,'window',x,2.55,z,.16,.24,.03);
 }
 // District identity remains visible at every level.
 if(district==='tea'){
  for(const x of [-.66,.66]){box(g,'wood',x,.46,.88,.45,.1,.38);box(g,'tea',x,.53,.88,.39,.04,.32);}
 }else if(district==='kiln'){
  box(g,'brick',.68,height+.68,-.58,.26,.6,.26);
  for(const x of [-.72,.73])part(g,cone,'tile',x,.49,.85,.23,.4,.23);
 }else{
  for(let i=0;i<3;i++)box(g,'wood',.8,.4+i*.12,.74,.32,.09,.35);
  box(g,'stone',-.8,.43,.8,.33,.25,.36);
 }
 if(market){box(g,'wood',0,.95,.86,1.5,.1,.42);box(g,'amber',0,1.46,.9,1.65,.12,.65);for(const x of [-.6,0,.6])box(g,'brick',x,1.1,.86,.3,.2,.26);}
 return g;
}
export function makeHighlandPrefabs(){const root=new THREE.Group();for(const district of ['tea','kiln','ridge'])for(let level=1;level<=4;level++)root.add(house(district,level));for(let level=1;level<=4;level++)root.add(house('kiln',level,true));return root;}
export function highlandPropertyModel(tile,level,buildingType){
 if(!level)return null;
 if(tile.type==='BIG_PROPERTY')return buildingType==='MALL'?`mountain_exchange_${Math.min(level,4)}`:null;
 return `mountain_${['tea','kiln','ridge'][Math.floor(tile.id/8)]}_${Math.min(level,4)}`;
}
function tree(parent,x,z,type,scale=1){
 const g=new THREE.Group();g.position.set(x,.22,z);g.scale.setScalar(scale);parent.add(g);
 box(g,'wood',0,.8,0,.14,1.6,.14);
 if(type==='pine'){for(let i=0;i<3;i++)part(g,cone,'pine',0,1.25+i*.49,0,.83-i*.16,1.15,.73-i*.15);}
 else{for(const [dx,dy,dz,c] of [[0,1.9,0,'amber'],[-.42,1.55,0,'red'],[.38,1.58,.1,'amber'],[0,1.45,-.37,'red']])part(g,ball,c,dx,dy,dz,.65,.55,.58);}
 return g;
}
export function makeHighlandLandscape(scene){
 const ground=new THREE.Group();ground.name='mountain-terraced-garden';scene.scenery.add(ground);
 for(let i=0;i<3;i++){
  const w=8-i*.7,d=4.8-i*1.5,z=-7.2-i*.5,top=.43+i*.35;
  box(ground,'stone',-5,top-.2,z,w,.4,d);box(ground,'tea',-5,top+.025,z,w-.15,.05,d-.12);
  for(let n=0;n<7;n++){const bush=scene.clonePrefab('shrub',-8+n*.93,-5.7-i*1.35,.48,0);bush.position.y=top+.05;bush.traverse(o=>{if(o.isMesh&&['leaf','leaf_light','jade'].includes(o.material.name))o.material=materials.tea;});}
  for(let n=0;n<8-i;n++)box(ground,'plaster',-8.45+n*.94,top-.08,z+d/2+.015,.78,.1,.03);
 }
 for(let i=0;i<5;i++)box(ground,'stone',-.45,.08+i*.1,-5.3-i*.55,.75,.16,.6);
 // Low retaining bank behind the street; no decoration enters a tile or lot.
 for(let n=0;n<9;n++){const rock=part(ground,ball,'stone',-17+n*4.1,-.65,15.5,1.9,.5,.65);rock.rotation.y=n*.7;}
 const trees=[[-11,-7,'pine',1.05],[-11,0,'maple',1],[-9,5,'maple',.9],[-3,5,'maple',.85],[3,4,'pine',.95],[8,3,'maple',1],[10,-3,'pine',1],[9,-7,'maple',1.05],[3,-8,'pine',1.1],[-2,-10,'maple',.85]];
 trees.forEach(([x,z,type,scale])=>tree(ground,x,z,type,scale));
 const detail=new THREE.Group();detail.name='mountain-small-ground-detail';
 for(const [x,z] of [[-10,-5],[-10,4],[-2,4],[4,4],[9,2],[10,-5],[2,-9],[-1,-10]]){
  for(let i=0;i<3;i++){const blade=box(detail,'tea',x+i*.12,.45,z,.045,.5+i*.07,.045);blade.rotation.z=(i-1)*.3;}
  part(detail,ball,'stone',x+.35,.3,z+.25,.3,.22,.24);
 }
 detail.traverse(m=>{if(m.isMesh)m.castShadow=false;});
 detail.userData={desktopOnly:true,clumps:8};return detail;
}

/** Original public savings booth: stone plinth, roof, teller counter and coin seal. */
export function makeSavingsKiosk(){
 const g=new THREE.Group();g.name='mountain-savings-kiosk';g.position.set(-13.3,.22,-1.5);g.rotation.y=-Math.PI/2;
 box(g,'stone',0,.18,0,2.7,.36,2.5);box(g,'plaster',0,1.2,-.35,2.15,1.7,1.35);
 roof(g,'slate',0,2.25,0,3.05,2.8);
 for(const x of [-1.05,1.05])box(g,'wood',x,1.18,.85,.13,2,.13);
 box(g,'wood',0,.95,.65,2.3,.14,.9);box(g,'wood',0,1.67,.36,1.5,.75,.08);box(g,'window',0,1.67,.42,1.25,.54,.04);
 box(g,'wood',0,1.03,1,1.5,.28,.13);box(g,'amber',.55,1.2,.78,.5,.28,.35);box(g,'slate',.55,1.34,.8,.27,.025,.045);
 part(g,ball,'amber',0,2.35,1.1,.32,.32,.09);box(g,'slate',0,2.35,1.2,.1,.1,.025);
 for(let i=0;i<3;i++)box(g,'stone',0,.1-i*.02,1.55+i*.37,.7,.15,.35);
 box(g,'wood',1.65,.48,0,.4,.13,1.65);for(const z of [-.6,.6])box(g,'stone',1.65,.25,z,.3,.45,.25);
 return g;
}
