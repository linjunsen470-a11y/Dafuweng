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

  // 1. Crisp double warm-white roadside curb stripes along both edges of every segment.
  const stripeGeo = new THREE.BoxGeometry(0.14, 0.025, 1);
  const stripeMat = new THREE.MeshBasicMaterial({ color: '#fff6da' });
  const stripes = new THREE.InstancedMesh(stripeGeo, stripeMat, undirectedEdges.length * 2);
  stripes.name = 'road-edge-stripes';
  const dummy = new THREE.Object3D();
  const halfOffset = Math.max(0.9, width * 0.44);
  let idx = 0;
  for (const edge of undirectedEdges) {
    const cx = edge.from.position.x + edge.dx * 0.5;
    const cz = edge.from.position.z + edge.dz * 0.5;
    const nx = -edge.dz / edge.length;
    const nz = edge.dx / edge.length;
    for (const side of [-1, 1]) {
      dummy.position.set(cx + nx * halfOffset * side, 0.208, cz + nz * halfOffset * side);
      dummy.rotation.set(0, edge.angle, 0);
      dummy.scale.set(1, 1, edge.length + 0.16);
      dummy.updateMatrix();
      stripes.setMatrixAt(idx++, dummy.matrix);
    }
  }
  stripes.instanceMatrix.needsUpdate = true;
  group.add(stripes);

  // 2. Forward-pointing directional chevrons so players read route flow at a glance.
  const chevronPositions = [];
  for (const edge of directedEdges) {
    const isFork = (edge.from.next || []).length > 1;
    const steps = isFork ? [0.42, 0.62] : [0.5];
    for (const t of steps) {
      chevronPositions.push({
        x: edge.from.position.x + edge.dx * t,
        z: edge.from.position.z + edge.dz * t,
        angle: edge.angle,
        scale: isFork ? 0.96 : 0.72,
        isFork
      });
    }
  }

  if (chevronPositions.length) {
    const chevronGeo = createChevronGeometry();
    const chevronMat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    const chevrons = new THREE.InstancedMesh(chevronGeo, chevronMat, chevronPositions.length);
    chevrons.name = 'road-flow-chevrons';
    const normalTint = new THREE.Color('#fff1bd');
    const forkTint = new THREE.Color('#ffcf33');
    chevronPositions.forEach((item, i) => {
      dummy.position.set(item.x, 0.232, item.z);
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

  // 3. Prominent gold junction rings at every fork node to spotlight route branches.
  const forks = map.tiles.filter(tile => tile.position && (tile.next || []).length > 1);
  if (forks.length) {
    const ringGeo = new THREE.RingGeometry(width * 0.44, width * 0.56, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd447', side: THREE.DoubleSide });
    const rings = new THREE.InstancedMesh(ringGeo, ringMat, forks.length);
    rings.name = 'road-fork-rings';
    forks.forEach((tile, i) => {
      dummy.position.set(tile.position.x, 0.238, tile.position.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
    });
    rings.instanceMatrix.needsUpdate = true;
    group.add(rings);
  }
}

// Builds a vivid Richman-4 style linked street ribbon connecting adjacent owned lots.
export function createStreetLinkRibbon(a, b, ownerColor) {
  const group = new THREE.Group();
  const dist = a.distanceTo(b);
  const angle = Math.atan2(b.x - a.x, b.z - a.z);
  const mid = a.clone().lerp(b, 0.5);

  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.055, dist),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.92 })
  );
  backing.position.set(mid.x, mid.y + 0.09, mid.z);
  backing.rotation.y = angle;

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.07, dist),
    new THREE.MeshBasicMaterial({ color: ownerColor, transparent: true, opacity: 0.95 })
  );
  core.position.set(mid.x, mid.y + 0.11, mid.z);
  core.rotation.y = angle;

  group.add(backing, core);
  return group;
}
