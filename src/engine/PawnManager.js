import * as THREE from 'three';
import { PLAYER_PROFILES } from '../game/BoardData.js';

export class PawnManager {
  constructor(scene3D, boardBuilder) {
    this.scene3D = scene3D;
    this.boardBuilder = boardBuilder;
    this.pawns = [];
    this.godAuraMeshes = new Map();
  }

  createPlayerPawns(playerConfigs) {
    playerConfigs.forEach((cfg, index) => {
      const profile = PLAYER_PROFILES[index % PLAYER_PROFILES.length];
      const group = new THREE.Group();

      // 创建精致 Q 版 3D 角色模型
      const characterMesh = this.createDetailedCharacter(index, profile);
      group.add(characterMesh);

      // 角色脚下炫彩 3D 光圈底座
      const ringGeo = new THREE.RingGeometry(0.8, 1.0, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: profile.colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      group.add(ring);

      // 头顶 3D 悬浮名字标牌
      const namePlate = this.createNamePlate(cfg.name || profile.name, profile.color);
      namePlate.position.y = 2.4;
      group.add(namePlate);

      const startPos = this.boardBuilder.tilePositions[0];
      const offset = this.getPawnOffset(index);
      group.position.copy(startPos).add(offset);

      this.scene3D.scene.add(group);

      this.pawns.push({
        id: index,
        mesh: group,
        characterMesh: characterMesh,
        currentTile: 0,
        targetPos: group.position.clone()
      });
    });

    // 悬浮 Idle 呼吸动画
    this.scene3D.addUpdatable({
      update: () => {
        const time = performance.now() * 0.003;
        this.pawns.forEach((pawn, idx) => {
          if (pawn.characterMesh) {
            pawn.characterMesh.position.y = Math.sin(time + idx * 1.5) * 0.08;
          }
        });
      }
    });
  }

  createDetailedCharacter(index, profile) {
    const charGroup = new THREE.Group();
    const profId = profile.id !== undefined ? profile.id : index;

    if (profId === 0) {
      // 🎀 1. 林小满
      const dressMat = new THREE.MeshStandardMaterial({ color: '#ff4757', roughness: 0.3 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffeaa7', roughness: 0.5 });
      const hairMat = new THREE.MeshStandardMaterial({ color: '#2d3436', roughness: 0.4 });
      const ribbonMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });

      const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 20), dressMat);
      body.position.y = 0.55;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.25;
      charGroup.add(head);

      // 双马尾
      [-0.45, 0.45].forEach(x => {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), hairMat);
        bun.position.set(x, 1.4, -0.1);
        charGroup.add(bun);
      });

      // 蝴蝶结
      const bow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), ribbonMat);
      bow.position.set(0, 1.55, 0.25);
      charGroup.add(bow);
    } else if (profId === 1) {
      // 🤠 2. 顾田野
      const shirtMat = new THREE.MeshStandardMaterial({ color: '#ffa502', roughness: 0.5 });
      const hatMat = new THREE.MeshStandardMaterial({ color: '#f5cd79', roughness: 0.7 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffeaa7', roughness: 0.5 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 16), shirtMat);
      body.position.y = 0.5;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.2;
      charGroup.add(head);

      // 大草帽
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 24), hatMat);
      hatBrim.position.y = 1.5;
      charGroup.add(hatBrim);

      const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.35, 16), hatMat);
      hatTop.position.y = 1.7;
      charGroup.add(hatTop);
    } else if (profId === 2) {
      // 💎 3. 洛晶晶
      const dressMat = new THREE.MeshStandardMaterial({ color: '#a55eea', roughness: 0.2, metalness: 0.1 });
      const furMat = new THREE.MeshStandardMaterial({ color: '#f1f2f6', roughness: 0.8 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#ffeaa7', roughness: 0.5 });
      const glassesMat = new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.1 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 1.1, 20), dressMat);
      body.position.y = 0.55;
      body.castShadow = true;
      charGroup.add(body);

      const fur = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 12, 20), furMat);
      fur.rotation.x = Math.PI / 2;
      fur.position.y = 0.95;
      charGroup.add(fur);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), faceMat);
      head.position.y = 1.3;
      charGroup.add(head);

      const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.1), glassesMat);
      glasses.position.set(0, 1.35, 0.38);
      charGroup.add(glasses);
    } else if (profId === 3) {
      // 👳‍♂️ 4. 巴洛克
      const robeMat = new THREE.MeshStandardMaterial({ color: '#2ed573', roughness: 0.4 });
      const scarfMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 });
      const bandMat = new THREE.MeshStandardMaterial({ color: '#ff4757', roughness: 0.2 });

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.1, 20), robeMat);
      body.position.y = 0.55;
      body.castShadow = true;
      charGroup.add(body);

      const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), scarfMat);
      scarf.position.y = 1.3;
      charGroup.add(scarf);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 16), bandMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.55;
      charGroup.add(band);
    } else if (profId === 4) {
      // 🥷 5. 风间岚
      const suitMat = new THREE.MeshStandardMaterial({ color: '#1e90ff', roughness: 0.3 });
      const maskMat = new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.4 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.0, 0.5), suitMat);
      body.position.y = 0.5;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), suitMat);
      head.position.y = 1.25;
      charGroup.add(head);

      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.2), maskMat);
      mask.position.set(0, 1.2, 0.3);
      charGroup.add(mask);
    } else {
      // 🌴 6. 米娅
      const outfitMat = new THREE.MeshStandardMaterial({ color: '#ff7f50', roughness: 0.5 });
      const faceMat = new THREE.MeshStandardMaterial({ color: '#fab1a0', roughness: 0.5 });
      const featherMat = new THREE.MeshStandardMaterial({ color: '#00cec9', roughness: 0.3 });

      const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 16), outfitMat);
      body.position.y = 0.5;
      body.castShadow = true;
      charGroup.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 20), faceMat);
      head.position.y = 1.2;
      charGroup.add(head);

      // 头顶羽毛
      [-0.15, 0, 0.15].forEach((x, i) => {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 8), featherMat);
        feather.position.set(x, 1.7, 0);
        feather.rotation.z = (i - 1) * 0.3;
        charGroup.add(feather);
      });
    }

    return charGroup;
  }

  createNamePlate(nameText, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(16, 20, 40, 0.85)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 6;

    // 圆角矩形
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 52, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.2, 0.55, 1);
    return sprite;
  }

  getPawnOffset(playerIndex) {
    const angle = (playerIndex / 4) * Math.PI * 2;
    const dist = 0.95;
    return new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
  }

  // 沿路径跳跃移动动画（支持正向与反向，并实时同步回到 GameState）
  async movePawnAlongPath(playerIndex, steps, direction, gameState, onStepCallback, mapRuntime = null, onRouteChoice = null) {
    const pawn = this.pawns[playerIndex];
    if (!pawn) return;

    let current = pawn.currentTile;

    for (let i = 0; i < steps; i++) {
      if (mapRuntime) {
        const options = mapRuntime.getNextOptions(current, direction);
        if (!options.length) break;
        current = options.length > 1 && onRouteChoice
          ? await onRouteChoice(options, current, steps - i)
          : options[0];
        if (!options.includes(current)) current = options[0];
      } else {
        const boardSize = this.boardBuilder.tilePositions.length;
        current = (current + direction + boardSize) % boardSize;
      }
      pawn.currentTile = current;
      gameState.players[playerIndex].currentTile = current;

      const targetPos = this.boardBuilder.tilePositions[current].clone().add(this.getPawnOffset(playerIndex));

      // 单步跳跃音效与动画
      await this.animateHop(pawn.mesh, targetPos);

      if (onStepCallback) {
        const stopImmediate = onStepCallback(current);
        if (stopImmediate) break; // 如果踩中路障等强制打断
      }
    }
  }

  animateHop(mesh, targetPos) {
    return new Promise((resolve) => {
      const startPos = mesh.position.clone();
      const duration = 220; // ms
      const startTime = performance.now();

      const update = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        mesh.position.x = THREE.MathUtils.lerp(startPos.x, targetPos.x, progress);
        mesh.position.z = THREE.MathUtils.lerp(startPos.z, targetPos.z, progress);

        const jumpHeight = 1.3;
        mesh.position.y = startPos.y + Math.sin(progress * Math.PI) * jumpHeight;

        if (progress < 1.0) {
          requestAnimationFrame(update);
        } else {
          mesh.position.copy(targetPos);
          resolve();
        }
      };

      update();
    });
  }

  syncFromGameState(gameState) {
    this.pawns.forEach((pawn) => {
      const player = gameState.players[pawn.id];
      if (!player) return;
      pawn.currentTile = player.currentTile;
      const tilePosition = this.boardBuilder.tilePositions[player.currentTile];
      pawn.mesh.position.copy(tilePosition).add(this.getPawnOffset(player.id));
      this.updateGodAura(player.id, player.godType);
      if (player.isBankrupt) this.setBankrupt(player.id);
    });
  }

  updateGodAura(playerIndex, godType) {
    const pawn = this.pawns[playerIndex];
    if (!pawn) return;

    if (this.godAuraMeshes.has(playerIndex)) {
      const oldMesh = this.godAuraMeshes.get(playerIndex);
      pawn.mesh.remove(oldMesh);
      this.godAuraMeshes.delete(playerIndex);
    }

    if (!godType) return;

    let auraColor = 0xffd700; // 金光 (财神)
    if (godType === 'LUCK') auraColor = 0x00e5ff; // 蓝耀 (福神)
    else if (godType === 'MISFORTUNE') auraColor = 0x2d3436; // 幽黑 (穷神)
    else if (godType === 'BAD') auraColor = 0xd63031; // 警红 (衰神)
    else if (godType === 'EARTH') auraColor = 0x00b894; // 碧绿 (土地公)

    const geo = new THREE.TorusGeometry(0.85, 0.09, 16, 32);
    const mat = new THREE.MeshBasicMaterial({ color: auraColor });
    const aura = new THREE.Mesh(geo, mat);
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 2.2;

    pawn.mesh.add(aura);
    this.godAuraMeshes.set(playerIndex, aura);
  }

  setBankrupt(playerIndex) {
    const pawn = this.pawns[playerIndex];
    if (pawn) {
      pawn.mesh.traverse((child) => {
        if (child.isMesh) {
          child.material.transparent = true;
          child.material.opacity = 0.3;
        }
      });
    }
  }
}
