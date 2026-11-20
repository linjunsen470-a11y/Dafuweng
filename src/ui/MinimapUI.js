import {quayRoutes} from '../game/QuayRoutes.js';
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
    this.tilesById=new Map((mapDefinition?.tiles || []).map(tile=>[tile.id,tile]));
    this.bounds=this.getBounds();
    const title=this.panel?.querySelector('.minimap-header span');
    if(title)title.textContent=mapDefinition?.name || '地图导航';
    this.backdrop=this.canvas && mapDefinition ? this.drawBackdrop() : null;
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
    const bounds = this.bounds || this.getBounds();
    const padding = 12;
    return {
      x: padding + ((position.x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * (this.canvas.width - padding * 2),
      y: padding + ((position.z - bounds.minZ) / (bounds.maxZ - bounds.minZ || 1)) * (this.canvas.height - padding * 2)
    };
  }

  unproject(x, y) {
    const bounds = this.bounds || this.getBounds();
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

  // Cache the printed map. Only ownership, route choices and pawns change during a turn.
  drawBackdrop() {
    const paper=document.createElement('canvas');
    paper.width=this.canvas.width;paper.height=this.canvas.height;
    const ctx=paper.getContext('2d');
    const [margin,land]=({
      'grand-bay':['#99c9c4','#dfd19c'], 'island-fork':['#9acbc8','#dccc9b'],
      'city-loop':['#d9cabc','#eee1c9'], 'taiwan-loop':['#a4c7af','#e0d49c'],
      'fortune-crossroads':['#afc8a3','#e2d4a1']
    })[this.mapDefinition.id] || ['#c9ceae','#e5d7ac'];
    ctx.fillStyle=margin;ctx.fillRect(0,0,paper.width,paper.height);
    const visited=new Set();
    let tile=this.mapDefinition.tiles[0];
    ctx.beginPath();
    while(tile && !visited.has(tile.id)){
      const p=this.project(tile.position);
      if(visited.size)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
      visited.add(tile.id);tile=this.tilesById.get(tile.next?.[0]);
    }
    ctx.closePath();ctx.fillStyle=land;ctx.fill();
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    for(const t of this.mapDefinition.tiles){
      const a=this.project(t.position);
      for(const id of t.next || []){
        const next=this.tilesById.get(id);
        if(!next)continue;
        const b=this.project(next.position);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
      }
    }
    ctx.lineWidth=7;ctx.strokeStyle='#656153';ctx.stroke();
    ctx.lineWidth=3.5;ctx.strokeStyle='#fff0c6';ctx.stroke();
    if (this.mapDefinition.id === 'grand-bay') {
      for (const {ids,color} of Object.values(quayRoutes)) {
        ctx.strokeStyle=color;
        ctx.lineWidth=4;
        ctx.beginPath();
        ids.forEach((id,index)=>{
          const point=this.project(this.tilesById.get(id).position);
          if(index===0)ctx.moveTo(point.x,point.y);
          else ctx.lineTo(point.x,point.y);
        });
        ctx.stroke();
      }
      const join=this.project(this.mapDefinition.tiles[24].position);
      ctx.strokeStyle='#ffdf8f';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(join.x,join.y,6,0,Math.PI*2);ctx.stroke();
    }

    return paper;
  }

  render() {
    if(!this.ctx || !this.backdrop || !this.mapDefinition)return;
    const ctx=this.ctx;
    ctx.drawImage(this.backdrop,0,0);
    const choiceSet = new Set(this.routeChoices);
    this.mapDefinition.tiles.forEach(tile => {
      const point = this.project(tile.position);
      const property = this.gameState.propertyManager?.getProperty(tile.id);
      const owner = property?.owner === null || property?.owner === undefined ? null : this.gameState.players[property.owner];
      ctx.beginPath();
      ctx.arc(point.x, point.y, choiceSet.has(tile.id) ? 7 : isPropertyTile(tile) ? 3.6 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = choiceSet.has(tile.id)
        ? '#12747a'
        : owner?.color || COLOR_GROUPS[tile.group]?.color || (tile.type === TileType.ROAD ? '#adb7c2' : '#ffd166');
      ctx.fill();
    });

    const current=this.gameState.currentPlayerIndex;
    const players=this.gameState.players || [];
    [...players.filter(p=>p.id!==current),...players.filter(p=>p.id===current)].forEach(player => {
      if (player.isBankrupt) return;
      const tile = this.tilesById.get(player.currentTile);
      if (!tile) return;
      const point = this.project(tile.position);
      ctx.beginPath();
      ctx.arc(point.x, point.y, player.id === current ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = player.id===current ? 3 : 1.5;
      ctx.stroke();
      if(player.id===current){ctx.beginPath();ctx.arc(point.x,point.y,10,0,Math.PI*2);ctx.strokeStyle='#573c35';ctx.lineWidth=2;ctx.stroke();}
    });
  }
}
