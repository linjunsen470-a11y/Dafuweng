import {journeyCameraFrame} from './SliceJourneyCamera.js';
import {pawnPlacement,crowdGroups,avoidBadgeOverlap} from './SlicePawnLayout.js';
import {makeHighlandPrefabs,highlandPropertyModel,makeHighlandLandscape,makeSavingsKiosk} from './SliceHighlandArt.js';
import {applyExpression,expressionFor,EXPRESSION_LABELS} from './SliceExpressions.js';
import {makeMountainPeople} from './SliceMountainPeople.js';
import {MOUNTAIN_PEOPLE} from './SliceStory.js';
import * as THREE from 'three-modern';
import { COAST_REGIONS, coastRegion, sliceRegions, sliceRegion } from './SliceMap.js';
import { COAST_ROUTES } from './SliceTransport.js';
import { REGIONAL_SCENERY, REGION_ARCHITECTURE, residenceModel } from './SliceScenery.js';
import { SliceDocks, dockDeckHeight } from './SliceDocks.js';
import { DOCK_NEIGHBORS } from './SliceDockStories.js';
import { SliceAmbience } from './SliceAmbience.js';
import { OrbitControls } from 'three-modern/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three-modern/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three-modern/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three-modern/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three-modern/addons/geometries/RoundedBoxGeometry.js';

const v = (x,y,z) => new THREE.Vector3(x,y,z);
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const materialCache=new Map();
const mat=(color,extra={})=>{const key=JSON.stringify([color,extra]);if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0,...extra}));return materialCache.get(key);};
const colors = ['#ef9a7f','#51aa98','#8b72ba','#c58a38'];
export class SliceScene {
  constructor(container, tiles, {onSelect=()=>{},onDock=()=>{},onResident=()=>{},onTacticTarget=()=>{},mapId='shanhai-coast',ambientMotion=true}={}) {
    this.mapId=mapId;this.highland=mapId==='shanhai-highland';
    this.container=container;this.tiles=tiles;this.onSelect=onSelect;this.onDock=onDock;this.onResident=onResident;this.onTacticTarget=onTacticTarget;this.pawns=[];this.labels=[];this.mixers=[];this.clock=new THREE.Clock();this.angle=.53;this.zoomed=false;this.disposed=false;this.propertyRevision=-1;this.moving=false;
    this.ambientMotion=ambientMotion;this.compactPreference=matchMedia('(max-width:680px), (pointer:coarse)');this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');this.propertyBadges=new Map();
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#d5e9e1');this.scene.fog=new THREE.Fog('#d5e9e1',65,135);
    this.camera=new THREE.OrthographicCamera(-25,25,20,-20,.1,180);this.camera.position.set(26,34,35);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor('#d5e9e1');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.shadowMap.autoUpdate=false;this.container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minPolarAngle=.38;this.controls.maxPolarAngle=1.12;this.controls.enablePan=false;this.controls.minZoom=.75;this.controls.maxZoom=2;this.controls.target.set(0,0,0);
    this.scene.add(new THREE.HemisphereLight('#e2f5ff','#8e9569',2.8));const sun=this.sun=new THREE.DirectionalLight('#fff1cf',3.2);sun.position.set(-18,30,15);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-26;sun.shadow.camera.right=26;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=1;sun.shadow.camera.far=90;sun.shadow.normalBias=.05;sun.shadow.bias=-.0004;this.scene.add(sun);this.scene.add(new THREE.AmbientLight('#e1eee1',.4));
    this.scenery=new THREE.Group();this.scene.add(this.scenery);this.propertyGroup=new THREE.Group();this.scene.add(this.propertyGroup);this.selectables=[];
    if(this.highland)this.makeHighlandGround();else this.makeGround();this.makeRoad();if(!this.highland){this.makeTransportStops();this.docks=new SliceDocks(this.scene,this.tiles);this.selectables.push(...this.docks.picks);}this.makeSelection();this.makeDice();
    this.renderVisible=true;
    this.visibilityObserver=new IntersectionObserver(entries=>{this.renderVisible=entries[0]?.isIntersecting??true;});
    this.visibilityObserver.observe(container);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
    this.pointerStart=null;this.onDown=e=>{this.pointerStart=[e.clientX,e.clientY]};this.onUp=e=>{if(this.characterPreview)return;if(!this.pointerStart||Math.hypot(e.clientX-this.pointerStart[0],e.clientY-this.pointerStart[1])>6)return;const r=this.container.getBoundingClientRect();const pointer=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);if(this.tacticMode){const hit=ray.intersectObjects(this.tacticPicks)[0];this.onTacticTarget(hit?.object.userData.tacticTargetId??null);return;}const hits=ray.intersectObjects(this.selectables);if(hits[0]){const data=hits[0].object.userData;if(data.residentId)this.onResident(data.residentId);else if(data.dockId)this.onDock(data.dockId);else this.onSelect(data.tileId);}};
    this.renderer.domElement.addEventListener('pointerdown',this.onDown);this.renderer.domElement.addEventListener('pointerup',this.onUp);
  }
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;const ar=w/h,span=ar<1?24:19.5;this.camera.left=-span*ar;this.camera.right=span*ar;this.camera.top=span;this.camera.bottom=-span;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  mesh(geometry,material,pos,parent=this.scenery){const m=new THREE.Mesh(geometry,material);if(pos)m.position.copy(pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  islandShape(rx,rz){const s=new THREE.Shape();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=1+.022*Math.sin(a*5)+.015*Math.cos(a*7),x=Math.cos(a)*rx*r,z=Math.sin(a)*rz*r;if(!i)s.moveTo(x,z);else s.lineTo(x,z);}s.closePath();return s;}
  island(rx,rz,depth,y,color){const g=new THREE.ExtrudeGeometry(this.islandShape(rx,rz),{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.4,bevelThickness:.08});g.rotateX(-Math.PI/2);return this.mesh(g,mat(color),v(0,y,0));}
  makeGround(){
    this.mesh(new THREE.PlaneGeometry(250,250),mat('#83c5c1',{roughness:.4}),v(0,-1.55,0)).rotation.x=-Math.PI/2;
    this.island(18.7,14.3,.65,-1.25,'#d9cbaa');this.island(18.15,13.8,.25,-.48,'#e8d8af');this.island(17.4,13,.12,-.16,'#9dbd8d');
    // Sand coves, broad lawn and a stone-edged public garden.
    this.mesh(new THREE.CylinderGeometry(7.1,7.3,.14,64),mat('#a9c59a'),v(0,.13,0)).scale.z=.75;
    this.mesh(new THREE.CylinderGeometry(3.2,3.35,.18,48),mat('#ddd7ba'),v(-2,.22,0));
    this.mesh(new THREE.CylinderGeometry(2.95,2.95,.12,48),mat('#cbd4b2'),v(-2,.36,0));
    // Fountain with visible water, stone lip and a sculptural center.
    this.mesh(new THREE.CylinderGeometry(1.45,1.55,.4,48),mat('#e8e2c8'),v(-2,.58,0));
    this.mesh(new THREE.CylinderGeometry(1.25,1.25,.04,48),mat('#78bab2',{roughness:.25}),v(-2,.81,0));
    this.mesh(new THREE.CylinderGeometry(.22,.3,.9,16),mat('#e7dfc0'),v(-2,1.04,0));
    this.mesh(new THREE.SphereGeometry(.42,18,12),mat('#afc9bd'),v(-2,1.59,0));
    this.mesh(new THREE.TorusGeometry(.82,.08,8,32),mat('#ecdfba'),v(-2,1.27,0)).rotation.x=Math.PI/2;
    // Offshore stones and wind-ruffled sea lines are original geometry.
    for(let i=0;i<18;i++){const a=i*2.3999,rad=21+(i%3)*2.8;const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5+(i%4)*.3,.025,4,32),new THREE.MeshBasicMaterial({color:'#c9e5d7',transparent:true,opacity:.5}));ring.rotation.x=Math.PI/2;ring.scale.z=.4;ring.position.set(Math.cos(a)*rad,-1.49,Math.sin(a)*rad*.78);this.scenery.add(ring);}
    const dock=this.mesh(new THREE.BoxGeometry(2.5,.22,6),mat('#bb9574'),v(14,-.27,10));dock.rotation.y=-.3;
    for(let i=0;i<9;i++){const plank=this.mesh(new THREE.BoxGeometry(2.54,.035,.06),mat('#9d7959'),v(14,-.14,7.6+i*.6));plank.rotation.y=-.3;}
    for(let i=0;i<4;i++)this.mesh(new THREE.CylinderGeometry(.1,.13,1.5,8),mat('#9d7959'),v(13.05+(i%2)*2,-.55,8+Math.floor(i/2)*3.6));
    this.boat=new THREE.Group();this.boat.position.set(18,-1.25,9);this.boat.rotation.y=-.6;
    const hull=this.mesh(new THREE.SphereGeometry(1,16,10),mat('#f7e6bc'),v(0,0,0),this.boat);hull.scale.set(.6,.28,1.5);this.mesh(new THREE.CylinderGeometry(.035,.035,2.6,8),mat('#9a8063'),v(0,1.25,0),this.boat);const sailG=new THREE.BufferGeometry();sailG.setAttribute('position',new THREE.Float32BufferAttribute([.04,.4,0,.04,2.4,0,1.2,.4,0],3));sailG.computeVertexNormals();this.mesh(sailG,mat('#eaa18a',{side:THREE.DoubleSide}),null,this.boat);this.scene.add(this.boat);
  }
  makeHighlandGround(){
    this.scene.background.set('#e7ddc7');this.scene.fog.color.set('#e7ddc7');
    this.mesh(new THREE.PlaneGeometry(250,250),mat('#c6b58d'),v(0,-1.55,0)).rotation.x=-Math.PI/2;
    this.mesh(new RoundedBoxGeometry(42,.8,35,2,1.3),mat('#b99871'),v(0,-.8,-1));
    this.mesh(new RoundedBoxGeometry(41,.25,34,2,1.2),mat('#b9b17c'),v(0,-.25,-1));
    for(const [x,z,r,h] of [[-23,-17,7,8],[-10,-24,8,10],[5,-25,7,8],[22,-19,8,11]]){
      const hill=this.mesh(new THREE.ConeGeometry(r,h,7),mat('#8a9270'),v(x,h/2-1.4,z));hill.rotation.y=x*.1;
      const cap=this.mesh(new THREE.ConeGeometry(r*.34,h*.32,7),mat('#c4bd99'),v(x,h*.84-1.4,z));cap.rotation.y=x*.1;
    }
    this.mesh(new THREE.CylinderGeometry(3,3,.12,24),mat('#d5bd93'),v(5,.12,-2));
  }
  makeMountainBuildings(){
    // Original static low-poly props; merged with scenery by the existing batcher.
    const wood=mat('#785b3e'),roof=mat('#646c58'),clay=mat('#ad684b'),stone=mat('#998c71'),tea=mat('#75814d');
    const group=(name,x,z)=>{const g=new THREE.Group();g.name=name;g.position.set(x,.22,z);this.scenery.add(g);return g;};
    const box=(g,w,h,d,x,y,z,m)=>this.mesh(new THREE.BoxGeometry(w,h,d),m,v(x,y,z),g);
    const shed=group('mountain-tea-shed',-6,-4);
    for(const x of [-1.8,1.8])for(const z of [-1,1])box(shed,.14,2.1,.14,x,1,z,wood);
    for(const side of [-1,1]){const r=box(shed,2.3,.14,2.8,side*1,2.3,0,roof);r.rotation.z=side*-.28;}
    for(const z of [-.65,.65]){box(shed,3.4,.14,.7,0,.9,z,wood);box(shed,3.2,.08,.6,0,1,z,tea);}
    const kiln=group('mountain-stepped-kiln',7,-6);
    for(let i=0;i<3;i++){box(kiln,2.8-i*.45,.8,1.2,0,.4+i*.55,-i*.95,clay);box(kiln,.7,.55,.06,0,.3+i*.55,.61-i*.95,wood);}
    box(kiln,.55,2.4,.55,.7,2,-2.2,stone);
    for(const x of [-1.8,1.8])this.mesh(new THREE.CylinderGeometry(.22,.32,.5,8),clay,v(x,.3,0),kiln);
    const depot=group('mountain-trail-depot',-11,2.5);
    box(depot,2.8,.3,2.5,0,.15,0,stone);box(depot,2.4,1.7,2,0,1,0,wood);
    for(const side of [-1,1]){const r=box(depot,1.6,.16,2.7,side*.7,2.1,0,roof);r.rotation.z=side*-.36;}
    box(depot,.65,1.2,.06,0,.8,1.03,mat('#cfaa71'));
    for(let i=0;i<3;i++)box(depot,.55,.5,.55,1.7,.3+i*.48,.5,clay);
    // Short stepped retaining wall ties the freight hut to the mountain road.
    for(let i=0;i<5;i++)box(depot,.65,.16,.9,-.6-i*.55,-.05-i*.025,2,stone);
    this.addLabel('盘山货栈 · 22号来信',v(-11,3.2,2.5),'civic');
    this.addLabel('阶梯柴窑',v(7,3.7,-6),'civic');
    this.mountainLandmarks=['mountain-tea-shed','mountain-stepped-kiln','mountain-trail-depot'];
  }
  makeHighlandVillage(){
    const kiosk=makeSavingsKiosk();this.scenery.add(kiosk);kiosk.updateMatrixWorld(true);kiosk.traverse(m=>{if(m.isMesh){m.userData.tileId=20;this.selectables.push(m);}});this.savingsKiosk={x:-13.3,z:-1.5,tileId:20};this.addLabel('20号 · 林场储蓄亭',v(-13.3,3.3,-1.5),'civic');
    this.makeMountainBuildings();this.mountainPeople=makeMountainPeople(this.scene);this.selectables.push(...this.mountainPeople.meshes);for(const person of MOUNTAIN_PEOPLE)this.addLabel(person.name,v(person.x,2.6,person.z),'civic');
    const landmarks=[['mountain_exchange_4',5,-2,1.4,'古窑会馆'],['mountain_tea_3',-1,2,1.2,'谷口茶庄'],['commerce_park_1',-7,2,1.3,'歇脚凉亭']];
    for(const [model,x,z,scale,label] of landmarks){this.clonePrefab(model,x,z,scale,Math.PI);if(label==='歇脚凉亭')this.addLabel(label,v(x,4.8,z),'civic');}
    const detail=makeHighlandLandscape(this);this.highlandDetail=this.batch(detail);this.highlandDetail.userData=detail.userData;this.scene.add(this.highlandDetail);
    for(const [x,z] of [[4,-5],[6,-5],[-3,2]])this.clonePrefab('flower_planter',x,z,.9,0);
    for(const [x,z] of [[2,-2],[7,0],[-5,3]])this.clonePrefab('bench',x,z,.9,Math.PI/2);
    sliceRegions(this.mapId).forEach((region,i)=>{const tile=this.tiles[i*8+2];const label=this.addLabel(region.name,v(tile.position.x*.8,1,tile.position.z*.8),'region-label');label.style.borderColor=region.color;});
  }
  ribbon(curve,width,y,color){const pos=[],idx=[],n=288;for(let i=0;i<=n;i++){const t=i/n,p=curve.getPoint(t),d=curve.getTangent(t),normal=v(-d.z,0,d.x).normalize();for(const sign of [-1,1])pos.push(p.x+normal.x*width/2*sign,y,p.z+normal.z*width/2*sign);if(i<n){const k=i*2;idx.push(k,k+2,k+1,k+1,k+2,k+3);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();this.mesh(g,mat(color,{side:THREE.DoubleSide}),null);}
  makeRoad(){const points=this.tiles.map(t=>v(t.position.x,0,t.position.z));this.curve=new THREE.CatmullRomCurve3(points,true,'centripetal');this.ribbon(this.curve,2.28,.045,'#e4d7b9');this.ribbon(this.curve,1.82,.075,'#eee8d3');
    const tileGeometry=new RoundedBoxGeometry(.97,.09,.97,2,.1);
    this.tiles.forEach((tile,i)=>{const special=!['PROPERTY','BIG_PROPERTY'].includes(tile.type);const m=this.mesh(tileGeometry,mat(i===0?'#6fa98f':special?sliceRegion(tile.id,this.mapId).color:sliceRegion(tile.id,this.mapId).tileColor),v(tile.position.x,.16,tile.position.z));m.userData.tileId=tile.id;this.selectables.push(m);m.rotation.y=-Math.atan2(this.tiles[(i+1)%24].position.z-tile.position.z,this.tiles[(i+1)%24].position.x-tile.position.x);
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle=i===0?'#fff5db':'#a49b7e';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=special?'600 66px serif':'500 38px sans-serif';ctx.fillText(i===0?'⚑':tile.type==='CHANCE'?'✦':tile.type==='BIG_PROPERTY'?'▤':tile.type==='TREASURE'?'◇':tile.type==='COUPON'?'✧':String(i),64,64);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const ink=new THREE.Mesh(new THREE.PlaneGeometry(.65,.65),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));ink.rotation.x=-Math.PI/2;ink.position.set(tile.position.x,.213,tile.position.z);this.scenery.add(ink);
      const angle=Math.atan2(tile.position.x,tile.position.z);tile.visualLot={x:tile.position.x+Math.sin(angle)*2.3,z:tile.position.z+Math.cos(angle)*2.3,rotation:angle+Math.PI};
      if(tile.type==='BIG_PROPERTY'){tile.visualLot.x=tile.position.x+Math.sin(angle)*2.6;tile.visualLot.z=tile.position.z+Math.cos(angle)*2.6;}
    });
  }
  makeTransportStops(){
    for(const route of COAST_ROUTES){
      const tile=this.tiles.find(t=>t.id===route.from),p=v(tile.position.x,.3,tile.position.z);
      const inward=v(-p.x,0,-p.z).normalize().multiplyScalar(1.3);p.add(inward);
      this.mesh(new THREE.CylinderGeometry(.06,.08,1.4,8),mat('#548d83'),p.clone().add(v(0,.6,0)));
      this.mesh(new RoundedBoxGeometry(.95,.45,.12,2,.05),mat('#e2f0da'),p.clone().add(v(0,1.2,0)));
      this.addLabel(`⚓ ${DOCK_NEIGHBORS.find(d=>d.id===route.id).name} · ${route.from} → ${route.to}`,p.clone().add(v(0,1.9,0)),'transport-label');
    }
  }
  seaPath(from,to,seaOnly=false){
    const a=this.tiles.find(t=>t.id===from),b=this.tiles.find(t=>t.id===to);
    const start=Math.atan2(a.position.z/17,a.position.x/22);
    let end=Math.atan2(b.position.z/17,b.position.x/22);while(end>=start)end-=Math.PI*2;
    const points=seaOnly?[]:[v(a.position.x,.3,a.position.z)];
    for(let i=0;i<=32;i++){const angle=start+(end-start)*i/32;points.push(v(Math.cos(angle)*22,-.9,Math.sin(angle)*17));}
    if(!seaOnly)points.push(v(b.position.x,.3,b.position.z));
    return new THREE.CatmullRomCurve3(points,false,'centripetal');
  }
  setTransportRoute(from,to){
    if(this.transportLine){this.scene.remove(this.transportLine);this.transportLine.geometry.dispose();this.transportLine.material.dispose();this.transportLine=null;}
    if(from===null)return;
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.seaPath(from,to).getPoints(100)),
      new THREE.LineDashedMaterial({color:'#2a968c',dashSize:.5,gapSize:.25,depthTest:false,transparent:true,opacity:.8}));
    line.computeLineDistances();line.renderOrder=5;this.scene.add(line);this.transportLine=line;this.highlight(to);
  }
  async travelByBoat(playerId,from,to,duration=1600,onStage=()=>{}){
    const pawn=this.pawns.find(p=>p.playerId===playerId);if(!pawn)return;
    const curve=this.seaPath(from,to,true),boat=new THREE.Group(),props=new THREE.Group();
    const reduced=this.motionPreference?.matches,pace=reduced?30:Math.max(1,duration),courier=pawn.characterId==='ayu';
    const start=pawn.root.position.clone(),end=this.pawnDestination(to,playerId);pawn.inTransit=true;pawn.destinationTile=to;
    // Depart along the permanent dock; use a temporary landing ramp at the destination.
    const deckStart=curve.getPointAt(0),deckEnd=curve.getPointAt(1);
    const add=(g,color,pos,parent=boat)=>{const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.8}));m.position.copy(pos);parent.add(m);return m;};
    add(new RoundedBoxGeometry(1.5,.45,2.6,2,.2),'#568d87',v(0,-.25,0));
    add(new THREE.BoxGeometry(1.25,.08,2.15),'#e7c79a',v(0,0,0));
    for(const z of [-.85,.85])add(new THREE.BoxGeometry(1.3,.25,.15),'#fff0d4',v(0,.17,z));
    const ramp=(a,b)=>{const d=b.clone().sub(a),m=add(new THREE.BoxGeometry(1.05,.08,d.length()),'#bb9574',a.clone().add(b).multiplyScalar(.5).add(v(0,-.08,0)),props);m.quaternion.setFromUnitVectors(v(0,0,1),d.normalize());return m;};
    const landing=ramp(deckEnd,v(end.x,.22,end.z));landing.visible=false;
    boat.position.copy(deckStart);boat.rotation.y=Math.atan2(curve.getTangentAt(0).x,curve.getTangentAt(0).z);
    this.scene.add(boat,props);this.activeTrip={playerId,from,to,phase:'boarding',boat};
    const bases=pawn.root.children.filter(o=>o!==pawn.model).map(o=>[o,o.visible]);
    const stage=name=>{this.activeTrip.phase=name;if(!this.disposed)onStage(name);};
    const tween=async(ms,update)=>{const began=performance.now();await new Promise(resolve=>{const step=()=>{if(this.disposed){resolve();return;}const t=Math.min(1,(performance.now()-began)/Math.max(1,ms));update(t);if(t<1)requestAnimationFrame(step);else resolve();};step();});};
    const walk=async(a,b,ms,onDock=false)=>{this.action(playerId,'walk');pawn.actions.walk?.setEffectiveTimeScale(courier?1.4:1.05);pawn.root.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);await tween(ms,t=>{pawn.root.position.lerpVectors(a,b,t);if(onDock)pawn.root.position.y=.22+dockDeckHeight(t);if(!reduced)pawn.root.position.y+=Math.sin(Math.PI*t)*.12;});};
    try{
      this.setTransportRoute(from,to);stage('boarding');bases.forEach(([o])=>o.visible=false);
      await walk(start,deckStart,pace*(courier?.36:.46),true);if(this.disposed)return;
      stage('sailing');this.action(playerId,'idle');
      await tween(pace,t=>{const p=curve.getPointAt(t),d=curve.getTangentAt(t),sway=reduced?0:Math.sin(t*Math.PI*6)*Math.sin(Math.PI*t);boat.position.copy(p);boat.rotation.y=Math.atan2(d.x,d.z);boat.rotation.z=sway*.035;pawn.root.position.copy(p).add(v(0,.05,0));pawn.root.rotation.y=boat.rotation.y;pawn.model.rotation.z=sway*(courier?.065:.035);});
      if(this.disposed)return;
      pawn.model.rotation.z=0;boat.rotation.z=0;landing.visible=true;stage('alighting');
      await walk(pawn.root.position.clone(),v(end.x,.22,end.z),pace*(courier?.36:.46));if(this.disposed)return;
      this.action(playerId,'idle');stage('arrival');this.highlight(to);
    }finally{
      pawn.model.rotation.z=0;bases.forEach(([o,visible])=>o.visible=visible);
      if(!this.disposed){pawn.root.position.copy(end);pawn.tileId=to;pawn.inTransit=false;pawn.destinationTile=null;this.action(playerId,'idle');}
      this.scene.remove(boat,props);for(const group of [boat,props])group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
      this.activeTrip=null;this.setTransportRoute(null);
    }
  }
  makeDice(){
    const faces=[1,6,2,5,3,4],pips={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
    const materials=faces.map(n=>{const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.fillStyle='#fff1d6';x.fillRect(0,0,128,128);x.fillStyle='#397c6b';for(const [a,b]of pips[n]){x.beginPath();x.arc(64+a*30,64+b*30,9,0,Math.PI*2);x.fill();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map:t,roughness:.45});});
    this.diceMesh=new THREE.Mesh(new THREE.BoxGeometry(1.35,1.35,1.35),materials);this.diceMesh.position.set(-1,1,7);this.diceMesh.visible=false;this.scene.add(this.diceMesh);
  }
  rollDice(value,ms=720){const orientations={1:[0,0,Math.PI/2],2:[0,0,0],3:[-Math.PI/2,0,0],4:[Math.PI/2,0,0],5:[Math.PI,0,0],6:[0,0,-Math.PI/2]};this.diceThrow={start:performance.now(),duration:ms,target:orientations[value]||orientations[1]};this.diceMesh.visible=true;}
  makeSelection(){this.selection=new THREE.Mesh(new THREE.RingGeometry(.67,.77,40),new THREE.MeshBasicMaterial({color:'#e5a068',transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));this.selection.rotation.x=-Math.PI/2;this.selection.position.y=.23;this.scene.add(this.selection);this.selection.visible=false;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(30),3));geometry.setAttribute('lineDistance',new THREE.BufferAttribute(new Float32Array(10),1));
    this.plotOutline=new THREE.LineSegments(geometry,new THREE.LineDashedMaterial({color:'#a05b2f',dashSize:.28,gapSize:.14,depthTest:false,depthWrite:false}));this.plotOutline.renderOrder=7;this.plotOutline.visible=false;this.scene.add(this.plotOutline);
  }
  updatePawnRings(){for(const p of this.pawns||[]){if(!p.ring)continue;p.ring.material.depthTest=!this.clearView;p.ring.material.depthWrite=!this.clearView;p.ring.renderOrder=this.clearView?8:0;}}
  updatePlotOutline(){
    if(!this.plotOutline)return;const tile=this.tiles.find(t=>t.id===this.selectedTile),lot=tile?.visualLot;
    this.plotOutline.visible=Boolean(this.clearView&&lot&&['PROPERTY','BIG_PROPERTY'].includes(tile.type)&&!this.tacticMode);if(!this.plotOutline.visible)return;
    const a=this.plotOutline.geometry.attributes.position,cos=Math.cos(lot.rotation),sin=Math.sin(lot.rotation),corners=[[-1.5,-1.5],[1.5,-1.5],[1.5,1.5],[-1.5,1.5]],points=corners.map(([x,z])=>[lot.x+x*cos+z*sin,.3,lot.z-x*sin+z*cos]);
    points.forEach((p,i)=>{a.setXYZ(i*2,...p);a.setXYZ(i*2+1,...points[(i+1)%4]);});a.setXYZ(8,tile.position.x,.3,tile.position.z);a.setXYZ(9,lot.x,.3,lot.z);a.needsUpdate=true;this.plotOutline.geometry.computeBoundingSphere();const distance=this.plotOutline.geometry.attributes.lineDistance;for(let i=0;i<5;i++){distance.setX(i*2,0);distance.setX(i*2+1,Math.hypot(a.getX(i*2)-a.getX(i*2+1),a.getZ(i*2)-a.getZ(i*2+1)));}distance.needsUpdate=true;
  }
  setClearView(enabled){
    if(this.characterPreview||this.tacticMode)return false;
    this.clearView=Boolean(enabled);this.controls.minPolarAngle=this.clearView ? .18 : .38;this.controls.maxPolarAngle=this.clearView ? .48 : 1.12;
    this.container.parentElement.classList.toggle('clear-view',this.clearView);
    this.selection.material.depthTest=!this.clearView;this.selection.material.needsUpdate=true;this.selection.renderOrder=this.clearView?7:0;
    this.updatePawnRings();this.overview();this.controls.update();this.updatePlotOutline();return true;
  }
  async load(){const loader=new GLTFLoader();const [buildings,courier,botanist,neighborhoods,residences,commerce,cartographer,builder]=await Promise.all(['buildings.glb','character-courier.glb','character-botanist.glb','neighborhoods.glb','residences.glb','commerce.glb','character-cartographer.glb','character-builder.glb'].map(f=>loader.loadAsync(`${import.meta.env.BASE_URL}shanhai/models/${f}`)));this.prefabs=buildings.scene;this.adoptNeighborhoods(neighborhoods.scene);this.adoptNeighborhoods(residences.scene);this.adoptNeighborhoods(commerce.scene);if(this.highland)this.prefabs.add(...makeHighlandPrefabs().children.slice());this.characterAssets={ayu:courier,qinghe:botanist,xingluo:cartographer,taoning:builder};if(this.highland)this.makeHighlandVillage();else this.makeVillage();this.createPawns([{id:0,characterId:'ayu',currentTile:0},{id:1,characterId:'qinghe',currentTile:1}]);this.syncProperties(null);this.scenery=this.batch(this.scenery);this.scene.add(this.scenery);this.renderer.shadowMap.needsUpdate=true;this.ambience=new SliceAmbience(this.scene,{mapId:this.mapId});this.loaded=true;this.animate();return this;}
  adoptNeighborhoods(pack){
    // The two Blender packs use the same named palette. Reuse material objects
    // so adding props does not create another full set of static draw calls.
    const shared=new Map();
    this.prefabs.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])shared.set(m.name,m);});
    pack.traverse(o=>{if(o.isMesh){const reuse=m=>shared.get(m.name)||m;o.material=Array.isArray(o.material)?o.material.map(reuse):reuse(o.material);}});
    this.prefabs.add(...pack.children);
  }
  regionalMaterial(material,region){
    const autumn={cream:'#e7c798',cream_light:'#f5dfb5',coral:'#a65d43',tile_light:'#cb8a58',teal:'#767447',leaf:'#bd823a',leaf_light:'#d8a54b',jade:'#8b7539'};const color=this.highland?autumn[material.name]:REGION_ARCHITECTURE[region]?.[material.name];if(!color)return material;
    this.regionalMaterials??=new Map();const key=`${region}:${material.uuid}`;
    if(!this.regionalMaterials.has(key)){const copy=material.clone();copy.color.set(color);this.regionalMaterials.set(key,copy);}
    return this.regionalMaterials.get(key);
  }
  clonePrefab(name,x,z,scale=1,rotation=0,parent=this.scenery,region=null){const original=this.prefabs.getObjectByName(name);if(!original)throw new Error(`Missing original asset ${name}`);const group=original.clone(true);group.position.set(x,.22,z);group.rotation.y=rotation;group.scale.multiplyScalar(scale);group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(region||this.highland){const recolor=m=>this.regionalMaterial(m,region);o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);}}});parent.add(group);return group;}
  makeVillage(){
    COAST_REGIONS.forEach((region,i)=>{const tile=this.tiles[i*8+2];const label=this.addLabel(region.name,v(tile.position.x*1.39,.6,tile.position.z*1.39),'region-label');label.style.borderColor=region.color;});
    // Landmarks are scenery inside the loop. Numbered outer plots stay playable.
    this.regionalScenery=REGIONAL_SCENERY;
    for(const item of REGIONAL_SCENERY){
      this.clonePrefab(item.model,item.x,item.z,item.scale,item.rotation);
      if(item.landmark)this.addLabel(item.label,v(item.x,4.2,item.z),'civic');
    }
    this.clonePrefab('market',2.2,3.7,.85,Math.PI);this.clonePrefab('lighthouse',-9,-2,.95,.4);
    const placements=[[-10,-3],[-10,0],[-8,2],[-5,-.9],[1,-1],[3,-1],[8,3],[-1,7.6],[-9,10],[0,12],[6,11],[15,1],[-15,-3],[-14,6],[3,-12]];
    placements.forEach(([x,z],i)=>this.clonePrefab(i%6===0?'palm':'tree_round',x,z,.7+(i%4)*.12,i*1.3));
    for(let i=0;i<28;i++){const a=i*2.3999,r=5+(i%4)*.8;const x=Math.cos(a)*r,z=Math.sin(a)*r*.65;if((x>-3.7&&x<-.2&&Math.abs(z)<2)||z< -3||REGIONAL_SCENERY.some(p=>Math.hypot(x-p.x,z-p.z)<(p.landmark?2.5:1)))continue;this.clonePrefab(i%3?'shrub':'flower_planter',x,z,.6+(i%3)*.1,a);}
    [[-4,0],[-2,3],[.5,0],[-2,-2.8]].forEach(([x,z],i)=>this.clonePrefab('bench',x,z,.85,i*Math.PI/2));
    [1,5,9,13,17,21].forEach(i=>{const p=this.tiles[i].position,a=Math.atan2(p.x,p.z);this.clonePrefab('streetlight',p.x-Math.sin(a)*1.35,p.z-Math.cos(a)*1.35,.8,a);});
    this.addLabel('望潮灯塔',v(-9,4.6,-2),'civic');this.addLabel('海风花园',v(-2,2.5,0),'civic');
  }
  batch(root){
    root.updateMatrixWorld(true);const batches=new Map(),textured=[];
    root.traverse(o=>{
      if(!o.isMesh)return;
      const source=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
      const groups=Array.isArray(o.material)?(o.geometry.groups.length?o.geometry.groups:[{start:0,count:source.getAttribute('position').count,materialIndex:0}]):[{start:0,count:source.getAttribute('position').count,materialIndex:0}];
      for(const group of groups){
        const material=Array.isArray(o.material)?o.material[group.materialIndex]:o.material;
        if(!material)continue;
        const geometry=new THREE.BufferGeometry();
        for(const name of ['position','normal','uv']){
          const a=source.getAttribute(name),size=name==='uv'?2:3,values=new Float32Array(group.count*size);
          if(a)for(let i=0;i<group.count;i++)for(let c=0;c<size;c++)values[i*size+c]=a.getComponent(group.start+i,c);
          geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
        }
        geometry.applyMatrix4(o.matrixWorld);
        if(material.map){material.needsUpdate=true;const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=o.castShadow;mesh.receiveShadow=o.receiveShadow;textured.push(mesh);continue;}
        let entry=batches.get(material.uuid);if(!entry){entry={material,geometries:[],casts:false};batches.set(material.uuid,entry);}entry.geometries.push(geometry);entry.casts ||= o.castShadow;
      }
      if(source!==o.geometry)source.dispose();
    });
    // Reused materials may have been compiled before shadow maps existed or for
    // a different mesh. Refresh their render state when adopting batched geometry.
    const out=new THREE.Group();for(const entry of batches.values()){entry.material.needsUpdate=true;const geometry=mergeGeometries(entry.geometries,false);if(geometry){const mesh=new THREE.Mesh(geometry,entry.material);mesh.castShadow=entry.casts;mesh.receiveShadow=true;out.add(mesh);}entry.geometries.forEach(g=>g.dispose());}textured.forEach(m=>out.add(m));this.scene.remove(root);return out;
  }

  syncProperties(state){if(!this.prefabs)return;
    this.propertyBadges?.forEach(label=>label.remove?.());this.propertyBadges=new Map();
    this.labels=(this.labels||[]).filter(l=>!l.label.classList?.contains('property-badge'));
    this.propertyVisuals=[];this.propertyGroup.traverse(o=>{if(o.isMesh&&o.userData.batched)o.geometry.dispose();});this.scene.remove(this.propertyGroup);const raw=new THREE.Group();this.scene.add(raw);for(const tile of this.tiles){if(!['PROPERTY','BIG_PROPERTY'].includes(tile.type))continue;const p=state?.propertyManager.getProperty(tile.id);const lot=tile.visualLot;const level=p?.level||0,model=(this.highland&&highlandPropertyModel(tile,level,p?.owner!=null?p.buildingType:null))||residenceModel(tile,level,p?.owner!=null?p.buildingType:null);this.propertyVisuals.push({tileId:tile.id,model,level,owner:p?.owner??null});this.clonePrefab(model,lot.x,lot.z,tile.type==='BIG_PROPERTY'?.8:.87,lot.rotation,raw,(p?.level||0)>0?sliceRegion(tile.id,this.mapId).id:null);if(p?.owner!==null&&p?.owner!==undefined){
      const player=state.players[p.owner],front=v(lot.x+Math.sin(lot.rotation)*1.35,.82,lot.z+Math.cos(lot.rotation)*1.35);
      const badge=this.addLabel(`业主 ${player.name}${tile.type==='BIG_PROPERTY'?(p.buildingType==='PARK'?' · 花园':p.buildingType==='MALL'?' · 商场':' · 商业'):''} · L${level}`,front,'property-badge');badge.style.borderColor=player.color;
      badge.title=`${tile.name} · ${player.name}所有 · 建筑等级 ${level}`;if(badge.dataset)badge.dataset.propertyTile=String(tile.id);
      badge.classList?.toggle('is-selected',this.selectedTile===tile.id);this.propertyBadges.set(tile.id,badge);
      // Four physical upgrade pips remain visible even when compact labels hide.
      for(let pip=0;pip<(p.buildingType==='PARK'?1:4);pip++){
        const x=(pip-1.5)*.34,z=1.08,cos=Math.cos(lot.rotation),sin=Math.sin(lot.rotation);
        const mark=this.mesh(new THREE.BoxGeometry(.24,.035,.13),mat(pip<level?'#fff0a6':'#657669'),v(lot.x+x*cos+z*sin,.325,lot.z-x*sin+z*cos),raw);mark.rotation.y=lot.rotation;
      }
      const base=this.mesh(new RoundedBoxGeometry(2.6,.11,2.6,2,.12),mat(state.players[p.owner].color),v(lot.x,.25,lot.z),raw);base.rotation.y=lot.rotation;const pole=this.mesh(new THREE.CylinderGeometry(.035,.035,1.4,6),mat('#d7c5a4'),v(lot.x+.85,.9,lot.z+.85),raw);const flag=this.mesh(new THREE.BoxGeometry(.6,.33,.03),mat(state.players[p.owner].color),v(lot.x+1.12,1.4,lot.z+.85),raw);}}
    this.propertyGroup=this.batch(raw);this.propertyGroup.traverse(o=>{if(o.isMesh)o.userData.batched=true;});this.scene.add(this.propertyGroup);this.renderer.shadowMap.needsUpdate=true;}
  createPawns(players){this.endCharacterPreview();this.pawns.forEach(p=>{this.scene.remove(p.root);p.label.remove();p.mixer.stopAllAction();p.root.children.filter(child=>child!==p.model).forEach(child=>{child.geometry?.dispose();child.material?.dispose();});});this.labels=this.labels.filter(l=>!l.label.classList.contains('player-label'));this.pawns=[];this.mixers=[];
    players.forEach((player,i)=>{const id=player.characterId||player.profileId||'ayu',asset=this.characterAssets[id]||this.characterAssets.ayu;const model=cloneSkeleton(asset.scene);const root=new THREE.Group();root.add(model);model.scale.setScalar(1.4);model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;}});const shadow=new THREE.Mesh(new THREE.CircleGeometry(.55,32),new THREE.MeshBasicMaterial({color:'#547666',transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.01;root.add(shadow);const ring=new THREE.Mesh(new THREE.RingGeometry(.53,.65,36),new THREE.MeshBasicMaterial({color:player.color||colors[i],side:THREE.DoubleSide,transparent:true,opacity:.85}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;root.add(ring);const tile=this.tiles.find(t=>t.id===player.currentTile)||this.tiles[0];root.position.set(tile.position.x,.22,tile.position.z);root.rotation.y=Math.PI*.3;this.scene.add(root);const mixer=new THREE.AnimationMixer(model),actions={};for(const clip of asset.animations)actions[clip.name]=mixer.clipAction(clip);actions.idle?.play();this.mixers.push(mixer);const label=this.addLabel(player.name||['阿屿','青禾'][i],root.position.clone().add(v(0,2.8,0)),'player-label');label.style.background=player.color||colors[i];this.pawns.push({root,model,mixer,actions,ring,tileId:tile.id,inTransit:false,currentAction:'idle',label,playerId:player.id,characterId:id,labelName:player.name||id,expressionMood:'neutral',expressionUntil:0});});this.layoutPawns(1);this.updatePawnRings();}
  action(playerId,name,restart=false){const pawn=this.pawns.find(p=>p.playerId===playerId);if(!pawn||!pawn.actions[name]||(pawn.currentAction===name&&!restart))return;if(pawn.currentAction!==name)pawn.actions[pawn.currentAction]?.fadeOut(.15);const action=pawn.actions[name];action.setLoop(['idle','walk'].includes(name)?THREE.LoopRepeat:THREE.LoopOnce,Infinity);action.clampWhenFinished=!['idle','walk'].includes(name);action.reset().fadeIn(.15).play();pawn.currentAction=name;pawn.actionEpoch=(pawn.actionEpoch||0)+1;}
  async frameJourney(routeIds,duration=220){
    const goal=journeyCameraFrame(this.camera,this.controls.target,this.tiles,routeIds,this.container.clientWidth,this.container.clientHeight);if(!goal)return false;
    const camera=this.camera,controls=this.controls,position=camera.position.clone(),target=controls.target.clone(),zoom=camera.zoom,start=performance.now(),enabled=controls.enabled,damping=controls.enableDamping;
    controls.enabled=false;controls.enableDamping=false;controls.minZoom=Math.min(.75,goal.zoom);
    const ms=this.motionPreference.matches||!this.renderVisible?0:duration;
    try{await new Promise(resolve=>{const step=()=>{if(this.disposed){resolve();return;}const t=ms?Math.min(1,(performance.now()-start)/ms):1,e=t*t*(3-2*t);camera.position.lerpVectors(position,goal.position,e);controls.target.lerpVectors(target,goal.target,e);camera.zoom=zoom+(goal.zoom-zoom)*e;camera.updateProjectionMatrix();controls.update();if(t<1)requestAnimationFrame(step);else resolve();};step();});}finally{controls.enabled=enabled;controls.enableDamping=damping;}
    this.zoomed=false;return true;
  }
  async move(playerId,tileId,duration=360,continueWalking=false){const p=this.pawns.find(p=>p.playerId===playerId),tile=this.tiles.find(t=>t.id===tileId);if(!p||!tile)return;const start=p.root.position.clone(),end=this.pawnDestination(tileId,playerId),a=Math.atan2(end.x-start.x,end.z-start.z);const startAngle=p.root.rotation.y,turn=Math.atan2(Math.sin(a-startAngle),Math.cos(a-startAngle));p.inTransit=true;p.destinationTile=tileId;p.actions.walk?.setEffectiveTimeScale(Math.min(2,.8/(duration/1000)));this.action(playerId,'walk');const startTime=performance.now();await new Promise(resolve=>{const step=()=>{const t=Math.min(1,(performance.now()-startTime)/Math.max(1,duration));p.root.rotation.y=startAngle+turn*Math.min(1,t*3);p.root.position.lerpVectors(start,end,t);if(t<1&&!this.disposed)requestAnimationFrame(step);else resolve();};step();});p.tileId=tileId;p.inTransit=continueWalking;p.destinationTile=null;if(!continueWalking)this.action(playerId,'idle');this.highlight(tileId);}
  pawnDestination(tileId,playerId){const tile=this.tiles.find(t=>t.id===tileId);const p=pawnPlacement(tile,this.pawns,playerId,this.camera?.position,this.controls?.target,this.clearView);return v(p.x,p.y,p.z);}
  layoutPawns(dt){
    if(this.characterPreview)return;
    const alpha=this.motionPreference?.matches?1:1-Math.exp(-dt*14);
    for(const p of this.pawns){
      const tile=this.tiles.find(t=>t.id===p.tileId);if(!tile)continue;
      const layout=pawnPlacement(tile,this.pawns,p.playerId,this.camera?.position,this.controls?.target,this.clearView),scale=p.inTransit?1.4:layout.scale;
      if(!p.inTransit)p.root.position.lerp(v(layout.x,layout.y,layout.z),alpha);
      p.model.scale.lerp(v(scale,scale,scale),alpha);
      p.root.children.filter(child=>child!==p.model).forEach(child=>child.scale.setScalar(p.model.scale.x/1.4));
    }
  }
  syncPawns(players){players.forEach(p=>{const pawn=this.pawns.find(a=>a.playerId===p.id);if(pawn){pawn.tileId=p.currentTile;pawn.inTransit=false;pawn.destinationTile=null;}});this.layoutPawns(1);}
  layoutCrowds(){
    const host=document.getElementById('occupant-labels');if(!host)return;
    this.crowdLabels ||= new Map();const groups=crowdGroups(this.pawns),live=new Set(groups.map(([id])=>id));
    this.crowdLabels.forEach((label,id)=>{if(!live.has(id)){label.remove();this.crowdLabels.delete(id);}});
    this.pawns.forEach(p=>{p.label.hidden=live.has(p.tileId)&&!p.inTransit;});
    host.hidden=Boolean(this.characterPreview||this.tacticMode);if(host.hidden)return;
    const w=this.container.clientWidth,h=this.container.clientHeight,obstacles=[];
    this.crowdHiddenLabels?.forEach(label=>label.style.visibility='');this.crowdHiddenLabels=[];
    // Keep the selected owner's badge below the figures when its original lot anchor covers them.
    for(const [id,members] of groups){
      const badge=this.propertyBadges?.get(id);
      const points=members.map(p=>({foot:p.root.position.clone().project(this.camera),head:p.root.position.clone().add(v(0,2.1*p.model.scale.y,0)).project(this.camera)}));
      const pixels=w*this.camera.zoom/(this.camera.right-this.camera.left),left=Math.min(...points.map(p=>(p.foot.x*.5+.5)*w))-pixels*.8,right=Math.max(...points.map(p=>(p.foot.x*.5+.5)*w))+pixels*.8;
      const top=Math.min(...points.map(p=>(-p.head.y*.5+.5)*h)),bottom=Math.max(...points.map(p=>(-p.foot.y*.5+.5)*h))+4;
      for(const {label} of this.labels){
        if(['player-label','property-badge','garden-label','tactic-label'].some(name=>label.classList.contains(name))||!label.offsetWidth)continue;
        const x=parseFloat(label.style.left),y=parseFloat(label.style.top),width=label.offsetWidth,height=label.offsetHeight;
        if(x-width/2<right&&x+width/2>left&&y>top&&y-height<bottom){label.style.visibility='hidden';this.crowdHiddenLabels.push(label);}
      }
      if(!badge?.offsetWidth)continue;
      const x=parseFloat(badge.style.left),y=parseFloat(badge.style.top),bw=badge.offsetWidth,bh=badge.offsetHeight;
      if(x-bw/2<right&&x+bw/2>left&&y>top&&y-bh<bottom){badge.style.left=`${Math.max(bw/2+4,Math.min(w-bw/2-4,(left+right)/2))}px`;badge.style.top=`${Math.min(h-4,bottom+bh+7)}px`;}
    }
    this.propertyBadges?.forEach(label=>{if(!label.offsetWidth)return;const width=label.offsetWidth,height=label.offsetHeight,x=parseFloat(label.style.left),y=parseFloat(label.style.top);obstacles.push({left:x-width/2,right:x+width/2,top:y-height,bottom:y});});
    for(const [id,members] of groups){
      let label=this.crowdLabels.get(id);if(!label){label=document.createElement('button');label.className='crowd-label';label.dataset.crowdTile=String(id);label.onclick=()=>this.onSelect(id);host.append(label);this.crowdLabels.set(id,label);}
      const names=members.map(p=>p.labelName).join('、'),text=`${id}号 · ${members.length}人`;
      if(label.textContent!==text)label.textContent=text;label.setAttribute('aria-label',`${id}号 ${this.tiles.find(t=>t.id===id).name}，${members.length}名同行者：${names}。查看人物与产权`);label.title=names;label.disabled=Boolean(this.interactionBusy);
      const center=members.reduce((sum,p)=>sum.add(p.root.position),v(0,0,0)).multiplyScalar(1/members.length).add(v(0,2.35,0)).project(this.camera);
      label.hidden=center.z>1;if(label.hidden)continue;
      const width=label.offsetWidth,height=label.offsetHeight,x=Math.max(width/2+4,Math.min(w-width/2-4,(center.x*.5+.5)*w)),bottom=Math.max(height+4,Math.min(h-4,(-center.y*.5+.5)*h));
      const box=avoidBadgeOverlap({left:x-width/2,right:x+width/2,top:bottom-height,bottom},obstacles,h);label.style.left=`${box.left}px`;label.style.top=`${box.top}px`;obstacles.push(box);
    }
  }
  focusCrowd(tileId){const tile=this.tiles.find(t=>t.id===tileId);if(!tile)return;this.overview();this.controls.target.set(tile.position.x,.6,tile.position.z);const radius=Math.hypot(tile.position.x,tile.position.z)||1;this.camera.position.copy(this.controls.target).add(v(-tile.position.x/radius*(this.clearView?20:43),this.clearView?58:34,-tile.position.z/radius*(this.clearView?20:43)));this.camera.zoom=2;this.camera.updateProjectionMatrix();this.controls.update();this.highlight(tileId);}
  express(playerId,mood){const pawn=this.pawns.find(p=>p.playerId===playerId);if(!pawn)return;applyExpression(pawn.model,mood);pawn.expressionMood=mood;pawn.expressionUntil=mood==='neutral'?0:performance.now()+2400;pawn.label.textContent=pawn.labelName+(mood==='neutral'?'':` · ${EXPRESSION_LABELS[mood]||''}`);}
  async react(playerId,name){const pawn=this.pawns.find(p=>p.playerId===playerId);if(!pawn)return;this.express(playerId,expressionFor(name));this.action(playerId,name,true);const token=pawn.actionEpoch;await wait(this.motionPreference?.matches?30:(pawn.actions[name]?.getClip().duration||.9)*1000);if(!this.disposed&&this.pawns.includes(pawn)&&pawn.actionEpoch===token)this.action(playerId,'idle');}
  highlight(tileId){this.selectedTile=tileId;this.labels.filter(l=>l.label.classList?.contains('garden-label')).forEach(l=>l.label.classList.toggle('is-selected',l.label.dataset.gardenTile===String(tileId)));this.propertyBadges?.forEach((label,id)=>label.classList?.toggle('is-selected',id===tileId));const t=this.tiles.find(t=>t.id===tileId);if(!t)return;this.selection.visible=true;this.selection.position.set(t.position.x,.24,t.position.z);this.updatePlotOutline();}
  addLabel(text,position,className=''){const label=document.createElement('div');label.className=`world-label ${className}`;label.textContent=text;document.getElementById('world-labels').append(label);this.labels.push({label,position});return label;}
  setTacticTargets(view){
    this.tacticGroup?.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});this.tacticGroup?.removeFromParent();this.tacticGroup=null;this.tacticPicks=[];
    for(const l of this.labels.filter(l=>l.label.classList?.contains('tactic-label')))l.label.remove();this.labels=this.labels.filter(l=>!l.label.classList?.contains('tactic-label'));
    this.tacticMode=Boolean(view);this.updatePlotOutline();this.tacticPlayerTargets=Boolean(view?.playerTarget);this.container.parentElement.classList.toggle('tactic-view',Boolean(view));
    if(!view){if(this.tacticCamera){const c=this.tacticCamera;this.camera.position.copy(c.position);this.camera.zoom=c.zoom;this.zoomed=c.zoomed;this.controls.target.copy(c.target);this.camera.updateProjectionMatrix();this.controls.update();if(c.selected!=null)this.highlight(c.selected);else this.selection.visible=false;this.tacticCamera=null;}return;}
    if(!this.tacticCamera){this.tacticCamera={position:this.camera.position.clone(),target:this.controls.target.clone(),zoom:this.camera.zoom,zoomed:this.zoomed,selected:this.selectedTile};this.overview();}
    const group=new THREE.Group();this.tacticGroup=group;this.scene.add(group);
    for(const t of view.targets){
      const disc=new THREE.Mesh(new THREE.CircleGeometry(t.selected?.95:.75,16),new THREE.MeshBasicMaterial({color:t.selected?'#e3a23f':'#258b73',transparent:true,opacity:t.selected?.9:.52,depthTest:false,side:THREE.DoubleSide}));disc.rotation.x=-Math.PI/2;disc.position.set(t.x,.4,t.z);disc.renderOrder=6;disc.userData.tacticTargetId=t.id;group.add(disc);this.tacticPicks.push(disc);
      const label=this.addLabel(t.markerLabel,v(t.x,view.playerTarget?1.4:1,t.z),'tactic-label');label.classList.toggle('is-selected',t.selected);
    }
    if(view.path.length&&view.selected){const origin=this.tiles[view.selected.tileId],points=[v(origin.position.x,.5,origin.position.z),...view.path.map(id=>v(this.tiles[id].position.x,.5,this.tiles[id].position.z))];const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#b56826',depthTest:false}));line.renderOrder=7;group.add(line);view.path.forEach((id,i)=>{const t=this.tiles[id];this.addLabel(`→${i+1}`,v(t.position.x,1.1,t.position.z),'tactic-label tactic-path');});}
  }
  layoutTacticLabels(){
    if(!this.tacticPlayerTargets)return;
    const marks=this.labels.filter(l=>l.label.classList.contains('tactic-label')).map(l=>{const p=l.position.clone().project(this.camera);return {...l,x:Math.max(24,Math.min(this.container.clientWidth-24,(p.x*.5+.5)*this.container.clientWidth)),y:Math.max(24,(-p.y*.5+.5)*this.container.clientHeight)};}).sort((a,b)=>a.y-b.y);
    for(let i=0;i<marks.length;i++)for(let j=0;j<i;j++)if(Math.abs(marks[i].x-marks[j].x)<46&&marks[i].y-marks[j].y<27)marks[i].y=marks[j].y+27;
    for(const m of marks){m.label.style.left=`${m.x}px`;m.label.style.top=`${m.y}px`;}
  }
  syncObstacles(state){
    const ids=state?this.tiles.filter(t=>state.propertyManager.getProperty(t.id)?.hasObstacle).map(t=>t.id):[],key=ids.join(',');if(key===this.obstacleKey)return;this.obstacleKey=key;
    this.obstacleGroup?.traverse(o=>{if(o.isMesh)o.geometry.dispose();});this.obstacleGroup?.removeFromParent();
    for(const entry of this.labels.filter(l=>l.label.classList?.contains('obstacle-label')))entry.label.remove();this.labels=this.labels.filter(l=>!l.label.classList?.contains('obstacle-label'));
    const group=new THREE.Group();this.obstacleGroup=group;this.scene.add(group);
    for(const id of ids){const tile=this.tiles[id],base=new THREE.Group();base.position.set(tile.position.x,.25,tile.position.z);group.add(base);
      for(const x of [-.45,.45])this.mesh(new THREE.BoxGeometry(.12,.7,.15),mat('#825d40'),v(x,.35,0),base);
      this.mesh(new THREE.BoxGeometry(1.25,.3,.13),mat('#e7a04f'),v(0,.52,0),base);this.addLabel(`▥ ${id}号围栏`,v(tile.position.x,1.7,tile.position.z),'obstacle-label');
    }this.renderer.shadowMap.needsUpdate=true;
  }
  setCommissionTarget(tileId,caption='✉ 委托目的地'){
    const tile=this.tiles.find(t=>t.id===tileId);
    if(!this.commissionMarker){
      this.commissionMarker=new THREE.Group();
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.065,6,36),new THREE.MeshBasicMaterial({color:'#f4b657'}));
      ring.rotation.x=-Math.PI/2;this.commissionMarker.add(ring);
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.22,.5,4),new THREE.MeshBasicMaterial({color:'#b56a32'}));
      arrow.rotation.z=Math.PI;arrow.position.y=1.2;this.commissionMarker.add(arrow);
      this.scene.add(this.commissionMarker);
      this.commissionPosition=v(0,2,0);this.commissionLabel=this.addLabel('✉ 委托目的地',this.commissionPosition,'commission-label');
    }
    this.commissionMarker.visible=Boolean(tile);this.commissionLabel.hidden=!tile;this.commissionLabel.textContent=caption;
    if(tile){this.commissionMarker.position.set(tile.position.x,.3,tile.position.z);this.commissionPosition.set(tile.position.x,2,tile.position.z);}
  }
  setGardenInfluence(info){
    this.gardenGroup?.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
    if(this.gardenGroup)this.scene.remove(this.gardenGroup);
    for(const item of this.labels.filter(l=>l.label.classList.contains('garden-label')))item.label.remove();
    this.labels=this.labels.filter(l=>!l.label.classList.contains('garden-label'));
    this.gardenGroup=null;this.gardenInfo=info;
    this.container.parentElement.classList.toggle('garden-view',Boolean(info));
    if(!info)return;
    const group=new THREE.Group();this.gardenGroup=group;this.scene.add(group);
    const marks=[{tileId:info.sourceId,source:true},...info.rows];
    for(const row of marks){
      const tile=this.tiles.find(t=>t.id===row.tileId),lot=tile.visualLot;
      const color=row.source?'#bd863b':row.increase>0?'#237e68':'#7b8587';
      const ring=new THREE.Mesh(new THREE.RingGeometry(1.94,2.07,4,1,Math.PI/4),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,depthWrite:false}));
      ring.rotation.set(-Math.PI/2,0,lot.rotation);ring.position.set(lot.x,.34,lot.z);group.add(ring);
      const label=this.addLabel(String(row.tileId),v(tile.position.x,1,tile.position.z),'garden-label');label.style.borderColor=color;label.dataset.gardenTile=String(row.tileId);
      label.classList.toggle('is-selected',this.selectedTile===row.tileId);
    }
  }
  layoutGardenLabels(){
    if(!this.gardenInfo)return;
    const width=this.container.clientWidth,height=this.container.clientHeight;
    const marks=this.labels.filter(l=>l.label.classList.contains('garden-label')).map(l=>{const p=l.position.clone().project(this.camera);return {...l,x:Math.max(22,Math.min(width-22,(p.x*.5+.5)*width)),y:Math.max(42,(-p.y*.5+.5)*height)};}).sort((a,b)=>a.y-b.y);
    for(let i=0;i<marks.length;i++)for(let j=0;j<i;j++)if(Math.abs(marks[i].x-marks[j].x)<38&&marks[i].y-marks[j].y<36)marks[i].y=marks[j].y+36;
    const overflow=Math.max(0,...marks.map(m=>m.y-(height-12)));
    for(const m of marks){m.label.style.left=`${m.x}px`;m.label.style.top=`${m.y-overflow}px`;}
  }
  focusGarden(){
    if(!this.gardenCamera)this.gardenCamera={position:this.camera.position.clone(),target:this.controls.target.clone(),zoom:this.camera.zoom};
    const tile=this.tiles.find(t=>t.id===12),target=v(tile.position.x,0,tile.position.z);
    this.controls.target.copy(target);this.camera.position.copy(target).add(this.clearView?v(12,58,16):v(26,34,35));this.camera.zoom=2;this.camera.updateProjectionMatrix();this.controls.update();
  }
  restoreGardenView(){if(!this.gardenCamera)return;this.camera.position.copy(this.gardenCamera.position);this.controls.target.copy(this.gardenCamera.target);this.camera.zoom=this.gardenCamera.zoom;this.camera.updateProjectionMatrix();this.controls.update();this.gardenCamera=null;}
  previewCharacter(playerId){
    this.endCharacterPreview();
    const pawn=this.pawns.find(p=>p.playerId===playerId);if(!pawn)return;
    // Reuse the selected pawn and renderer: no second canvas, cloned model or lights.
    this.characterPreview={visibility:new Map(this.scene.children.map(child=>[child,child.visible]))};
    this.scene.children.forEach(child=>{if(!child.isLight&&child!==pawn.root)child.visible=false;});
    const target=pawn.root.position.clone().add(v(0,1.25,0));
    this.controls.maxZoom=8;this.controls.minZoom=4;this.controls.minPolarAngle=.38;this.controls.maxPolarAngle=1.12;
    this.controls.target.copy(target);this.camera.position.copy(target).add(v(5,4.5,7));
    this.camera.zoom=6;this.camera.updateProjectionMatrix();this.controls.update();this.zoomed=false;
  }
  endCharacterPreview(){
    if(!this.characterPreview)return;
    this.characterPreview.visibility.forEach((visible,child)=>{child.visible=visible;});
    this.characterPreview=null;this.controls.minZoom=.75;this.controls.maxZoom=2;this.controls.minPolarAngle=this.clearView ? .18 : .38;this.controls.maxPolarAngle=this.clearView ? .48 : 1.12;
  }
  overview(){this.endCharacterPreview();this.camera.zoom=1;this.camera.position.set(...(this.clearView?[12,58,16]:[26,34,35]));this.controls.target.set(0,0,0);this.camera.updateProjectionMatrix();this.zoomed=false;}
  rotate(){const pos=this.camera.position.clone().sub(this.controls.target).applyAxisAngle(v(0,1,0),Math.PI/2).add(this.controls.target);this.camera.position.copy(pos);this.controls.update();}
  zoom(){this.zoomed=!this.zoomed;this.camera.zoom=this.characterPreview?(this.zoomed?7.5:6):(this.zoomed?1.4:1);this.camera.updateProjectionMatrix();}
  animate(){if(this.disposed)return;this.frame=requestAnimationFrame(()=>this.animate());const dt=Math.min(this.clock.getDelta(),.08),time=this.clock.elapsedTime;this.mixers.forEach(m=>m.update(dt));this.controls.update();this.layoutPawns(dt);if(this.highlandDetail)this.highlandDetail.visible=!this.characterPreview&&!this.compactPreference.matches;this.selection.material.opacity=(this.clearView||this.motionPreference.matches) ? .85 : .55+Math.sin(time*3)*.2;const ambientVisible=this.renderVisible&&!document.hidden,reduced=this.motionPreference.matches;this.ambience?.update(dt,{visible:ambientVisible,reduced,compact:this.compactPreference.matches,enabled:this.ambientMotion&&!this.characterPreview});this.sun.intensity=3.2*(this.ambience?.lightFactor??1);this.docks?.update(dt,{visible:ambientVisible,reduced:reduced||!this.ambientMotion});if(this.boat&&ambientVisible){const t=reduced||!this.ambientMotion?0:this.ambience?.time||0;this.boat.position.y=-1.2+Math.sin(t*1.5)*.06;this.boat.rotation.z=Math.sin(t)*.035;}this.pawns.forEach(p=>{if(p.expressionUntil&&performance.now()>=p.expressionUntil)this.express(p.playerId,'neutral');const l=this.labels.find(item=>item.label===p.label);if(l)l.position.copy(p.root.position).add(v(0,2.8,0));});this.labels.forEach(({label,position})=>{const p=position.clone().project(this.camera);label.style.left=`${(p.x*.5+.5)*this.container.clientWidth}px`;label.style.top=`${(-p.y*.5+.5)*this.container.clientHeight}px`;label.style.display=p.z>1?'none':'';});this.layoutCrowds();this.layoutGardenLabels();this.layoutTacticLabels();if(this.diceThrow){const t=Math.min(1,(performance.now()-this.diceThrow.start)/this.diceThrow.duration),e=1-Math.pow(1-t,3),target=this.diceThrow.target;this.diceMesh.position.set(-1+Math.sin(t*Math.PI)*1.2,.9+Math.sin(t*Math.PI)*2.5,7);this.diceMesh.rotation.set(target[0]+(1-e)*Math.PI*5,target[1]+(1-e)*Math.PI*4,target[2]+(1-e)*Math.PI*6);if(t===1&&performance.now()-this.diceThrow.start>this.diceThrow.duration+2400){this.diceMesh.visible=false;this.diceThrow=null;}}if(this.renderVisible)this.renderer.render(this.scene,this.camera);this.metrics={calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries};}
  dispose(){this.plotOutline?.geometry.dispose();this.plotOutline?.material.dispose();this.crowdLabels?.forEach(label=>label.remove());this.setTacticTargets(null);this.syncObstacles(null);this.mountainPeople?.dispose();this.setGardenInfluence(null);this.docks?.dispose();this.ambience?.dispose();this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.visibilityObserver.disconnect();this.controls.dispose();this.renderer.dispose();this.labels.forEach(l=>l.label.remove());}
}
