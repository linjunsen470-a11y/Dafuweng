import * as THREE from 'three';

function createChevronGeometry() {
  const shape = new THREE.Shape();
  // rotateX(-PI/2) maps 2D (x, y) to 3D (x, 0, -y), so negative Y points along +Z (forward).
  shape.moveTo(0, -0.56);
  shape.lineTo(0.46, 0.06);
  shape.lineTo(0.27, 0.22);
  shape.lineTo(0, -0.16);
  shape.lineTo(-0.27, 0.22);
  shape.lineTo(-0.46, 0.06);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Adds high-contrast Richman-4 style directional chevrons, crisp roadside edge lines,
// and clear junction medallions using instanced meshes so draw calls stay minimal.
export function addPathFlowGuides(group, map, width) {
  const tiles = new Map(map.tiles.map(tile => [tile.id, tile]));
  const directedEdges = [];
  const undirectedEdges = [];
  const seenUndirected = new Set();

  for (const tile of map.tiles) {
    if (!tile.position) continue;
    for (const nextId of tile.next || []) {
      const next = tiles.get(nextId);
      if (!next?.position) continue;
      const dx = next.position.x - tile.position.x;
      const dz = next.position.z - tile.position.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      directedEdges.push({ from: tile, to: next, dx, dz, length, angle: Math.atan2(dx, dz) });
      const edgeKey = Math.min(tile.id, nextId) + ':' + Math.max(tile.id, nextId);
      if (!seenUndirected.has(edgeKey)) {
        seenUndirected.add(edgeKey);
        undirectedEdges.push({ from: tile, to: next, dx, dz, length, angle: Math.atan2(dx, dz) });
      }
    }
  }

  if (!directedEdges.length) return;

  // 1. Crisp warm-cream inner curb highlight stripes along both sides of the cobblestone boulevard.
  const stripeGeo = new THREE.BoxGeometry(0.16, 0.03, 1);
  const stripeMat = new THREE.MeshBasicMaterial({ color: '#fff8e2' });
  const stripes = new THREE.InstancedMesh(stripeGeo, stripeMat, undirectedEdges.length * 2);
  stripes.name = 'road-edge-stripes';
  const dummy = new THREE.Object3D();
  const halfOffset = Math.max(0.9, width * 0.46);
  let idx = 0;
  for (const edge of undirectedEdges) {
    const cx = edge.from.position.x + edge.dx * 0.5;
    const cz = edge.from.position.z + edge.dz * 0.5;
    const nx = -edge.dz / edge.length;
    const nz = edge.dx / edge.length;
    for (const side of [-1, 1]) {
      dummy.position.set(cx + nx * halfOffset * side, 0.212, cz + nz * halfOffset * side);
      dummy.rotation.set(0, edge.angle, 0);
      dummy.scale.set(1, 1, edge.length + 0.18);
      dummy.updateMatrix();
      stripes.setMatrixAt(idx++, dummy.matrix);
    }
  }
  stripes.instanceMatrix.needsUpdate = true;
  group.add(stripes);

  // 2. Bold sunset-amber directional chevrons so route flow pops clearly on bright warm cobblestones.
  const chevronPositions = [];
  for (const edge of directedEdges) {
    const isFork = (edge.from.next || []).length > 1;
    const steps = isFork ? [0.42, 0.62] : [0.5];
    for (const t of steps) {
      chevronPositions.push({
        x: edge.from.position.x + edge.dx * t,
        z: edge.from.position.z + edge.dz * t,
        angle: edge.angle,
        scale: isFork ? 1.04 : 0.78,
        isFork
      });
    }
  }

  if (chevronPositions.length) {
    const chevronGeo = createChevronGeometry();
    const chevronMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const chevrons = new THREE.InstancedMesh(chevronGeo, chevronMat, chevronPositions.length);
    chevrons.name = 'road-flow-chevrons';
    const normalTint = new THREE.Color('#d95f18');
    const forkTint = new THREE.Color('#e63946');
    chevronPositions.forEach((item, i) => {
      dummy.position.set(item.x, 0.236, item.z);
      dummy.rotation.set(0, item.angle, 0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      chevrons.setMatrixAt(i, dummy.matrix);
      chevrons.setColorAt(i, item.isFork ? forkTint : normalTint);
    });
    chevrons.instanceMatrix.needsUpdate = true;
    if (chevrons.instanceColor) chevrons.instanceColor.needsUpdate = true;
    group.add(chevrons);
  }

  // 3. Prominent sunset-gold junction rings at every fork node to spotlight route branches.
  const forks = map.tiles.filter(tile => tile.position && (tile.next || []).length > 1);
  if (forks.length) {
    const ringGeo = new THREE.RingGeometry(width * 0.45, width * 0.59, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ff6b1a', side: THREE.DoubleSide });
    const rings = new THREE.InstancedMesh(ringGeo, ringMat, forks.length);
    rings.name = 'road-fork-rings';
    forks.forEach((tile, i) => {
      dummy.position.set(tile.position.x, 0.242, tile.position.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
    });
    rings.instanceMatrix.needsUpdate = true;
    group.add(rings);
  }

  // 4. Classic Richman-4 celebratory golden archway spanning the START tile.
  const startTile = map.tiles.find(t => t.type === 'START' && t.position);
  const nextStart = startTile && tiles.get(startTile.next?.[0]);
  if (startTile?.position && nextStart?.position) {
    const arch = createStartArchway(width);
    arch.position.set(startTile.position.x, 0.2, startTile.position.z);
    arch.rotation.y = Math.atan2(nextStart.position.x - startTile.position.x, nextStart.position.z - startTile.position.z);
    group.add(arch);
  }
}

function createStartArchway(roadWidth) {
  const group = new THREE.Group();
  group.name = 'road-start-arch';
  const span = roadWidth * 0.58;
  const redMat = new THREE.MeshStandardMaterial({ color: '#e53935', roughness: 0.35, metalness: 0.08 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffca28', roughness: 0.26, metalness: 0.55 });
  const creamMat = new THREE.MeshStandardMaterial({ color: '#fff8e1', roughness: 0.42 });

  for (const side of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.45, 10), creamMat);
    base.position.set(side * span, 0.22, 0);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.7, 10), redMat);
    pillar.position.set(side * span, 1.7, 0);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), goldMat);
    cap.position.set(side * span, 3.12, 0);
    group.add(base, pillar, cap);
  }
  const archBar = new THREE.Mesh(new THREE.TorusGeometry(span, 0.16, 10, 24, Math.PI), goldMat);
  archBar.position.set(0, 3.05, 0);
  const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), redMat);
  crest.position.set(0, 3.05 + span + 0.28, 0);
  group.add(archBar, crest);
  return group;
}

// Builds a vivid Richman-4 style linked street ribbon connecting adjacent owned lots.
export function createStreetLinkRibbon(a, b, ownerColor) {
  const group = new THREE.Group();
  const dist = a.distanceTo(b);
  const angle = Math.atan2(b.x - a.x, b.z - a.z);
  const mid = a.clone().lerp(b, 0.5);

  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.06, dist),
    new THREE.MeshBasicMaterial({ color: '#fff6d1', transparent: true, opacity: 0.94 })
  );
  backing.position.set(mid.x, mid.y + 0.09, mid.z);
  backing.rotation.y = angle;

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, dist),
    new THREE.MeshBasicMaterial({ color: ownerColor, transparent: true, opacity: 0.96 })
  );
  core.position.set(mid.x, mid.y + 0.11, mid.z);
  core.rotation.y = angle;

  group.add(backing, core);
  return group;
}
