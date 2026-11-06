import * as THREE from 'three';
import {isPropertyTile} from '../game/BoardData.js';
import {rentAbility} from './CharacterAbilityFeedback.js';

const money=value=>`$${Math.max(0,Math.round(Number(value)||0)).toLocaleString()}`;
export function describeMapTile(state, engine, id) {
  const tile=state.getTile(id),player=state.getCurrentPlayer();
  if(!tile||!player)return null;
  const property=state.propertyManager.getProperty(id),owner=state.players.find(p=>p.id===property?.owner);
  const lines=[];
  if(isPropertyTile(tile)){
    lines.push(owner?`${owner.name} · LV ${property.level}${owner.id===player.id?' · 本人地产':''}`:'无主地产');
    if(state.gameMode==='HEAT')lines.push('热斗模式：此格按补给规则结算，不使用标准购租报价');
    else if(state.gameMode==='TEAM'&&owner&&owner.id!==player.id&&owner.teamId===player.teamId)lines.push('队友地产 · 停留不付租金');
    else if(property?.isMortgaged)lines.push('已抵押 · 暂不收租');
    else if(owner){
      const rent=Math.round(state.propertyManager.calculateToll(id,state.newsEffect,state.priceIndex,player)*rentAbility(owner).multiplier);
      lines.push(`当前租金牌价 ${money(rent)}（非最终实收）`);
      if(owner.id!==player.id&&(player.godType==='GREAT_FORTUNE'||player.rentShieldActiveThisTurn))lines.push('当前有免租效果；落地时仍有效则免租。');
      else if(owner.id!==player.id&&player.godType)lines.push('当前附身状态可能改变费用；途中状态也可能变化。');
      lines.push(owner.id===player.id?'自己停留不付租金':'牌价含地产及地主加成；最终按落地时的免租、神明、技能与保险结算。');
    }else lines.push(`当前默认购价 ${money(engine.getPropertyActionCost(player,id,'BUY'))}`);
  }else lines.push(tile.desc||tile.name);
  const road=state.roadEntities?.find(e=>e.tileId===id&&!e.data?.attachedPlayerId);
  if(property?.hasObstacle||road?.type==='BARRIER')lines.push('🚧 路障：进入即截停，自己也会触发');
  if(property?.hasMine||road?.type==='MINE')lines.push('💥 地雷：进入有住院风险');
  if(road?.type==='TIME_BOMB')lines.push('⏱️ 定时炸弹：进入会附身');
  const links=state.mapRuntime.getNextOptions(id,player.direction||1).map(next=>({id:next,name:state.getTile(next)?.name||`${next}号格`}));
  return {title:`${id} · ${tile.name}`,lines,links,direction:player.direction===-1?'逆向':'正向',color:owner?.color||'#67e8f9'};
}

export class MapInspector {
  constructor(scene,board,state,engine){
    this.scene=scene;this.board=board;this.state=state;this.engine=engine;this.isOpen=false;this.selected=null;
    this.button=document.getElementById('btn-inspect-map');
    this.panel=document.createElement('section');this.panel.id='map-inspector';this.panel.className='map-inspector hidden';this.panel.setAttribute('aria-label','地图地块详情');
    this.panel.innerHTML='<header><strong>查地 · 只查看，不移动</strong><button id="map-inspector-close" type="button" aria-label="关闭查地">关闭</button></header><label>点选棋盘格或选择地块<select id="map-inspector-select" aria-label="查看地块"></select></label><div class="map-inspector-body"></div>';
    document.getElementById('hud-layer').appendChild(this.panel);
    this.select=this.panel.querySelector('select');this.body=this.panel.querySelector('.map-inspector-body');
    this.button.addEventListener('click',()=>this.isOpen?this.close():this.open());
    this.panel.querySelector('button').addEventListener('click',()=>this.close(true));
    this.select.addEventListener('change',()=>this.choose(Number(this.select.value),true));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.isOpen){e.preventDefault();this.close(true);}});
    this.marker=new THREE.Mesh(new THREE.RingGeometry(1.35,1.65,32),new THREE.MeshBasicMaterial({color:'#fff1a6',side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.8}));
    this.marker.rotation.x=-Math.PI/2;this.marker.renderOrder=25;this.marker.visible=false;scene.scene.add(this.marker);
    const canvas=scene.renderer.domElement;let down=null;
    canvas.addEventListener('pointerdown',e=>{down=this.isOpen?{x:e.clientX,y:e.clientY}:null;});
    canvas.addEventListener('pointerup',e=>{
      if(!this.isOpen||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;
      down=null;const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),scene.camera);
      const hit=ray.intersectObjects(board.tileMeshes.filter(Boolean),false)[0];
      if(hit)this.choose(hit.object.userData.tileData.id,false);
    });
    canvas.addEventListener('pointercancel',()=>{down=null;});
    let last=0;scene.addUpdatable({update:()=>{if(performance.now()-last<200)return;last=performance.now();this.button.disabled=!this.canInspect();if(this.isOpen){if(!this.canInspect())this.close();else this.refresh();}}});
  }
  canInspect(){return this.state.phase==='PRE_ROLL_ACTION'&&!this.state.getCurrentPlayer()?.isAI;}
  open(){
    if(!this.canInspect())return;
    this.select.replaceChildren(...this.state.mapDefinition.tiles.map(tile=>{const option=document.createElement('option');option.value=tile.id;option.textContent=`${tile.id} · ${tile.name}`;return option;}));
    this.isOpen=true;this.panel.classList.remove('hidden');this.button.setAttribute('aria-pressed','true');this.choose(this.state.getCurrentPlayer().currentTile,false);this.select.focus();
  }
  close(focus=false){this.isOpen=false;this.panel.classList.add('hidden');this.marker.visible=false;this.button.setAttribute('aria-pressed','false');if(focus)document.getElementById('btn-roll').focus();}
  choose(id,pan){if(!this.state.getTile(id))return;this.selected=id;this.select.value=String(id);this.lastModel=null;const position=this.board.tilePositions[id];if(position){this.marker.position.copy(position);this.marker.position.y+=.12;this.marker.visible=true;if(pan)this.scene.panToMapPoint(position.x,position.z);}this.refresh();}
  refresh(){
    const dock=document.querySelector('.control-panel');
    if(dock)this.panel.style.bottom=`${Math.max(12,innerHeight-dock.getBoundingClientRect().top+12)}px`;
    const model=describeMapTile(this.state,this.engine,this.selected);if(!model)return;
    const key=JSON.stringify(model);if(key===this.lastModel)return;this.lastModel=key;this.panel.style.setProperty('--inspection-owner',model.color);
    const title=document.createElement('h3');title.textContent=model.title;const rows=model.lines.map(line=>{const p=document.createElement('p');p.textContent=line;return p;});
    const note=document.createElement('p');note.className='inspection-path-note';note.textContent=`从此格继续（${model.direction}）· 点击仅查看`;
    const nav=document.createElement('nav');nav.setAttribute('aria-label','相邻路线');model.links.forEach(link=>{const b=document.createElement('button');b.type='button';b.textContent=`→ ${link.id} · ${link.name}`;b.onclick=()=>this.choose(link.id,true);nav.appendChild(b);});
    this.body.replaceChildren(title,...rows,note,nav);
  }
}
