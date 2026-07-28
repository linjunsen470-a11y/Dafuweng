import * as THREE from 'three';
import { BOARD_TILES, COLOR_GROUPS, TileType } from '../game/BoardData.js';

export class BoardBuilder {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.tileMeshes = [];
    this.tilePositions = [];
    this.buildingMeshes = new Map();
    this.obstacleMeshes = new Map();

    this.boardSize = 8;
    this.tileSize = 4.4;
    this.halfBoard = (this.boardSize * this.tileSize) / 2;

    this.textureLoader = new THREE.TextureLoader();
    this.loadTextures();

    this.createBoardBase();
    this.createTiles();
    this.createCentralDecoration();
    this.createSurroundingCityEnvironment();
    this.createStreetlights();
  }

  loadTextures() {
    this.textures = {
      start: this.textureLoader.load('/assets/tile_start_rich.jpg'),
      bank: this.textureLoader.load('/assets/tile_bank_rich.jpg'),
      stock: this.textureLoader.load('/assets/tile_stock_rich.jpg'),
      shop: this.textureLoader.load('/assets/tile_shop_rich.jpg'),
      mapBg: this.textureLoader.load('/assets/map_bg_texture.jpg'),
      grass: this.textureLoader.load('/assets/grass_ground.jpg')
    };

    if (this.textures.mapBg) {
      this.textures.mapBg.wrapS = THREE.RepeatWrapping;
      this.textures.mapBg.wrapT = THREE.RepeatWrapping;
      this.textures.mapBg.repeat.set(2, 2);
    }
  }

  calculateTilePosition(index) {
    const step = this.tileSize;
    const startOffset = this.halfBoard - step / 2;

    let x = 0, z = 0;
    if (index >= 0 && index < 8) {
      x = startOffset - index * step;
      z = startOffset;
    } else if (index >= 8 && index < 16) {
      x = -startOffset;
      z = startOffset - (index - 8) * step;
    } else if (index >= 16 && index < 24) {
      x = -startOffset + (index - 16) * step;
      z = -startOffset;
    } else if (index >= 24 && index < 32) {
      x = startOffset;
      z = -startOffset + (index - 24) * step;
    }
    return new THREE.Vector3(x, 0.4, z);
  }

  createBoardBase() {
    // 豪华发光大理石棋盘底座
    const baseGeo = new THREE.BoxGeometry(this.halfBoard * 2.15, 0.7, this.halfBoard * 2.15);
    const baseMat = new THREE.MeshStandardMaterial({
      color: '#1e272e',
      roughness: 0.3,
      metalness: 0.5
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -0.35, 0);
    baseMesh.receiveShadow = true;
    this.scene3D.scene.add(baseMesh);
    this.baseMesh = baseMesh;

    // 边缘金色条
    const borderGeo = new THREE.BoxGeometry(this.halfBoard * 2.18, 0.2, this.halfBoard * 2.18);
    const borderMat = new THREE.MeshStandardMaterial({
      color: '#ffaa00',
      metalness: 0.9,
      roughness: 0.1
    });
    const borderMesh = new THREE.Mesh(borderGeo, borderMat);
    borderMesh.position.set(0, -0.05, 0);
    this.scene3D.scene.add(borderMesh);
    this.borderMesh = borderMesh;
  }

  createTiles() {
    const tileGeo = new THREE.BoxGeometry(this.tileSize - 0.25, 0.5, this.tileSize - 0.25);

    BOARD_TILES.forEach((tileData, i) => {
      const pos = this.calculateTilePosition(i);
      this.tilePositions.push(pos);

      let tileColor = '#ffffff';
      if (tileData.group && COLOR_GROUPS[tileData.group]) {
        tileColor = COLOR_GROUPS[tileData.group].color;
      } else if (tileData.type === TileType.START) tileColor = '#ff4757';
      else if (tileData.type === TileType.CARD_SHOP) tileColor = '#ffbe76';
      else if (tileData.type === TileType.STOCK) tileColor = '#00d2d3';
      else if (tileData.type === TileType.BANK) tileColor = '#ffc048';
      else if (tileData.type === TileType.GOD_FORTUNE) tileColor = '#ffda79';
      else if (tileData.type === TileType.GOD_MISFORTUNE) tileColor = '#84817a';

      const sideMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
      const materials = [
        sideMat, sideMat,
        new THREE.MeshStandardMaterial({ color: tileColor, roughness: 0.3, metalness: 0.1 }),
        sideMat, sideMat, sideMat
      ];

      const tileMesh = new THREE.Mesh(tileGeo, materials);
      tileMesh.position.copy(pos);
      tileMesh.receiveShadow = true;
      tileMesh.castShadow = true;
      this.scene3D.scene.add(tileMesh);
      this.tileMeshes.push(tileMesh);

      // 应用自定义生成的贴图与 Canvas 贴图
      this.applyTileTextures(tileMesh, tileData);
    });
  }

  applyMapDefinition(mapDefinition) {
    if (!mapDefinition) return;
    mapDefinition.tiles.forEach((tileData, index) => {
      const mesh = this.tileMeshes[index];
      if (!mesh) return;
      this.applyTileTextures(mesh, tileData);
      mesh.userData.tileData = tileData;
      const isFork = (tileData.next || []).length > 1;
      const topMaterial = mesh.material[2];
      if (topMaterial?.isMeshStandardMaterial) {
        topMaterial.emissive?.set(isFork ? 0x00bcd4 : 0x000000);
        topMaterial.emissiveIntensity = isFork ? 0.22 : 0;
      }
    });
    const island = mapDefinition.theme === 'ISLAND';
    this.baseMesh?.material.color.set(island ? '#123c4a' : '#1e272e');
    this.borderMesh?.material.color.set(island ? '#00d2d3' : '#ffaa00');
  }

  applyTileTextures(tileMesh, tileData) {
    let customTex = null;
    if (tileData.type === TileType.START) customTex = this.textures.start;
    else if (tileData.type === TileType.BANK) customTex = this.textures.bank;
    else if (tileData.type === TileType.STOCK) customTex = this.textures.stock;
    else if (tileData.type === TileType.CARD_SHOP) customTex = this.textures.shop;

    if (customTex) {
      tileMesh.material[2] = new THREE.MeshStandardMaterial({ map: customTex, roughness: 0.3 });
    } else {
      this.createTileLabelCanvas(tileMesh, tileData);
    }
  }

  createTileLabelCanvas(tileMesh, tileData) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    let colorHex = '#ffffff';
    if (tileData.group && COLOR_GROUPS[tileData.group]) colorHex = COLOR_GROUPS[tileData.group].color;
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(24, 24, 464, 464, 32);
    ctx.fill();

    if (tileData.group && COLOR_GROUPS[tileData.group]) {
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.roundRect(24, 24, 464, 120, [32, 32, 0, 0]);
      ctx.fill();
    }

    ctx.fillStyle = '#1e272e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const icon = tileData.icon || '🏠';
    ctx.font = 'bold 96px sans-serif';
    ctx.fillText(icon, 256, 230);

    ctx.font = '900 48px "Noto Sans SC", sans-serif';
    ctx.fillText(tileData.name, 256, 360);

    if (tileData.price) {
      ctx.fillStyle = '#ee5253';
      ctx.font = 'bold 42px "Outfit", sans-serif';
      ctx.fillText(`$${tileData.price.toLocaleString()}`, 256, 430);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    tileMesh.material[2] = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 });
  }

  createCentralDecoration() {
    const centerGroup = new THREE.Group();

    // 中央公园使用了生成的草地贴图 (grass_ground.jpg)
    const parkGeo = new THREE.BoxGeometry(18.5, 0.4, 18.5);
    const grassMat = new THREE.MeshStandardMaterial({
      map: this.textures.mapBg || this.textures.grass || null,
      roughness: 0.6
    });
    const parkMesh = new THREE.Mesh(parkGeo, grassMat);
    parkMesh.position.set(0, 0.1, 0);
    parkMesh.receiveShadow = true;
    centerGroup.add(parkMesh);

    // 喷泉池
    const poolGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.6, 32);
    const poolMat = new THREE.MeshStandardMaterial({ color: '#48dbfb', roughness: 0.1, metalness: 0.8 });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.position.set(0, 0.45, 0);
    centerGroup.add(poolMesh);

    // 旋转双金币雕塑
    const coinMat = new THREE.MeshStandardMaterial({ color: '#ffaa00', metalness: 0.9, roughness: 0.15 });

    const coin1 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.35, 32), coinMat);
    coin1.rotation.z = Math.PI / 2.3;
    coin1.position.set(-0.6, 2.3, 0);
    coin1.castShadow = true;

    const coin2 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.35, 32), coinMat);
    coin2.rotation.z = -Math.PI / 2.3;
    coin2.position.set(0.6, 2.3, 0);
    coin2.castShadow = true;

    this.centerCoinsGroup = new THREE.Group();
    this.centerCoinsGroup.add(coin1);
    this.centerCoinsGroup.add(coin2);
    centerGroup.add(this.centerCoinsGroup);

    // 风车与休闲长椅
    const windmill = this.createWindmill();
    windmill.position.set(-5, 0.4, -5);
    centerGroup.add(windmill);

    // 围绕公园布置 Q版小树
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 7.6;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const tree = this.createDetailedTree();
      tree.position.set(x, 0.4, z);
      centerGroup.add(tree);
    }

    this.scene3D.scene.add(centerGroup);

    this.scene3D.addUpdatable({
      update: () => {
        if (this.centerCoinsGroup) {
          this.centerCoinsGroup.rotation.y += 0.012;
        }
        if (this.windmillBlades) {
          this.windmillBlades.rotation.z += 0.03;
        }
      }
    });
  }

  createWindmill() {
    const wmGroup = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: '#f5cd79', roughness: 0.4 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 2.4, 16), towerMat);
    tower.position.y = 1.2;
    tower.castShadow = true;
    wmGroup.add(tower);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 16), new THREE.MeshStandardMaterial({ color: '#e74c3c' }));
    roof.position.y = 2.7;
    wmGroup.add(roof);

    const bladesGroup = new THREE.Group();
    bladesGroup.position.set(0, 2.3, 0.45);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.04), bladeMat);
      blade.rotation.z = (i / 4) * Math.PI * 2;
      blade.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.7, Math.sin((i / 4) * Math.PI * 2) * 0.7, 0);
      bladesGroup.add(blade);
    }
    wmGroup.add(bladesGroup);
    this.windmillBlades = bladesGroup;

    return wmGroup;
  }

  createDetailedTree() {
    const treeGroup = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.4, 12);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#574b90', roughness: 0.8 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({ color: '#10ac84', roughness: 0.6 });
    const topLeaf = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), leafMat);
    topLeaf.position.y = 1.7;
    topLeaf.castShadow = true;
    treeGroup.add(topLeaf);

    return treeGroup;
  }

  createStreetlights() {
    // 四角复古暖光路灯
    const corners = [
      new THREE.Vector3(this.halfBoard - 1, 0.4, this.halfBoard - 1),
      new THREE.Vector3(-this.halfBoard + 1, 0.4, this.halfBoard - 1),
      new THREE.Vector3(-this.halfBoard + 1, 0.4, -this.halfBoard + 1),
      new THREE.Vector3(this.halfBoard - 1, 0.4, -this.halfBoard + 1)
    ];

    corners.forEach(pos => {
      const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 2.5, 12);
      const poleMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.copy(pos).add(new THREE.Vector3(0, 1.25, 0));
      this.scene3D.scene.add(pole);

      const bulbGeo = new THREE.SphereGeometry(0.3, 16, 16);
      const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffc048' });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.copy(pos).add(new THREE.Vector3(0, 2.6, 0));
      this.scene3D.scene.add(bulb);

      const light = new THREE.PointLight('#ffaa00', 1.2, 12);
      light.position.copy(bulb.position);
      this.scene3D.scene.add(light);
    });
  }

  createSurroundingCityEnvironment() {
    const roadGeo = new THREE.RingGeometry(this.halfBoard * 1.15, this.halfBoard * 1.45, 64);
    const roadMat = new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.9, side: THREE.DoubleSide });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = Math.PI / 2;
    road.position.y = -0.55;
    this.scene3D.scene.add(road);

    this.cars = [];
    const carColors = ['#ff4757', '#00e5ff', '#ffaa00', '#2ed573'];
    for (let i = 0; i < 4; i++) {
      const car = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(1.4, 0.6, 0.8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: carColors[i], roughness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.4;
      car.add(body);

      const cabinGeo = new THREE.BoxGeometry(0.8, 0.45, 0.7);
      const cabinMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(-0.1, 0.8, 0);
      car.add(cabin);

      this.scene3D.scene.add(car);
      this.cars.push({ mesh: car, angle: (i / 4) * Math.PI * 2, radius: this.halfBoard * 1.3 });
    }

    this.scene3D.addUpdatable({
      update: () => {
        this.cars.forEach(carObj => {
          carObj.angle += 0.008;
          const x = Math.cos(carObj.angle) * carObj.radius;
          const z = Math.sin(carObj.angle) * carObj.radius;
          carObj.mesh.position.set(x, -0.4, z);
          carObj.mesh.rotation.y = -carObj.angle + Math.PI / 2;
        });
      }
    });
  }

  updateBuildingMesh(tileIndex, level, ownerColor = null) {
    if (this.buildingMeshes.has(tileIndex)) {
      const oldGroup = this.buildingMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldGroup);
      this.buildingMeshes.delete(tileIndex);
    }

    if (level === 0 && ownerColor === null) return;

    const tilePos = this.tilePositions[tileIndex];
    const group = new THREE.Group();
    group.position.set(tilePos.x, tilePos.y + 0.25, tilePos.z);

    const roofMat = new THREE.MeshStandardMaterial({ color: ownerColor ?? 0xffaa00, roughness: 0.3 });
    const wallMat = new THREE.MeshStandardMaterial({ color: '#f8f9fa', roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#00d2d3', roughness: 0.1, metalness: 0.8 });

    if (level === 0) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: '#f5f6fa' })
      );
      pole.position.y = 0.6;
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.4),
        new THREE.MeshBasicMaterial({ color: ownerColor, side: THREE.DoubleSide })
      );
      flag.position.set(0.35, 1, 0);
      group.add(pole, flag);
    } else if (level === 1) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 2.0), wallMat);
      wall.position.y = 0.65;
      wall.castShadow = true;
      group.add(wall);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.0, 4), roofMat);
      roof.position.y = 1.8;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: '#e74c3c' }));
      chimney.position.set(0.6, 1.9, 0.4);
      group.add(chimney);
    } else if (level === 2) {
      const wall1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.2), wallMat);
      wall1.position.y = 0.65;
      wall1.castShadow = true;
      group.add(wall1);

      const wall2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.8), wallMat);
      wall2.position.y = 1.85;
      wall2.castShadow = true;
      group.add(wall2);

      const glassPatio = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.6, 1.2), glassMat);
      glassPatio.position.set(0, 1.85, 0.4);
      group.add(glassPatio);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 4), roofMat);
      roof.position.y = 2.9;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
    } else if (level >= 3) {
      const towerBase = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.8, 2.4), wallMat);
      towerBase.position.y = 1.9;
      towerBase.castShadow = true;
      group.add(towerBase);

      const glassTower = new THREE.Mesh(new THREE.BoxGeometry(2.45, 3.4, 1.8), glassMat);
      glassTower.position.y = 1.9;
      group.add(glassTower);

      const crown = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 1.8), roofMat);
      crown.position.y = 4.15;
      crown.castShadow = true;
      group.add(crown);

      const helipad = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16), new THREE.MeshStandardMaterial({ color: '#f1c40f' }));
      helipad.position.y = 4.55;
      group.add(helipad);
    }

    group.scale.set(0.1, 0.1, 0.1);
    this.scene3D.scene.add(group);
    this.buildingMeshes.set(tileIndex, group);

    let scale = 0.1;
    const anim = () => {
      scale += (1.0 - scale) * 0.2;
      group.scale.set(scale, scale, scale);
      if (Math.abs(1.0 - scale) > 0.01) {
        requestAnimationFrame(anim);
      } else {
        group.scale.set(1, 1, 1);
      }
    };
    anim();

    this.scene3D.createSparkles(tilePos, ownerColor, 30);
  }

  setObstacleMesh(tileIndex, hasObstacle) {
    if (this.obstacleMeshes.has(tileIndex)) {
      const oldMesh = this.obstacleMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldMesh);
      this.obstacleMeshes.delete(tileIndex);
    }

    if (!hasObstacle) return;

    const tilePos = this.tilePositions[tileIndex];
    const group = new THREE.Group();
    group.position.set(tilePos.x, tilePos.y + 0.6, tilePos.z);

    const postGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16);
    const postMat = new THREE.MeshStandardMaterial({ color: '#ff4757', roughness: 0.3 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.castShadow = true;
    group.add(post);

    const stripeGeo = new THREE.BoxGeometry(1.4, 0.3, 0.25);
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 0.25;
    group.add(stripe);

    this.scene3D.scene.add(group);
    this.obstacleMeshes.set(tileIndex, group);
  }
}
