import * as THREE from 'three';

export class Dice3D {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.createDiceMesh();
    this.createDiceOverlay();
  }

  createDiceOverlay() {
    // 页面中心大屏 3D 掷骰子点数弹窗特效
    const overlay = document.createElement('div');
    overlay.id = 'dice-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 35%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.5);
      z-index: 99999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    overlay.innerHTML = `
      <div id="dice-overlay-box" style="
        background: rgba(22, 26, 48, 0.9);
        border: 2px solid #ffaa00;
        box-shadow: 0 0 30px rgba(255, 170, 0, 0.6);
        border-radius: 24px;
        padding: 20px 40px;
        display: flex;
        align-items: center;
        gap: 16px;
        backdrop-filter: blur(12px);
      ">
        <span id="dice-overlay-icon" style="font-size: 3.5rem;">🎲</span>
        <span id="dice-overlay-val" style="font-size: 3.2rem; font-weight: 900; color: #ffaa00;">6</span>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.overlayValEl = document.getElementById('dice-overlay-val');
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

    this.targetRotations = {
      1: new THREE.Euler(0, 0, -Math.PI / 2),
      6: new THREE.Euler(0, 0, Math.PI / 2),
      2: new THREE.Euler(0, 0, 0),
      5: new THREE.Euler(Math.PI, 0, 0),
      3: new THREE.Euler(-Math.PI / 2, 0, 0),
      4: new THREE.Euler(Math.PI / 2, 0, 0)
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
      this.mesh.position.copy(startPos);
      this.mesh.visible = true;
      this.mesh.scale.set(0.1, 0.1, 0.1);

      const startTime = performance.now();
      const speed = this.speed || 1;
      const duration = 1000 / speed;

      const targetEuler = this.targetRotations[targetValue] || this.targetRotations[1];
      const extraSpinX = (Math.floor(Math.random() * 3) + 3) * Math.PI * 2;
      const extraSpinY = (Math.floor(Math.random() * 3) + 3) * Math.PI * 2;
      const extraSpinZ = (Math.floor(Math.random() * 3) + 3) * Math.PI * 2;

      const animateRoll = () => {
        const elapsed = performance.now() - startTime;
        const p = Math.min(elapsed / duration, 1.0);

        const easeP = 1 - Math.pow(1 - p, 3);

        this.mesh.rotation.x = targetEuler.x + (1 - easeP) * extraSpinX;
        this.mesh.rotation.y = targetEuler.y + (1 - easeP) * extraSpinY;
        this.mesh.rotation.z = targetEuler.z + (1 - easeP) * extraSpinZ;

        const scale = Math.min(p * 2.2, 1.2);
        this.mesh.scale.set(scale, scale, scale);

        const bounceHeight = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 5;
        this.mesh.position.y = startPos.y - 3 + bounceHeight;

        if (p < 1.0) {
          requestAnimationFrame(animateRoll);
        } else {
          // 显示大屏点数 Overlay
          const values = diceValues?.length ? diceValues : [targetValue];
          const total = values.reduce((sum, value) => sum + value, 0);
          this.overlayValEl.textContent = values.length > 1
            ? `${values.join(' + ')} = ${total} 点`
            : `${total} 点`;
          this.overlayEl.style.opacity = '1';
          this.overlayEl.style.transform = 'translate(-50%, -50%) scale(1.1)';

          setTimeout(() => {
            this.mesh.visible = false;
            this.overlayEl.style.opacity = '0';
            this.overlayEl.style.transform = 'translate(-50%, -50%) scale(0.5)';
            resolve(targetValue);
          }, 600 / speed);
        }
      };

      animateRoll();
    });
  }
}
