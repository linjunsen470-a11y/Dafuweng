import * as THREE from 'three';
import { BOARD_TILES, COLOR_GROUPS, TileType, isPropertyTile } from '../game/BoardData.js';

export class BoardBuilder {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.tileMeshes = [];
    this.tilePositions = [];
    this.buildingMeshes = new Map();
    this.obstacleMeshes = new Map();
    this.specialTileMeshes = new Map();
    this.vacantLotMeshes = new Map();
    this.activeMapDefinition = null;
    this.roadGroup = null;
    this.mapEnvironmentGroup = null;

    this.boardSize = 8;
    this.tileSize = 4.4;
    this.halfBoard = (this.boardSize * this.tileSize) / 2;

    this.textureLoader = new THREE.TextureLoader();
    this.loadTextures();

    this.createWorldGround();
    this.createBoardBase();
    this.createTiles();
    this.createCentralDecoration();
    this.createSurroundingCityEnvironment();
    this.createStreetlights();
    this.scene3D.addUpdatable({ update: () => this.animateMapLandmarks() });
  }

  loadTextures() {
    this.textures = {
      start: this.textureLoader.load('/assets/tile_start_rich.jpg'),
      bank: this.textureLoader.load('/assets/tile_bank_rich.jpg'),
      stock: this.textureLoader.load('/assets/tile_stock_rich.jpg'),
      shop: this.textureLoader.load('/assets/tile_shop_rich.jpg'),
      mapBg: this.textureLoader.load('/assets/map_bg_texture.jpg'),
      grass: this.textureLoader.load('/assets/grass_ground.jpg'),
      parkV2: this.textureLoader.load('/assets/park_ground_v2.webp'),
      worldGround: this.textureLoader.load('/assets/world-ground-v2.webp')
    };

    Object.values(this.textures).forEach(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.scene3D.renderer.capabilities.getMaxAnisotropy());
    });

    if (this.textures.mapBg) {
      this.textures.mapBg.wrapS = THREE.RepeatWrapping;
      this.textures.mapBg.wrapT = THREE.RepeatWrapping;
      this.textures.mapBg.repeat.set(2, 2);
    }
  }

  createWorldGround() {
    const geometry = new THREE.PlaneGeometry(108, 108);
    const material = new THREE.MeshStandardMaterial({
      map: this.textures.worldGround,
      roughness: 0.92,
      metalness: 0,
      color: '#ffffff'
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.82;
    ground.receiveShadow = true;
    this.scene3D.scene.add(ground);
    this.worldGround = ground;
  }

  calculateTilePosition(index) {
    const step = this.tileSize;
    const startOffset = this.halfBoard - step / 2;
    const outerOffset = this.halfBoard;

    let x = 0, z = 0;
    if (index >= 0 && index < 8) {
      x = startOffset - index * step;
      z = outerOffset;
    } else if (index >= 8 && index < 16) {
      x = -outerOffset;
      z = startOffset - (index - 8) * step;
    } else if (index >= 16 && index < 24) {
      x = -startOffset + (index - 16) * step;
      z = -outerOffset;
    } else if (index >= 24 && index < 32) {
      x = outerOffset;
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

  createTiles(tileDefinitions = BOARD_TILES, tileSize = this.tileSize) {
    const tileGeo = new THREE.BoxGeometry(tileSize - 0.25, 0.34, tileSize - 0.25);

    tileDefinitions.forEach((tileData, i) => {
      const pos = tileData.position
        ? new THREE.Vector3(tileData.position.x, 0.28, tileData.position.z)
        : this.calculateTilePosition(i);
      this.tilePositions[tileData.id ?? i] = pos;

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
      tileMesh.userData.tileData = tileData;
      this.tileMeshes[tileData.id ?? i] = tileMesh;

      // 应用自定义生成的贴图与 Canvas 贴图
      this.applyTileTextures(tileMesh, tileData);
    });
  }

  applyMapDefinition(mapDefinition) {
    if (!mapDefinition) return;
    this.clearDynamicMap();
    this.activeMapDefinition = mapDefinition;
    this.createTiles(mapDefinition.tiles, mapDefinition.tileSize || 4.4);
    if (this.scene3D.container) {
      this.scene3D.container.dataset.tileCount = String(mapDefinition.tiles.length);
      this.scene3D.container.dataset.lotCount = String(mapDefinition.tiles.filter(isPropertyTile).length);
      this.scene3D.container.dataset.mapId = mapDefinition.id;
    }
    this.createRoadNetwork(mapDefinition);
    mapDefinition.tiles.forEach((tileData) => {
      const mesh = this.tileMeshes[tileData.id];
      if (!mesh) return;
      mesh.userData.tileData = tileData;
      const isFork = (tileData.next || []).length > 1;
      const topMaterial = mesh.material[2];
      if (topMaterial?.isMeshStandardMaterial) {
        topMaterial.emissive?.set(isFork ? 0x00bcd4 : 0x000000);
        topMaterial.emissiveIntensity = isFork ? 0.22 : 0;
      }
    });
    this.rebuildMapLandmarks(mapDefinition);
    this.createMapEnvironment(mapDefinition);
    const island = mapDefinition.theme === 'ISLAND';
    const crossroads = mapDefinition.theme === 'CROSSROADS';
    const grand = mapDefinition.theme === 'GRAND_BAY';
    this.baseMesh.visible = !crossroads && !grand;
    this.borderMesh.visible = !crossroads && !grand;
    if (this.centralDecorationGroup) this.centralDecorationGroup.visible = !crossroads && !grand;
    if (this.surroundingRoad) this.surroundingRoad.visible = !grand;
    this.cars?.forEach(car => { car.mesh.visible = !grand; });
    this.streetLights?.forEach(({ light, bulb, pole }) => {
      light.visible = !grand;
      bulb.visible = !grand;
      if (pole) pole.visible = !grand;
    });
    if (this.worldGround) {
      this.worldGround.visible = !grand;
      this.worldGround.scale.setScalar(1);
    }
    this.baseMesh?.material.color.set(island ? '#123c4a' : '#1e272e');
    this.borderMesh?.material.color.set(island ? '#00d2d3' : '#ffaa00');
    this.scene3D.configureForMap?.(mapDefinition);
  }

  clearDynamicMap() {
    this.tileMeshes.forEach(mesh => {
      if (!mesh) return;
      this.scene3D.scene.remove(mesh);
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(material => {
        if (material?.map?.isCanvasTexture) material.map.dispose();
        material?.dispose?.();
      });
    });
    this.tileMeshes = [];
    this.tilePositions = [];
    [this.buildingMeshes, this.obstacleMeshes, this.mineMeshes, this.specialTileMeshes].forEach(collection => {
      collection?.forEach?.(object => {
        this.scene3D.scene.remove(object);
        this.disposeObject(object);
      });
      collection?.clear?.();
    });
    this.vacantLotMeshes.clear();
    if (this.roadGroup) {
      this.scene3D.scene.remove(this.roadGroup);
      this.disposeObject(this.roadGroup);
    }
    if (this.mapEnvironmentGroup) {
      this.scene3D.scene.remove(this.mapEnvironmentGroup);
      this.disposeObject(this.mapEnvironmentGroup);
    }
    this.roadGroup = null;
    this.mapEnvironmentGroup = null;
  }

  disposeObject(object) {
    object?.traverse?.(child => {
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach(material => {
        if (material.map?.isCanvasTexture) material.map.dispose();
        material.dispose?.();
      });
    });
  }

  createRoadNetwork(mapDefinition) {
    const roadWidth = mapDefinition.roadWidth || Math.max(2.8, (mapDefinition.tileSize || 4.4) * 0.82);
    const group = new THREE.Group();
    group.name = `roads-${mapDefinition.id}`;
    const roadMaterial = new THREE.MeshBasicMaterial({
      color: mapDefinition.theme === 'GRAND_BAY' ? '#566170' : '#3d4654',
    });
    const shoulderMaterial = new THREE.MeshBasicMaterial({ color: mapDefinition.theme === 'GRAND_BAY' ? '#d9c99d' : '#f2c66d' });
    const seen = new Set();
    mapDefinition.tiles.forEach(tile => {
      (tile.next || []).forEach(nextId => {
        const key = [tile.id, nextId].sort((a, b) => a - b).join(':');
        if (seen.has(key)) return;
        seen.add(key);
        const next = mapDefinition.tiles.find(item => item.id === nextId);
        if (!tile.position || !next?.position) return;
        const dx = next.position.x - tile.position.x;
        const dz = next.position.z - tile.position.z;
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, dz);
        const midpoint = { x: (tile.position.x + next.position.x) / 2, z: (tile.position.z + next.position.z) / 2 };
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 0.7, 0.12, length + 0.35), shoulderMaterial);
        shoulder.position.set(midpoint.x, 0.035, midpoint.z);
        shoulder.rotation.y = angle;
        shoulder.receiveShadow = true;
        group.add(shoulder);
        const road = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.16, length + 0.22), roadMaterial);
        road.position.set(midpoint.x, 0.12, midpoint.z);
        road.rotation.y = angle;
        road.receiveShadow = true;
        group.add(road);
      });
    });
    this.scene3D.scene.add(group);
    this.roadGroup = group;
  }

  createMapEnvironment(mapDefinition) {
    const group = new THREE.Group();
    group.name = `environment-${mapDefinition.id}`;
    if (mapDefinition.theme !== 'GRAND_BAY') {
      this.mapEnvironmentGroup = group;
      this.scene3D.scene.add(group);
      return;
    }

    const island = new THREE.Mesh(
      new THREE.BoxGeometry(142, 0.75, 92),
      new THREE.MeshBasicMaterial({ color: '#6ead67' })
    );
    island.position.set(0, -0.48, -3);
    island.receiveShadow = true;
    group.add(island);

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 52),
      new THREE.MeshBasicMaterial({ color: '#3ea9c4', transparent: true, opacity: 0.92 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.04, 54);
    group.add(ocean);

    const beach = new THREE.Mesh(
      new THREE.BoxGeometry(142, 0.18, 8),
      new THREE.MeshBasicMaterial({ color: '#f3d58a' })
    );
    beach.position.set(0, -0.02, 38);
    group.add(beach);

    const trunkMaterial = new THREE.MeshBasicMaterial({ color: '#76543b' });
    const leafMaterial = new THREE.MeshBasicMaterial({ color: '#3e9f62' });
    const treePositions = [
      [-42, 13], [-35, 16], [-28, 18], [-18, 17], [-8, 17],
      [-43, 5], [-32, 3], [-13, 2], [-5, -7], [-13, -13],
      [-6, -21], [-37, -25], [-45, -28], [-12, 34], [8, 35]
    ];
    treePositions.forEach(([x, z], index) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.8, 8), trunkMaterial);
      trunk.position.y = 0.9;
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15 + (index % 3) * 0.12, 1), leafMaterial);
      crown.position.y = 2.25;
      crown.castShadow = true;
      tree.add(trunk, crown);
      tree.position.set(x, 0, z);
      group.add(tree);
    });

    const mountainMaterial = new THREE.MeshBasicMaterial({ color: '#668b6b' });
    [[-38, -3, 8], [-27, -7, 6], [-43, -17, 7], [-30, -23, 5]].forEach(([x, z, radius], index) => {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 0.75, 7), mountainMaterial);
      mountain.position.set(x, radius * 0.36 - 0.15, z);
      mountain.rotation.y = index * 0.55;
      mountain.castShadow = true;
      group.add(mountain);
    });

    const cityColors = ['#dfe8f5', '#b8cee7', '#f0d7c2', '#c7c5e9'];
    [[8, -7], [14, -7], [8, -14], [14, -14], [2, -13], [17, 0], [3, 0], [31, -4]].forEach(([x, z], index) => {
      const height = 5 + (index % 4) * 2.2;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, height, 3.6),
        new THREE.MeshBasicMaterial({ color: cityColors[index % cityColors.length] })
      );
      tower.position.set(x, height / 2, z);
      tower.castShadow = true;
      group.add(tower);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 2.6), new THREE.MeshBasicMaterial({ color: '#6c76c5' }));
      roof.position.set(x, height + 0.22, z);
      group.add(roof);
    });

    const fieldColors = ['#a8cf58', '#d9bd55', '#85bd62'];
    [[-16, -4], [-8, -4], [-16, -10], [-8, -10]].forEach(([x, z], index) => {
      const field = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 4.6), new THREE.MeshBasicMaterial({ color: fieldColors[index % 3] }));
      field.position.set(x, 0.02, z);
      group.add(field);
    });

    const pierMaterial = new THREE.MeshBasicMaterial({ color: '#8b6549' });
    [-24, -8, 12, 32].forEach(x => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(5, 0.28, 12), pierMaterial);
      pier.position.set(x, 0.08, 43);
      group.add(pier);
    });
    const lighthouse = new THREE.Group();
    const lighthouseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 5.5, 16), new THREE.MeshBasicMaterial({ color: '#f4f4ea' }));
    lighthouseBody.position.y = 2.75;
    const lighthouseTop = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 16), new THREE.MeshBasicMaterial({ color: '#e65353' }));
    lighthouseTop.position.y = 6.05;
    lighthouse.add(lighthouseBody, lighthouseTop);
    lighthouse.position.set(60, 0, 37);
    group.add(lighthouse);

    this.scene3D.scene.add(group);
    this.mapEnvironmentGroup = group;
  }

  setRouteChoices(tileIds = []) {
    const selected = new Set(tileIds);
    this.tileMeshes.forEach((mesh, tileId) => {
      const top = mesh?.material?.[2];
      if (!top?.isMeshStandardMaterial) return;
      const isChoice = selected.has(tileId);
      top.emissive?.set(isChoice ? 0x00e5ff : ((mesh.userData.tileData?.next || []).length > 1 ? 0x00bcd4 : 0x000000));
      top.emissiveIntensity = isChoice ? 0.75 : ((mesh.userData.tileData?.next || []).length > 1 ? 0.22 : 0);
    });
  }

  applyTileTextures(tileMesh, tileData) {
    let customTex = null;
    if (tileData.type === TileType.ROAD) {
      tileMesh.material[2] = new THREE.MeshStandardMaterial({ color: '#77808d', roughness: 0.9, metalness: 0.02 });
      return;
    }
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
    else if (tileData.type === TileType.COUPON) colorHex = '#ffca3a';
    else if (tileData.type === TileType.MONSTER) colorHex = '#8b5cf6';
    else if (tileData.type === TileType.TREASURE) colorHex = '#f97316';
    else if (tileData.type === TileType.GOD_FORTUNE) colorHex = '#ffe66d';
    else if (tileData.type === TileType.CHANCE) colorHex = '#22d3ee';
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

  rebuildMapLandmarks(mapDefinition) {
    this.specialTileMeshes.forEach(group => this.scene3D.scene.remove(group));
    this.specialTileMeshes.clear();
    this.vacantLotMeshes.clear();

    mapDefinition.tiles.forEach(tile => {
      const position = this.tilePositions[tile.id];
      if (!position) return;
      let group = null;
      if (isPropertyTile(tile)) {
        group = this.createVacantLotMarker(tile);
        this.vacantLotMeshes.set(tile.id, group);
      } else if (tile.type === TileType.MONSTER) group = this.createMonsterLandmark();
      else if (tile.type === TileType.COUPON) group = this.createCouponLandmark(tile.couponAmount || 30);
      else if (tile.type === TileType.TREASURE) group = this.createTreasureLandmark();
      else if (tile.type === TileType.GOD_FORTUNE) group = this.createFortuneLandmark();
      else if ((tile.next || []).length > 1) group = this.createForkLandmark();
      else if ([TileType.BANK, TileType.STOCK, TileType.CARD_SHOP, TileType.HOSPITAL, TileType.PRISON, TileType.LOTTERY, TileType.MAGIC_HOUSE, TileType.MECHANISM].includes(tile.type)) {
        group = this.createFacilityLandmark(tile);
      }
      if (!group) return;
      const anchor = isPropertyTile(tile) && tile.lot?.position
        ? tile.lot.position
        : this.getRoadsideAnchor(tile, position);
      group.position.set(anchor.x, position.y + 0.35, anchor.z);
      group.rotation.y = tile.lot?.rotation || 0;
      group.userData.baseY = group.position.y;
      group.userData.phase = tile.id * 0.71;
      group.userData.tileType = tile.type;
      this.scene3D.scene.add(group);
      this.specialTileMeshes.set(tile.id, group);
    });
  }

  createVacantLotMarker(tile) {
    const group = new THREE.Group();
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(2.65, 0.12, 2.65),
      new THREE.MeshBasicMaterial({ color: '#8fd694' })
    );
    pad.position.y = 0.08;
    group.add(pad);
    const postMaterial = new THREE.MeshBasicMaterial({ color: '#f4d58d' });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.65, 8), postMaterial);
      post.position.set(x, 0.38, z);
      group.add(post);
    });
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.65, 0.1),
      new THREE.MeshBasicMaterial({ color: '#fff7d6' })
    );
    sign.position.set(0, 0.72, 0.9);
    sign.rotation.x = -0.16;
    group.add(sign);
    const badge = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 16),
      new THREE.MeshBasicMaterial({ color: tile.group && COLOR_GROUPS[tile.group] ? COLOR_GROUPS[tile.group].color : '#2ed573' })
    );
    badge.position.set(0, 0.72, 0.956);
    group.add(badge);
    return group;
  }

  getRoadsideAnchor(tile, position) {
    if (this.activeMapDefinition?.theme !== 'GRAND_BAY' || (tile.next || []).length > 1) return position;
    const next = this.activeMapDefinition.tiles.find(item => item.id === tile.next?.[0]);
    if (!next?.position) return position;
    const dx = next.position.x - position.x;
    const dz = next.position.z - position.z;
    const length = Math.hypot(dx, dz) || 1;
    const side = tile.id % 2 ? 1 : -1;
    return { x: position.x + (-dz / length) * 3.7 * side, z: position.z + (dx / length) * 3.7 * side };
  }

  createFacilityLandmark(tile) {
    const palette = {
      [TileType.BANK]: ['#f6c453', '#fff4c2'],
      [TileType.STOCK]: ['#45b7d1', '#dff8ff'],
      [TileType.CARD_SHOP]: ['#d96dd3', '#ffe2fb'],
      [TileType.HOSPITAL]: ['#ef6b73', '#ffffff'],
      [TileType.PRISON]: ['#596275', '#dfe4ea'],
      [TileType.LOTTERY]: ['#f39c12', '#fff3cd'],
      [TileType.MAGIC_HOUSE]: ['#8e44ad', '#f5e6ff'],
      [TileType.MECHANISM]: ['#34495e', '#d5dbdb']
    };
    const [roofColor, wallColor] = palette[tile.type] || ['#7bed9f', '#ffffff'];
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.7, 2.2), new THREE.MeshBasicMaterial({ color: wallColor }));
    base.position.y = 0.85;
    base.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.8, 4), new THREE.MeshBasicMaterial({ color: roofColor }));
    roof.position.y = 2.1;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(base, roof);
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#15223b';
    ctx.beginPath();
    ctx.roundRect(4, 4, 184, 120, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '56px sans-serif';
    ctx.fillText(tile.icon || '🏛️', 96, 47);
    ctx.font = 'bold 23px "Noto Sans SC", sans-serif';
    ctx.fillText(tile.name, 96, 94);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sign.position.set(0, 3.15, 0);
    sign.scale.set(3, 2, 1);
    group.add(sign);
    return group;
  }

  createMonsterLandmark() {
    const group = new THREE.Group();
    const purple = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.45, emissive: '#2e1065', emissiveIntensity: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.86, 20, 16), purple);
    body.scale.y = 1.08;
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#111827' });
    [-0.3, 0.3].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), eyeMat);
      eye.position.set(x, 1.25, 0.72);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), pupilMat);
      pupil.position.set(x, 1.25, 0.88);
      group.add(eye, pupil);
    });
    [-0.48, 0.48].forEach(x => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.72, 10), new THREE.MeshStandardMaterial({ color: '#fde68a' }));
      horn.position.set(x, 1.88, 0);
      horn.rotation.z = x < 0 ? 0.35 : -0.35;
      group.add(horn);
    });
    return group;
  }

  createCouponLandmark(amount) {
    const group = new THREE.Group();
    const ticket = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.92, 0.16),
      new THREE.MeshStandardMaterial({ color: amount >= 50 ? '#ffd166' : '#ffe69a', metalness: 0.25, roughness: 0.3, emissive: '#7c4a03', emissiveIntensity: 0.2 })
    );
    ticket.position.y = 1.15;
    ticket.rotation.z = -0.12;
    group.add(ticket);
    const coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.09, 10, 22),
      new THREE.MeshStandardMaterial({ color: '#fff7ae', metalness: 0.75, roughness: 0.18 })
    );
    coin.position.set(0, 1.15, 0.12);
    group.add(coin);
    return group;
  }

  createTreasureLandmark() {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#9a5b2e', roughness: 0.65 });
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd166', metalness: 0.7, roughness: 0.2, emissive: '#8a4f00', emissiveIntensity: 0.22 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.72, 1.0), wood);
    box.position.y = 0.62;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.45, 16, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2;
    lid.rotation.y = Math.PI / 2;
    lid.position.y = 1.02;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.15, 1.08), gold);
    band.position.y = 0.85;
    group.add(box, lid, band);
    return group;
  }

  createFortuneLandmark() {
    const group = new THREE.Group();
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const radius = i % 2 === 0 ? 0.92 : 0.4;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const star = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }),
      new THREE.MeshStandardMaterial({ color: '#ffe66d', metalness: 0.45, roughness: 0.2, emissive: '#ff9f1c', emissiveIntensity: 0.55 })
    );
    star.position.y = 1.35;
    star.position.z = -0.1;
    group.add(star);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.055, 8, 32), new THREE.MeshBasicMaterial({ color: '#fff6b7', transparent: true, opacity: 0.8 }));
    halo.position.y = 1.35;
    group.add(halo);
    return group;
  }

  createForkLandmark() {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#075985', emissiveIntensity: 0.35 });
    [-0.45, 0.45].forEach((x, index) => {
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.75, 3), material);
      arrow.position.set(x, 1.05, 0);
      arrow.rotation.z = index ? -0.75 : 0.75;
      group.add(arrow);
    });
    return group;
  }

  animateMapLandmarks() {
    const time = performance.now() * 0.0018;
    this.specialTileMeshes.forEach(group => {
      if (isPropertyTile({ type: group.userData.tileType })) return;
      group.position.y = group.userData.baseY + Math.sin(time + group.userData.phase) * 0.16;
      if ([TileType.MONSTER, TileType.COUPON, TileType.TREASURE, TileType.GOD_FORTUNE].includes(group.userData.tileType)) {
        group.rotation.y += group.userData.tileType === TileType.MONSTER ? 0.008 : 0.015;
      }
    });
  }

  createCentralDecoration() {
    const centerGroup = new THREE.Group();

    // 中央公园使用了生成的草地贴图 (grass_ground.jpg)
    const parkGeo = new THREE.BoxGeometry(18.5, 0.4, 18.5);
    const grassMat = new THREE.MeshStandardMaterial({
      map: this.textures.parkV2 || this.textures.mapBg || this.textures.grass || null,
      roughness: 0.72
    });
    const parkMesh = new THREE.Mesh(parkGeo, grassMat);
    parkMesh.position.set(0, 0.1, 0);
    parkMesh.receiveShadow = true;
    centerGroup.add(parkMesh);

    // 喷泉池
    const poolGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.6, 32);
    const poolMat = new THREE.MeshPhysicalMaterial({
      color: '#48dbfb',
      roughness: 0.12,
      metalness: 0.05,
      transmission: 0.18,
      transparent: true,
      opacity: 0.88,
      clearcoat: 0.75
    });
    const poolMesh = new THREE.Mesh(poolGeo, poolMat);
    poolMesh.position.set(0, 0.45, 0);
    centerGroup.add(poolMesh);

    const fountainRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.45, 0.22, 12, 48),
      new THREE.MeshStandardMaterial({ color: '#f6e6bd', roughness: 0.65 })
    );
    fountainRing.rotation.x = Math.PI / 2;
    fountainRing.position.y = 0.8;
    centerGroup.add(fountainRing);

    this.fountainDrops = [];
    for (let i = 0; i < 12; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#dff9ff', transparent: true, opacity: 0.85 })
      );
      drop.userData.phase = (i / 12) * Math.PI * 2;
      centerGroup.add(drop);
      this.fountainDrops.push(drop);
    }

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
    this.centralDecorationGroup = centerGroup;

    this.scene3D.addUpdatable({
      update: () => {
        if (this.centerCoinsGroup) {
          this.centerCoinsGroup.rotation.y += 0.012;
        }
        if (this.windmillBlades) {
          this.windmillBlades.rotation.z += 0.03;
        }
        const time = performance.now() * 0.0022;
        this.fountainDrops?.forEach((drop, index) => {
          const phase = (time + drop.userData.phase) % (Math.PI * 2);
          const radius = 1.2 + Math.sin(phase) * 1.8;
          drop.position.set(Math.cos(index / 12 * Math.PI * 2) * radius, 1.1 + Math.abs(Math.sin(phase)) * 2.6, Math.sin(index / 12 * Math.PI * 2) * radius);
        });
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

    this.streetLights = [];
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
      this.streetLights.push({ light, bulb, pole });
    });
  }

  setNightMode(enabled) {
    if (this.worldGround) this.worldGround.material.color.set(enabled ? '#7886a6' : '#ffffff');
    this.streetLights?.forEach(({ light, bulb }) => {
      light.intensity = enabled ? 2.4 : 0.55;
      bulb.material.color.set(enabled ? '#fff0a8' : '#ffc048');
      bulb.material.opacity = enabled ? 1 : 0.75;
      bulb.material.transparent = true;
    });
    this.buildingMeshes.forEach(group => {
      group.traverse(child => {
        if (child.userData?.isWindow) child.material.emissiveIntensity = enabled ? 1.6 : 0.35;
        if (child.userData?.isBuildingStandee) child.material.color.set(enabled ? '#9aa8c8' : '#ffffff');
      });
    });
  }

  createSurroundingCityEnvironment() {
    const roadGeo = new THREE.RingGeometry(this.halfBoard * 1.15, this.halfBoard * 1.45, 64);
    const roadMat = new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.9, side: THREE.DoubleSide });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = Math.PI / 2;
    road.position.y = -0.55;
    this.scene3D.scene.add(road);
    this.surroundingRoad = road;

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
    const vacantLot = this.vacantLotMeshes.get(tileIndex);
    if (vacantLot) vacantLot.visible = level === 0 && ownerColor === null;
    if (this.buildingMeshes.has(tileIndex)) {
      const oldGroup = this.buildingMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldGroup);
      this.buildingMeshes.delete(tileIndex);
    }

    if (level === 0 && ownerColor === null) return;

    const tilePos = this.tilePositions[tileIndex];
    if (!tilePos) return;
    const tile = this.activeMapDefinition?.tiles.find(item => item.id === tileIndex);
    const buildingAnchor = tile?.lot?.position || tilePos;
    const group = new THREE.Group();
    group.position.set(buildingAnchor.x, tilePos.y + 0.25, buildingAnchor.z);
    group.rotation.y = tile?.lot?.rotation || 0;

    const roofMat = new THREE.MeshStandardMaterial({ color: ownerColor ?? 0xffaa00, roughness: 0.3 });
    const wallMat = new THREE.MeshStandardMaterial({ color: '#f8f9fa', roughness: 0.4 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#39d6e4',
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 0.85,
      emissive: '#063f52',
      emissiveIntensity: 0.35
    });

    if (tile?.large && level > 0) {
      const height = 1.2 + level * 0.75;
      const mall = new THREE.Mesh(new THREE.BoxGeometry(3.8, height, 2.8), wallMat);
      mall.position.y = height / 2;
      mall.castShadow = true;
      const facade = new THREE.Mesh(new THREE.BoxGeometry(3.5, Math.max(0.7, height - 0.45), 0.14), glassMat);
      facade.position.set(0, height / 2, 1.46);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.28, 3.05), roofMat);
      roof.position.y = height + 0.14;
      group.add(mall, facade, roof);
      [-1.25, -0.4, 0.4, 1.25].forEach((x, index) => {
        const logo = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.38, 0.12),
          new THREE.MeshBasicMaterial({ color: [0xff7675, 0x74b9ff, 0x55efc4, 0xfdcb6e][index] })
        );
        logo.position.set(x, Math.min(height - 0.35, 1.1), 1.56);
        group.add(logo);
      });
    } else if (level === 0) {
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
    } else if (level === 3) {
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
    } else if (level >= 4) {
      // Level 4: 摩天大楼 (Skyscraper with antenna, glass facade & gold crown)
      const megaBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.2, 2.6), wallMat);
      megaBase.position.y = 2.6;
      megaBase.castShadow = true;
      group.add(megaBase);

      const megaGlass = new THREE.Mesh(new THREE.BoxGeometry(2.65, 4.8, 2.0), glassMat);
      megaGlass.position.y = 2.6;
      group.add(megaGlass);

      const crown = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 2.0), roofMat);
      crown.position.y = 5.7;
      crown.castShadow = true;
      group.add(crown);

      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8), new THREE.MeshStandardMaterial({ color: '#ffaa00', metalness: 0.9 }));
      antenna.position.y = 7.1;
      group.add(antenna);

      const lightPulse = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff4757' }));
      lightPulse.position.y = 8.0;
      lightPulse.userData.isBeacon = true;
      group.add(lightPulse);
    }

    if (level > 0) this.addBuildingWindows(group, level);
    if (!tile?.large) {
      const buildingStandee = this.createBuildingStandee(level, ownerColor, () => {
        group.children.forEach(child => { child.visible = child === buildingStandee; });
      });
      group.add(buildingStandee);
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

  addBuildingWindows(group, level) {
    const floors = [0, 1, 2, 4, 6][Math.min(level, 4)];
    const maxHeight = [0, 1.2, 2.5, 3.7, 5.1][Math.min(level, 4)];
    const facadeZ = level <= 2 ? 1.03 : 1.34;
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#ffeaa7',
      emissive: '#ffb142',
      emissiveIntensity: 0.35,
      roughness: 0.25
    });
    for (let floor = 0; floor < floors; floor++) {
      for (const x of [-0.55, 0, 0.55]) {
        const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.04), windowMat.clone());
        windowMesh.position.set(x, 0.55 + floor * (maxHeight / Math.max(1, floors)), facadeZ);
        windowMesh.userData.isWindow = true;
        group.add(windowMesh);
      }
    }
  }

  createBuildingStandee(level, ownerColor, onReady) {
    const stage = Math.max(0, Math.min(4, level));
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    const heights = [1.7, 2.25, 2.65, 3.35, 4.15];
    const widths = [1.5, 1.8, 2.0, 2.3, 2.5];
    sprite.scale.set(widths[stage], heights[stage], 1);
    sprite.position.y = heights[stage] / 2 + 0.12;
    sprite.userData.isBuildingStandee = true;

    const frameColor = new THREE.Color(ownerColor ?? 0xffaa00).getStyle();
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.roundRect(5, 5, 290, 350, 34);
    ctx.fill();
    texture.needsUpdate = true;

    const image = new Image();
    image.onload = () => {
      const cellWidth = image.width / 5;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(8, 8, 284, 344, 32);
      ctx.clip();
      ctx.drawImage(image, stage * cellWidth + 3, 0, cellWidth - 6, image.height, 8, 8, 284, 344);
      ctx.restore();
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.roundRect(8, 8, 284, 344, 32);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.86)';
      ctx.lineWidth = 4;
      ctx.stroke();
      texture.needsUpdate = true;
      onReady?.();
    };
    image.src = '/assets/buildings-v2-atlas.webp';
    return sprite;
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

  setMineMesh(tileIndex, hasMine) {
    if (this.mineMeshes?.has(tileIndex)) {
      const oldMesh = this.mineMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldMesh);
      this.mineMeshes.delete(tileIndex);
    }
    if (!this.mineMeshes) this.mineMeshes = new Map();
    if (!hasMine) return;

    const tilePos = this.tilePositions[tileIndex];
    const group = new THREE.Group();
    group.position.set(tilePos.x, tilePos.y + 0.3, tilePos.z);

    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshStandardMaterial({ color: '#2f3542', roughness: 0.2 }));
    bomb.position.y = 0.2;
    group.add(bomb);

    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#e1b12c' }));
    fuse.position.set(0, 0.6, 0);
    group.add(fuse);

    this.scene3D.scene.add(group);
    this.mineMeshes.set(tileIndex, group);
  }
}
