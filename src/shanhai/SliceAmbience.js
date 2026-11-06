import * as THREE from 'three-modern';

/** Original lightweight scenery motion; no shadows, textures, timers or game RNG. */
export class SliceAmbience {
  constructor(scene,{mapId='shanhai-coast'}={}) {
    this.highland=mapId==='shanhai-highland';this.lightFactor=1;this.dummy=new THREE.Object3D();
    this.group=new THREE.Group();this.group.name='ambient-life';scene.add(this.group);this.time=0;
    if(this.highland){
      this.smoke=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:'#e9e3ce',transparent:true,opacity:.3,depthWrite:false}),3);
      this.leaves=new THREE.InstancedMesh(new THREE.CircleGeometry(1,4),new THREE.MeshBasicMaterial({color:'#c16d34',side:THREE.DoubleSide}),6);
      this.smoke.frustumCulled=false;this.leaves.frustumCulled=false;this.group.add(this.smoke,this.leaves);this.update(0);return;
    }
    const birdMaterial=new THREE.MeshBasicMaterial({color:'#fff5d9',side:THREE.DoubleSide});
    this.birds=[0,1].map(()=>{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute([
        0,0,.22,-.8,0,-.06,0,0,-.12, 0,0,-.12,.8,0,-.06,0,0,.22,
        -.06,0,-.28,.06,0,-.28,0,0,.32
      ],3));
      const bird=new THREE.Mesh(geometry,birdMaterial);bird.frustumCulled=false;this.group.add(bird);return bird;
    });
    this.ripples=[0,1].map(()=>{
      const ring=new THREE.Mesh(new THREE.RingGeometry(.40,.43,24),new THREE.MeshBasicMaterial({color:'#e9f5d9',side:THREE.DoubleSide,transparent:true,forceSinglePass:true,opacity:.5,depthWrite:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set(-2,.84,0);this.group.add(ring);return ring;
    });
    this.waves=new THREE.InstancedMesh(new THREE.RingGeometry(1,1.035,32),new THREE.MeshBasicMaterial({color:'#d9f0dc',transparent:true,opacity:.38,side:THREE.DoubleSide,forceSinglePass:true,depthWrite:false}),2);
    this.waves.frustumCulled=false;this.group.add(this.waves);this.update(0);
  }
  update(dt,{visible=true,reduced=false,compact=false,enabled=true}={}) {
    this.group.visible=enabled&&!reduced;this.lightFactor=1;
    if(!visible||reduced||!enabled)return;
    this.time+=Math.min(Math.max(dt,0),.08);
    this.lightFactor=compact?1:.97+.03*Math.cos(this.time*Math.PI/30);
    if(this.highland){
      this.smoke.count=compact?2:3;this.leaves.visible=!compact;
      for(let i=0;i<this.smoke.count;i++){
        const phase=(this.time*.12+i/this.smoke.count)%1,scale=Math.sin(phase*Math.PI)*(.3+phase*.25);
        this.dummy.position.set(7.7+phase*.65,3.42+phase*1.8,-8.2-phase*.25);this.dummy.rotation.set(0,phase,phase*.3);this.dummy.scale.set(scale,scale*.8,scale);this.dummy.updateMatrix();this.smoke.setMatrixAt(i,this.dummy.matrix);
      }
      this.smoke.instanceMatrix.needsUpdate=true;
      if(!compact){for(let i=0;i<6;i++){
        const phase=(this.time*.07+i*.19)%1;
        this.dummy.position.set(-9+phase*5.5,2.6-phase*1.6,-4+Math.sin(i*2.4)*1.9);this.dummy.rotation.set(phase*7+i,phase*5,i);this.dummy.scale.setScalar(Math.sin(phase*Math.PI)*(.18+i%3*.04));this.dummy.updateMatrix();this.leaves.setMatrixAt(i,this.dummy.matrix);
      }this.leaves.instanceMatrix.needsUpdate=true;}return;
    }
    this.waves.visible=!compact;
    if(!compact){for(let i=0;i<2;i++){
      const phase=(this.time*.1+i*.5)%1;
      this.dummy.position.set(21+i*2,-1.48,-7+i*11);this.dummy.rotation.set(-Math.PI/2,0,.35);const size=(1.7+phase*1.4)*Math.sin(phase*Math.PI);this.dummy.scale.set(size,size*.55,1);this.dummy.updateMatrix();this.waves.setMatrixAt(i,this.dummy.matrix);
    }this.waves.instanceMatrix.needsUpdate=true;}
    for(let i=0;i<2;i++){
      this.birds[i].visible=this.ripples[i].visible=!compact||i===0;
      const bird=this.birds[i],a=this.time*.14+i*.7;
      bird.position.set(Math.cos(a)*20,4.5+Math.sin(a*2+i)*.5,Math.sin(a)*15);
      bird.rotation.y=-a;
      const position=bird.geometry.getAttribute('position');
      position.setY(1,Math.sin(this.time*3+i)*.28);position.setY(4,Math.sin(this.time*3+i)*.28);position.needsUpdate=true;
      const phase=(this.time*.35+i*.5)%1,ring=this.ripples[i];
      ring.scale.setScalar(.7+phase*2.2);ring.material.opacity=(1-phase)*.55;
    }
  }
  dispose(){
    const materials=new Set();this.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.dispose?.();materials.add(o.material);}});
    materials.forEach(m=>m.dispose());this.group.removeFromParent();
  }
}
