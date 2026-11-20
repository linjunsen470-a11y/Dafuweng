import * as THREE from 'three';
import { surfaceTime } from './BoardSurfaceArt.js';
import { COAST_WATER_Y } from './IslandCoast.js';
import { updateHarborGulls } from './HarborPromenade.js';
import { quietMotion } from './EffectTimeline.js';

// Animate existing meshes and shader uniforms. No extra lighting or draw passes.
export class WorldAmbience {
  constructor(board) {
    this.board=board;
    this.time=0;
    this.last=performance.now();
    this.windows=new Map();
  }

  update() {
    const now=performance.now(), dt=Math.min(.16,(now-this.last)/1000);
    this.last=now;
    if (quietMotion()) return;
    const b=this.board;
    this.time+=dt;
    const t=this.time;
    surfaceTime.value=t;
    if (b.waterTime) b.waterTime.value=t*1.8;
    b.harborWaves?.forEach((wave,i)=>{
      wave.position.x=wave.userData.originX+9*Math.sin(t*wave.userData.speed+i);
      wave.material.opacity=.27+.08*Math.sin(t*1.6+i);
    });
    b.harborFerries?.forEach((boat,i)=>{
      const speed=boat.userData.speed;
      boat.position.x=((boat.userData.originX+speed*t*2.5+78)%156+156)%156-78;
      boat.position.y=COAST_WATER_Y-.22+.08*Math.sin(t*1.8+i);
      boat.rotation.set(.035*Math.sin(t+i),speed<0?Math.PI:0,.035*Math.sin(t*1.4));
    });
    if (b.harborGulls) updateHarborGulls(b.harborGulls,t*1.8);
    if (b.windmillBlades) b.windmillBlades.rotation.z=t*.8;
    for (const group of b.buildingMeshes.values()) {
      if (group.userData.rotor) group.userData.rotor.rotation.y=t*.9;
    }
    for (const group of b.specialTileMeshes.values()) {
      if (group.userData.arcadeRotor) group.userData.arcadeRotor.rotation.z=t*.8;
    }
    if (b.scene3D.timeOfDay !== 'DAY') {
      const glow=.9+.1*Math.sin(t*1.4);
      for (const [material, brightness] of this.windows) material.emissiveIntensity=brightness*glow;
      for (const {bulb} of b.streetLights || []) bulb.material.opacity=glow;
    }
  }
}

// The arcade's rooftop pinwheel uses one mesh and its existing lot's disposal path.
export function arcadePinwheel(group, height) {
  const shape=new THREE.Shape();
  shape.moveTo(0,0);
  for (let i=0;i<5;i++) {
    const a=i*2*Math.PI/5;
    shape.lineTo(.49*Math.cos(a),.49*Math.sin(a));
    shape.lineTo(.33*Math.cos(a+.7),.33*Math.sin(a+.7));
    shape.lineTo(0,0);
  }
  const rotor=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:'#f28a51',side:THREE.DoubleSide}));
  rotor.position.set(0,height+.32,0);
  group.add(rotor);group.userData.arcadeRotor=rotor;
}
