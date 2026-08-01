import { COLOR_GROUPS, TileType, isPropertyTile } from '../game/BoardData.js';

export class MinimapUI {
  constructor(scene3D, gameState) {
    this.scene3D = scene3D;
    this.gameState = gameState;
    this.panel = document.getElementById('minimap-panel');
    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.mapDefinition = null;
    this.lastRender = 0;
    this.routeChoices = [];
    this.canvas?.addEventListener('pointerdown', event => this.handlePointer(event));
    this.scene3D.addUpdatable({
      update: () => {
        const now = performance.now();
        if (now - this.lastRender > 180) {
          this.render();
          this.lastRender = now;
        }
      }
    });
  }

  setMap(mapDefinition) {
    this.mapDefinition = mapDefinition;
    if (this.canvas) this.canvas.dataset.nodeCount = String(mapDefinition?.tiles?.length || 0);
    this.routeChoices = [];
    this.render();
  }

  setRouteChoices(tileIds = []) {
    this.routeChoices = [...tileIds];
    this.render();
  }

  toggle() {
    this.panel?.classList.toggle('minimized');
  }

  getBounds() {
    if (this.mapDefinition?.bounds) return this.mapDefinition.bounds;
    const positions = this.mapDefinition?.tiles.map(tile => tile.position).filter(Boolean) || [];
    return {
      minX: Math.min(...positions.map(position => position.x), -20),
      maxX: Math.max(...positions.map(position => position.x), 20),
      minZ: Math.min(...positions.map(position => position.z), -20),
      maxZ: Math.max(...positions.map(position => position.z), 20)
    };
  }

  project(position) {
    const bounds = this.getBounds();
    const padding = 12;
    return {
      x: padding + ((position.x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * (this.canvas.width - padding * 2),
      y: padding + ((position.z - bounds.minZ) / (bounds.maxZ - bounds.minZ || 1)) * (this.canvas.height - padding * 2)
    };
  }

  unproject(x, y) {
    const bounds = this.getBounds();
    const padding = 12;
    return {
      x: bounds.minX + ((x - padding) / (this.canvas.width - padding * 2)) * (bounds.maxX - bounds.minX),
      z: bounds.minZ + ((y - padding) / (this.canvas.height - padding * 2)) * (bounds.maxZ - bounds.minZ)
    };
  }

  handlePointer(event) {
    if (!this.canvas || !this.mapDefinition) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
    const point = this.unproject(x, y);
    this.scene3D.panToMapPoint(point.x, point.z);
  }

  render() {
    if (!this.ctx || !this.canvas || !this.mapDefinition) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#18334b');
    gradient.addColorStop(1, '#162139');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#788694';
    ctx.lineWidth = this.mapDefinition.theme === 'GRAND_BAY' ? 5 : 4;
    this.mapDefinition.tiles.forEach(tile => {
      const start = this.project(tile.position);
      (tile.next || []).forEach(nextId => {
        const next = this.mapDefinition.tiles.find(item => item.id === nextId);
        if (!next) return;
        const end = this.project(next.position);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
    });

    const choiceSet = new Set(this.routeChoices);
    this.mapDefinition.tiles.forEach(tile => {
      const point = this.project(tile.position);
      const property = this.gameState.propertyManager?.getProperty(tile.id);
      const owner = property?.owner === null || property?.owner === undefined ? null : this.gameState.players[property.owner];
      ctx.beginPath();
      ctx.arc(point.x, point.y, choiceSet.has(tile.id) ? 5 : isPropertyTile(tile) ? 3.4 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = choiceSet.has(tile.id)
        ? '#00f0ff'
        : owner?.color || COLOR_GROUPS[tile.group]?.color || (tile.type === TileType.ROAD ? '#adb7c2' : '#ffd166');
      ctx.fill();
    });

    this.gameState.players?.forEach(player => {
      if (player.isBankrupt) return;
      const tile = this.mapDefinition.tiles.find(item => item.id === player.currentTile);
      if (!tile) return;
      const point = this.project(tile.position);
      ctx.beginPath();
      ctx.arc(point.x, point.y, player.id === this.gameState.currentPlayerIndex ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
}
