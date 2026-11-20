import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Ribbons and retaining faces share a centreline so their joints follow the
// whole turn. Coordinates are scenic only; legal edges come from MapData.
export function connectingStreet(mapId){
  if(mapId!=='island-fork' && mapId!=='fortune-crossroads')return null;
  const coast=mapId==='island-fork', root=new THREE.Group(), batches=new Map();
  const stone='#b39a79', cap='#efd6ab', wood='#916345', iron='#416365';
  function add(geometry,color){
    if(geometry.index){const previous=geometry;geometry=previous.toNonIndexed();previous.dispose();}
    if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
    if(!batches.has(color))batches.set(color,[]);batches.get(color).push(geometry);
  }
  function box(x,y,z,w,h,d,color,yaw=0){
    const g=new THREE.BoxGeometry(w,h,d);g.rotateY(yaw);g.translate(x,y,z);add(g,color);
  }
  function beam(a,b,width,color){
    const dir=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(width,width,dir.length(),8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));
    const mid=a.clone().lerp(b,.5);g.translate(mid.x,mid.y,mid.z);add(g,color);
  }
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  function path(points){
    return new THREE.CatmullRomCurve3(points.map(([x,y,z])=>v(x,y,z)));
  }
  function strip(curve,left,right,base,top,color){
    const pos=[],idx=[],n=Math.ceil(curve.getLength()/1.1);
    for(let i=0;i<=n;i++){
      const t=i/n,p=curve.getPointAt(t),d=curve.getTangentAt(t),len=Math.hypot(d.x,d.z);
      const edge=(offset,y)=>pos.push(p.x-offset*d.z/len,p.y+y,p.z+offset*d.x/len);
      edge(left,base);edge(left,top);edge(right,top);edge(right,base);
      if(i<n)for(let side=0;side<3;side++){
        const a=i*4+side;idx.push(a,a+1,a+4,a+4,a+1,a+5);
      }
    }
    const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geom.setIndex(idx);geom.computeVertexNormals();add(geom,color);
  }
  function posts(curve,side,start,end,count){
    let prev;
    for(let i=0;i<=count;i++){
      const t=start+(end-start)*i/count,p=curve.getPointAt(t),d=curve.getTangentAt(t);
      p.x-=side*d.z;p.z+=side*d.x;
      box(p.x,p.y+.54,p.z,.17,1.02,.17,wood);
      p.y+=.90;if(prev)beam(prev,p,.055,wood);prev=p;
    }
  }
  const section=(name,occludes=false)=>{
    const group=new THREE.Group();group.name=name;group.userData.streetOccluder=occludes;
    for(const [color,parts] of batches){
      const mesh=new THREE.Mesh(mergeGeometries(parts),new THREE.MeshStandardMaterial({color,roughness:.88}));
      mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);parts.forEach(g=>g.dispose());
    }
    batches.clear();root.add(group);
  };
  if(coast){
    // Continue the fish market's public side down to a small lifeboat slip.
    const quay=path([[6,.12,11.2],[10,.12,10.0],[13.4,.16,8.4],[15.1,.20,7.1],[16.8,.20,5.7],[17.75,.12,5.16]]);
    strip(quay,-1.0,1.0,-.1,.15,'#d7ba91');strip(quay,.9,1.05,.04,.27,cap);
    const outer=path([[16,.13,21.2],[20,.13,19.0],[24,.16,15.8],[27.1,.23,12],[29.2,.20,7.3],[31.4,.16,3.2],[35,.13,.4],[39.5,.14,-.9]]);
    strip(outer,-1.4,1.4,-.11,.23,stone);strip(outer,-1.31,1.31,.20,.27,'#c9ad83');
    strip(outer,-1.41,-1.25,.21,.39,cap);
    posts(outer,-1.28,.02,.40,5);posts(outer,-1.28,.58,.95,6);
    // Launch ramp emerges from the same quay, its two skids continue beneath the hull.
    const slip=path([[26,.2,13.1],[28.7,.13,14.9],[31.7,-.10,16.8],[34,-.47,18.2]]);
    strip(slip,-1.72,1.72,-.08,.08,'#aa967c');
    for(const offset of [-.64,.64])strip(slip,offset-.10,offset+.10,.08,.21,iron);
    section('quay-to-launch');
    const yardX=15.2,yardZ=6.0;
    // A double-ended hull sits on timber cradles in front of an open-sided repair shed.
    const hull=new THREE.LatheGeometry([new THREE.Vector2(.12,0),new THREE.Vector2(.80,.43),new THREE.Vector2(1,.83)],12);
    hull.scale(1.88,1,.74);hull.translate(yardX,.58,yardZ);add(hull,'#ab563f');
    const deck=new THREE.CylinderGeometry(1,1,.10,12);deck.scale(1.88,1,.74);deck.translate(yardX,1.43,yardZ);add(deck,cap);
    for(const dx of [-1.13,1.13]){
      box(yardX+dx,.35,yardZ,.25,.52,1.49,wood);
      for(const dz of [-1.02,1.02])box(yardX+dx,1.51,yardZ+dz,.15,2.9,.15,iron);
      beam(v(yardX+dx,2.85,yardZ-1.06),v(yardX+dx,3.33,yardZ),.08,wood);
      beam(v(yardX+dx,3.33,yardZ),v(yardX+dx,2.85,yardZ+1.06),.08,wood);
    }
    box(yardX,3.31,yardZ,3.82,.13,.14,wood);
    for(const dz of [-.65,.65]){
      const g=new THREE.BoxGeometry(3.86,.16,1.45);g.rotateX(dz>0?.39:-.39);
      g.translate(yardX,3.07,yardZ+dz);add(g,'#729a92');
    }
    // A lifting jib over the open end marks the slipway from the arriving street.
    const pivot=v(16.67,2.55,6.45),tip=v(18.02,3.54,6.62);
    beam(v(16.67,.26,6.45),v(16.67,3.40,6.45),.13,'#a4513d');
    beam(pivot,tip,.12,'#eab254');
    beam(v(16.67,3.40,6.45),tip,.055,iron);
    beam(tip,v(tip.x,2.26,tip.z),.034,iron);
    const hook=new THREE.TorusGeometry(.17,.052,6,12,Math.PI*1.57);
    hook.translate(tip.x,2.13,tip.z);add(hook,iron);
    section('boat-repair-shed',true);
    // At the far end the existing channel marker shares the yard's brass
    // and red paint. The gallery sits on its mast inside the planted splitter.
    const sx=20.4,sz=-4.1;
    for(const [rad,height,y,color] of [[.68,.15,2.24,iron],[.38,.70,2.65,'#d99746'],[.72,.13,3.03,cap]]){
      const drum=new THREE.CylinderGeometry(rad,rad,height,12);
      drum.translate(sx,y,sz);add(drum,color);
    }
    const hood=new THREE.ConeGeometry(.72,.66,8);hood.translate(sx,3.37,sz);add(hood,'#af5340');
    for(const dx of [-.35,.35])for(const dz of [-.25,.25])box(sx+dx,2.67,sz+dz,.065,.65,.065,iron);
    for(let step=0;step<3;step++)box(sx, .23+step*.13,sz+1.39-step*.26,1.0,.17,.39,cap);
    section('harbor-pilot-light',true);
  }else{
    // A single cultivated bank carries the foreground cottages around the corner.
    // Its road-side face is low; dry stone, fruit trellises and a raised footway
    // follow the contour all the way from the upper sheds to the lower fields.
    const bank=path([[-2,.14,22.1],[-6.4,.20,22.15],[-10.7,.28,21.8],[-15.0,.43,20.65],
      [-18.8,.53,18.75],[-21.65,.47,16.10],[-23.6,.31,13.18],[-24.4,.18,10.6]]);
    strip(bank,-2.5,1.18,-.93,.09,'#b9af79');
    strip(bank,-1.33,.73,.09,.20,'#b5ae78');
    strip(bank,.46,1.18,.18,.25,'#deca9a');
    strip(bank,1.15,1.35,-.60,.25,'#a48e71');strip(bank,1.12,1.40,.25,.34,cap);
    for(const [lo,hi] of [[.04,.26],[.39,.59],[.71,.91]]){
      posts(bank,.37,lo,hi,3);
      for(let n=0;n<8;n++){
        const t=lo+(hi-lo)*n/7,p=bank.getPointAt(t),d=bank.getTangentAt(t);
        const g=new THREE.IcosahedronGeometry(1,0);
        g.scale(.54,.45,.48);g.translate(p.x+d.z*.60,p.y+.62,p.z-d.x*.60);
        add(g,n%3?'#719151':'#91a55d');
      }
    }
    section('valley-orchard-lane');
    // The irrigated inner branch descends from the flower path to the insurance office.
    // Beyond the bend the same watercourse passes a stone store, near the rejoin.
    const race=path([[-3.1,.64,7.6],[-5.35,.64,6.9],[-7.25,.50,5.25],[-7.00,.39,3.22],[-5.40,.20,.7],[-6,.13,-1.4],[-8.4,.09,-2.9],[-12.5,.08,-4.08]]);
    strip(race,-.83,.83,-.70,.30,stone);strip(race,-.62,.62,.30,.34,'#74b5aa');
    for(const edge of [-.73,.73])strip(race,edge-.12,edge+.12,.29,.48,cap);
    const terrace=path([[-2.4,.14,8.25],[-4.3,.15,7.95],[-6.37,.14,7.02],[-8.06,.14,5.47],[-8.25,.12,3.85]]);
    strip(terrace,-.35,.35,-.12,.48,'#a99477');strip(terrace,-.40,.40,.47,.57,cap);
    posts(race,.74,.07,.28,3);
    // A footbridge leads to the field gate. The stone water chute points towards the lower road.
    box(-6.7,1.08,5.89,2.82,.17,1.06,wood,-.6);
    box(-11,.52,-3.57,3.6,.24,1.09,cap,-.28);
    section('flower-path-mill-race');
    const x=-12.05,z=-5.95;
    box(x,.92,z,3.35,1.84,2.15,'#c9ad83');
    for(const side of [-1,1]){
      const g=new THREE.BoxGeometry(2.02,.19,2.65);g.rotateZ(-side*.44);
      g.translate(x+side*.84,2.21,z);add(g,'#a05f45');
    }
    box(x,1.08,z+1.09,1.17,1.61,.14,wood);
    box(x+1.03,1.11,z+1.13,.60,.63,.16,iron);
    const wheel=new THREE.TorusGeometry(.91,.105,7,18);wheel.translate(x-1.15,1.06,z+1.29);add(wheel,wood);
    for(let spoke=0;spoke<4;spoke++){
      const g=new THREE.BoxGeometry(.11,1.81,.11);g.rotateZ(spoke*Math.PI/4);g.translate(x-1.15,1.06,z+1.29);add(g,wood);
    }
    section('lower-mill-store',true);
  }
  return root;
}
