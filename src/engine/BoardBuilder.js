import {connectingStreet} from './ConnectingStreets.js';
import {streetYard} from './VacantStreetYards.js';
import {finishRoofs,finishLandscape,surfaceTime,surfaceTexture} from './BoardSurfaceArt.js';
import {regionalDistrict} from './RegionalDistricts.js';
import {createMarketDistrict} from './MarketDistrict.js';
import {createCardHouse, addServiceThreshold} from './CardHouses.js';
import {createStreetAprons} from './StreetAprons.js';
import {hasClassicFrontages,planClassicFrontages} from './ClassicFrontages.js';
import {createTownCourts} from './TownCourts.js';
import {createQuayStreet,quayLot} from './QuayStreet.js';
import { createHarborPromenade, createHarborGulls, updateHarborGulls } from './HarborPromenade.js';
import { animateBuildingChange, markPurchase } from './BuildingChange.js';
import { createHarborWorkingYard } from './HarborWorkingYard.js';
import { createBankCivicCourt } from './BankCivicCourt.js';
import { createNorthMarketStreet } from './NorthMarketStreet.js';
import { createCivicStation } from './CivicStation.js';
import { createMagicFrontage } from './MagicFrontage.js';
import { createIslandCoast, COAST_WATER_Y } from './IslandCoast.js';
import { CITY_BLOCK_SITES, createCityBlock } from './CityBlocks.js';
import { createCrossroadsGarden } from './CrossroadsGarden.js';
import { createCityGround, createTerraceOrchards } from './CityGround.js';
import { createHospitalClinic } from './HospitalStreet.js';
import { isOldTownHome } from './OldTownStreet.js';
import { isCivicHome } from './CivicStreet.js';
import { harborTileStyle, harborForkDirections } from './HarborBoardStyle.js';
import { HarborStreets, isHarborHome, facingRoad } from './HarborStreets.js';
import { harborFacility, facilityFacing } from './HarborFacilities.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOARD_TILES, COLOR_GROUPS, TileType, isPropertyTile } from '../game/BoardData.js';
import { getBoardThemeProfile, getTileVisualSpec } from '../game/BoardVisualRules.js';

export class BoardBuilder {
  constructor(scene3D) {
    this.scene3D = scene3D;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.tileMeshes = [];
    this.tilePositions = [];
    this.buildingMeshes = new Map();
    this.obstacleMeshes = new Map();
    this.mineMeshes = new Map();
    this.roadEntityMeshes = new Map();
    this.specialTileMeshes = new Map();
    this.vacantLotMeshes = new Map();
    this.activeMapDefinition = null;
    this.roadGroup = null;
    this.tileDetailGroup = null;
    this.mapEnvironmentGroup = null;
    this.roadTileTextures = new Map();

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
      start: this.createAssetTexture('/assets/tile_start_rich.jpg', '#f59e0b', '#fef3c7'),
      bank: this.createAssetTexture('/assets/tile_bank_rich.jpg', '#1d4ed8', '#dbeafe'),
      stock: this.createAssetTexture('/assets/tile_stock_rich.jpg', '#0891b2', '#cffafe'),
      shop: this.createAssetTexture('/assets/tile_shop_rich.jpg', '#be185d', '#fce7f3'),
      mapBg: this.createAssetTexture('/assets/map_bg_texture.jpg', '#172554', '#0f766e'),
      grass: this.createAssetTexture('/assets/grass_ground.jpg', '#3f6212', '#84cc16'),
      parkV2: this.createAssetTexture('/assets/park_ground_v2.webp', '#166534', '#86efac')
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

  createAssetTexture(path, primary, accent) {
    const texture = this.textureLoader.load(
      path,
      loaded => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = Math.min(8, this.scene3D.renderer.capabilities.getMaxAnisotropy());
        loaded.needsUpdate = true;
      },
      undefined,
      () => console.warn(`Board texture failed to load: ${path}; material color fallback remains active.`)
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.scene3D.renderer.capabilities.getMaxAnisotropy());
    texture.userData.sharedBoardTexture = true;
    return texture;
  }

  createProceduralTexture(primary, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = primary;
    context.fillRect(0, 0, 64, 64);
    context.fillStyle = accent;
    context.globalAlpha = 0.18;
    for (let y = 0; y < 64; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < 64; x += 16) context.fillRect(x, y, 8, 8);
    }
    context.globalAlpha = 1;
    return new THREE.CanvasTexture(canvas);
  }

  createWorldGround() {
    const geometry = new THREE.PlaneGeometry(108, 108);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
    const ctx=canvas.getContext('2d');
    const field=ctx.createLinearGradient(0,0,768,768);
    field.addColorStop(0,'#92b98e');field.addColorStop(.48,'#c7cd98');field.addColorStop(1,'#88b998');
    ctx.fillStyle=field;ctx.fillRect(0,0,768,768);
    // Distant contours keep their low contrast even where a camera reaches the board edge.
    for(let row=0;row<12;row++)for(let column=0;column<12;column++){
      const x=column*70+Math.sin(row+column*4)*23,y=row*68+Math.cos(column+row*2)*18;
      const shade=ctx.createRadialGradient(x,y,3,x,y,53);
      shade.addColorStop(0,(row+column)%3?'rgba(74,125,86,.30)':'rgba(246,220,154,.43)');
      shade.addColorStop(1,'rgba(174,186,140,0)');ctx.fillStyle=shade;ctx.fillRect(x-54,y-54,108,108);
    }
    for(const [width,color] of [[30,'#c9c99e'],[22,'#6eaaa1'],[14,'#86bcad']]){
      ctx.lineWidth=width;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(-43,140);
      ctx.bezierCurveTo(179,28,249,245,450,111);ctx.bezierCurveTo(610,4,641,105,802,29);ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
      color: '#ffffff'
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.82;
    ground.receiveShadow = true;
    this.scene3D.scene.add(ground);
    this.worldGround = finishLandscape(ground);
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
    const paving=document.createElement('canvas');
    paving.width=paving.height=256;
    const ctx=paving.getContext('2d');
    ctx.fillStyle='#a39678';ctx.fillRect(0,0,256,256);
    const stones=['#e5dac0','#e9ddbd','#dfcfad','#ecdfc1'];
    for(let row=0;row<8;row++)for(let column=-1;column<4;column++){
      const x=column*64+(row%2)*32;
      ctx.fillStyle=stones[(row*7+column+5)%4];
      ctx.fillRect(x+1,row*32+1,62,30);
    }
    const pavingTexture=new THREE.CanvasTexture(paving);
    pavingTexture.wrapS=pavingTexture.wrapT=THREE.RepeatWrapping;
    pavingTexture.repeat.set(7,7);pavingTexture.colorSpace=THREE.SRGBColorSpace;
    baseMat.map=pavingTexture;baseMat.roughness=.91;baseMat.metalness=.03;
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
    borderMesh.position.set(0, -0.46, 0);
    this.scene3D.scene.add(borderMesh);
    this.borderMesh = borderMesh;
  }

  createTiles(tileDefinitions = BOARD_TILES, tileSize = this.tileSize) {
    const inset = this.activeMapDefinition?.id === 'grand-bay' || hasClassicFrontages(this.activeMapDefinition);
    const tileGeo = new THREE.BoxGeometry(tileSize - .3, inset ? .035 : .34, tileSize - .3);
    const detailGroup = new THREE.Group();
    detailGroup.name = `tile-plinths-${this.activeMapDefinition?.id || 'classic'}`;
    this.scene3D.scene.add(detailGroup);
    this.tileDetailGroup = detailGroup;

    tileDefinitions.forEach((tileData, i) => {
      const pos = tileData.position
        ? new THREE.Vector3(tileData.position.x, 0.28, tileData.position.z)
        : this.calculateTilePosition(i);
      this.tilePositions[tileData.id ?? i] = pos;
      const visual = getTileVisualSpec(this.activeMapDefinition, tileData);

      let tileColor = '#ffffff';
      if (tileData.group && COLOR_GROUPS[tileData.group]) {
        tileColor = COLOR_GROUPS[tileData.group].color;
      } else if (tileData.type === TileType.START) tileColor = '#ff4757';
      else if (tileData.type === TileType.CARD_SHOP) tileColor = '#ffbe76';
      else if (tileData.type === TileType.STOCK) tileColor = '#00d2d3';
      else if (tileData.type === TileType.BANK) tileColor = '#ffc048';
      else if (tileData.type === TileType.GOD_FORTUNE) tileColor = '#ffda79';
      else if (tileData.type === TileType.GOD_MISFORTUNE) tileColor = '#84817a';

      const sideMat = new THREE.MeshStandardMaterial({ color: this.activeMapDefinition?.id === 'grand-bay' ? '#b6b59e' : visual.plinth, roughness: 0.7, metalness: 0.08 });
      const materials = [
        sideMat, sideMat,
        new THREE.MeshStandardMaterial({ color: tileColor, roughness: 0.3, metalness: 0.1 }),
        sideMat, sideMat, sideMat
      ];

      const tileMesh = new THREE.Mesh(tileGeo, materials);
      tileMesh.position.copy(pos);
      if (inset) {
        tileMesh.position.y = .245;
        sideMat.visible = false;
      }
      if (tileData.type === TileType.ROAD && tileData.position && this.activeMapDefinition?.id !== 'grand-bay') {
        const next = tileDefinitions.find(item => item.id === tileData.next?.[0]);
        if (next?.position) tileMesh.rotation.y = Math.atan2(next.position.x - tileData.position.x, next.position.z - tileData.position.z);
      }
      tileMesh.receiveShadow = true;
      tileMesh.castShadow = true;
      this.scene3D.scene.add(tileMesh);
      tileMesh.userData.tileData = tileData;
      this.tileMeshes[tileData.id ?? i] = tileMesh;

      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(tileSize - 0.08, 0.1, tileSize - 0.08),
        new THREE.MeshStandardMaterial({
          color: this.activeMapDefinition?.id === 'grand-bay' ? '#b6b59e' : visual.plinth, roughness: 0.8, metalness: 0.05,
          emissive: visual.accent, emissiveIntensity: this.activeMapDefinition?.id === 'grand-bay' ? .03 : tileData.type === TileType.ROAD ? 0.16 : 0.34
        })
      );
      plinth.position.set(pos.x, pos.y - 0.2, pos.z);
      plinth.rotation.y = tileMesh.rotation.y;
      plinth.receiveShadow = true;
      plinth.visible = !inset;
      plinth.userData.isTilePlinth = true;
      plinth.userData.districtId = visual.districtId;
      detailGroup.add(plinth);

      // 应用自定义生成的贴图与 Canvas 贴图
      this.applyTileTextures(tileMesh, tileData);
    });
  }

  applyMapDefinition(mapDefinition) {
    if (!mapDefinition) return;
    this.clearDynamicMap();
    mapDefinition=planClassicFrontages(mapDefinition);
    this.activeMapDefinition = mapDefinition;
    const tileSize=mapDefinition.tileSize || 4.4;
    this.createTiles(mapDefinition.tiles,hasClassicFrontages(mapDefinition)?Math.min(3.15,tileSize):tileSize);
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
    this.loadHarborStreets();
    const island = mapDefinition.theme === 'ISLAND';
    const crossroads = mapDefinition.theme === 'CROSSROADS';
    const grand = mapDefinition.theme === 'GRAND_BAY';
    this.baseMesh.visible = !crossroads && !grand && !island;
    this.borderMesh.visible = !crossroads && !grand && !island;
    if (this.centralDecorationGroup) this.centralDecorationGroup.visible = !crossroads && !grand && !island && mapDefinition.id !== 'taiwan-loop';
    if (this.surroundingRoad) this.surroundingRoad.visible = !grand && !island;
    this.cars?.forEach(car => { car.mesh.visible = !grand && !island; });
    this.streetLights?.forEach(({ light, bulb, pole }) => {
      light.visible = !grand;
      bulb.visible = !grand;
      if (pole) pole.visible = !grand;
    });
    if (this.worldGround) {
      this.worldGround.visible = !grand;
      this.worldGround.scale.setScalar(['city-loop','taiwan-loop'].includes(mapDefinition.id)?2.4:1);
    }
    this.baseMesh?.material.color.set(island ? '#a4d7c2' : '#ffe6b6');
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
        if (material?.map?.isCanvasTexture && !material.map.userData?.sharedBoardTexture) material.map.dispose();
        material?.dispose?.();
      });
    });
    this.tileMeshes = [];
    this.tilePositions = [];
    [this.buildingMeshes, this.obstacleMeshes, this.mineMeshes, this.roadEntityMeshes, this.specialTileMeshes].forEach(collection => {
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
    if (this.tileDetailGroup) {
      this.scene3D.scene.remove(this.tileDetailGroup);
      this.disposeObject(this.tileDetailGroup);
    }
    if (this.mapEnvironmentGroup) {
      this.scene3D.scene.remove(this.mapEnvironmentGroup);
      this.disposeObject(this.mapEnvironmentGroup);
    }
    this.roadGroup = null;
    this.tileDetailGroup = null;
    this.mapEnvironmentGroup = null;
  }

  disposeObject(object) {
    object?.traverse?.(child => {
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach(material => {
        if (material.map?.isCanvasTexture && !material.map.userData?.sharedBoardTexture) material.map.dispose();
        material.dispose?.();
      });
    });
  }

  createRoadNetwork(mapDefinition) {
    const roadWidth = mapDefinition.roadWidth || Math.max(2.8, (mapDefinition.tileSize || 4.4) * 0.82);
    const profile = getBoardThemeProfile(mapDefinition.theme);
    const group = new THREE.Group();
    group.name = `roads-${mapDefinition.id}`;
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: '#ffffff', map:surfaceTexture(mapDefinition.id,'road'), roughness: 0.88, metalness: 0.03
    });
    const shoulderMaterial = new THREE.MeshStandardMaterial({ color: profile.shoulder, roughness: 0.74, metalness: 0.06 });
    const pavement=hasClassicFrontages(mapDefinition)?new THREE.MeshStandardMaterial({color:'#cfb18b',roughness:.96}):null;
    if(pavement){
      pavement.map=surfaceTexture(mapDefinition.id,'pave');pavement.color.set('#ffffff');
    }
    const laneMaterials = new Map();
    const seen = new Set();
    let segmentCount = 0;
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
        const visual = getTileVisualSpec(mapDefinition, tile);
        if (!laneMaterials.has(visual.lane)) {
          laneMaterials.set(visual.lane, new THREE.MeshBasicMaterial({
            color: visual.lane, transparent: true, opacity: 0.72, depthWrite: false
          }));
        }
        function alignPaving(geo,span){
          const uv=geo.attributes.uv,vertices=geo.attributes.position;
          for(let i=0;i<vertices.count;i++){
            const x=vertices.getX(i),z=vertices.getZ(i);
            uv.setXY(i,(midpoint.x+x*Math.cos(angle)+z*Math.sin(angle))/span,(midpoint.z+z*Math.cos(angle)-x*Math.sin(angle))/span);
          }
        }
        if(pavement){
          const sidewalk=new THREE.Mesh(new THREE.BoxGeometry(roadWidth+4.4,.20,length+.45),pavement);
          // World-aligned paving bonds continue through oblique road joins.
          alignPaving(sidewalk.geometry,4.6);
          sidewalk.position.set(midpoint.x,-.035,midpoint.z);sidewalk.rotation.y=angle;sidewalk.receiveShadow=true;group.add(sidewalk);
        }
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 0.7, 0.12, length + 0.35), shoulderMaterial);
        shoulder.position.set(midpoint.x, 0.035, midpoint.z);
        shoulder.rotation.y = angle;
        shoulder.receiveShadow = true;
        group.add(shoulder);
        const road = new THREE.Mesh(new THREE.BoxGeometry(roadWidth, 0.16, length + 0.22), roadMaterial);
        alignPaving(road.geometry,4);
        road.position.set(midpoint.x, 0.12, midpoint.z);
        road.rotation.y = angle;
        road.receiveShadow = true;
        group.add(road);
        const lane = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.07, roadWidth * 0.035), 0.035, Math.max(0.3, length * 0.6)), laneMaterials.get(visual.lane));
        lane.position.set(midpoint.x, 0.222, midpoint.z);
        lane.rotation.y = angle;
        lane.userData.isDistrictLane = true;
        lane.userData.districtId = visual.districtId;
        group.add(lane);
        segmentCount++;
      });
    });
    for (const direction of harborForkDirections(mapDefinition)) {
      const {x,z,dx,dz} = direction;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        x + dx * .35, .255, z + dz * .35,
        x - dx * .25 + dz * .24, .255, z - dz * .25 - dx * .24,
        x - dx * .25 - dz * .24, .255, z - dz * .25 + dx * .24
      ], 3));
      const arrow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color:'#fff2be',side:THREE.DoubleSide}));
      arrow.userData.forkDirection = direction;
      group.add(arrow);
    }
    group.userData.segmentCount = segmentCount;
    group.userData.detailCount = segmentCount;
    this.scene3D.scene.add(group);
    this.roadGroup = group;
    if (this.scene3D.container) {
      this.scene3D.container.dataset.roadSegmentCount = String(segmentCount);
      this.scene3D.container.dataset.roadDetailCount = String(segmentCount);
    }
  }

  createMapEnvironment(mapDefinition) {
    const group = new THREE.Group();
    group.name = `environment-${mapDefinition.id}`;
    group.add(finishRoofs(createTownCourts(mapDefinition),mapDefinition.id));
    const marketDistrict=createMarketDistrict(mapDefinition) || regionalDistrict(mapDefinition.id);
    if(marketDistrict){
      group.add(finishRoofs(marketDistrict,mapDefinition.id));
      group.streetOccluders=marketDistrict.children.filter(child=>child.userData.streetOccluder);
    }
    const connection=connectingStreet(mapDefinition.id);
    if(connection){
      group.add(finishRoofs(connection,mapDefinition.id));
      group.streetOccluders=(group.streetOccluders || []).concat(connection.children.filter(child=>child.userData.streetOccluder));
    }
    if(hasClassicFrontages(mapDefinition))group.add(createStreetAprons(mapDefinition));
    this.harborWaves = [];
    this.harborFerries = [];
    this.harborGulls = null;
    if (mapDefinition.id === 'fortune-crossroads') group.add(createCrossroadsGarden(mapDefinition,this.halfBoard));
    if (mapDefinition.theme !== 'GRAND_BAY') {
      this.mapEnvironmentGroup = group;
      this.scene3D.scene.add(group);
      return;
    }

    group.add(finishRoofs(createQuayStreet(mapDefinition),mapDefinition.id),createIslandCoast(), finishRoofs(createNorthMarketStreet(mapDefinition),mapDefinition.id), finishRoofs(createBankCivicCourt(mapDefinition),mapDefinition.id), createHarborWorkingYard(mapDefinition));
    this.harborGulls = createHarborGulls();
    updateHarborGulls(this.harborGulls,0);
    this.harborGulls.frustumCulled = false;
    group.add(createHarborPromenade(),this.harborGulls);
    const districtGround = createCityGround(mapDefinition);
    if (districtGround) group.add(finishLandscape(districtGround), createTerraceOrchards());

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({
        color: '#2396bb', roughness: 0.28, metalness: 0.12,
        transparent: true, opacity: 0.94
      })
    );
    this.waterTime = {value:0};
    ocean.material.onBeforeCompile = shader => {
      shader.uniforms.waterTime = this.waterTime;
      shader.vertexShader = 'varying vec2 seaPoint;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nseaPoint = position.xy;');
      shader.fragmentShader = 'varying vec2 seaPoint; uniform float waterTime;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float curve = seaPoint.y*2.9 + 1.4*sin(seaPoint.x*.37 + waterTime*.5) + waterTime;
        float crest = smoothstep(.93,.999,sin(curve)) * smoothstep(.1,.85,sin(seaPoint.x*.8 + seaPoint.y*.31));
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.52,.92,.89),crest*.38);
      `);
    };
    ocean.rotation.x = -Math.PI / 2;
    // Surround the island below land and playable surfaces; never overlay property pads.
    ocean.name = 'island-sea';
    ocean.position.set(0, COAST_WATER_Y, -3);
    group.add(ocean);

    [-56, -20, 18, 55].forEach((x, index) => {
      const wave = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 0.34),
        new THREE.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: 0.34, depthWrite: false })
      );
      wave.rotation.x = -Math.PI / 2;
      wave.position.set(x, COAST_WATER_Y + 0.02 + index * 0.002, 49 + index * 4.8);
      wave.userData.originX = x;
      wave.userData.speed = 0.65 + index * 0.12;
      group.add(wave);
      this.harborWaves.push(wave);
    });

    const trunkMaterial = new THREE.MeshBasicMaterial({ color: '#76543b' });
    const leafMaterial = new THREE.MeshStandardMaterial({color:'#66ac52',roughness:1,flatShading:true});
    const treePositions = [
      [-42, 13], [-35, 16], [-28, 18], [-18, 17], [-8, 17],
      [-43, 5], [-32, 3], [-13, 2], [-5, -7], [-13, -13],
      [-6, -21], [-37, -25], [-45, -28], [-12, 34], [8, 35]
    ];
    treePositions.forEach(([x, z], index) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.8, 8), trunkMaterial.clone());
      trunk.position.y = 0.9;
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(1.15 + (index % 3) * 0.12, 1), leafMaterial.clone());
      crown.scale.set(1.05,1.15 + (index % 3)*.12,.88);
      crown.rotation.y = index * 1.13;
      crown.material.color.set(['#57ac62','#82b754','#468f65'][index%3]);
      crown.position.y = 2.25;
      crown.castShadow = true;
      tree.add(trunk, crown);
      tree.userData.harborOccluder = 'tree';
      tree.position.set(x, 0, z);
      group.add(tree);
    });

    const mountainMaterial = new THREE.MeshBasicMaterial({ color: '#668b6b' });
    [[-36, -1, 5.2], [-27, -7, 6], [-40, -21, 3], [-35, -28, 3.2]].forEach(([x, z, radius], index) => {
      const mountain = new THREE.Mesh(new THREE.ConeGeometry(radius, radius * 0.75, 7), mountainMaterial);
      mountain.position.set(x, radius * 0.36 - 0.15, z);
      mountain.rotation.y = index * 0.55;
      mountain.castShadow = true;
      group.add(mountain);
    });

    CITY_BLOCK_SITES.forEach(({x,z,height},index) => {
      const block = createCityBlock(height,index);
      block.position.set(x,0,z);
      group.add(block);
    });

    const pierCanvas = document.createElement('canvas');
    pierCanvas.width = 64; pierCanvas.height = 256;
    const pierContext = pierCanvas.getContext('2d');
    pierContext.fillStyle = '#a17e5c'; pierContext.fillRect(0,0,64,256);
    pierContext.fillStyle = '#72543e';
    for (let y=0; y<256; y+=24) pierContext.fillRect(0,y,64,2);
    const pierTexture = new THREE.CanvasTexture(pierCanvas); pierTexture.colorSpace = THREE.SRGBColorSpace;
    const pierMaterial = new THREE.MeshStandardMaterial({ map: pierTexture, roughness: 1 });
    [-24, -8, 12, 32].forEach(x => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 12.5), pierMaterial);
      // Shore end z=36.25 overlaps the existing waterfront walk ending at36.35.
      pier.name = 'harbor-pier';
      pier.position.set(x, 0.08, 42.5);
      for (const z of [39,47]) {
        const support = new THREE.Mesh(new THREE.BoxGeometry(.28,1.1,.28),pierMaterial);
        support.position.set(x,-.5,z); group.add(support);
      }
      group.add(pier);
    });
    [[-46, 50, 0.38], [22, 58, -0.28]].forEach(([x, z, speed], index) => {
      const ferry = this.createGrandBayFerry(index);
      ferry.position.set(x, COAST_WATER_Y - .22, z);
      ferry.userData.originX = x;
      ferry.userData.speed = speed;
      group.add(ferry);
      this.harborFerries.push(ferry);
    });
    const lighthouse = new THREE.Group();
    const lighthouseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 5.5, 16), new THREE.MeshBasicMaterial({ color: '#f4f4ea' }));
    lighthouseBody.position.y = 2.75;
    const lighthouseTop = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.1, 16), new THREE.MeshBasicMaterial({ color: '#e65353' }));
    lighthouseTop.position.y = 6.05;
    lighthouse.add(lighthouseBody, lighthouseTop);
    lighthouse.position.set(60, 0, 37);
    group.add(lighthouse);

    if (this.harborArt?.prefabs) group.add(this.harborArt.streets(mapDefinition));
    this.scene3D.scene.add(group);
    this.mapEnvironmentGroup = group;
  }

  loadHarborStreets() {
    if (this.harborArtLoading) return;
    this.harborArt = new HarborStreets();
    this.scene3D.container.dataset.harborArt = 'loading';
    this.harborArtLoading = this.harborArt.load().then(() => {
      this.scene3D.container.dataset.harborArt = 'ready';
      if (!this.activeMapDefinition) return;
      if (this.activeMapDefinition.id === 'grand-bay') this.mapEnvironmentGroup.add(this.harborArt.streets(this.activeMapDefinition));
      const records = [...this.buildingMeshes].map(([id, mesh]) => [id, mesh.userData.propertyVisual]);
      this.rebuildMapLandmarks(this.activeMapDefinition);
      for (const [id, record] of records) if (record) this.updateBuildingMesh(id, ...record, true);
      for (const id of [...this.obstacleMeshes.keys()]) this.setObstacleMesh(id,true);
      for (const id of [...this.mineMeshes.keys()]) this.setMineMesh(id,true);
      for (const [id, mesh] of [...this.roadEntityMeshes]) {
        if (mesh.userData.entity?.type === 'TIME_BOMB') this.setRoadEntityMesh(id,mesh.userData.entity);
      }
    }).catch(error => {
      this.scene3D.container.dataset.harborArt = 'fallback';
      console.warn('Original harbor models unavailable; keeping procedural buildings.', error);
    });
  }

  createGrandBayFerry(variant = 0) {
    const group = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(5.4, 0.55, 1.7),
      new THREE.MeshStandardMaterial({ color: variant ? '#f06b5b' : '#f7f5e8', roughness: 0.42 })
    );
    hull.position.y = 0.34;
    hull.castShadow = true;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 0.82, 1.35),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.38 })
    );
    deck.position.set(-0.3, 0.96, 0);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.38, 1.39),
      new THREE.MeshStandardMaterial({ color: '#174b68', emissive: '#12334a', emissiveIntensity: 0.35, roughness: 0.14 })
    );
    glass.position.set(-0.35, 1.04, 0);
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 1.5),
      new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(-4.2, 0.01, 0);
    group.add(hull, deck, glass, wake);
    return group;
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
    if (this.activeMapDefinition?.id === 'grand-bay' || hasClassicFrontages(this.activeMapDefinition)) {
      const spec = harborTileStyle(tileData);
      const visual = getTileVisualSpec(this.activeMapDefinition, tileData);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const property=isPropertyTile(tileData),road=tileData.type==='ROAD';
      // The outer square is transparent. The continuous carriageway supplies
      // its own joints and shadows all the way to the edge of the enamel inlay.
      const accent=tileData.group && COLOR_GROUPS[tileData.group]?.color || visual.accent;
      const disc=(r,fill)=>{
        ctx.beginPath();ctx.arc(128,127,r,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();
      };
      const rim=ctx.createLinearGradient(75,48,164,204);
      rim.addColorStop(0,'#ffe8a0');rim.addColorStop(.44,'#cead67');rim.addColorStop(.65,'#806942');rim.addColorStop(1,'#dab77a');
      disc(road?66:101,'#514f48');disc(road?62:96,rim);
      const enamel=ctx.createRadialGradient(98,93,5,133,138,97);
      enamel.addColorStop(0,road?'#839593':accent);enamel.addColorStop(.68,road?'#57706e':accent);
      enamel.addColorStop(1,road?'#3e5858':'#52665c');
      disc(road?56:87,enamel);
      ctx.save();ctx.beginPath();ctx.arc(128,127,road?50:80,3.61,5.35);ctx.strokeStyle='rgba(255,249,220,.68)';ctx.lineWidth=3;ctx.stroke();ctx.restore();
      ctx.textAlign='center';ctx.textBaseline='middle';
      if(property || road){
        const points=road?[[94,103],[127,123],[162,103],[162,125],[127,148],[94,125]]:
          [[77,117],[128,73],[179,117],[166,117],[166,154],[140,154],[140,126],[118,126],[118,154],[91,154],[91,117]];
        ctx.beginPath();points.forEach(([x,y],n)=>n?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
        ctx.fillStyle='#fff0c9';ctx.fill();ctx.strokeStyle='#684e34';ctx.lineWidth=4;ctx.stroke();
      }else{
        ctx.font='bold 58px sans-serif';ctx.lineWidth=5;ctx.strokeStyle='#594735';ctx.strokeText(spec.label,128,118);
        ctx.fillStyle='#fff2c9';ctx.fillText(spec.label,128,118);
      }
      ctx.font='bold '+(road?22:26)+'px sans-serif';ctx.fillStyle='#fff4ce';ctx.strokeStyle='#4d544b';ctx.lineWidth=4;
      const numberY=road?163:178;
      ctx.strokeText(String(tileData.id),128,numberY);ctx.fillText(String(tileData.id),128,numberY);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8,this.scene3D.renderer.capabilities.getMaxAnisotropy());
      tileMesh.material[2].dispose();
      tileMesh.material[2] = new THREE.MeshStandardMaterial({map:texture,alphaTest:.45,roughness:.76,metalness:.06});
      tileMesh.castShadow=false;
      tileMesh.userData.harborLabel = spec.label;
      return;
    }
    let customTex = null;
    if (tileData.type === TileType.ROAD) {
      const visual = getTileVisualSpec(this.activeMapDefinition, tileData);
      tileMesh.material[2] = new THREE.MeshStandardMaterial({
        map: this.createRoadTileTexture(visual), color: '#ffffff', roughness: 0.86, metalness: 0.04,
        emissive: visual.accent, emissiveIntensity: 0.06
      });
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

  createRoadTileTexture(visual) {
    const key = `${visual.asphalt}:${visual.lane}`;
    if (this.roadTileTextures.has(key)) return this.roadTileTextures.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = visual.asphalt;
    ctx.fillRect(0, 0, 256, 256);
    const asphalt = ctx.createLinearGradient(0, 0, 256, 256);
    asphalt.addColorStop(0, 'rgba(255,255,255,.07)');
    asphalt.addColorStop(.45, 'rgba(255,255,255,0)');
    asphalt.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = asphalt;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = visual.lane;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 9;
    ctx.setLineDash([34, 28]);
    ctx.beginPath();
    ctx.moveTo(128, -10);
    ctx.lineTo(128, 266);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 236, 236);
    ctx.globalAlpha = 0.52;
    ctx.fillStyle = visual.lane;
    ctx.beginPath();
    ctx.moveTo(128, 48);
    ctx.lineTo(105, 82);
    ctx.lineTo(119, 82);
    ctx.lineTo(119, 108);
    ctx.lineTo(137, 108);
    ctx.lineTo(137, 82);
    ctx.lineTo(151, 82);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.scene3D.renderer.capabilities.getMaxAnisotropy());
    texture.userData.sharedBoardTexture = true;
    this.roadTileTextures.set(key, texture);
    return texture;
  }

  createTileLabelCanvas(tileMesh, tileData) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const visual = getTileVisualSpec(this.activeMapDefinition, tileData);
    let colorHex = visual.accent;
    if (tileData.group && COLOR_GROUPS[tileData.group]) colorHex = COLOR_GROUPS[tileData.group].color;
    else if (tileData.type === TileType.COUPON) colorHex = '#ffca3a';
    else if (tileData.type === TileType.MONSTER) colorHex = '#8b5cf6';
    else if (tileData.type === TileType.TREASURE) colorHex = '#f97316';
    else if (tileData.type === TileType.GOD_FORTUNE) colorHex = '#ffe66d';
    else if (tileData.type === TileType.CHANCE) colorHex = '#22d3ee';
    ctx.fillStyle = '#0b2030';
    ctx.fillRect(0, 0, 512, 512);
    const backdrop = ctx.createLinearGradient(0, 0, 512, 512);
    backdrop.addColorStop(0, 'rgba(255,255,255,.10)');
    backdrop.addColorStop(.5, 'rgba(255,255,255,0)');
    backdrop.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = backdrop;
    ctx.beginPath();
    ctx.roundRect(18, 18, 476, 476, 38);
    ctx.fill();
    ctx.strokeStyle = colorHex;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 2;
    for (let offset = -512; offset < 512; offset += 54) {
      ctx.beginPath();
      ctx.moveTo(offset, 512);
      ctx.lineTo(offset + 512, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.roundRect(18, 18, 476, 92, [38, 38, 8, 8]);
    ctx.fill();
    ctx.fillStyle = 'rgba(2,12,25,.55)';
    ctx.fillRect(18, 93, 476, 17);

    ctx.fillStyle = '#f4fbff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const icon = tileData.icon || '🏠';
    ctx.font = 'bold 118px sans-serif';
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 28;
    ctx.fillText(icon, 256, 232);
    ctx.shadowBlur = 0;

    ctx.font = '900 42px "Noto Sans SC", sans-serif';
    const displayName = tileData.name.length > 8 ? `${tileData.name.slice(0, 8)}…` : tileData.name;
    ctx.fillText(displayName, 256, 354);

    ctx.fillStyle = 'rgba(190,222,232,.8)';
    ctx.font = '800 24px "Outfit", sans-serif';
    ctx.fillText(visual.districtName || tileData.type.replaceAll('_', ' '), 256, 403);

    if (tileData.price) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 38px "Outfit", sans-serif';
      ctx.fillText(`$${tileData.price.toLocaleString()}`, 256, 456);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    tileMesh.material[2] = new THREE.MeshStandardMaterial({
      map: texture, roughness: 0.38, metalness: 0.08,
      emissive: colorHex, emissiveIntensity: 0.08
    });
  }

  rebuildMapLandmarks(mapDefinition) {
    this.specialTileMeshes.forEach(group => { this.scene3D.scene.remove(group); this.disposeObject(group); });
    this.specialTileMeshes.clear();
    this.vacantLotMeshes.clear();

    mapDefinition.tiles.forEach(tile => {
      const position = this.tilePositions[tile.id];
      if (!position) return;
      let group = null;
      const service = harborFacility(mapDefinition, tile);
      if (service) group = this.createHarborFacility(tile, service);
      else if (tile.serviceFrontage) {
        const regionalShop = tile.type === TileType.CARD_SHOP && ['island-fork','taiwan-loop'].includes(mapDefinition.id);
        const building = regionalShop ? createCardHouse(mapDefinition.id === 'island-fork') : this.createFacilityLandmark(tile);
        // Quantized GLBs keep their authored scale and origin on the root mesh.
        // The pavement and roadside transform must remain in board units.
        group = new THREE.Group();
        Object.assign(group.userData, building.userData);
        group.add(building);
        addServiceThreshold(group, tile, mapDefinition.roadWidth || Math.max(2.8,(mapDefinition.tileSize || 4.4)*.82));
      }
      else if (tile.type === TileType.CHANCE && this.harborArt?.prefabs) {
        group = this.harborArt.clone('board_news');
        if (group) group.userData.isStaticFacility = true;
      } else if (isPropertyTile(tile)) {
        group = this.createVacantLotMarker(tile);
        this.vacantLotMeshes.set(tile.id, group);
      } else if (tile.type === TileType.MONSTER) group = this.createMonsterLandmark();
      else if (tile.type === TileType.COUPON) group = this.createCouponLandmark(tile.couponAmount || 30);
      else if (tile.type === TileType.TREASURE) group = this.createTreasureLandmark();
      else if (tile.type === TileType.GOD_FORTUNE) group = this.createFortuneLandmark();
      else if ((tile.next || []).length > 1) group = this.createForkLandmark();
      else if ([TileType.BANK, TileType.STOCK, TileType.CARD_SHOP, TileType.HOSPITAL, TileType.PRISON, TileType.LOTTERY, TileType.MAGIC_HOUSE, TileType.MECHANISM, TileType.COMPANY, TileType.MINIGAME].includes(tile.type)) {
        group = this.createFacilityLandmark(tile);
      }
      if (!group) return;
      const anchor = service || tile.serviceFrontage?.position || (isPropertyTile(tile) && tile.lot?.position
        ? tile.lot.position
        : this.getRoadsideAnchor(tile, position));
      group.position.set(anchor.x, service || tile.serviceFrontage || (isPropertyTile(tile) && tile.lot?.position) || group.userData.originalHospital || group.userData.originalMagic || group.userData.originalStation ? .22 : position.y + 0.35, anchor.z);
      group.rotation.y = service ? facilityFacing(tile, service) : tile.serviceFrontage ? tile.serviceFrontage.rotation : group.userData.originalStation ? Math.PI : tile.lot?.rotation || 0;
      if (isPropertyTile(tile) && tile.lot?.position) group.rotation.y=facingRoad(tile)+Math.PI;
      if (tile.serviceFrontage && !service) group.position.y = .075;
      group.userData.baseY = group.position.y;
      group.userData.phase = tile.id * 0.71;
      group.userData.tileType = tile.type;
      this.scene3D.scene.add(group);
      this.specialTileMeshes.set(tile.id, group);
    });
  }

  createHarborFacility(tile, spec) {
    const model = this.harborArt?.clone(spec.model);
    const group = new THREE.Group();
    group.userData.serviceTile = tile.id;
    group.userData.isStaticFacility = true;
    if (model) {
      group.add(model);
      group.userData.originalModel = spec.model;
    } else {
      // Existing procedural fallback remains available if asset loading fails.
      group.add(this.createFacilityLandmark(tile));
      return group;
    }
    if (tile.type === TileType.STOCK) {
      const crown = this.harborArt.clone('exchange_crown');
      if (crown) {
        crown.position.y = spec.height;
        group.add(crown);
      }
    }
    return group;
  }

  createVacantLotMarker(tile) {
    const group = new THREE.Group();
    const accent = getTileVisualSpec(this.activeMapDefinition, tile).accent;
    if (tile.lot?.position) {
      const map=this.activeMapDefinition.id;
      const dock=(map==='island-fork' && (tile.id<=12 || tile.id>=26)) || (map==='grand-bay' && quayLot(tile.id));
      const arcade=map==='city-loop' || tile.large;
      const tea=map==='taiwan-loop' || (map==='island-fork' && tile.id>=16 && tile.id<=22);
      const edging=new THREE.MeshStandardMaterial({color:dock?'#886345':arcade?'#97795d':'#ac8b63'});
      const surface=new THREE.MeshStandardMaterial({color:dock?'#c08c54':arcade?'#c5baba':tea?'#afbc82':'#a2b87a'});
      const quayUse=map==='grand-bay' && (tile.group?.startsWith('BAY_') || tile.id===15);
      const tidalGarden=quayUse && (tile.group==='BAY_2' || tile.id===15);
      surface.map=surfaceTexture(tidalGarden?'taiwan-loop':quayUse && tile.group==='BAY_3'?'city-loop':map,'plot');
      let plotFloor;
      if(tidalGarden){
        const outline=new THREE.Shape();
        outline.moveTo(-1.61,1.42);outline.lineTo(.41,1.42);
        outline.quadraticCurveTo(1.72,1.37,1.70,.18);
        outline.quadraticCurveTo(1.67,-1.50,-.06,-1.50);
        outline.lineTo(-1.61,-1.50);outline.closePath();
        plotFloor=new THREE.ExtrudeGeometry(outline,{depth:.13,bevelEnabled:false});
        plotFloor.rotateX(-Math.PI/2);plotFloor.translate(0,-.08,0);
      }else plotFloor=new THREE.BoxGeometry(3.30,.11,3.05);
      group.add(new THREE.Mesh(plotFloor,surface));
      const detail=(x,y,z,w,h,d,material)=>{
        const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);part.position.set(x,y,z);group.add(part);
      };
      if(quayUse){
        const yard=new THREE.MeshStandardMaterial({color:'#477d79',roughness:.86});
        const pale=new THREE.MeshStandardMaterial({color:'#f2d49c',roughness:.91});
        const side=tile.id%2===0?-1:1;
        if(tile.group==='BAY_1'){
          // An open net-mending rack, with a free half-yard for the eventual home.
          surface.color.set('#c29f73');
          for(const z of [-.77,.71])detail(side*.85,.52,z,.13,.96,.14,edging);
          detail(side*.85,.94,-.03,.13,.13,1.71,edging);
          for(let k=0;k<5;k++)detail(side*.85,.64,-.61+k*.29,.08,.58,.045,yard);
          for(const y of [.48,.67,.85])detail(side*.85,y,-.02,.085,.045,1.32,yard);
          detail(-side*.81,.15,-.51,.76,.18,1.14,pale);
        }else if(tile.id===13 || tile.id===18){
          // Seaward reading terrace: three stone treads lead to a timber seat.
          surface.color.set('#a4bd99');
          for(let k=0;k<3;k++)detail(side*(.69-k*.31),.10+k*.046,-.21,.55,.11+k*.085,1.76,pale);
          detail(-side*.84,.38,-.39,.48,.15,1.33,edging);
          for(const z of [-.92,.15])detail(-side*.84,.20,z,.31,.34,.13,yard);
          detail(-side*1.02,.57,-.39,.10,.41,1.34,yard);
        }else if(tile.group==='BAY_3'){
          surface.color.set('#b0aaa0');
          for(const x of [-.75,.76])detail(x,.14,0,.14,.12,2.28,pale);
          for(const [x,z] of [[-.75,-.65],[.12,-.48]]){
            detail(side*x,.33,z,.78,.55,.74,edging);
            detail(side*x,.62,z,.12,.05,.76,yard);
          }
        }else{
          // Shell-shaped tidal garden, with a curved seat and fan of stepping stones.
          surface.color.set('#d4c294');
          const basin=new THREE.Mesh(new THREE.CylinderGeometry(.70,.80,.19,16),pale);
          basin.scale.z=.73;basin.position.set(side*.52,.15,-.37);
          group.add(basin);
          const water=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.035,16),yard);
          water.scale.z=.73;water.position.copy(basin.position);
          water.position.y+=.10;group.add(water);
          for(let i=0;i<3;i++){
            const reed=new THREE.Mesh(new THREE.ConeGeometry(.10,.54+i*.11,5),yard);
            reed.position.set(side*(.78-i*.12),.47,-.54-i*.06);group.add(reed);
          }
          for(let k=0;k<5;k++){
            const angle=k*.54-.95;
            detail(side*.52+.96*Math.sin(angle),.18,-.37+.86*Math.cos(angle),.39,.21,.28,pale);
          }
          detail(-side*.88,.28,-.57,.40,.32,1.54,edging);
        }
      }else if(dock){
        for(let board=-3;board<=3;board++)detail(0,.068,board*.40,3.26,.02,.035,edging);
        for(const x of [-1.38,1.38])detail(x,.30,1.24,.21,.64,.21,edging);
        detail(0,.43,1.24,2.82,.14,.12,edging);
      }else if(arcade){
        for(const side of [-1,1])detail(side*1.21,.13,.26,.52,.16,2.45,edging);
        for(const z of [-.96,-.13,.70])detail(0,.09,z,1.45,.065,.11,edging);
      }else{
        const hedge=new THREE.MeshStandardMaterial({color:tea?'#708c47':'#649159'});
        for(const side of [-1,1]){
          detail(side*1.05,.20,tea?.50:.28,.60,.28,tea?1.68:2.02,hedge);
          detail(side*1.39,.13,.15,.11,.22,2.40,edging);
        }
        detail(0,.09,-.28,.78,.075,2.27,new THREE.MeshStandardMaterial({color:'#e9c99a'}));
      }
      if(!quayUse)group.add(streetYard(tile,dock?'dock':arcade?'station':'garden'));
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.055,1.03,8),edging);
      pole.position.set(.97,.64,.6);group.add(pole);
      const flag=new THREE.Shape();flag.moveTo(0,0);flag.lineTo(.69,-.14);flag.lineTo(0,-.36);flag.closePath();
      const pennant=new THREE.Mesh(new THREE.ShapeGeometry(flag),new THREE.MeshStandardMaterial({color:COLOR_GROUPS[tile.group]?.color || accent,side:THREE.DoubleSide}));
      pennant.position.set(.97,1.14,.60);group.add(pennant);
      return group;
    }
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(2.72, 0.14, 2.72),
      new THREE.MeshStandardMaterial({ color: '#17372f', roughness: 0.76, emissive: accent, emissiveIntensity: 0.12 })
    );
    pad.position.y = 0.08;
    group.add(pad);
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.34, emissive: accent, emissiveIntensity: 0.28 });
    [[0, 1.36, 2.72, .09], [0, -1.36, 2.72, .09], [1.36, 0, .09, 2.72], [-1.36, 0, .09, 2.72]].forEach(([x, z, width, depth]) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(width, .1, depth), edgeMaterial);
      edge.position.set(x, .17, z);
      group.add(edge);
    });
    const postMaterial = new THREE.MeshStandardMaterial({ color: '#f6e6b7', roughness: .56 });
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
      new THREE.MeshBasicMaterial({ color: accent })
    );
    badge.position.set(0, 0.72, 0.956);
    group.add(badge);
    return group;
  }

  getRoadsideAnchor(tile, position) {
    // The default outward normal of 72 points directly onto branch tile118.
    if (this.activeMapDefinition?.id === 'grand-bay' && tile.id === 72) return {x:-59,z:-16};
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
      ,[TileType.COMPANY]: ['#0ea5e9', '#e0f2fe']
      ,[TileType.MINIGAME]: ['#ec4899', '#fce7f3']
    };
    const [roofColor, wallColor] = palette[tile.type] || ['#7bed9f', '#ffffff'];
    const company = {AURORA_RETAIL:'commerce_mall_1',SUMMIT_MATERIAL:'company_summit_yard',NOVA_BUILD:'company_summit_yard'}[tile.companyId] || 'company_cloud_court';
    const source = {COMPANY:company, MINIGAME:'civic_arcade', HOSPITAL:'board_clinic', PRISON:'board_prison', MAGIC_HOUSE:'board_magic', BANK:'harbor_bank', STOCK:'old_town_exchange', CARD_SHOP:'market_clock_gallery', LOTTERY:'harbor_lottery'}[tile.type];
    const prefab = source && this.harborArt?.clone(source);
    if (prefab) { prefab.userData.isStaticFacility = true; return prefab; }
    const clinic = tile.type === TileType.HOSPITAL;
    const magic = tile.type === TileType.MAGIC_HOUSE;
    const station = tile.type === TileType.PRISON;
    const group = station ? createCivicStation() : clinic ? createHospitalClinic() : magic ? createMagicFrontage() : new THREE.Group();
    if (!clinic && !magic && !station) {
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(1.82, 1.92, .24, 16),
        new THREE.MeshStandardMaterial({ color: '#0b2234', roughness: .34, metalness: .4, emissive: roofColor, emissiveIntensity: .3 })
      );
      plinth.position.y = .12;
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.7, 2.2), new THREE.MeshStandardMaterial({ color: wallColor, roughness: .48, metalness: .06 }));
      base.position.y = 0.85;
      base.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.8, 4), new THREE.MeshStandardMaterial({ color: roofColor, roughness: .28, metalness: .24, emissive: roofColor, emissiveIntensity: .22 }));
      roof.position.y = 2.1;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.72, .045, 8, 36),
        new THREE.MeshBasicMaterial({ color: roofColor, transparent: true, opacity: .7, depthWrite: false })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = .29;
      halo.userData.isFacilityHalo = true;
      group.add(plinth, base, roof, halo);
      const windowMaterial = new THREE.MeshStandardMaterial({ color: '#dff9ff', emissive: roofColor, emissiveIntensity: .78, roughness: .2 });
      [-.72, 0, .72].forEach(x => {
        const window = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .06), windowMaterial);
        window.position.set(x, .92, 1.13);
        window.userData.isWindow = true;
        group.add(window);
      });
    }
    group.userData.isFacilityLandmark = true;
    return group;
  }

  createMonsterLandmark() {
    const group = new THREE.Group();
    group.name = 'kite-fox-landmark';
    new GLTFLoader().load(`${import.meta.env.BASE_URL}assets/models/kite-fox.glb`, ({scene}) => {
      if (!group.parent) {
        this.disposeObject(scene);
        return;
      }
      scene.traverse(part => { if (part.isMesh) part.castShadow = true; });
      scene.scale.setScalar(1.28);
      group.add(scene);
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

  updateHarborPawnVisibility(pawns, now = performance.now()) {
    if (!this.activeMapDefinition) return;
    const walking = pawns.some(pawn=>pawn.mesh.userData.isMoving);
    if (now - (this.lastPawnVisibilityCheck ?? -Infinity) < (walking ? 55 : 180)) return;
    this.lastPawnVisibilityCheck = now;
    const camera = this.scene3D.camera.position;
    const targets = [];
    const occupied = new Set();
    const right = new THREE.Vector3().setFromMatrixColumn(this.scene3D.camera.matrixWorld,0);
    for (const pawn of pawns.filter(p=>p.mesh.visible)) {
      const scale = pawn.characterMesh?.scale.y || 1;
      const face = pawn.mesh.position.clone().add(new THREE.Vector3(0,1.25*scale,0));
      targets.push(face);
      if (pawn.mesh.userData.isMoving) {
        // A tall roof corner can cover one shoulder while leaving the face centre
        // and the destination tile clear. Test the silhouette on the current step.
        targets.push(face.clone().addScaledVector(right,.39*scale),face.clone().addScaledVector(right,-.39*scale));
        targets.push(pawn.mesh.position.clone().add(new THREE.Vector3(0,.5*scale,0)));
      }
      if (!occupied.has(pawn.currentTile) && this.tilePositions[pawn.currentTile]) {
        targets.push(this.tilePositions[pawn.currentTile].clone().add(new THREE.Vector3(0,.25,0)));
        occupied.add(pawn.currentTile);
      }
    }
    const visibleTargets = targets.filter(target=>{
      const screen = target.clone().project(this.scene3D.camera);
      return Math.abs(screen.x)<1.1 && Math.abs(screen.y)<1.1 && screen.z<1;
    });
    const scenery = this.mapEnvironmentGroup?.children.filter(o=>o.userData.harborOccluder) || [];
    const facilities = [...(this.specialTileMeshes?.values() || [])].filter(group=>group.userData.isStaticFacility);
    const candidates = [...this.buildingMeshes.values(),...facilities,...scenery,...(this.mapEnvironmentGroup?.streetOccluders || [])];
    const rays=visibleTargets.map(target=>({
      ray:new THREE.Ray(camera,target.clone().sub(camera).normalize()),
      distance:camera.distanceTo(target)-.35
    }));
    const hit = new THREE.Vector3(), box = new THREE.Box3();
    for (const group of candidates) {
      if (group.userData.propertyVisual?.[0] === 0) continue;
      const model = group.userData.originalModel ? group.getObjectByName(group.userData.originalModel) : group;
      if (!model) continue;
      // Rebuilt lots and facilities get new groups. Cache settled, stationary bounds.
      if (!group.userData.visibilityBounds) {
        model.updateWorldMatrix(true,true);
        box.setFromObject(model);
        if (Math.abs(group.scale.y-1)<.002) group.userData.visibilityBounds=box.clone();
      } else box.copy(group.userData.visibilityBounds);
      const obstructs = rays.some(({ray,distance}) => ray.intersectBox(box,hit) && camera.distanceTo(hit)<distance);
      if (Boolean(group.userData.isPawnOccluder) === obstructs) continue;
      group.userData.isPawnOccluder = obstructs;
      model.traverse(child => {
        if (child.userData.isOwnerLight || child.userData.isOwnerBeacon) return;
        for (const material of (Array.isArray(child.material) ? child.material : [child.material])) {
          if (!material) continue;
          material.userData.harborOpaqueState ??= {opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite};
          const normal = material.userData.harborOpaqueState;
          // A transparent stack of tower floors can still hide the silhouette.
          // All floors leave the same screen pixels clear, keeping the pawn readable.
          if (group.userData.propertyVisual?.[0]>=4) {
            if (!normal.shader) {
              normal.shader=material.onBeforeCompile;
              normal.cacheKey=material.customProgramCacheKey;
              normal.cutawayKey=normal.cacheKey.call(material)+'-tower-cutaway';
            }
            if (obstructs) {
              material.onBeforeCompile=function(shader,renderer){
                normal.shader.call(this,shader,renderer);
                shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
                  'if (mod(floor(gl_FragCoord.x) + 2.0*floor(gl_FragCoord.y), 4.0) >= 1.0) discard;\n#include <opaque_fragment>');
              };
              material.customProgramCacheKey=()=>normal.cutawayKey;
            } else {
              material.onBeforeCompile=normal.shader;
              material.customProgramCacheKey=normal.cacheKey;
            }
          }
          material.opacity = obstructs ? .22 : normal.opacity;
          material.transparent = obstructs || normal.transparent;
          material.depthWrite = obstructs ? false : normal.depthWrite;
          material.needsUpdate = true;
        }
      });
    }
  }

  animateMapLandmarks() {
    surfaceTime.value=performance.now()/1000;
    const time = performance.now() * 0.0018;
    this.specialTileMeshes.forEach(group => {
      if (isPropertyTile({ type: group.userData.tileType }) || group.userData.isStaticFacility) return;
      group.position.y = group.userData.baseY + Math.sin(time + group.userData.phase) * 0.16;
      if ([TileType.MONSTER, TileType.COUPON, TileType.TREASURE, TileType.GOD_FORTUNE].includes(group.userData.tileType)) {
        group.rotation.y += group.userData.tileType === TileType.MONSTER ? 0.008 : 0.015;
      }
      group.traverse(child => {
        if (child.userData?.isFacilityHalo) child.rotation.z = time * .32 + group.userData.phase;
      });
    });
    for (const building of this.buildingMeshes.values()) {
      const rotor = building.userData.rotor;
      if (rotor && !this.motionPreference.matches) rotor.rotation.y = time;
    }
    if (!this.motionPreference.matches) {
      for (const collection of [this.mineMeshes,this.roadEntityMeshes]) for (const mesh of collection.values()) {
        for (const lamp of mesh.userData.lamps || []) lamp.emissiveIntensity = .45+.55*Math.sin(time*4)**2;
      }
    }
    if (this.harborGulls && !this.motionPreference.matches) updateHarborGulls(this.harborGulls,time);
    if (this.waterTime) this.waterTime.value = time;
    this.harborWaves?.forEach((wave, index) => {
      wave.position.x = wave.userData.originX + Math.sin(time * wave.userData.speed + index) * 9;
      wave.material.opacity = 0.22 + (Math.sin(time * 1.4 + index) + 1) * 0.09;
    });
    this.harborFerries?.forEach((ferry, index) => {
      ferry.position.x += ferry.userData.speed * 0.04;
      if (ferry.userData.speed > 0 && ferry.position.x > 78) ferry.position.x = -78;
      if (ferry.userData.speed < 0 && ferry.position.x < -78) ferry.position.x = 78;
      ferry.rotation.y = ferry.userData.speed < 0 ? Math.PI : 0;
      ferry.position.y = COAST_WATER_Y - .22 + Math.sin(time * 1.8 + index) * 0.05;
    });
  }

  createCentralDecoration() {
    const centerGroup = new THREE.Group();

    // 中央公园使用项目内程序化生成的草地纹理。
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
        if (child.userData?.isOwnerLight) child.material.emissiveIntensity = enabled ? 1.25 : 0.5;
        if (child.userData?.isOwnerBeacon) child.material.opacity = enabled ? 1 : .78;
        if (child.userData?.isBuildingStandee) child.material.color.set(enabled ? '#9aa8c8' : '#ffffff');
      });
    });
    this.mapEnvironmentGroup?.traverse(child => {
      const materials=Array.isArray(child.material)?child.material:[child.material];
      for(const material of materials) if(material?.userData.districtWindow) material.emissiveIntensity=enabled ? .75 : .10;
      if (child.userData?.isPromenadeLamp) child.material.emissiveIntensity = enabled ? 1.4 : .1;
      if (child.userData?.isOriginalCityWindow && child.material?.emissive) {
        child.material.emissiveIntensity = enabled ? .5 : 0;
      }
    });
  }

  createSurroundingCityEnvironment() {
    const roadGeo = new THREE.RingGeometry(this.halfBoard * 1.15, this.halfBoard * 1.45, 64);
    const roadMat = new THREE.MeshStandardMaterial({ color: '#738781', roughness: 0.9, side: THREE.DoubleSide });
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

  updateBuildingMesh(tileIndex, level, ownerColor = null, buildingType = null, refresh = false, purchased = false) {
    const previous = this.buildingMeshes.get(tileIndex)?.userData.propertyVisual;
    if (!refresh && previous && previous[0] === level && previous[1] === ownerColor && previous[2] === buildingType) return;
    const vacantLot = this.vacantLotMeshes.get(tileIndex);
    if (vacantLot) vacantLot.visible = level === 0 && ownerColor === null;
    if (this.buildingMeshes.has(tileIndex)) {
      const oldGroup = this.buildingMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldGroup);
      this.disposeObject(oldGroup);
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
    if (this.activeMapDefinition?.id==='grand-bay' && quayLot(tileIndex) && ownerColor!=null) {
      // In local space +Z faces the road after the residence is oriented.
      group.rotation.y=facingRoad(tile);
      const doorstep=new THREE.Mesh(new THREE.BoxGeometry(2.85,.13,.49),new THREE.MeshStandardMaterial({color:ownerColor}));
      doorstep.position.set(0,.16,1.65);group.add(doorstep);
      for(const side of [-1,1]){
        const gate=new THREE.Mesh(new THREE.BoxGeometry(.27,.75,.27),doorstep.material);
        gate.position.set(side*1.26,.42,1.65);group.add(gate);
      }
    }
    group.userData.propertyVisual = [level, ownerColor, buildingType];
    if(tile?.lot?.position && ownerColor!=null){
      const trim=new THREE.MeshStandardMaterial({color:ownerColor,roughness:.78});
      const marker=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),trim,4);
      const stamp=new THREE.Object3D();
      for(const [i,[x,z,w,d]] of [[-1.36,1.56,.56,.21],[1.36,1.56,.56,.21],[-1.55,.92,.18,1.36],[1.55,.92,.18,1.36]].entries()){
        stamp.position.set(x,-.11,z);stamp.scale.set(w,.25,d);stamp.updateMatrix();marker.setMatrixAt(i,stamp.matrix);
      }
      marker.userData.isOwnerBeacon=true;
      group.add(marker);
    }
    const originalDistrict = isCivicHome(this.activeMapDefinition,tile,buildingType) ? 'civic'
      : isOldTownHome(this.activeMapDefinition,tile,buildingType) ? 'market'
        : isHarborHome(this.activeMapDefinition,tile,buildingType) ? 'harbor' : null;
    const district = originalDistrict || 'garden';
    const shopModel = {MALL: `commerce_mall_${level}`, PARK: `commerce_park_${level}`, HOTEL:'board_hotel', GAS_STATION:'board_gas_station', LAB:'board_lab'}[buildingType];
    const originalHome = shopModel ? this.harborArt?.clone(shopModel)
      : level > 0 && this.harborArt?.residence(level,district);
    if (originalHome) {
      if (tile?.lot?.position && tile.position) group.rotation.y = facingRoad(tile);
      group.add(finishRoofs(originalHome,this.activeMapDefinition.id));
      group.userData.rotor = originalHome.getObjectByName('radar_rotor') || originalHome.getObjectByName('lobby_door');

      if (buildingType === 'PARK') {
        const fountain = this.harborArt.clone('board_fountain');
        if (fountain) { fountain.position.set(.52,.22,.22); fountain.scale.setScalar(.78); group.add(fountain); }
      }
      this.addBuildingOwnerLighting(group, ownerColor, tile?.large);
      group.userData.originalModel = originalHome.name;
      this.scene3D.scene.add(group);
      this.buildingMeshes.set(tileIndex, group);
      if (purchased) markPurchase(this.scene3D.scene,tilePos,group,ownerColor);
      if (purchased || (!refresh && previous && previous[0] !== level)) animateBuildingChange(group,previous?.[0] ?? -1,level,this.scene3D);
      return;
    }

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

    if (tile?.large && ownerColor !== null && buildingType === 'PARK') {
      const lawn = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.16, 20), new THREE.MeshStandardMaterial({ color: '#22c55e' }));
      lawn.position.y = 0.08;
      group.add(lawn);
      [[-0.9, -0.5], [0.85, -0.45], [0, 0.75]].forEach(([x, z]) => {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.75, 8), new THREE.MeshStandardMaterial({ color: '#92400e' }));
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 10), new THREE.MeshStandardMaterial({ color: '#15803d' }));
        trunk.position.set(x, 0.4, z); crown.position.set(x, 1.15, z); group.add(trunk, crown);
      });
    } else if (tile?.large && ownerColor !== null && buildingType === 'GAS_STATION') {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.28, 2.7), roofMat);
      canopy.position.y = 1.8;
      group.add(canopy);
      [-1.25, 1.25].forEach(x => {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.1, 0.55), new THREE.MeshStandardMaterial({ color: '#f8fafc' }));
        pump.position.set(x, 0.55, 0); group.add(pump);
      });
    } else if (tile?.large && ownerColor !== null) {
      const visual = {
        MALL: { color: '#38bdf8', height: 1 }, HOTEL: { color: '#f472b6', height: 1.55 }, LAB: { color: '#a78bfa', height: 1.25 }
      }[buildingType] || { color: '#38bdf8', height: 1 };
      glassMat.color.set(visual.color);
      const height = (1.2 + Math.max(1, level) * 0.75) * visual.height;
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
      if (buildingType === 'LAB') {
        const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), new THREE.MeshStandardMaterial({ color: '#e9d5ff' }));
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
        antenna.position.y = height + 0.75; orb.position.y = height + 1.38; group.add(antenna, orb);
      }
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
      for (const side of [-1,1]) {
        for (const z of [-1.15,0,1.15]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(.12,.48,.12),roofMat);
          post.position.set(side*1.3,.24,z); group.add(post);
        }
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.08,.10,2.4),roofMat);
        rail.position.set(side*1.3,.32,0); group.add(rail);
      }
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

    if (level > 0) {
      this.addBuildingOwnerLighting(group, ownerColor, tile?.large);
      this.addBuildingWindows(group, level);

    }

    this.scene3D.scene.add(group);
    this.buildingMeshes.set(tileIndex, group);
    if (purchased) markPurchase(this.scene3D.scene,tilePos,group,ownerColor);

    group.scale.setScalar(1);
    if (purchased || (!refresh && previous && previous[0] !== level)) animateBuildingChange(group,previous?.[0] ?? -1,level,this.scene3D);
  }

  addBuildingOwnerLighting(group, ownerColor, large = false) {
    const accent = new THREE.Color(ownerColor ?? 0xffaa00);
    const sizeX = large ? 4.45 : 3.05;
    const sizeZ = large ? 3.5 : 3.05;
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(sizeX, .14, sizeZ),
      new THREE.MeshStandardMaterial({
        color: '#0a1a28', roughness: .34, metalness: .42,
        emissive: accent, emissiveIntensity: .5
      })
    );
    foundation.position.y = .07;
    foundation.userData.isOwnerLight = true;
    group.add(foundation);
    const beaconMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .8 });
    [[-sizeX * .43, -sizeZ * .43], [sizeX * .43, -sizeZ * .43], [-sizeX * .43, sizeZ * .43], [sizeX * .43, sizeZ * .43]].forEach(([x, z]) => {
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .72, 6), beaconMaterial);
      beacon.position.set(x, .42, z);
      beacon.userData.isOwnerBeacon = true;
      group.add(beacon);
    });
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

  syncStreetLinks(state) {
    if (this.streetBands) {
      this.streetBands.removeFromParent();
      this.disposeObject(this.streetBands);
    }
    const group = new THREE.Group();
    const manager=state.propertyManager;
    for(const [id, others] of manager.streetLinks) {
      const lot=manager.getProperty(id);
      if(lot?.owner==null || lot.isMortgaged) continue;
      for(const other of others) {
        const neighbor=manager.getProperty(other);
        if(other<=id || neighbor?.owner!==lot.owner || neighbor.isMortgaged) continue;
        const a=this.buildingMeshes.get(id)?.position,b=this.buildingMeshes.get(other)?.position;
        if(!a || !b) continue;
        const color=state.players[lot.owner].colorHex;
        const band=new THREE.Mesh(new THREE.BoxGeometry(.22,.06,a.distanceTo(b)),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.8}));
        band.position.copy(a).lerp(b,.5);band.position.y+=.12;
        band.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
        group.add(band);
      }
    }
    this.streetBands=group;
    this.scene3D.scene.add(group);
  }

  createRoadToken(kind, position) {
    const model = this.harborArt?.clone('token_'+kind);
    if (!model || !position) return null;
    const group = new THREE.Group();
    group.userData.token = kind;
    group.userData.lamps = [];
    model.traverse(child=>{
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) if (mat?.name === 'lamp') {
        mat.emissive.set('#ff492b');
        group.userData.lamps.push(mat);
      }
    });
    group.add(model);
    group.position.copy(position);
    group.position.y += .18;
    group.rotation.y = .3;
    return group;
  }

  showClearingRobot(tileId) {
    const group = this.createRoadToken('robot',this.tilePositions[tileId]);
    if (!group) return;
    const scene = this.scene3D.scene;
    scene.add(group);
    const start = performance.now(), x = group.position.x, y = group.position.y;
    const map = this.activeMapDefinition;
    const move = now => {
      const t = Math.min(1,(now-start)/860);
      if (!this.motionPreference.matches) {
        group.position.x = x - 1.3 + 1.6*t;
        group.position.y = y + .13*Math.abs(Math.sin(t*16));
        group.rotation.z = .07*Math.sin(t*16);
      }
      if (t<1 && map===this.activeMapDefinition) requestAnimationFrame(move);
      else { scene.remove(group); this.disposeObject(group); }
    };
    move(start);
  }

  setObstacleMesh(tileIndex, hasObstacle) {
    if (hasObstacle && this.obstacleMeshes.get(tileIndex)?.userData.token) return;
    if (this.obstacleMeshes.has(tileIndex)) {
      const oldMesh = this.obstacleMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldMesh);
      this.disposeObject(oldMesh);
      this.obstacleMeshes.delete(tileIndex);
    }

    if (!hasObstacle) return;

    const tilePos = this.tilePositions[tileIndex];
    const token = this.createRoadToken('barrier',tilePos);
    if (token) {
      this.scene3D.scene.add(token);
      this.obstacleMeshes.set(tileIndex,token);
      return;
    }
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
    if (hasMine && this.mineMeshes.get(tileIndex)?.userData.token) return;
    if (this.mineMeshes?.has(tileIndex)) {
      const oldMesh = this.mineMeshes.get(tileIndex);
      this.scene3D.scene.remove(oldMesh);
      this.disposeObject(oldMesh);
      this.mineMeshes.delete(tileIndex);
    }
    if (!hasMine) return;

    const tilePos = this.tilePositions[tileIndex];
    const token = this.createRoadToken('mine',tilePos);
    if (token) {
      this.scene3D.scene.add(token);
      this.mineMeshes.set(tileIndex,token);
      return;
    }
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

  setRoadEntityMesh(tileIndex, entity = null) {
    const previous = this.roadEntityMeshes.get(tileIndex);
    if (entity?.type === 'TIME_BOMB' && previous?.userData.token && previous.userData.entity.id === entity.id) {
      previous.userData.entity = entity;
      return;
    }
    if (previous) {
      this.scene3D.scene.remove(previous);
      this.disposeObject(previous);
      this.roadEntityMeshes.delete(tileIndex);
    }
    if (!entity || ['BARRIER', 'MINE'].includes(entity.type)) return;
    const tilePos = this.tilePositions[tileIndex];
    if (!tilePos) return;
    if (entity.type === 'TIME_BOMB') {
      const token = this.createRoadToken('timer',tilePos);
      if (token) {
        token.userData.entity = entity;
        this.scene3D.scene.add(token);
        this.roadEntityMeshes.set(tileIndex,token);
        return;
      }
    }
    const palettes = {
      TIME_BOMB: ['#111827', '#f59e0b'], GIFT_BOX: ['#ef4444', '#fde047'],
      COUPON_CHEST: ['#7c3aed', '#fbbf24'], DOG: ['#92400e', '#fef3c7'],
      GOD: ['#38bdf8', '#ffffff'], NPC: ['#14b8a6', '#ccfbf1']
    };
    const [primary, accent] = palettes[entity.type] || ['#64748b', '#f8fafc'];
    const group = new THREE.Group();
    group.position.set(tilePos.x + 0.9, tilePos.y + 0.55, tilePos.z + 0.9);
    const body = new THREE.Mesh(
      entity.type === 'TIME_BOMB' ? new THREE.SphereGeometry(0.45, 14, 12) : new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: primary, roughness: 0.35, emissive: accent, emissiveIntensity: 0.12 })
    );
    body.position.y = 0.4;
    body.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), new THREE.MeshBasicMaterial({ color: accent }));
    cap.position.y = 1.0;
    group.add(body, cap);
    this.scene3D.scene.add(group);
    group.userData.entity = entity;
    this.roadEntityMeshes.set(tileIndex, group);
  }
}
