import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Ribbons and retaining faces share a centreline so their joints follow the
// whole turn. Coordinates are scenic only; legal edges come from MapData.
export function connectingStreet(mapId){
  if(!['city-loop','taiwan-loop','island-fork','fortune-crossroads'].includes(mapId))return null;
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
      const l=typeof left==='function'?left(t):left;
      const r=typeof right==='function'?right(t):right;
      edge(l,base);edge(l,top);edge(r,top);edge(r,base);
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
  if(mapId==='city-loop'){
    // The surface railway sweeps diagonally to the carriage sheds. Track fans,
    // not another playable street, give the station a visible city-side boundary.
    const main=path([[-20,.08,30],[-9,.08,28.8],[6,.08,27.9],[15,.08,26.7],
      [22,.08,23.8],[27.8,.08,18.7],[30.6,.08,11.4],[31,.08,-4],[31,.08,-18]]);
    strip(main,-3.1,3.1,-.68,.11,'#aaa59a');
    for(const edge of [-1.8,-.94,.94,1.8])strip(main,edge-.065,edge+.065,.13,.23,iron);
    for(let n=0;n<72;n++){
      const t=n/71,p=main.getPointAt(t),d=main.getTangentAt(t),angle=Math.atan2(d.x,d.z);
      for(const offset of [-1.37,1.37])box(p.x-offset*d.z,.21,p.z+offset*d.x,1.49,.12,.19,wood,angle);
    }
    const siding=path([[4,.1,27.95],[12,.1,28.5],[18,.1,30.15],[27,.1,30.85],[32,.1,30.85]]);
    strip(siding,-1.01,1.01,-.20,.09,'#a7a397');
    for(const side of [-.46,.46])strip(siding,side-.065,side+.065,.10,.20,iron);
    // A short maintenance consist stands on the near line with a cab facing
    // the points. The stops at both approach ends distinguish rail from road.
    for(const [t,cab] of [[.31,true],[.38,false]]){
      const p=main.getPointAt(t),d=main.getTangentAt(t),a=Math.atan2(d.x,d.z);
      const x=p.x-d.z*1.37,z=p.z+d.x*1.37;
      box(x,.60,z,1.53,.47,4.54,iron,a);
      box(x,.99,z,1.58,.49,4.42,cab?'#c7853f':'#6e8982',a);
      if(cab){
        box(x+d.x*.94,1.64,z+d.z*.94,1.49,.94,1.55,'#e6b850',a);
        box(x+d.x*1.74,1.71,z+d.z*1.74,1.12,.46,.10,iron,a);
        box(x+d.x*.94,2.18,z+d.z*.94,1.72,.16,1.79,cap,a);
      }else for(const side of [-1,1])box(x+side*d.z*.70,1.45,z-side*d.x*.70,.12,.76,4.33,'#79918c',a);
    }
    for(const t of [0,1]){
      const p=main.getPointAt(t),d=main.getTangentAt(t),a=Math.atan2(d.x,d.z);
      for(const off of [-1.37,1.37])box(p.x-d.z*off,.61,p.z+d.x*off,1.31,.82,.34,'#ab6550',a);
    }
    box(27.50,.20,10.42,5.04,.35,3.56,'#c6b59b');
    section('switching-yard');
    // Two masonry bays face the tracks; the glazed sawtooth roofs read in overview.
    for(const x of [24.5,30.25]){
      box(x,1.45,33.52,5.64,2.86,4.98,'#b67c61');
      box(x,1.20,30.99,3.96,2.18,.15,iron);
      const roof=new THREE.BoxGeometry(6.02,.20,5.71);roof.rotateX(.17);roof.translate(x,3.40,33.5);add(roof,'#537f80');
      box(x,3.10,30.97,5.04,.59,.15,'#99c3b6');
      for(const dx of [-1.87,-.92,0,.92,1.87])box(x+dx,3.12,30.86,.12,.66,.12,cap);
    }
    section('carriage-workshops',true);
    // Lift towers carry pedestrians over the east board edge, from the existing
    // station platform to the outer concourse. Keep the track-facing facade open.
    for(const x of [12.05,25.7]){
      box(x,2.16,10.47,1.76,4.32,2.25,'#d0a97d');
      box(x,2.26,11.64,.93,3.56,.15,iron);
      box(x,4.47,10.47,2.13,.28,2.72,'#4e8382');
      if(x>20)for(let k=0;k<4;k++)box(x-k*.31,.10+k*.09,12.35,1.42,.16+k*.16,.86,cap);
    }
    box(18.85,3.84,10.47,13.72,.30,1.42,'#50777a');
    for(const dz of [-.66,.66]){
      box(18.85,4.65,10.47+dz,13.9,.11,.13,iron);
      for(let i=0;i<9;i++){
        const x=12.15+1.51*i;
        beam(v(x,3.98,10.47+dz),v(x+.74,4.65,10.47+dz),.062,iron);
        beam(v(x+.74,4.65,10.47+dz),v(x+1.48,3.98,10.47+dz),.062,iron);
      }
    }
    section('station-passenger-bridge',true);
    return root;
  }
  if(mapId==='taiwan-loop'){
    // The sluice drains into a broad river; a shelving bank and separated
    // gravel bars leave a winding blue silhouette outside the original tile ring.
    const east=path([[27.5,.15,8.02],[27.9,.14,4],[31.4,.12,-1],[32,.10,-8],
      [29.2,.09,-15],[29.5,.08,-21],[34,.06,-27],[38,.04,-29],[46,.02,-32],[52,.01,-41],[64,0,-52],[82,0,-60]]);
    const west=path([[-17.45,.15,27.2],[-20.4,.14,26.9],[-23.6,.13,25.25],[-26.0,.11,21.7],
      [-28.1,.1,18.75],[-31.9,.1,16.6],[-32.9,.09,11.8],[-30.4,.07,7.6],[-28.6,.06,2.0],
      [-30.1,.05,-4],[-34,.04,-8],[-39,.02,-10],[-46,0,-18],[-59,0,-23],[-74,0,-33],[-87,0,-48]]);
    // Keep the lock mouth narrow. Farther downstream, deep water, shoals and
    // banks spread at different rates. The river continues past the town.
    const depthWidth=t=>2.02+3.6*t*t+1.7*Math.sin(t*7)**2;
    const shelfWidth=t=>depthWidth(t)+.44+1.58*Math.sin(t*5.8)**2;
    for(const river of [east,west]){
      strip(river,t=>-depthWidth(t),depthWidth,-.38,.07,'#73a99b');
      strip(river,depthWidth,shelfWidth,-.31,.06,'#9cc4ac');
      strip(river,shelfWidth,t=>shelfWidth(t)+.55,-.34,.09,'#d5bf91');
      strip(river,t=>-depthWidth(t)-.36,t=>-depthWidth(t),-.35,.14,'#cdb58d');
    }
    for(const [curve,offsets] of [[east,[.23,.55,.81]],[west,[.35,.58,.78]]]){
      for(const t of offsets){
        const p=curve.getPointAt(t),d=curve.getTangentAt(t);
        const shelf=new THREE.CylinderGeometry(1,1.10,.22,16);
        shelf.scale(1.12,1,2.36);shelf.rotateY(Math.atan2(d.x,d.z));
        shelf.translate(p.x+d.z*2.05,.23,p.z-d.x*2.05);add(shelf,'#b5b881');
        for(let k=0;k<5;k++)beam(v(p.x+d.z*2+k*.12,.32,p.z-d.x*2),v(p.x+d.z*2+k*.15,.65+(k%2)*.29,p.z-d.x*2+.18),.055,'#788c59');
      }
    }
    // The south footbridges lead directly to one towpath. It widens into
    // a stepped crescent outside the lock, with landing seats facing the water.
    const tow=path([[13,.10,30],[19,.12,30.15],[23,.12,29.65],[27.2,.12,27.4],
      [29.9,.12,24.1],[30.56,.12,20.4],[30.52,.12,15.6],[30.50,.12,8.24],[31.2,.12,5.6]]);
    strip(tow,-.62,.72,-.22,.21,'#d9be94');
    strip(tow,.69,.83,.12,.30,cap);
    const crescent=path([[21.7,.08,30.55],[25.3,.08,29.40],[28.63,.08,26.55],[30.54,.08,22.96]]);
    strip(crescent,.25,2.75,-.32,.27,'#b8ba87');
    strip(crescent,2.33,2.95,.12,.48,'#bba78a');
    for(const t of [.21,.55,.84]){
      const p=crescent.getPointAt(t),d=crescent.getTangentAt(t);
      box(p.x-d.z*1.48,.56,p.z+d.x*1.48,2.1,.19,.53,wood,Math.atan2(-d.z,d.x));
    }
    section('sluice-river-and-bars');
    // The ferry landing connects the paths through the vegetable gardens to
    // a low waterside hall. Walkable-looking scenery stays beyond the board.
    for(const [x,z,yaw] of [[-23.5,25.25,-.82],[29.9,1.9,.48]]){
      box(x,.50,z,7.45,.24,1.38,wood,yaw);
      for(const side of [-1,1]){
        const dx=Math.cos(yaw)*3.25*side,dz=-Math.sin(yaw)*3.25*side;
        box(x+dx,.51,z+dz,.26,1.00,.26,iron);
      }
    }
    for(let n=0;n<4;n++)box(24.6+n*.38,.10+n*.085,4.4,1.0,.17+n*.15,3.82,cap);
    section('riverside-piers');
    const hallX=-29.8,hallZ=25.6;
    box(hallX,.43,hallZ,4.6,.65,3.38,'#ab8b71');
    for(const dx of [-1.78,0,1.78])for(const dz of [-1.14,1.14])box(hallX+dx,1.61,hallZ+dz,.19,1.92,.21,'#ac6248');
    for(const s of [-1,1]){
      const g=new THREE.BoxGeometry(5.22,.21,1.92);g.rotateX(s*.32);
      g.translate(hallX,2.86,hallZ+s*.83);add(g,'#4c8079');
    }
    box(hallX,3.17,hallZ,5.37,.15,.18,'#9ca98d');
    section('ferry-landing',true);
    return root;
  }
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
