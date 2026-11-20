import * as THREE from 'three';

function createRoundedDiceGeometry(size = 1.9, radius = 0.28, segments = 4) {
  const geo = new THREE.BoxGeometry(size, size, size, segments * 2, segments * 2, segments * 2);
  const pos = geo.attributes.position;
  const half = size * 0.5;
  const inner = half - radius;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(
      THREE.MathUtils.clamp(v.x, -inner, inner),
      THREE.MathUtils.clamp(v.y, -inner, inner),
      THREE.MathUtils.clamp(v.z, -inner, inner)
    );
    const diff = v.clone().sub(c);
    if (diff.lengthSq() > 0) {
      diff.normalize().multiplyScalar(radius);
      v.copy(c).add(diff);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

export class Dice3D {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.createDiceMesh();
  }

  createDiceMesh() {
    const geo = createRoundedDiceGeometry(2.05, 0.34, 4);

    const materials = [];
    for (let i = 1; i <= 6; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Warm ivory toy dice face with soft bevel sheen
      const bg = ctx.createRadialGradient(110, 96, 18, 128, 128, 170);
      bg.addColorStop(0, '#fffef8');
      bg.addColorStop(0.75, '#fff5db');
      bg.addColorStop(1, '#f3dba9');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 256, 256);

      ctx.strokeStyle = '#e0a54b';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.roundRect(14, 14, 228, 228, 36);
      ctx.stroke();

      this.drawDots(ctx, i);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      materials.push(new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.22,
        metalness: 0.08
      }));
    }

    this.mesh = new THREE.Mesh(geo, materials);
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    this.scene3D.scene.add(this.mesh);

    const shadowGeo = new THREE.CircleGeometry(1.15, 24);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x3b2412, transparent: true, opacity: 0.28, depthWrite: false });
    this.shadows = Array.from({ length: 3 }, () => {
      const disc = new THREE.Mesh(shadowGeo, shadowMat.clone());
      disc.rotation.x = -Math.PI / 2;
      disc.visible = false;
      this.scene3D.scene.add(disc);
      return disc;
    });

    this.dice = [this.mesh, this.mesh.clone(), this.mesh.clone()];
    this.scene3D.scene.add(...this.dice.slice(1));
    this.targetRotations = {
      1: new THREE.Euler(0, 0, Math.PI / 2),
      2: new THREE.Euler(0, 0, -Math.PI / 2),
      3: new THREE.Euler(0, 0, 0),
      4: new THREE.Euler(Math.PI, 0, 0),
      5: new THREE.Euler(-Math.PI / 2, 0, 0),
      6: new THREE.Euler(Math.PI / 2, 0, 0)
    };
  }

  drawDots(ctx, num) {
    const dots = {
      1: [[128, 128]],
      2: [[74, 74], [182, 182]],
      3: [[74, 74], [128, 128], [182, 182]],
      4: [[74, 74], [74, 182], [182, 74], [182, 182]],
      5: [[74, 74], [74, 182], [128, 128], [182, 74], [182, 182]],
      6: [[76, 66], [76, 128], [76, 190], [180, 66], [180, 128], [180, 190]]
    };
    const isRed = num === 1 || num === 4;
    const radius = num === 1 ? 42 : 25;
    (dots[num] || []).forEach(([x, y]) => {
      // Soft recessed rim + glossy inner highlight
      ctx.fillStyle = isRed ? '#c82333' : '#242b38';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, radius * 0.1, x, y, radius);
      grad.addColorStop(0, isRed ? '#ff6b7a' : '#4a5568');
      grad.addColorStop(1, isRed ? '#d62839' : '#1e2430');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.88, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  roll(targetValue, startPos = new THREE.Vector3(0, 8, 0), diceValues = null) {
    return new Promise((resolve) => {
      const values = diceValues?.length ? diceValues : [targetValue];
      const startTime = performance.now();
      const speed = this.speed || 1;
      const duration = 900 / speed;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.scene3D.camera.quaternion).setY(0).normalize();
      const groundY = Math.max(1.08, startPos.y - 2.85);

      const bounceHeight = p => {
        // Realistic damped 3-bounce curve
        if (p < 0.45) {
          const u = p / 0.45;
          return (1 - u * u) * 3.8;
        }
        if (p < 0.76) {
          const u = (p - 0.45) / 0.31;
          return Math.sin(u * Math.PI) * 1.45;
        }
        if (p < 0.94) {
          const u = (p - 0.76) / 0.18;
          return Math.sin(u * Math.PI) * 0.45;
        }
        return 0;
      };

      const animateRoll = () => {
        const p = Math.min((performance.now() - startTime) / duration, 1);
        const ease = 1 - (1 - p) ** 3;
        values.forEach((value, i) => {
          const die = this.dice[i];
          const shadow = this.shadows[i];
          const target = this.targetRotations[value] || this.targetRotations[1];
          const spin = (1 - ease) * Math.PI * 2;
          const h = bounceHeight(p);
          const nearBounce = h < 0.12 && p > 0.42 && p < 0.96;

          die.visible = true;
          die.rotation.set(target.x + spin * (2.5 + i * 0.5), target.y + spin * 2, target.z + spin * 1.5);
          const squashY = nearBounce ? 0.84 : 0.96;
          const stretchXZ = nearBounce ? 1.06 : 0.96;
          die.scale.set(stretchXZ, squashY, stretchXZ);

          const lateral = (i - (values.length - 1) / 2) * 2.55 - (1 - ease) * 2.1;
          die.position.copy(startPos).addScaledVector(right, lateral);
          die.position.y = groundY + h;

          if (shadow) {
            shadow.visible = true;
            shadow.position.set(die.position.x, groundY - 0.96, die.position.z);
            shadow.scale.setScalar(Math.max(0.45, 1.05 - h * 0.14));
            shadow.material.opacity = Math.max(0.08, 0.32 - h * 0.055);
          }
        });
        if (p < 1.0) {
          requestAnimationFrame(animateRoll);
        } else {
          setTimeout(() => {
            this.dice.forEach(die => { die.visible = false; });
            this.shadows.forEach(s => { s.visible = false; });
            resolve(targetValue);
          }, 620 / speed);
        }
      };

      animateRoll();
    });
  }
}
