import * as THREE from 'three';

export class Dice3D {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.createDiceMesh();
  }

  createDiceMesh() {
    const geo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
    
    const materials = [];
    for (let i = 1; i <= 6; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 12;
      ctx.strokeRect(8, 8, 240, 240);

      ctx.fillStyle = (i === 1 || i === 4) ? '#ff4757' : '#2f3542';
      this.drawDots(ctx, i);

      const texture = new THREE.CanvasTexture(canvas);
      materials.push(new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.15,
        metalness: 0.1
      }));
    }

    this.mesh = new THREE.Mesh(geo, materials);
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    this.scene3D.scene.add(this.mesh);

    this.dice = [this.mesh,this.mesh.clone(),this.mesh.clone()];
    this.scene3D.scene.add(...this.dice.slice(1));
    this.targetRotations = {
      1: new THREE.Euler(0,0,Math.PI/2),
      2: new THREE.Euler(0,0,-Math.PI/2),
      3: new THREE.Euler(0,0,0),
      4: new THREE.Euler(Math.PI,0,0),
      5: new THREE.Euler(-Math.PI/2,0,0),
      6: new THREE.Euler(Math.PI/2,0,0)
    };
  }

  drawDots(ctx, num) {
    const dots = {
      1: [[128, 128]],
      2: [[72, 72], [184, 184]],
      3: [[72, 72], [128, 128], [184, 184]],
      4: [[72, 72], [72, 184], [184, 72], [184, 184]],
      5: [[72, 72], [72, 184], [128, 128], [184, 72], [184, 184]],
      6: [[72, 64], [72, 128], [72, 192], [184, 64], [184, 128], [184, 192]]
    };
    const radius = num === 1 ? 36 : 24;
    const list = dots[num] || [];
    list.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  roll(targetValue, startPos = new THREE.Vector3(0, 8, 0), diceValues = null) {
    return new Promise((resolve) => {
      const values = diceValues?.length ? diceValues : [targetValue];
      const startTime = performance.now();
      const speed = this.speed || 1;
      const duration = 880 / speed;
      const right = new THREE.Vector3(1,0,0).applyQuaternion(this.scene3D.camera.quaternion).setY(0).normalize();
      const animateRoll = () => {
        const p = Math.min((performance.now()-startTime)/duration,1);
        values.forEach((value,i)=>{
          const die=this.dice[i], target=this.targetRotations[value];
          const spin=(1-p)**2*Math.PI*2;
          die.visible=true;
          die.rotation.set(target.x+spin*(2+i),target.y+spin*2,target.z+spin);
          die.scale.setScalar(.92);
          die.position.copy(startPos).addScaledVector(right,(i-(values.length-1)/2)*2.4-(1-p)*1.7);
          die.position.y += -2.7 + (1-p)*1.4 + Math.abs(Math.sin(p*Math.PI*3))*(1-p)*2.5;
        });
        if (p < 1.0) {
          requestAnimationFrame(animateRoll);
        } else {
          setTimeout(() => {
            this.dice.forEach(die=>die.visible=false);
            resolve(targetValue);
          }, 600 / speed);
        }
      };

      animateRoll();
    });
  }
}
