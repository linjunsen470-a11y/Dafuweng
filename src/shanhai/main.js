import {movementStopText} from './SliceMovementFeedback.js';
import {debtReceipt} from './SliceDebtReceipt.js';
import {fenceCounterplay} from './SliceCounterplay.js';
import {seasonReport} from './SliceSeasonReport.js';
import {roleGuide} from './SliceRoleGuide.js';
import {mountainMapNote} from './SliceMapNote.js';
import {CONSTRUCTION_ROUND,CONSTRUCTION_FEE} from './SliceConstruction.js';
import {tacticBoardView} from './SliceTactics.js';
import { SliceScene } from './SliceScene.js';
import { SliceSession, SLICE_CHARACTERS } from './SliceSession.js';
import { sliceMap, sliceRegions, sliceRegion, sliceSaveKey, sliceCast } from './SliceMap.js';
import { islandEvent as lookupIslandEvent } from './SliceEvents.js';
import { COAST_ROUTES } from './SliceTransport.js';
import { captureAITurn, summarizeAITurn, canPauseSpectating } from './SliceTurnSummary.js';
import { gardenInfluence, propertyDecision, auctionPropertyPreview } from './SliceCommerce.js';
import { LANTERN_STEPS, MOUNTAIN_PEOPLE } from './SliceStory.js';
import { DOCK_NEIGHBORS, dockNeighbor, canChatAtDock } from './SliceDockStories.js';
import { characterFeedback } from './SlicePerformance.js';
import { SliceAudio } from './SliceAudio.js';

const highland=new URLSearchParams(location.search).get('map')==='highland';
const chapterMap=sliceMap(highland?'shanhai-highland':'shanhai-coast'),chapterName=highland?'枫谷山城':'蓝湾海岸';
const COAST_REGIONS=sliceRegions(chapterMap.id),coastRegion=id=>sliceRegion(id,chapterMap.id),islandEvent=id=>active?session.event(id):lookupIslandEvent(id,chapterMap.id),chapterRoutes=highland?[]:COAST_ROUTES;
const $=id=>document.getElementById(id), money=n=>Number(n||0).toLocaleString('en-US'), sleep=ms=>new Promise(r=>setTimeout(r,ms));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let audioPreferences={};try{audioPreferences=JSON.parse(localStorage.getItem('shanhai:audio')||'{}');}catch{}
const session=new SliceSession({mapId:chapterMap.id}), audio=new SliceAudio({musicVolume:.21,sfxVolume:.55,...audioPreferences,musicTrack:chapterMap.musicId});
function saveAudio(){try{localStorage.setItem('shanhai:audio',JSON.stringify({musicEnabled:audio.musicEnabled,sfxEnabled:audio.sfxEnabled,musicVolume:audio.musicVolume,sfxVolume:audio.sfxVolume}));}catch{}}
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),reduced=motionQuery.matches;
let ambientMotion=true;try{ambientMotion=localStorage.getItem('shanhai:ambient-motion')!=='false';}catch{}
if(reduced)document.body.classList.add('motion-reduced');
let active=false,busy=false,character='ayu',speed=1,loaded=false,epoch=0,lastRevision=-1,toastTimer,bannerTimer,menuPending=false;
let scene=null;
let boardTactic=null;
let lastAITurns=[];
let gardenView=false,gardenSelected=12,gardenSignature='';
let aiQuick=false;try{aiQuick=localStorage.getItem('shanhai:ai-quick')==='true';}catch{}
// A presentation preference only: old game saves need no migration.
let turnGuidePreference=null,turnGuideOpen=false;
try{const saved=localStorage.getItem('shanhai:turn-guide');if(['open','closed'].includes(saved))turnGuidePreference=saved;}catch{}
function renderTurnGuide(){
 const state=session.state,p=session.currentPlayer;if(!p)return;
 const body=$('turn-guide-body'),toggle=$('turn-guide-toggle');
 body.hidden=!turnGuideOpen;toggle.setAttribute('aria-expanded',String(turnGuideOpen));
 const label=turnGuideOpen?'跳过引导':'重看回合指引';if(toggle.textContent!==label)toggle.textContent=label;
 let step='move',text='点棋盘只查看资料。按下方「掷骰子」免费出发；暂时不用委托或道具也能玩。';
 if(state.phase==='GAME_OVER'){step='done';text='本季已结束，按下方「查看经营结果」看排名；结算页可以开始下一局。';}
 else if(state.phase==='AUCTION'||session.awaitingAuctionContinue){step='auction';text='现在先处理竞拍：按报价区出价或放弃，结果确认后再继续原回合。';}
 else if(state.players[0]?.isBankrupt){step='watch';text='你已退出经营。剩余角色继续；旁观暂停时，可继续一轮或保存离开。';}
 else if(p.isAI){step='wait';text=`已交棒，${state.players.filter(o=>o.isAI&&!o.isBankrupt).length}名AI依次行动。等行动区再次显示你的名字，再开始下一回合。`;}
 else if(busy||state.pendingMove){text='正在处理这次行动，请等落地结果；无需重复按掷骰。';}
 else if(state.phase==='LANDING_ACTION'){
  if(session.pendingEvent){step='decide';text='已到来信站。先读费用和风险，再选一个方案；免费帮工也能继续。';}
  else if(!session.decisionMade&&['PURCHASE','UPGRADE'].includes(session.focus?.kind)){step='decide';text='已实际停靠。按下方按钮买地、升级或路过；想留现金可以路过。点其他地块只会查看资料。';}
  else{step='finish';text='本站已处理。按下方「结束回合」把行动交给AI；买地或处理来信后都要完成这一步。';}
 }else if(session.cardUsed){text='本回合策略机会已用过。按下方「掷骰子」继续出发，不必再补充卡片。';}
 body.dataset.step=step;
 const shown=step==='wait'?'finish':step;
 document.querySelectorAll('[data-guide-step]').forEach(node=>{const current=node.dataset.guideStep===shown;if(current)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
 // Avoid repeated screen-reader announcements on unrelated renders.
 if($('turn-guide-next').textContent!==text)$('turn-guide-next').textContent=text;
}
$('turn-guide-toggle').onclick=()=>{turnGuideOpen=!turnGuideOpen;turnGuidePreference=turnGuideOpen?'open':'closed';try{localStorage.setItem('shanhai:turn-guide',turnGuidePreference);}catch{}renderTurnGuide();};
const quickAI=()=>aiQuick&&active&&session.currentPlayer?.isAI;
const duration=n=>reduced?30:quickAI()?Math.min(70,n/speed):n/speed;
const selectedRounds=()=>Number($('season-length').value)===12?12:16;
const shownRounds=()=>active?session.state.maxRounds:selectedRounds();
function refreshSeasonLength(){
 const rounds=selectedRounds();$('welcome-rounds').textContent=rounds;
 $('season-length-guide').textContent=`${rounds===12?'短局：少4轮，更早比较净值；后期建设与故事探索的机会更少。':'标准局：保留原有16轮节奏，留出更多经营与探索机会。'}每轮所有存续角色各轮到一次，停留状态照常跳过；第${rounds}轮结束按净值决胜，只剩一人时提前结束。初始现金、价格、能力冷却相同；异地施工仍从第8轮开放。选择只影响新局，继续旅程按存档轮数。`;
}
$('season-length').onchange=refreshSeasonLength;refreshSeasonLength();
function refreshAIPace(){const b=$('ai-pace-button');b.textContent=aiQuick?'AI速览':'AI逐步';b.setAttribute('aria-pressed',String(aiQuick));}
function renderAIProgress(){
 const p=session.currentPlayer,state=session.state,panel=$('ai-turn-progress');panel.hidden=!active||!p;if(panel.hidden)return;
 if(state.phase==='GAME_OVER'){panel.textContent='本季结束 · 查看最终排名，或开启下一季。';return;}
 const view=session.getAuctionView();
 if(view){const {auction:a,bidder,tile,minimum}=view;panel.textContent=`地产竞拍 · ${bidder.name}（${bidder.isAI?'AI':'你'}）正在报价。${tile.id}号 ${tile.name} · ${a.highestBidderId===null?'尚无报价':`最高 ¥${money(a.highestBid)}`} · 下一口 ¥${money(minimum)}。`;return;}
 if(session.awaitingAuctionContinue){panel.textContent=`竞拍已结算 · ${session.auctionResults.length}块地产，等待你确认结果后继续。`;return;}
 if(!busy&&canPauseSpectating(session)){panel.textContent=`旁观已暂停 · 第${state.round}轮待继续。可查看同行回顾，或保存回到启程页。`;return;}
 if(p.isBankrupt){panel.textContent=`${p.name}已退出本季，正在完成清算和地产竞拍。`;return;}
 if(!p.isAI){panel.textContent=`第${state.round}轮 · ${p.name}（你）${busy?'正在行动':'，轮到你了'}。${lastAITurns.length?'同行回合已完成，可展开下方速报。':''}`;return;}
 const ais=state.players.filter(o=>o.isAI&&!o.isBankrupt),completed=lastAITurns.filter(r=>r.round===state.round).map(r=>r.name);
 panel.textContent=`第${state.round}轮 · ${p.name}（第${ais.findIndex(o=>o.id===p.id)+1}/${ais.length}位AI）${aiQuick?' · 速览中':' · 逐步观看'}。${completed.length?`${completed.join('、')}已完成。`:''}${state.players[0].isBankrupt?'你已退出本季，本轮结束后暂停旁观。':''}`;
}
refreshAIPace();
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function speak(kind,detail='',player=session.currentPlayer){const f=characterFeedback(player,kind),panel=$('character-feedback');panel.hidden=false;panel.dataset.kind=kind;panel.dataset.mood=f.mood;scene?.express(player.id,f.mood);panel.innerHTML=`<img src="${import.meta.env.BASE_URL}shanhai/portraits/${f.characterId}${f.mood==='neutral'?'':`-${f.mood}`}.png" alt="${esc(f.speaker)} · ${f.moodLabel}表情"><div><strong>${esc(f.speaker)} <span class="expression-label">${f.moodLabel}</span><small>${esc(detail)}</small></strong><p>${esc(f.line)}</p></div>`;}
function banner(text){$('turn-banner').textContent=text;$('turn-banner').classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>$('turn-banner').classList.remove('show'),2400);}
function revealAction(){if(!active||busy||(session.currentPlayer.isAI&&!canPauseSpectating(session)&&session.getAuctionView()?.bidder?.id!==0&&!session.awaitingAuctionContinue)||$('info-dialog').open)return;const r=$('action-card').getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)(turnGuideOpen?document.querySelector('.journey-guide'):$('action-card')).scrollIntoView({block:'start',behavior:'instant'});}
function setBusy(value){if(value&&boardTactic)endBoardTactic(false);busy=value;render();if(!value)revealAction();}
function openModal(html){if(boardTactic)endBoardTactic(false);$('modal-content').innerHTML=html;if(!$('info-dialog').open)$('info-dialog').showModal();}
function closeModal(){$('info-dialog').close();scene?.setTransportRoute?.(null);}
$('info-dialog').querySelector('.modal-close').onclick=closeModal;
$('info-dialog').addEventListener('close',()=>{if(!busy)scene?.setTransportRoute?.(null);});
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function storyContent(tileId){
 if(!active)return '';const s=session.getStoryStatus(session.state.players[0]);
 const ended=session.state.phase==='GAME_OVER';
 const available=s.targetId===tileId?s.actions:[];
 return `<div class="story-detail"><span class="overline">${session.storyName} · ${s.stage===4?'故事完成':`${s.stage}/4`}</span><h3>${esc(s.endingInfo?.title||s.title)}</h3><p>${esc(s.endingInfo?.text||s.objective)}</p>${ended&&s.stage<4?'<p>本季旅程结束，这封便笺留待下一次旅程。</p>':''}${available.map(a=>`<button class="secondary" data-story-action="${a.id}" ${busy||s.blockedReason?'disabled':''}>${a.label}</button>`).join('')}${s.stage<4&&s.blockedReason?`<small>${esc(s.blockedReason)}</small>`:''}<p class="story-note">可选故事 · 无额外费用或经济奖励 · 结局授予纪念称号</p></div>`;
}
function bindStoryActions(){document.querySelectorAll('[data-story-action]').forEach(b=>b.onclick=()=>{if(busy||session.currentPlayer.isAI)return;const result=session.advanceStory(b.dataset.storyAction);if(!result.success){toast(result.reason);return;}audio.play('purchase');scene.react(session.currentPlayer.id,result.stage===4?'celebrate':'notice');for(const d of DOCK_NEIGHBORS)if(result.stage===4||d.tileId===session.currentPlayer.currentTile)scene.docks?.greet(d.id);toast(result.description);save();showStory();});}
function showStory(){if(!active||busy)return;const s=session.getStoryStatus(session.state.players[0]);if(highland){openModal(`<span class="overline">MAPLE VALLEY · 一窑新茶</span><h2>茶棚与柴窑的约定</h2><div class="mountain-people">${MOUNTAIN_PEOPLE.map(p=>`<article><strong>${p.name} · ${p.role}</strong><p>${p.reply}</p></article>`).join('')}</div><ol class="story-steps">${session.storySteps.slice(0,4).map((step,i)=>`<li class="${s.stage>i?'complete':s.stage===i?'current':''}">${s.stage>i?'✓ ':''}${step.title}</li>`).join('')}</ol>${storyContent(s.targetId)}<p>人物站在环路内侧的茶棚、柴窑旁。故事行动在编号站点办理：0号接信 → 10号开窑 → 16号取茶 → 22号茶会。实际停靠才算；事件可选免费方案，失利也不阻断故事。</p>`);bindStoryActions();return;}openModal(`<span class="overline">A LIGHT FOR THE BAY</span><h2>海风花灯</h2><p>阿澜想为晚归的船点一盏灯。先办好一份街坊的委托，再把小栀的灯罩带到木木的花棚。</p><ol class="story-steps">${LANTERN_STEPS.slice(0,4).map((step,i)=>`<li class="${s.stage>i?'complete':s.stage===i?'current':''}">${s.stage>i?'✓ ':''}${step.title}</li>`).join('')}</ol>${storyContent(s.targetId)}${s.stage===1?'<p>掷骰前在「海湾委托」接一单；已有的未完成委托也可计入。过期委托不推进故事。</p>':''}<p>故事没有额外轮次期限，在本季${session.state.maxRounds}轮内完成即可。目标需要实际停靠；可用遥控骰子选落点，船票按原航线到站。</p>`);bindStoryActions();}
function renderStory(){$('story-panel').hidden=false;const s=session.getStoryStatus(session.state.players[0]);$('story-panel').innerHTML=`<strong>✦ ${session.storyName} <small>${s.stage===4?'已完成':`${s.stage}/4`}</small></strong><p>${esc(s.endingInfo?`纪念称号 · ${s.endingInfo.title}`:s.objective)}</p><button id="story-open" class="commission-open">${s.stage===4?'重读结局':'查看故事进度'} →</button>`;$('story-open').onclick=showStory;}
function showDock(id){
 if(!loaded||busy||!session.hasCoastFeatures)return;const dock=dockNeighbor(id);if(!dock)return;scene.highlight(dock.tileId);
 const canChat=canChatAtDock(dock,session,{active,busy}),canTravel=canChat&&session.state.phase==='PRE_ROLL_ACTION';
 openModal(`<span class="overline">BLUE BAY · DOCK NEIGHBORS</span><h2>${dock.place}</h2><nav class="dock-tabs" aria-label="选择码头">${DOCK_NEIGHBORS.map(d=>`<button data-dock="${d.id}" aria-pressed="${d.id===id}">${d.name} · ${d.tileId}号</button>`).join('')}</nav><div class="dock-story" style="--dock-color:${dock.color}"><strong>${dock.name} · ${dock.role}</strong><p>${dock.story}</p><p id="dock-reply" role="status">${canChat?'“来，一起歇歇脚。今天想做点什么？”':`来到 ${dock.tileId}号交通站，在你的回合可以和${dock.name}交流。`}</p></div><p class="dock-note">免费交流 · 不消耗回合，无现金或点券奖励。船票仍需单独购买。</p><div class="dock-choices">${dock.choices.map(c=>`<button class="secondary" data-dock-choice="${c.id}" ${canChat?'':'disabled'}>${c.label}</button>`).join('')}</div>${storyContent(dock.tileId)}${canTravel?'<button id="dock-tickets" class="primary">查看本站船票 →</button>':''}`);
 document.querySelectorAll('[data-dock]').forEach(b=>b.onclick=()=>showDock(b.dataset.dock));
 document.querySelectorAll('[data-dock-choice]').forEach(b=>b.onclick=()=>{if(!canChatAtDock(dock,session,{active,busy}))return;const choice=dock.choices.find(c=>c.id===b.dataset.dockChoice);$('dock-reply').textContent=choice.reply;scene.docks?.greet(id);audio.play('turn');});
 bindStoryActions();
 if($('dock-tickets'))$('dock-tickets').onclick=()=>{closeModal();showTransport();};
}
$('neighbors-button').onclick=()=>showDock(DOCK_NEIGHBORS[Math.floor(session.currentPlayer.currentTile/8)]?.id||'harbor');
function showRegions(){openModal(`<span class="overline">THREE NEIGHBORHOODS, DIFFERENT CHOICES</span><h2>${chapterName}，三段街区。</h2><div class="region-guide">${COAST_REGIONS.map((r,i)=>`<article style="--region:${r.color}"><h3>${r.name}</h3><p>${r.description}</p><small>第 ${i*8}–${i*8+7} 站 · ${chapterMap.tiles.filter(t=>coastRegion(t.id).id===r.id&&islandEvent(t.id)).map(t=>`${t.id}号：${islandEvent(t.id).title}`).join(' / ')}</small></article>`).join('')}</div><p>22号站按轮换班：单数轮是原有活动，双数轮开放${highland?'雨后晒场':'拓印试展'}；已打开的来信不会因刷新换题。遥控骰子先看目的地，点击棋盘来信格可预览全部方案。出资风险可能减少购地现金，花掉点券也会减少之后的选路机会。</p>`);}
$('region-button').onclick=showRegions;$('current-region').onclick=showRegions;
$('help-button').onclick=()=>highland?openModal(`<span class="overline">MAPLE VALLEY</span><h2>枫谷山城指南</h2><p>沿24站山路环线经营${shownRounds()}轮，以总资产决定胜负。经过0号驿站领取 ¥2,000；落地后可买地、升级或支付租金。三段街区的价格和收益不同。</p><p>4、10、16、22号有山城原创来信，每个选项写明费用与风险。可用遥控骰子选择1–6步，AI按相同规则经营。</p><p>委托、职业能力、12号集会所经营与花园邻地视图均可使用。本图提供「一窑新茶」短故事：0号接信、10号开窑、16号取茶、22号茶会；没有蓝湾渡轮和花灯支线。</p><p>两张地图独立存档；回到启程页后可切换地图。此图复用原创建筑与角色，配有原创三拍子《枫谷茶时》。</p>`):openModal(`<span class="overline">A LITTLE GUIDE TO BLUE BAY</span><h2>海湾生活指南</h2><ol><li><b>掷骰，沿路出发。</b>骰子由规则引擎决定，人物逐格走到落点。</li><li><b>买地，让小城生长。</b>抵达无主地可购买，再次抵达自家地可升级。空地、海湾小屋、街角商铺、露台公寓、海景高楼共五阶。</li><li><b>经营，也要留足现金。</b>经过对方地产会付租。12号蓝湾市集可选商场收租，或花园放弃本站租金以提高附近自有地产租金20%；两类都会给对手访客点券。掷骰前可支付 ¥300 改建，超过新类型上限的等级会永久损失；账本会提前列明。</li><li><b>让旅程多一点选择。</b>遥控骰子消耗一张真实卡片，选择1–6步的目的地。用补给格和市集得到的点券可在掷骰前补充卡片，AI也遵循同样规则。信笺格有随机事件。</li><li><b>接一份海湾委托。</b>掷骰前选择速递或焕新；三轮内停靠指定地点或落地买地/升级一次，自动领取现金与点券。每人同时一单，结单当轮不能再接，到期不扣款。阿屿速递、青禾焕新额外奖励 ¥300，AI规则相同。</li><li><b>读懂街区与来信。</b>港口、商街、艺坊提供不同的现金、点券与委托机会。事件选项明示费用、概率和净收益；可选稳妥收入，也可承担损失换取更高回报。未选择的事件会随存档保留。</li><li><b>在交通站跨区。</b>0、8、16号站掷骰前可买船票替代本回合掷骰。定班渡轮 ¥650 保证抵达；潮汐快艇 ¥250，75% 抵达、25% 改靠来信站。跳过的地点不触发奖励或委托，跨过起点不领 ¥2,000，抵达后照常经营。</li><li><b>用职业能力经营。</b>掷骰前，阿屿花20点券代送前方两步内的速递委托；青禾花30点券在有自有非抵押地产的街区开花市，按地块与等级获得 ¥300–600。使用后第三轮恢复，不消耗骰子；AI规则相同。</li><li><b>${shownRounds()}轮后比较总资产。</b>每次完成行动自动存档，也可手动保存。原完整游戏的存档不受影响。</li></ol><p>中央船屋、钟楼街、花房与花园属于场景装饰；可经营的地块位于编号道路外侧。地产底座和旗帜表示业主，金色短格表示升级次数；标牌显示业主与 L0–L4，手机上点选地块可查看标牌。鼠标拖动旋转，滚轮缩放。音乐、音效可独立关闭。</p><p>本章是限定范围的可玩样板，不包含完整游戏全部模式和设施。</p>`);
function refreshAudioControls(){for(const [id,enabled,label] of [['music-toggle',audio.musicEnabled,'背景音乐'],['sfx-toggle',audio.sfxEnabled,'音效']]){$(id).classList.toggle('off',!enabled);$(id).setAttribute('aria-label',`${enabled?'关闭':'开启'}${label}`);$(id).setAttribute('aria-pressed',String(enabled));}}
$('music-toggle').onclick=()=>{audio.setMusicEnabled(!audio.musicEnabled);audio.unlock();saveAudio();refreshAudioControls();};
$('sfx-toggle').onclick=()=>{audio.setSfxEnabled(!audio.sfxEnabled);audio.unlock();saveAudio();refreshAudioControls();};
$('audio-settings').onclick=()=>{
 openModal(`<span class="overline">ORIGINAL CHAPTER SOUNDS</span><h2>声音与音量</h2><p>当前配乐：${highland?'《枫谷茶时》 · 三拍子与轻风':'《盐风漫步》 · 木琴与轻浪'}</p><p>音乐与音效可分别调节；设置会记住并用于两张地图。</p><div class="sound-controls">${[['music','背景音乐',audio.musicVolume,audio.musicEnabled],['sfx','游戏音效',audio.sfxVolume,audio.sfxEnabled]].map(([id,label,volume,enabled])=>`<label for="${id}-volume">${label} <output id="${id}-level">${Math.round(volume*100)}%</output></label><input id="${id}-volume" type="range" min="0" max="100" value="${Math.round(volume*100)}"><label class="sound-check"><input id="${id}-enabled" type="checkbox" ${enabled?'checked':''}>开启${label}</label>`).join('')}</div><p>试听使用当前音效音量；关闭音效时保持静音。</p><div class="sound-samples">${[['dice','掷骰'],['purchase','购地'],['event-success','事件成功'],['event-fail','事件失利 / 流拍'],['ability','角色能力'],['auction-sold','竞拍成交'],['bankruptcy','破产离场']].map(([id,label])=>`<button class="secondary" data-sound="${id}">${label}</button>`).join('')}</div><p id="sound-status" role="status"></p>`);
 for(const id of ['music','sfx']){
  $(id+'-volume').oninput=e=>{audio[id==='music'?'setMusicVolume':'setSfxVolume'](Number(e.target.value)/100);$(id+'-level').textContent=e.target.value+'%';saveAudio();};
  $(id+'-enabled').onchange=e=>{audio[id==='music'?'setMusicEnabled':'setSfxEnabled'](e.target.checked);audio.unlock();saveAudio();refreshAudioControls();};
 }
 document.querySelectorAll('[data-sound]').forEach(b=>b.onclick=async()=>{const status=$('sound-status');await audio.unlock();await audio.effectsReady;if(!status.isConnected||!$('info-dialog').open)return;const played=audio.play(b.dataset.sound);status.textContent=played?`正在播放：${b.textContent}`:!audio.sfxEnabled||!audio.sfxVolume?'音效已静音。':'音频暂不可用，请稍后重试。';});
};
function refreshAmbientControl(){const b=$('ambient-toggle'),quiet=motionQuery.matches;b.disabled=quiet;b.setAttribute('aria-pressed',String(ambientMotion&&!quiet));b.textContent=ambientMotion&&!quiet?'≈':'—';b.title=quiet?'环境静止：系统已要求减少动画':`${ambientMotion?'关闭':'开启'}环境动态 · ${highland?'茶烟与风叶':'轻风海面'}`;b.setAttribute('aria-label',b.title);}
$('ambient-toggle').onclick=()=>{ambientMotion=!ambientMotion;if(scene)scene.ambientMotion=ambientMotion;try{localStorage.setItem('shanhai:ambient-motion',String(ambientMotion));}catch{}refreshAmbientControl();};
motionQuery.addEventListener('change',refreshAmbientControl);refreshAmbientControl();
$('view-home').onclick=()=>scene?.characterPreview?closeCharacterPreview():gardenView?scene?.focusGarden():scene?.overview();$('view-rotate').onclick=()=>scene?.rotate();$('view-zoom').onclick=()=>scene?.zoom();
$('view-clear').onclick=()=>{if(!scene?.setClearView(!scene.clearView))return;const enabled=scene.clearView;$('view-clear').setAttribute('aria-pressed',String(enabled));$('view-clear').textContent=enabled?'返回立体':'清晰俯视';$('view-clear').title=enabled?'返回原有立体视角':'提高视角，展开人物并标示选中地产';};
$('ai-pace-button').onclick=()=>{aiQuick=!aiQuick;try{localStorage.setItem('shanhai:ai-quick',String(aiQuick));}catch{}refreshAIPace();renderAIProgress();};
$('speed-button').onclick=()=>{speed=speed===1?2:1;$('speed-button').textContent=`${speed}× 节奏`;};
function guideText(id){const g=roleGuide(id);return `<p><b>适合：</b>${g.style}</p><p><b>委托专长：</b>${g.bonus}</p><p><b>${g.ability}</b><br>${g.condition}</p><p class="role-limit">${g.tradeoff}</p><p><b>第一步：</b>${g.opening}</p>`;}
$('compare-roles').onclick=()=>{openModal(`<span class="overline">FOUR WAYS TO TRAVEL</span><h2>选一位适合你的同行者</h2><p>四位角色初始现金、卡片和胜负目标相同，AI也遵守同样规则。主动能力均为使用后第三轮恢复，不额外消耗骰子；实际用牌仍占本回合策略机会。以下建议按玩法偏好，不是强弱排名。</p><div class="role-comparison">${SLICE_CHARACTERS.map(c=>`<article><h3>${c.name} · ${c.role}</h3>${guideText(c.id)}<button class="secondary" data-guide-character="${c.id}">选择${c.name}</button></article>`).join('')}</div>`);document.querySelectorAll('[data-guide-character]').forEach(b=>b.onclick=()=>{document.querySelector(`[data-character="${b.dataset.guideCharacter}"]`).click();closeModal();});};
function showMapNote(reverse=false){
 if(!highland||!active||busy||session.currentPlayer.isAI)return;
 const note=mountainMapNote(session,reverse);
 openModal(`<span class="overline">XINGLUO'S FIELD NOTES</span><h2>雨痕里的小箭头</h2><p>${session.currentPlayer.characterId==='xingluo'?'星罗翻到旧手册的一页：':'补给亭留着星罗抄写的一页便笺：'}“雨把路牌上的箭头冲淡了。先在纸上走一遍，别急着花掉手里的骰子。”</p><nav class="map-note-tabs" aria-label="选择读图方式"><button class="secondary" data-note-reverse="false" aria-pressed="${!reverse}">按原方向读图</button><button class="secondary" data-note-reverse="true" aria-pressed="${reverse}">假设先转向</button></nav><p>从 <b>${note.startId}号 ${esc(note.startName)}</b> 出发，${reverse?'假设先转向，再':'按当前方向'}计划走3步，路图上的停点在哪？${note.fence?'前方有围栏，遇到会先停下。':'这段路没有围栏。'}</p><div class="map-note-choices">${note.choices.map(c=>`<button class="secondary" data-note-answer="${c.id}">${c.id}号 ${esc(c.name)}</button>`).join('')}</div><div id="map-note-answer" class="map-note-answer" role="status" aria-live="polite"></div><p class="quiet-note">免费读图，可重复练习。这里只看方向与围栏；实际行程仍受状态和事件影响。不会移动、转向、消耗卡片或给予奖励。</p>`);
 document.querySelectorAll('[data-note-reverse]').forEach(b=>b.onclick=()=>showMapNote(b.dataset.noteReverse==='true'));
 document.querySelectorAll('[data-note-answer]').forEach(b=>b.onclick=()=>{if(busy||session.currentPlayer.isAI)return;const correct=Number(b.dataset.noteAnswer)===note.target;scene.highlight(note.target);$('map-note-answer').innerHTML=`<strong>${correct?'停点标对了。':'再顺着箭头看一遍。'}</strong><p>${note.startId}号 → ${note.route.map(t=>`${t.id}号 ${esc(t.name)}`).join(' → ')}${note.fence?'（围栏截停）':''}</p><p>${esc(note.reply)}</p><p>便笺末尾写着：“能选落点，不等于要立刻用卡；先看这一站值不值得。”</p>`;});
}
$('map-note-button').onclick=()=>showMapNote();
const CHARACTER_LOOKS={ayu:'珊瑚色鸭舌帽 · 斜挎邮包与包裹',qinghe:'叶片发夹 · 圆发髻与植物背篓',xingluo:'宽檐旅行帽 · 圆眼镜与地图筒',taoning:'黄色安全帽 · 护耳与随身工具带'};
function showCharacterPreview(){
 if(!loaded||active)return;
 scene.previewCharacter(0);const chosen=SLICE_CHARACTERS.find(c=>c.id===character);
 $('preview-name').textContent=`${chosen.name} · ${chosen.role}`;$('preview-detail').textContent=CHARACTER_LOOKS[character];
 $('character-preview').hidden=false;document.querySelector('.world-panel').classList.add('character-previewing');
}
function closeCharacterPreview(focus=true){
 if(scene?.characterPreview)scene.overview();$('character-preview').hidden=true;document.querySelector('.world-panel').classList.remove('character-previewing');
 if(focus)$('preview-character').focus();
}
$('preview-character').onclick=()=>{showCharacterPreview();if(scene?.characterPreview){document.querySelector('.world-panel').scrollIntoView({block:'start'});$('close-character-preview').focus({preventScroll:true});}};
$('close-character-preview').onclick=()=>closeCharacterPreview();
function refreshCast(){
 const selected=$('opponent-character').value;
 $('opponent-character').innerHTML='<option value="">默认同行者</option>'+SLICE_CHARACTERS.filter(c=>c.id!==character).map(c=>`<option value="${c.id}">${c.name} · ${c.role}</option>`).join('');
 if(selected!==character&&SLICE_CHARACTERS.some(c=>c.id===selected))$('opponent-character').value=selected;
 const chosen=SLICE_CHARACTERS.find(c=>c.id===character);$('role-guide').innerHTML=`<h3>${chosen.name} · ${roleGuide(character).style}</h3>${guideText(character)}`;document.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===character)));const cast=sliceCast(character,$('opponent-character').value,$('player-count').value);$('opponent-guide').textContent=cast.slice(1).map((c,i)=>`AI${i+1} ${c.name}：${roleGuide(c.id).ability}`).join('；')+'。顺序为你 → '+cast.slice(1).map(c=>c.name).join(' → ')+'，全部完成才进入下一轮。其余AI按角色表依次补齐且不重复，各自经营、没有组队；破产地产由存续玩家竞拍，出价须为整百；只剩一名玩家时直接结算。';
 if(loaded&&!active){const previewing=Boolean(scene.characterPreview);scene.createPawns(cast.map((c,i)=>({...c,id:i,characterId:c.id,currentTile:i})));if(previewing)showCharacterPreview();scene.react(0,'celebrate');}
}
$('opponent-character').onchange=refreshCast;$('player-count').onchange=refreshCast;
document.querySelectorAll('[data-character]').forEach(button=>button.onclick=()=>{character=button.dataset.character;document.querySelectorAll('[data-character]').forEach(b=>b.classList.toggle('selected',b===button));refreshCast();});
refreshCast();
function save(announce=false){
 const r=session.save();
 $('save-status').textContent=r.success?'旅程已自动保存':'无法保存：本次旅程仅保留在当前页面，请勿关闭或刷新。';
 $('save-status').classList.toggle('save-warning',!r.success);
 if(announce)toast(r.success?'旅程已保存在这个浏览器中。':r.reason||'保存未成功');
 return r;
}
$('save-button').onclick=()=>save(true);
function returnToWelcome(){epoch++;setGardenView(false);active=false;busy=false;closeModal();$('garden-toggle').hidden=true;$('welcome-panel').hidden=false;$('game-panel').hidden=true;document.body.classList.remove('playing');$('resume-button').hidden=false;scene.setCommissionTarget?.(null);scene.overview();selectCurrentCast();$('welcome-panel').scrollIntoView({block:'start'});}
function selectCurrentCast(){$('season-length').value=String(session.state.maxRounds===12?12:16);refreshSeasonLength();const [human,other]=session.state.players;character=human.characterId;$('player-count').value=String(session.state.players.length);document.querySelectorAll('[data-character]').forEach(b=>b.classList.toggle('selected',b.dataset.character===character));refreshCast();$('opponent-character').value=other.characterId;refreshCast();}
$('menu-button').onclick=()=>{if(busy){toast('等这一小段行程结束，再回到启程页。');return;}openModal(`<span class="overline">KEEP YOUR JOURNEY</span><h2>暂别${chapterName}？</h2><p>当前对局会保存，下次可以继续这段旅程。</p><button class="primary" id="confirm-menu">保存并回到启程页</button><button class="secondary" id="cancel-menu">继续经营</button>`);$('confirm-menu').onclick=()=>{if(!save(true).success){closeModal();return;}returnToWelcome();};$('cancel-menu').onclick=closeModal;};
function launch(restoring=false,roundsOverride=null){closeCharacterPreview(false);endBoardTactic(false);$('tactic-result').hidden=true;lastAITurns=[];$('ai-recap').hidden=true;delete $('ai-recap').dataset.turn;setGardenView(false);$('character-feedback').hidden=true;audio.unlock();epoch++;if(!restoring)session.start({seed:Date.now(),characterId:character,opponentId:$('opponent-character').value,playerCount:Number($('player-count').value),maxRounds:roundsOverride??selectedRounds()});active=true;busy=false;turnGuideOpen=turnGuidePreference===null?!restoring:turnGuidePreference==='open';lastRevision=-1;document.body.classList.add('playing');$('welcome-panel').hidden=true;$('game-panel').hidden=false;scene.createPawns(session.state.players);scene.syncProperties(session.state);lastRevision=session.state.assetRevision;scene.highlight(session.currentPlayer.currentTile);scene.overview();render();if(matchMedia('(max-width:680px)').matches)$('game-panel').scrollIntoView({block:'start'});else document.querySelector('.sidebar').scrollTop=0;save();banner(restoring?'欢迎回来，旅程继续。':`${session.currentPlayer.name}，${chapterName}之旅开始了。`);audio.play('turn');if(session.state.phase==='GAME_OVER')showVictory();else if(session.state.phase==='AUCTION'){runAuctionAI();revealAction();}else if(session.awaitingAuctionContinue)revealAction();else if(session.currentPlayer.isAI){if(canPauseSpectating(session))revealAction();else runAI();}else if(session.state.pendingMove)continueHumanMovement();else if(session.state.phase==='LANDING_ACTION'&&!session.landingResolved){const result=session.resolveLanding();onLanding(result.focus||session.focus);announceCommission(result);save();render();runAuctionAI();}}
$('start-button').onclick=()=>{if(loaded)launch(false);};$('resume-button').onclick=()=>{if(!loaded)return;const result=session.load();if(result.success)launch(true);else toast(result.reason||'上次的旅程暂时无法恢复。');};
function button(text,handler,kind='primary',disabled=false,id){const b=document.createElement('button');b.className=kind;b.textContent=text;b.disabled=disabled;if(id)b.id=id;b.onclick=handler;$('action-buttons').append(b);return b;}
function setGardenView(value){
 gardenView=Boolean(value&&active&&!busy&&!session.currentPlayer.isAI);gardenSignature='';
 $('garden-toggle').setAttribute('aria-pressed',String(gardenView));$('garden-toggle').textContent=gardenView?'退出邻地视图':'花园邻地';$('garden-panel').hidden=!gardenView;
 if(gardenView){renderGarden();scene.focusGarden();}else{scene?.setGardenInfluence(null);scene?.restoreGardenView();}
}
$('garden-toggle').onclick=()=>setGardenView(!gardenView);
function selectGardenTile(id){gardenSelected=id;scene.highlight(id);renderGarden();}
function renderGarden(){
 $('garden-toggle').hidden=!active;$('garden-toggle').disabled=busy||session.currentPlayer.isAI;
 if(!gardenView)return;if(busy||session.currentPlayer.isAI){setGardenView(false);return;}
 const info=gardenInfluence(session.state),signature=JSON.stringify(info);
 if(signature!==gardenSignature){scene.setGardenInfluence(info);gardenSignature=signature;}
 const selected=info.rows.find(r=>r.tileId===gardenSelected);
 $('garden-panel').innerHTML=`<div class="garden-heading"><strong>${esc(info.mode)}</strong><button id="garden-ledger">经营账本 ↗</button><button id="garden-close" aria-label="关闭邻地视图">关闭</button></div><p>${esc(info.sourceNote)} 金框12号为市集，绿框表示可增租，灰框暂不增租。按编号查看，颜色不是唯一提示。</p><div class="garden-rows">${info.rows.map(r=>`<button class="garden-row ${r.increase?'benefits':''}" data-garden-row="${r.tileId}" aria-pressed="${gardenSelected===r.tileId}"><strong>${r.tileId}号 ${esc(r.name)} <small>${esc(r.ownerName)} · L${r.level}</small></strong><span>${esc(r.reason)}</span><b>${info.active?`无此花园 ¥${money(r.base)} → 当前 ¥${money(r.current)}`:info.preview?`当前 ¥${money(r.current)} → 花园后 ¥${money(r.projected)}`:`当前租金 ¥${money(r.current)}`}${r.increase?`（+${money(r.increase)}）`:''}</b><em class="${r.ownerId!==null&&r.ownerId!==0?'risk':''}">${esc(r.risk)}</em></button>`).join('')}</div><p class="garden-note">${selected?`选中 ${selected.tileId}号 · ${selected.ownerId===null?'尚无业主':`${esc(selected.ownerName)}所有`}。`:''}租金含当前物价及新闻；个人免租状态可能降低实付。需实际停靠才收租，不是每轮收入；多座花园不叠加。</p>`;
 $('garden-close').onclick=()=>setGardenView(false);$('garden-ledger').onclick=showCommerce;
 document.querySelectorAll('[data-garden-row]').forEach(b=>b.onclick=()=>selectGardenTile(Number(b.dataset.gardenRow)));
}
function businessCard(b,{buy=false}={}){
 const neighbors=b.neighbors.length?b.neighbors.map(n=>`${n.tileId}号 ${esc(n.name)} ¥${money(n.rent)}${n.increase?`（+${money(n.increase)}）`:''}`).join(' · '):'附近暂无可受益的自有非抵押地产';
 return `<article class="business-card" data-business="${b.id}"><span class="overline">${b.id==='MALL'?'收租经营 · L0–L4':'邻地经营 · L0–L1'}</span><h3>${b.name}${b.current?' · 当前经营':''}</h3><strong>${b.tiers[b.level]} · L${b.level}</strong><p>${b.id==='MALL'?'收取本站租金；对手实际付租后也会得到点券。':'本站不收租；同业主编号距离两格内的地产租金 +20%。升级不增加此加成。'}</p><div class="business-rents">${b.rentLadder.map((n,i)=>`<span>L${i} <b>¥${money(n)}</b></span>`).join('')}</div><p>访客回馈 ${b.visitorPoints} 点券${b.id==='PARK'?' ＋ 下回合旧规则负面免疫（不抵消自主投资风险）':'（实际付租后）'}；每升一级多送10点券。业主到访不领取。</p><p>标准升级 ¥${money(b.standardUpgradeCost)} / 次 · ${b.id==='PARK'?'只可升至 L1':'最多 L4'}<br>当前邻地参考租金：${neighbors}</p>${!buy&&!b.current?`<p class="business-warning">改建费用 ¥${money(b.conversionCost)} · 改建后 L${b.level}${b.lostLevels?` · 永久减少 ${b.lostLevels} 级，不退建设费，改回商场也不恢复`:' · 保留现有等级'}。改建不算焕新委托，也不消耗骰子。</p>`:''}</article>`;
}
function showCommerce(){
 if(!active||busy)return;const prop=session.state.propertyManager.getProperty(12),owner=session.state.players.find(p=>p.id===prop.owner),actor=owner||session.state.players[0],options=session.getCommerceOptions(12,actor),canManage=owner?.id===session.currentPlayer.id&&!session.currentPlayer.isAI&&session.state.phase==='PRE_ROLL_ACTION';
 openModal(`<span class="overline">BLUE BAY · BUSINESS CHOICES</span><h2>${esc(chapterMap.tiles[12].name)} · 经营账本</h2><p>${owner?`${esc(owner.name)}所有 · L${prop.level}`:'尚无业主 · 实际停靠12号站可购买'}。${prop.isMortgaged?'已抵押：租金、访客服务与花园邻地加成暂停。':''}掷骰前可改建；再次实际停靠才可升级。</p><button id="commerce-map" class="secondary">在地图查看花园邻地 →</button><div class="business-options">${options.map(b=>`${businessCard(b,{buy:!owner})}${canManage?`<button class="secondary" data-convert="${b.id}" ${b.blockedReason?'disabled':''}>${esc(b.blockedReason||`支付 ¥${money(b.conversionCost)}，改为${b.name}${b.lostLevels?`（降至 L${b.level}）`:''}`)}</button>`:''}`).join('')}</div><p class="business-footnote">参考租金含当前物价、新闻及邻地加成；免租与个人状态会影响最终结算。数字只代表一次落地，不是每轮自动收入。标准升级价未计个人优惠；落地按钮显示实付价。花园等级提升只增加外观、资产估值和访客回馈，不提高邻地加成。</p>`);
 $('commerce-map').onclick=()=>{closeModal();setGardenView(true);document.querySelector('.world-panel').scrollIntoView({block:'start'});};
 document.querySelectorAll('[data-convert]').forEach(b=>b.onclick=()=>{if(busy||session.currentPlayer.isAI)return;const r=session.changeBusiness(12,b.dataset.convert);if(!r.success){toast(r.reason);return;}audio.play('upgrade');toast(`改建完成 · 支付 ¥${money(r.cost)} · 现为 L${prop.level}`);save();showCommerce();});
}
function auctionResultsHTML(){
 return session.auctionResults.length?`<section class="auction-results" aria-label="拍卖结果"><h4>已结算地块</h4>${session.auctionResults.map(a=>`<p>${a.tileId}号 ${esc(session.state.getTile(a.tileId).name)}：${a.status==='RESOLVED'?`${esc(session.state.players[a.highestBidderId].name)}以 ¥${money(a.highestBid)} 竞得；款项交给${esc(session.state.players[a.beneficiaryId]?.name||'银行')}。`:'无人出价，流拍后恢复为空地，可正常购买。'}</p>`).join('')}</section>`:'';
}
function auctionPropertyHTML(view){
 const q=auctionPropertyPreview(session.state,view.bidder,view.tile.id);
 if(!q)return '';
 return `<section id="auction-property-preview" class="auction-property-preview" data-rent="${q.rent}" aria-label="竞得后的租金预览"><strong>${esc(view.bidder.name)}竞得后参考租金 ¥${money(q.rent)} / 次</strong><p>保留 ${esc(q.buildingName)} · L${q.level}${q.isMortgaged?' · 抵押中，暂不收租':''}。对手实际停靠时结算，不是每轮收入。</p><details><summary>${q.affected.length?`会改变 ${q.affected.length} 处自有地产租金`:'其他自有地产租金不变'} · 查看口径</summary>${q.affected.map(r=>`<p data-auction-neighbor="${r.tileId}" data-before="${r.before}" data-after="${r.after}">${r.tileId}号 ${esc(r.name)}：¥${money(r.before)} → ¥${money(r.after)} / 次</p>`).join('')}<p>按当前物价、新闻、完整街区与花园加成计算；以步行访客为参考，不含个人免租等效果。不是收入预测，后续局势变化会改变实付。</p></details></section>`;
}
function renderAuction(){
 for(const id of ['remote-button','supply-button','tactics-button','construction-button','ability-button','commission-open','neighbors-button','map-note-button'])if($(id))$(id).disabled=true;
 const view=session.getAuctionView();$('action-kicker').textContent='破产地产 · 公开竞拍';
 if(!view){
   $('action-title').textContent='本次地产竞拍已完成';$('action-description').textContent='现金与产权已结算并保存。继续后跳过已破产角色，由存续玩家继续对局。';$('action-details').innerHTML=auctionResultsHTML();
   button('确认结果，继续对局 →',finishTurn,'primary',busy,'auction-continue');return;
 }
 const {auction:a,bidder,tile,property,minimum,beneficiary,remaining}=view,human=bidder.id===0;
 $('action-title').textContent=`${tile.id}号 ${tile.name}`;
 $('action-description').textContent=`${human?'轮到你':`等待${bidder.name}`}出价 · 起拍价 ¥${money(a.minimumBid)} · 每次至少加 ¥100，报价须为整百。放弃后不能重返这块地的竞拍，下一块仍可参与。仅成交时扣款，结束前不推进普通回合。`;
 $('action-details').innerHTML=`<div class="auction-quote"><p>L${property.level} · 原地价 ¥${money(tile.price)}（不等于成交价）<br>后面还有 ${remaining} 块待拍地产</p><p>${a.highestBidderId===null?'尚无人报价':`当前最高：${esc(session.state.players[a.highestBidderId].name)} · ¥${money(a.highestBid)}`}<br>下一口最低 ¥${money(minimum)} · ${esc(bidder.name)}现金 ¥${money(bidder.cash)}</p><p>成交款交给${esc(beneficiary?.name||'银行')}。${beneficiary?.id===bidder.id?`${human?'你':esc(bidder.name)}若竞得，扣款后款项回到自己的现金，净支出为零；仍须有足额现金出价。`:''}</p></div>${auctionPropertyHTML(view)}<ol class="auction-history">${a.bidHistory.slice(-8).map(h=>`<li>${esc(session.state.players[h.playerId].name)}：${h.action==='BID'?`出价 ¥${money(h.amount)}`:h.action==='AUTO_PASS'?'现金不足，自动放弃':'放弃本地块'}</li>`).join('')}</ol>${human?`<label class="auction-input-label" for="auction-amount">你的报价（最低 ¥${money(minimum)}）</label><input id="auction-amount" type="number" inputmode="numeric" min="${minimum}" max="${bidder.cash}" step="100" value="${minimum}" ${busy?'disabled':''}><p id="auction-balance" class="action-note"></p>`:''}${auctionResultsHTML()}`;
 if(human){
   const input=$('auction-amount'),bid=button('确认出价',()=>submitAuction(Number(input.value),a.id),'primary',busy||bidder.cash<minimum,'auction-bid');
   const update=()=>{const value=Number(input.value),valid=Number.isInteger(value)&&value>=minimum&&value%100===0&&value<=bidder.cash;bid.disabled=busy||!valid;$('auction-balance').textContent=valid?`若以此价竞得：先扣 ¥${money(value)}${beneficiary?.id===bidder.id?'，再收回相同款项':''}，现金余额 ¥${money(bidder.cash-value+(beneficiary?.id===bidder.id?value:0))}。`:'请输入不超过现金、且至少达到最低价的整百金额。';};input.oninput=update;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(!bid.disabled)bid.click();}};update();
   button('放弃这块地',()=>submitAuction(0,a.id),'secondary',busy,'auction-pass');
 }else button(busy?'AI正在判断报价…':'继续AI竞价',runAuctionAI,'primary',busy,'auction-ai-resume');
}
function submitAuction(amount,id){
 if(busy)return;const result=session.bidAuction(0,amount,id);
 if(!result.success){toast(result.reason);return;}
 if(result.completed)audio.play(result.auction.status==='RESOLVED'?'auction-sold':'event-fail');save();render();runAuctionAI();
}
async function runAuctionAI(){
 if(busy||!active||!session.getAuctionView()?.bidder?.isAI)return;
 const token=epoch;setBusy(true);
 try{
   while(token===epoch&&session.getAuctionView()?.bidder?.isAI){
     await sleep(reduced||aiQuick?70:450);if(token!==epoch)break;
     const result=session.bidAuctionAI();if(!result.success)throw Error(result.reason);
     if(result.completed)audio.play(result.auction.status==='RESOLVED'?'auction-sold':'event-fail');save();
   }
 }catch(e){toast(`竞拍暂停：${e.message}`);}finally{if(token===epoch)setBusy(false);}
}
function renderAIRecap(){
 const panel=$('ai-recap');panel.hidden=!lastAITurns.length;if(panel.hidden)return;
 const delta=n=>`${n<0?'−':'+'}${money(Math.abs(n))}`;
 const key=lastAITurns.map(r=>`${r.round}:${r.name}`).join('|');if(panel.dataset.turn===key)return;panel.dataset.turn=key;
 const open=new Set([...panel.querySelectorAll('details[open]')].map(d=>d.dataset.recap));
 const focused=panel.contains(document.activeElement)?document.activeElement.closest('details')?.dataset.recap:null;
 panel.innerHTML=`<h3>同行回合速报 <small>${lastAITurns.length}人 · 展开看明细</small></h3>`+lastAITurns.map(r=>{const id=`${r.round}:${r.name}`;return `<details class="ai-turn-recap" data-recap="${esc(id)}" ${open.has(id)?'open':''}><summary><strong>${esc(r.name)} · 第${r.round}轮${r.skipped?'跳过':r.partial?'续接':'已完成'}</strong><span>现金净变动 ¥${delta(r.cashDelta)} · ${r.tileId}号 ${esc(r.tileName)}</span>${r.movementStop?`<span class="ai-movement-stop">${esc(r.movementStop)}</span>`:''}</summary><p>${r.skipped?'状态影响，本段没有主动行动。':r.changes.length?r.changes.map(esc).join('<br>'):'本段没有产权或建筑等级变化'}<br>点券 ${delta(r.pointDelta)}${r.completed?` · 完成 ${r.completed} 单委托`:''}</p><p>产权和等级变化也可能来自精灵效果；净变动包含本段奖励、支出及轮末结算。</p><ol>${r.logs.map(log=>`<li>${esc(log)}</li>`).join('')}</ol></details>`;}).join('');
 if(focused)[...panel.querySelectorAll('details')].find(d=>d.dataset.recap===focused)?.querySelector('summary').focus({preventScroll:true});
}
function renderDebtReceipt(){
 const el=$('debt-receipt'),r=debtReceipt(session);el.hidden=!r;if(!r){el.replaceChildren();return;}
 const other=[['出售股票',r.stockSold],['出售建筑',r.buildingSold],['抵押地产',r.mortgaged]].filter(([,v])=>v);
 el.innerHTML=`<h4>${esc(r.name)} · 本次自动偿债</h4><p>${r.tileId}号租金应付 ¥${money(r.due)} · 已向${esc(r.creditor)}支付 ¥${money(r.paid)}<br><strong>${r.bankrupt?`清算后未付差额 ¥${money(r.shortfall)}，已破产退出。`:'已付清，本次没有破产。'}</strong></p><p>自动动用存款 <b>¥${money(r.depositUsed)}</b>${other.map(([label,v])=>`<br>${label}回笼 ¥${money(v)}`).join('')}<br>当前现金 ¥${money(r.cash)} · 剩余存款 ¥${money(r.deposit)}</p><p class="quiet-note">现金不足会先动用存款，再依原规则变现资产；筹款后仍不足才破产。已提取的存款不会再赚利息，后续结息按届时剩余存款计算。${r.bankrupt?'这里是破产时的偿债金额；后续地产竞拍款另列。':''}</p>`;
}
function render(){if(scene)scene.interactionBusy=busy;if(!active||!session.state.players.length)return;const state=session.state,p=session.currentPlayer,focus=session.focus;const properties=[...state.propertyManager.properties.values()];$('players').dataset.count=String(state.players.length);$('round-number').textContent=state.round;$('round-limit').textContent=state.maxRounds;renderCommission();renderAbility();renderStory();renderGarden();renderAIRecap();renderAIProgress();renderTurnGuide();$('map-note-button').disabled=busy||p.isAI||state.phase==='GAME_OVER';$('neighbors-button').disabled=busy;$('neighbors-button').textContent=`码头邻里 · ${DOCK_NEIGHBORS[Math.floor(p.currentTile/8)]?.name||'阿澜'} →`;const stopText=movementStopText(session);$('transport-feedback').textContent=session.lastTransport?.description||stopText;$('transport-feedback').hidden=!session.lastTransport&&!stopText;if(stopText)$('dice-caption').textContent=`原定${session.lastMovementStop.steps+session.lastMovementStop.unused}步 · 围栏截停在${session.lastMovementStop.tileId}号`;$('current-region').textContent=`${coastRegion(p.currentTile).name} · 查看区域机会 ↗`;
 const actor=session.getAuctionView()?.bidder?.id??(!session.awaitingAuctionContinue&&state.phase!=='GAME_OVER'?p.id:null);$('players').innerHTML=state.players.map(player=>`<div class="player-card ${player.id===actor?'current':''}" aria-current="${player.id===actor}"><div class="player-head"><img class="player-avatar" src="${import.meta.env.BASE_URL}shanhai/portraits/${player.characterId||player.profileId}.png" alt=""><strong>${esc(player.name)}</strong><span class="player-tag">${player.isAI?'AI':'你'}${player.isBankrupt?' · 已破产':player.id===actor?state.phase==='AUCTION'?' · 报价':' · 当前':''}</span></div><div class="player-money"><small>¥ </small>${money(player.cash)}</div><div class="player-specialty">${esc(player.skillName)}</div><div class="player-assets">${properties.filter(t=>t.owner===player.id).length} 处地产 · 净值 ${money(state.calculateNetWorth(player))}${player.deposit?` · 存款 ${money(player.deposit)}`:''}${player.id===state.currentPlayerIndex&&player.rentShieldActiveThisTurn&&!player.isBankrupt?' · 本回合免租':''}</div></div>`).join('');
 $('event-log').innerHTML=state.logHistory.slice(-6).reverse().map(log=>`<li>${esc(log.msg.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u,''))}</li>`).join('')||'<li>海湾还很安静，故事正要开始。</li>';
 if(state.assetRevision!==lastRevision){scene.syncProperties(state);lastRevision=state.assetRevision;}
 const counter=fenceCounterplay(session);$('counterplay-button').hidden=!counter||p.isAI;$('counterplay-button').disabled=busy;if(counter)$('counterplay-button').textContent=`前方${counter.distance}步 · ${counter.tileId}号围栏应对 →`;const supply=session.getRemoteSupply();$('supply-button').disabled=busy||p.isAI||!supply.available;$('supply-button').textContent=`补充遥控骰子 · ${supply.cost} 点券（持有 ${supply.points}）`;const n=p.cards.filter(c=>c==='REMOTE_DICE').length;$('remote-count').textContent=n;$('remote-button').disabled=busy||p.isAI||state.phase!=='PRE_ROLL_ACTION'||session.cardUsed||n===0;$('tactics-button').disabled=busy||p.isAI;$('construction-button').disabled=busy||p.isAI||state.phase==='GAME_OVER';$('construction-button').textContent='地产管理 · 周转 / 升级 →';const next=state.mapRuntime.projectPath(p.currentTile,1,p.direction||1)[0];$('route-state').textContent=`当前朝 ${next}号 ${state.getTile(next).name} 行进。${session.cardUsed?'本回合策略机会已使用，请普通掷骰。':'每回合道具、遥控骰子与异地施工共用一次策略机会。'}`;scene.syncObstacles(state);$('action-details').innerHTML='';$('action-buttons').replaceChildren();renderDebtReceipt();
 if(state.phase==='GAME_OVER'){$('action-kicker').textContent='一段旅程，值得纪念';$('action-title').textContent=`${state.winner?.name||chapterName}的本季结算`;$('action-description').textContent=`${chapterName} · 第${Math.min(state.round,state.maxRounds)}轮结束。查看排名、资产与行动回顾，或开启下一季。`;button('查看经营结果',showVictory,'primary',false,'results-button');return;}
 if(state.phase==='AUCTION'||session.awaitingAuctionContinue){renderAuction();return;}
 if(!busy&&canPauseSpectating(session)){
   $('action-kicker').textContent='你的经营已结束 · 按轮旁观';$('action-title').textContent=`旁观暂停 · 第${state.round}轮待继续`;
   $('action-description').textContent=`你已破产，不再参与经营或出价。现金、产权与结算规则照常保留。${lastAITurns.length?'本轮同行回顾已保留在下方，可展开查看。':'刷新前的回顾不会重建；已结算资产和最近动态仍可查看。'}继续后，剩余AI完成当前轮再暂停；到达终局则显示排名。`;
   button('继续旁观这一轮 →',()=>runAI(),'primary',false,'spectator-continue');
   button('保存并回到启程页',()=>{if(save(true).success)returnToWelcome();},'secondary',false,'spectator-menu');return;
 }
 if(busy||p.isAI){$('action-kicker').textContent=p.isAI?'同行者的旅程':'沿海风的方向';$('action-title').textContent=state.pendingMove?`${p.name}正在前往下一站`:`${p.name}正在经营${chapterName}`;$('action-description').textContent=state.pendingMove?`还有 ${state.pendingMove.remainingSteps} 步 · ${state.getTile(p.currentTile).name}`:'对方也遵循同样的骰子、价格和租金规则。';button('旅程进行中…',()=>{},'primary',true);return;}
 if(state.phase==='PRE_ROLL_ACTION'){$('action-kicker').textContent=`${p.name}，轮到你了`;$('action-title').textContent='下一站，会有什么？';$('action-description').textContent=`你有 ¥${money(p.cash)} 现金。掷骰后再决定是否买地；路过也可以保留现金。`; button('掷骰子 · 出发 →',()=>humanRoll(),'primary',false,'roll-button');button(`${chapterMap.tiles[12].name} · 经营账本 →`,showCommerce,'secondary',false,'commerce-open');if(session.getTransportOptions().length)button('⚓ 查看跨区船票 →',showTransport,'secondary',false,'transport-open');return;}
 if(session.pendingEvent){
   $('action-kicker').textContent=`${coastRegion(p.currentTile).name} · ${highland?'山城':'海岛'}来信`;
   $('action-title').textContent=focus.title;$('action-description').textContent=focus.description;
   $('action-details').innerHTML='<p class="event-risk-note">费用先付；成功概率、失败回收及净收益见各方案。请选择一个方案后继续；无投入方案始终可选。</p>';
   for(const choice of session.getIslandChoices()){
     const b=button('',()=>{const result=session.chooseIslandEvent(choice.id);if(!result.success){toast(result.reason);return;}onLanding(session.focus);announceCommission(result);save();render();},'event-choice',Boolean(choice.blockedReason));
     b.dataset.eventChoice=choice.id;
     b.innerHTML=`<strong>${esc(choice.name)}<span>${choice.chance?`${choice.chance}% 成功`:'确定结果'}</span></strong><small>${esc(choice.detail)}</small>${choice.routePreview?`<small class="trail-route-preview">${[['current','保持方向'],['reverse','付费返程后']].map(([key,label])=>{const r=choice.routePreview[key];return `${label} · 1–3步停点：${r.stops.slice(0,3).map(o=>`${o.tileId}号 ${esc(o.name)}${o.obstacleStop?'（围栏截停）':''}`).join(' / ')}<br>1–6步参考平均租金 ¥${money(r.meanRent)}`;}).join('<hr>')}<br>仅按当前产权、围栏和普通骰子估算，不含个人状态及随机事件；低租金也可能错过委托。付款后现金 ¥${money(p.cash-choice.cost)}。</small>`:''}${choice.blockedReason?`<em>${esc(choice.blockedReason)}</em>`:''}`;
   }
   return;
 }
 if(focus){const tile=state.getTile(focus.tileId),prop=state.propertyManager.getProperty(tile.id),cost=focus.cost||0;const isBuy=focus.kind==='PURCHASE',isUpgrade=focus.kind==='UPGRADE';$('action-kicker').textContent=isBuy?'一处等待你的风景':isUpgrade?'让你的街区，再长大一点':focus.kind==='RENT'?'路过邻居的风景':'海湾来信';$('action-title').textContent=focus.title||tile.name;
   if(isBuy||isUpgrade){$('action-description').textContent=isBuy?(tile.type==='BIG_PROPERTY'?`${chapterMap.tiles[12].name}可以经营商业，访客消费还能领取点券。`:'这里还是一块空地。买下它，下一次回来就能开始建造。'):`目前是 LV.${prop.level}，升级后将出现全新的建筑轮廓。`;
    $('action-details').innerHTML=`<div class="price-preview"><span>${isBuy?'购地价格':'升级费用'} <b>¥${money(cost)}</b></span><span>余额 <b>¥${money(p.cash-cost)}</b></span></div><div class="action-note">基础租金：${(tile.tolls||[]).map((n,i)=>`${i===prop.level?'● ':''}L${i} ¥${money(n)}`).join(' / ')}<br>实际租金由建筑类型、街区垄断与事件共同计算。</div>`;
    const choice=propertyDecision(state,p,tile.id,focus.kind,cost);
    if(choice){$('action-details').innerHTML=`<div class="price-preview"><span>${isBuy?'实付购地':'实付升级'} <b>¥${money(cost)}</b></span><span>支付后现金 <b>¥${money(choice.cashAfter)}</b></span></div><p class="decision-income">本站参考租金 <b>¥${money(choice.current)} → ¥${money(choice.after)}</b>（+${money(choice.increase)}）<br>只有对手实际停靠才收租，不是每轮收入。</p><p class="decision-risk">${choice.threat?`前方6步中，对手最高参考租金为 ${choice.threat.tileId}号${esc(choice.threat.name)} ¥${money(choice.threat.rent)}。${choice.cashAfter<choice.threat.rent?'支付后现金不足这一次参考租金，可考虑先路过。':'是否停靠取决于后续路线。'}`:'前方6步暂无对手收租地；这不保证后续没有事件支出。'}</p><small class="decision-footnote">含当前物价与新闻，个人状态会影响实付；余额未计随后可能获得的委托奖励。</small>`;}
    const blockedReason=session.getPropertyBlockReason();
    if(tile.type==='BIG_PROPERTY'&&isBuy){
      $('action-description').textContent='两种经营方向，同样购地价；先看你是否已拥有邻地。';$('action-details').innerHTML=`<div class="price-preview"><span>购地 ¥${money(cost)}</span><span>购后余额 ¥${money(p.cash-cost)}</span></div>`;
      for(const b of session.getCommerceOptions(tile.id)){$('action-details').insertAdjacentHTML('beforeend',businessCard(b,{buy:true}));const choice=button(`经营${b.name} · ¥${money(cost)}`,()=>decide('purchase',b.id),'primary',Boolean(blockedReason));choice.dataset.businessBuy=b.id;}$('action-details').insertAdjacentHTML('beforeend','<p class="action-note">参考租金包含当前物价和新闻，个人状态可能改变实际结算。邻地数字表示一次落地租金，并非每轮自动收益。</p>');
    }else{
      if(tile.type==='BIG_PROPERTY'){
        const b=session.getCommerceOptions(tile.id).find(b=>b.current);
        if(b){$('action-description').textContent=`${b.name}：${b.tiers[b.level]} → ${b.tiers[b.level+1]}`;$('action-details').innerHTML=`<div class="price-preview"><span>实付升级 ¥${money(cost)}</span><span>升级后余额 ¥${money(p.cash-cost)}</span></div><p class="action-note">本站参考租金 ¥${money(b.rent)} → ¥${money(b.nextRent)}；访客点券 ${b.visitorPoints} → ${b.visitorPoints+10}。${b.id==='PARK'?'邻地加成仍为20%，本次升级不增加租金。':'访客实际付租后获点券。'}<br>个人状态可能改变最终租金；可选择路过，保留现金。</p>`;}
      }
      button(`${isBuy?'买下这块地':'升级至 LV.'+(prop.level+1)} · ¥${money(cost)}`,()=>decide(isBuy?'purchase':'upgrade'),'primary',Boolean(blockedReason),'decision-button');
    }
    if(blockedReason)$('action-description').textContent+=` ${blockedReason}。`;
    button('这次先路过 →',finishTurn,'secondary',false,'skip-button');
   }else{let desc=focus.description||'这一站的故事已记录在海湾动态中。';if(focus.kind==='DONE')desc='经营操作已经完成。产权、现金与建筑等级都已保存。';if(focus.kind==='RENT'){const r=focus.result.rentResult||focus.result;desc=r.type==='RENT_WAIVED'?`本次免租，无需向 ${state.players[prop.owner]?.name||'业主'} 支付租金。`:`已向 ${state.players[prop.owner]?.name||'业主'} 支付租金 ¥${money(r.toll??r.amount??r.amountDue??0)}，结算已写入动态。`;}const facility=focus.result.events?.find(e=>e.type==='COMMERCIAL_FACILITY_VISITED');if(facility)desc+=` ${facility.title}：${facility.detail}。`;if(focus.kind==='OWN_MAX'&&tile.type==='BIG_PROPERTY')desc='已达到当前经营类型最高等级；下一回合掷骰前可在经营账本查看改建方案。';if(focus.result.chance)desc=focus.result.chance.desc||desc;$('action-description').textContent=desc;if(highland&&p.currentTile===20&&!p.isBankrupt)button('林场储蓄亭 · 存入 / 取出 →',showSavings,'secondary',false,'savings-open');button(focus.kind==='BANKRUPT'?'继续剩余对局 →':'结束回合 →',finishTurn,'primary',false,'end-turn-button');}
 }
}
function showSavings(){
 if(!active||busy||session.currentPlayer.isAI)return;
 const p=session.currentPlayer,options=session.getSavingsOptions(),q=options[0];if(!q)return;
 openModal(`<span class="overline">FOREST PUBLIC SAVINGS · 20</span><h2>林场储蓄亭</h2><button id="savings-look" class="secondary">在地图近看储蓄亭 →</button><p>先领取原补给30点券，再自愿办理存取；也可直接结束回合。现金用于买地与出价，存款仍计入净值。</p><p class="savings-balances">现金 <b>¥${money(p.cash)}</b> · 存款 <b>¥${money(p.deposit||0)}</b></p><p>${q.settlesThisSeason?`下一次结息在进入第 ${q.settlementRound} 轮时，按当时存款的5%计入存款。当前余额届时约获 ¥${money(q.currentInterest)}。`:'本季结束前已没有下一次结息；存款仍计入净值。'}之后若取款、偿债或余额变化，利息也会变化。</p><p>主动取款也须实际停靠20号亭，同次停靠可办理存取。欠租时，原自动偿债会先动用存款，不是资产保护箱；不要把近期买地、出价所需现金全存下。</p><div class="savings-options">${options.map(o=>`<article><h3>${o.label}</h3><p>办理后现金 ¥${money(o.cashAfter)} · 存款 ¥${money(o.depositAfter)}${o.settlesThisSeason?`<br>若余额不再变化，下次结息约 ¥${money(o.projectedInterest)}`:''}</p>${o.blockedReason?`<p>${esc(o.blockedReason)}</p>`:''}<button class="secondary" data-savings="${o.id}" ${o.blockedReason?'disabled':''}>${o.label}</button></article>`).join('')}</div><p class="quiet-note">存取不消耗卡片、不移动、不重复发点券；同一次停靠可分次存入。</p><button id="savings-map-note" class="secondary">读星罗的测绘便笺 →</button>`);
 $('savings-map-note').onclick=()=>showMapNote();
 $('savings-look').onclick=()=>{closeModal();scene.focusCrowd(20);document.querySelector('.world-panel').scrollIntoView({block:'start'});};
 document.querySelectorAll('[data-savings]').forEach(b=>b.onclick=()=>{
  if(busy||session.currentPlayer.isAI)return;const r=session.useSavings(b.dataset.savings);if(!r.success){toast(r.reason);showSavings();return;}
  scene.highlight(20);scene.react(session.currentPlayer.id,'notice');audio.play('purchase');save();render();
  openModal(`<h2>林场办理完成</h2><p id="savings-receipt">${esc(r.description)}</p><p>存款仍计入净值，现金留作沿途经营。关掉窗口后可结束回合。</p><button id="savings-return" class="secondary">返回储蓄亭</button>`);$('savings-return').onclick=showSavings;
 });
}
function renderAbility(){
 const p=session.state.players[0],a=session.getAbilityPreview(p);
 $('ability-panel').innerHTML=`<div class="commission-heading"><span>✦ ${esc(p.name)} · ${a.name}</span><small>每三轮一次</small></div><p>${esc(a.description)}</p><p>${a.reward.cardId?`消耗 ${a.cashCost?`¥${money(a.cashCost)}`:`${a.cost}点券`} · 获得一张${a.reward.cardName}`:`消耗 ${a.cost} 点券 · 获得 ¥${money(a.reward.cash)}${a.reward.points?` ＋ ${a.reward.points} 点券`:''}`}</p><button id="ability-button" class="commission-open" ${busy||a.blockedReason?'disabled':''}>${esc(a.blockedReason||`使用${a.name} →`)}</button>${a.last?`<p class="ability-last" role="status">${esc(a.last)}</p>`:''}`;
 $('ability-button').onclick=async()=>{if(busy||session.currentPlayer.isAI)return;setBusy(true);try{const result=session.useAbility();if(!result.success)throw Error(result.reason);await animateAbility(result);save();}catch(e){toast(e.message);}finally{setBusy(false);}};
}
async function animateAbility(result){if(result.type==='CONSTRUCTION_COMPLETED'){scene.syncProperties(session.state);scene.highlight(result.tileId);showTacticResult(result);speak('upgrade',result.description);audio.play('upgrade');toast(result.description);const reaction=scene.react(session.currentPlayer.id,'celebrate');if(!quickAI())await reaction;return;}if(result.tacticName)showTacticResult(result);speak('ability',result.tacticName||result.abilityName||(result.abilityId==='RELAY'?'驿站接力':'社区花市'));audio.play(result.type==='ABILITY_USED'?'ability':'purchase');toast(result.description);const reaction=scene.react(session.currentPlayer.id,'ability');if(!quickAI())await reaction;}
function renderCommission(){
 const player=session.state.players[0],career=session.careers[player.id],task=career?.active;
 const canAccept=!busy&&!session.currentPlayer.isAI&&session.state.phase==='PRE_ROLL_ACTION'&&!task&&career?.settledRound!==session.state.round;
 const story=session.getStoryStatus(player),delivery=task?.kind==='DELIVERY';
 scene?.setCommissionTarget?.(session.state.phase==='GAME_OVER'?null:delivery?task.targetId:story.stage>=(highland?1:2)&&story.stage<=3?story.targetId:null,delivery?'✉ 委托目的地':`✦ ${session.storyName}目标`);
 let content='';
 if(task){
   const reward=session.commissionReward(task.kind,player),name=task.kind==='DELIVERY'?'海风速递':'街区焕新';
   const target=task.kind==='DELIVERY'?`停靠 ${session.state.getTile(task.targetId).name}`:'落地买地或升级（不含异地施工）';
   content=`<strong>${name} · ${target}</strong><p>第 ${task.dueRound} 轮你的回合结束前完成 · 剩余 ${Math.max(0,task.dueRound-session.state.round+1)} 轮</p><div class="commission-reward">¥${money(reward.cash)} <span>＋ ${reward.points} 点券${reward.specialist?' · 专长加成':''}</span></div>`;
 }else{
   const last=career?.last;
   content=last?.status==='COMPLETE'?`<strong>✓ 委托已完成</strong><p>到账 ¥${money(last.cash)} ＋ ${esc(last.points)} 点券${last.specialist?'，含专长奖励':''}。</p>`:last?.status==='EXPIRED'?'<strong>上份委托已到期</strong><p>没有扣款，选择适合这一程的新委托。</p>':'<strong>让这一程，多一个目标。</strong><p>速递赚现金，焕新攒点券。接单免费，到期不扣款。</p>';
   content+=`<button id="commission-open" class="commission-open" ${canAccept?'':'disabled'}>${canAccept?'查看两份委托 →':session.state.phase==='GAME_OVER'?'本季已结束':career?.settledRound===session.state.round?'下轮可接新委托':'掷骰前可接委托'}</button>`;
 }
 $('commission-panel').innerHTML=`<div class="commission-heading"><span>✉ ${highland?'山城':'海湾'}委托</span><small>已完成 ${esc(career?.completed||0)} 单</small></div>${content}`;
 const open=$('commission-open');if(open)open.onclick=()=>{
   if(!canAccept)return;
   openModal(`<span class="overline">BLUE BAY COMMUNITY BOARD</span><h2>${chapterName}，正在等你。</h2><p>每人同时接一单，结单当轮不能再接。${esc(player.skillName)}：${esc(player.skillDesc)}</p><div class="commission-offers">${session.getCommissionOffers(player).map(offer=>`<article class="commission-offer ${offer.specialist?'specialist':''}"><span>${offer.kind==='DELIVERY'?'✉ 海岛物流':'❀ 街区共建'}${offer.specialist?' · 你的专长':''}</span><h3>${offer.title}</h3><p>${esc(offer.description)}</p><div class="commission-reward">¥${money(offer.cash)} <span>＋ ${offer.points} 点券</span></div><small>第 ${offer.dueRound} 轮你的回合结束前有效</small><button class="primary" data-commission="${offer.kind}">接下这份委托</button></article>`).join('')}</div>`);
   document.querySelectorAll('[data-commission]').forEach(b=>b.onclick=()=>{const result=session.acceptCommission(b.dataset.commission);if(result.success){closeModal();toast('委托已记下，沿路去完成吧。');save();render();revealAction();}else toast(result.reason);});
 };
}
async function frameWalkingRoute(){const p=session.currentPlayer,steps=session.state.pendingMove?.remainingSteps||0;await scene.frameJourney([p.currentTile,...session.state.mapRuntime.projectPath(p.currentTile,steps,p.direction||1)],reduced||quickAI()?0:220/speed);}
async function animateDice(result){await frameWalkingRoute();audio.play('dice');scene.rollDice(result.dice?.[0]||result.steps||1,duration(720));$('dice-stage').classList.add('show');$('dice-face').classList.add('rolling');$('dice-caption').textContent=`${session.currentPlayer.name} · 骰子滚动中`;const symbols=['⚀','⚁','⚂','⚃','⚄','⚅'];let n=0;const tick=setInterval(()=>$('dice-face').textContent=symbols[n++%6],65);await sleep(duration(720));clearInterval(tick);const value=result.dice?.[0]||result.steps||1;$('dice-face').textContent=symbols[(value-1)%6];$('dice-face').classList.remove('rolling');$('dice-caption').textContent=`掷出 ${result.steps} 步`;await sleep(duration(260));}
async function moveSteps(){const token=epoch;while(session.state.pendingMove&&token===epoch){const playerId=session.currentPlayer.id;const result=session.advanceMove();if(!result.success)throw Error(result.reason);audio.play('step');await scene.move(playerId,session.currentPlayer.currentTile,duration(320),Boolean(session.state.pendingMove?.remainingSteps>0));save();}if(token!==epoch)return false;return true;}
async function continueHumanMovement(){if(busy)return;setBusy(true);try{await frameWalkingRoute();if(await moveSteps()){const result=session.resolveLanding();onLanding(result.focus||session.focus);announceCommission(result);save();}}catch(e){toast(`行程暂停：${e.message}`);}finally{setBusy(false);runAuctionAI();}}
async function humanRoll(remote=null){if(busy||session.currentPlayer.isAI)return;audio.unlock();setBusy(true);try{const r=remote===null?session.roll():session.useRemoteDice(remote);if(!r.success)throw Error(r.reason);await animateDice(remote===null?r:session.lastRoll);if(await moveSteps()){const result=session.resolveLanding();onLanding(result.focus||session.focus);announceCommission(result);save();}}catch(e){toast(e.message);}finally{setBusy(false);runAuctionAI();}}
function showTransport(){
 if(busy||session.currentPlayer.isAI||session.state.phase!=='PRE_ROLL_ACTION')return;
 const options=session.getTransportOptions();if(!options.length)return;
 const first=options[0],target=first.destination;
 scene.setTransportRoute?.(first.from,target.tileId);
 openModal(`<span class="overline">BLUE BAY WATER TRANSIT</span><h2>${esc(first.routeName)} · 跨区船票</h2><div class="transport-itinerary"><span>${first.from}号 ${esc(session.state.getTile(first.from).name)}</span><b>→</b><strong>${target.tileId}号 ${esc(target.name)}</strong><small>${esc(target.region.name)} · ${esc(travelDescription(target))}</small></div><p>乘船替代本回合掷骰，不消耗遥控卡。跳过的地点不触发奖励、租金或委托；跨过起点不领 ¥2,000。抵达后仍需支付租金或购地费用。</p><div class="transport-options">${options.map(o=>`<button class="event-choice" data-transport="${o.id}" ${o.blockedReason?'disabled':''}><strong>${o.name}<span>¥${o.fare}</span></strong><small>${o.chance===100?'保证到达目的地':`${o.chance}% 抵达目的地；${100-o.chance}% 改靠 ${o.alternative.tileId}号 ${esc(o.alternative.name)}，到站选择「${esc(o.alternative.event.title)}」`}<br>船费不退 · 付船费后现金 ¥${money(session.currentPlayer.cash-o.fare)}${target.cost!==null?` · 再${target.kind==='PURCHASE'?'购地':'升级'}后 ¥${money(session.currentPlayer.cash-o.fare-target.cost)}`:''}</small>${o.blockedReason?`<em>${o.blockedReason}</em>`:''}</button>`).join('')}</div><button class="secondary" id="transport-cancel">留在环路，暂不买票</button>`);
 document.querySelectorAll('[data-transport]').forEach(b=>b.onclick=()=>{closeModal();humanTransport(first.routeId,b.dataset.transport);});
 $('transport-cancel').onclick=closeModal;
}
async function animateTransport(trip){
 scene.overview();audio.play('step');banner(trip.diverted?'潮汐变化 · 船只改靠': '跨区航线 · 沿海出发');
 const p=session.currentPlayer,destination=`${trip.tileId}号 ${session.state.getTile(trip.tileId).name}`;
 await scene.travelByBoat(p.id,trip.from,trip.tileId,duration(1600),stage=>{const label={boarding:'登船',sailing:trip.diverted?'潮流改靠':'航行',alighting:'下船',arrival:'已抵达'}[stage];speak(stage==='sailing'&&trip.diverted?'diverted':stage,`${label} · ${destination}`,p);banner(`${p.name} · ${label} · ${destination}`);if(stage==='boarding'||stage==='alighting')audio.play('step');});
 toast(trip.description);save();
}
async function humanTransport(routeId,serviceId){
 if(busy||session.currentPlayer.isAI)return;
 audio.unlock();setBusy(true);
 try{
   const result=session.takeTransport(routeId,serviceId);if(!result.success)throw Error(result.reason);
   await animateTransport(result.transport);
   const landing=session.resolveLanding();onLanding(landing.focus||session.focus);announceCommission(landing);save();
 }catch(e){toast(`航程暂停：${e.message}`);}finally{setBusy(false);runAuctionAI();}
}
function announceCommission(result){if(result?.commission){const r=result.commission;speak('commission','委托已完成');audio.play('purchase');toast(`委托完成 · +¥${money(r.cash)} / +${r.points} 点券${r.specialist?' · 专长加成':''}${result.commission.storyAdvanced?' · 故事下一站：8号小栀':''}`);}}
function onLanding(focus){if(!focus)return;const p=session.currentPlayer;scene.highlight(p.currentTile);if(focus.kind==='BANKRUPT'){speak('setback','资产清算，本季退出');audio.play('bankruptcy');scene.react(p.id,'disappointed');toast(focus.description);}else if(focus.kind==='RENT'){const facility=focus.result?.events?.find(e=>e.type==='COMMERCIAL_FACILITY_VISITED');speak('rent',facility?`${facility.title} · +${facility.amount} 点券`:'租金已结算');audio.play('rent');scene.react(p.id,'disappointed');}else if(['SPECIAL','ISLAND_EVENT','EVENT_DONE'].includes(focus.kind)){speak(focus.kind==='EVENT_DONE'?(focus.result?.won===false?'setback':'success'):'event',focus.title);audio.play(focus.kind==='EVENT_DONE'?(focus.result?.won===false?'event-fail':'event-success'):'event');scene.react(p.id,focus.kind==='EVENT_DONE'?(focus.result?.won===false?'disappointed':'celebrate'):'notice');toast(`${focus.title}：${focus.description}`);}else audio.play('turn');}
async function decide(which,buildingType){if(busy)return;const p=session.currentPlayer;setBusy(true);try{const result=session[which](buildingType);if(!result.success)throw Error(result.reason);speak(which,session.focus.title);audio.play(which==='purchase'?'purchase':'upgrade');toast(which==='purchase'?`${p.name}买下了${session.focus.title}。`:`${session.focus.title}升级至 LV.${result.level}。`);await scene.react(p.id,'celebrate');announceCommission(result);save();}catch(e){toast(e.message);}finally{setBusy(false);}}
async function finishTurn(){if(busy)return;const before=new Map(session.state.players.filter(p=>p.isAI&&!p.isBankrupt).map(p=>[p.id,captureAITurn(session,p)]));const r=session.endTurn();if(!r.success){toast(r.reason);return;}save();lastAITurns=[];if(session.state.phase==='GAME_OVER'){render();showVictory();return;}if(!session.currentPlayer.isAI){lastAITurns=[...before.values()].map(b=>({...summarizeAITurn(session,b),skipped:true}));render();revealAction();banner(`${session.currentPlayer.name}，轮到你了。`);return;}await runAI(before.get(session.currentPlayer.id));}
async function runAI(initialBefore=null){if(busy||!active)return;const token=epoch,watchRound=session.state.round;setBusy(true);try{while(session.currentPlayer?.isAI&&session.state.phase!=='GAME_OVER'&&token===epoch){if(lastAITurns[0]?.round!==session.state.round){lastAITurns=[];renderAIRecap();renderAIProgress();}banner(`${session.currentPlayer.name} · 开始经营`);await sleep(duration(450));const aiId=session.currentPlayer.id,beforeAI=initialBefore||captureAITurn(session);initialBefore=null;beforeAI.round=session.state.round;if(session.state.pendingMove)await frameWalkingRoute();const result=await session.playAITurn({onRoll:animateDice,onTransport:animateTransport,onAbility:animateAbility,onStep:async()=>{audio.play('step');await scene.move(aiId,session.currentPlayer.currentTile,duration(300),Boolean(session.state.pendingMove?.remainingSteps>0));save();},onLanding:async focus=>{beforeAI.movementStop=movementStopText(session);onLanding(focus);await sleep(duration(650));}});if(!result.success)throw Error(result.reason);lastAITurns.push(summarizeAITurn(session,beforeAI));renderAIRecap();renderAIProgress();save();if(result.type==='AUCTION_PENDING'||(session.state.round!==watchRound&&canPauseSpectating(session)))break;}if(session.state.phase==='GAME_OVER')showVictory();else if(canPauseSpectating(session)){banner('本轮旁观结束 · 可查看回顾或暂别');}else if(session.state.phase!=='AUCTION'&&!session.awaitingAuctionContinue){audio.play('turn');banner(`${session.currentPlayer.name}，轮到你了。`);}}catch(e){toast(`AI行程暂停：${e.message}`);}finally{setBusy(false);runAuctionAI();}}
function showConstruction(tileId=null){
 if(!active||busy||session.currentPlayer.isAI)return;
 const options=session.getConstructionOptions(),choice=options.find(o=>o.tileId===tileId),q=choice?session.getPropertyFinance(tileId):null;
 const signed=n=>`${n>0?'+':n<0?'−':''}¥${money(Math.abs(n))}`;
 const remaining=cash=>q?.threat?`<small>若付该笔租金，余 ${signed(cash-q.threat.rent)}</small>`:'';
 const comparison=q?`<section class="property-cash-plan" aria-label="现金与租金比较"><h3>${choice.tileId}号 ${esc(choice.name)} · L${choice.level}${q.isMortgaged?' · 已抵押':''}</h3><p>${q.threat?`前方1–6步最高参考租金：${q.threat.tileId}号 ${esc(q.threat.name)} <b>¥${money(q.threat.rent)}</b>。`:'前方1–6步暂无对手参考租金。'}按当前方向与围栏估算；不保证停靠，不含个人免租及后续事件支出。</p><table><thead><tr><th scope="col">方案</th><th scope="col">操作后现金</th><th scope="col">本站租金 / 次</th></tr></thead><tbody><tr><th scope="row">保持现状</th><td>¥${money(q.cash)}${remaining(q.cash)}</td><td>¥${money(q.currentRent)}</td></tr><tr><th scope="row">${q.isMortgaged?'赎回':'抵押'}<small>${signed(q.cashDelta)}</small></th><td>¥${money(q.cashAfter)}${remaining(q.cashAfter)}</td><td>¥${money(q.afterRent)}</td></tr><tr><th scope="row">异地升级<small>${signed(-choice.cost)}</small></th><td>¥${money(choice.cashAfter)}${remaining(choice.cashAfter)}</td><td>¥${money(choice.nextRent)}</td></tr></tbody></table><p class="quiet-note">仅比较一次操作；租金需对手实际停靠，不是每轮收入。受限制的方案只是参考报价，不能执行。</p><p>${q.isMortgaged?`赎回支付 ¥${money(q.redeemCost)}，含原抵押款 ¥${money(q.principal)} 与 ¥${money(q.fee)} 手续费。`:`抵押到账 ¥${money(q.principal)}（土地原价一半）；保留产权，本站停租。日后赎回需 ¥${money(q.redeemCost)}，含 ¥${money(q.fee)} 手续费。`}即刻净值变化 ${signed(q.netWorthDelta)}，抵押款不是收入。花园抵押期间也暂停访客回馈与邻地加成。</p>${q.affected.length?`<details class="finance-affected"><summary>${q.isMortgaged?'赎回':'抵押'}还影响 ${q.affected.length} 处自有地产租金</summary>${q.affected.map(r=>`<p>${r.tileId}号 ${esc(r.name)}：¥${money(r.before)} → ¥${money(r.after)} / 次</p>`).join('')}</details>`:''}${q.blockedReason?`<p class="finance-blocked">${esc(q.blockedReason)}</p>`:''}<button id="finance-confirm" class="secondary" data-finance-action="${q.action}" ${q.blockedReason?'disabled':''}>${q.isMortgaged?`支付 ¥${money(q.redeemCost)}，赎回地产`:`抵押停租，获得 ¥${money(q.principal)}`}</button></section>`:'';
 openModal(`<span class="overline">PROPERTY CASH CHOICES</span><h2>地产周转与施工</h2>${choice?comparison:'<p>选择自有地产，比较保持现状、抵押或赎回、异地升级的现金和租金。掷骰前才能操作；抵押与赎回沿用原规则，不占策略机会。</p>'}${choice?`<article class="construction-quote"><h3>异地施工 · L${choice.level} → L${choice.nextLevel}</h3><p>升级 ¥${money(choice.upgradeCost)} ＋ 上门费 ¥${choice.fee} ＝ <b>¥${money(choice.cost)}</b><br>即刻净值变化 <b>${signed(choice.netWorthDelta)}</b>（现金支出与建筑估值合计）</p><p>${choice.nearRival?'对手前方6步内包含此地；遥控、转向或交通可能改变路线。':'此地不在对手当前前方6步内，短期可能没有访客。'}</p>${choice.blockedReason?`<p>${esc(choice.blockedReason)}</p>`:''}<button id="construction-confirm" class="primary" ${choice.blockedReason?'disabled':''}>确认施工 · ¥${money(choice.cost)}</button><button id="construction-back" class="secondary">返回地产列表，暂不施工</button></article>`:`<div class="construction-options">${options.map(o=>{const f=session.getPropertyFinance(o.tileId);return `<button class="secondary" data-construction="${o.tileId}"><strong>${o.tileId}号 ${esc(o.name)} · L${o.level}${f.isMortgaged?' · 已抵押':''}</strong><small>当前租金 ¥${money(o.currentRent)} · ${f.blockedReason||`${f.isMortgaged?'赎回支付':'抵押可得'} ¥${money(f.isMortgaged?f.redeemCost:f.principal)}`}</small></button>`;}).join('')||'<p>还没有自有地产。先沿路买地，再比较周转方案。</p>'}</div>`}<details class="property-management-rules"><summary>抵押与施工规则</summary><p>抵押只适用于无建筑的自有地，不会自动拆楼；保留产权与建筑类型，抵押款不增加净值。赎回需原抵押款加10%手续费。抵押、赎回不消耗策略机会。</p><p>第 ${CONSTRUCTION_ROUND} 轮起，掷骰前可异地升级一次：正常升级费＋¥${CONSTRUCTION_FEE} 上门费，占本回合策略机会。不能再用道具、遥控或掷骰前乘船，仍须普通掷骰。原地落地升级免上门费，异地施工不完成焕新委托。${session.state.maxRounds}轮末按净值决胜。</p></details>`);
 document.querySelectorAll('[data-construction]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.construction);scene.highlight(id);showConstruction(id);});
 if($('construction-back'))$('construction-back').onclick=()=>showConstruction();
 if($('finance-confirm'))$('finance-confirm').onclick=()=>{
   if(busy||session.currentPlayer.isAI)return;
   const result=session.financeProperty(tileId,q.action);
   if(!result.success){toast(result.reason);showConstruction(tileId);return;}
   save();render();audio.play('purchase');
   // A receipt prevents a double click from immediately reversing the operation.
   openModal(`<h2>${q.isMortgaged?'赎回完成':'抵押完成'}</h2><p id="finance-receipt">${tileId}号 ${esc(choice.name)} · ${q.isMortgaged?'支付':'到账'} ¥${money(q.isMortgaged?result.cost:result.value)}<br>当前现金 ¥${money(session.currentPlayer.cash)} · 本站参考租金 ¥${money(session.state.propertyManager.calculateToll(tileId,session.state.newsEffect,session.state.priceIndex))}</p><p>产权保留，仍在掷骰前。${q.isMortgaged?'租金与设施效果按规则恢复。':'本站停租；如为花园，邻地加成与访客回馈暂停。'}</p><button id="finance-return" class="secondary">返回地产比较</button>`);
   $('finance-return').onclick=()=>showConstruction(tileId);
 };
 if($('construction-confirm'))$('construction-confirm').onclick=async()=>{if(busy||session.currentPlayer.isAI)return;const result=session.contractUpgrade(tileId);if(!result.success){toast(result.reason);showConstruction(tileId);return;}closeModal();save();setBusy(true);try{await animateAbility(result);}finally{setBusy(false);}};
}
$('construction-button').onclick=()=>showConstruction();
function showCounterplay(){
 if(!active||busy||session.currentPlayer.isAI)return;const c=fenceCounterplay(session);if(!c)return;
 const tactics=session.getTactics(),clear=tactics.find(t=>t.id==='CLEAR_ROAD'),reverse=tactics.find(t=>t.id==='TURN_AROUND');
 const option=(key,label)=>{const r=c[key];return `<article><h3>${label}</h3><p>1–3步停点：${r.stops.slice(0,3).map(t=>`${t.tileId}号 ${esc(t.name)}${t.obstacleStop?'（截停）':''}`).join(' / ')}</p><p>普通骰子1–6步参考平均租金 <b>¥${money(r.meanRent)}</b></p></article>`;};
 const action=(t,id,label)=>`<button class="secondary" id="${id}" ${(t.count?t.useBlocked:t.buyBlocked)?'disabled':''}>${t.count?`${label} · 用1张已有卡`:`去背包兑换${t.name} · ${t.cost}点券`}</button><small>${esc((t.count?t.useBlocked:t.buyBlocked)||'确认目标后才消耗；兑换与使用是两步操作。')}</small>`;
 openModal(`<span class="overline">READ THE ROAD, CHOOSE YOUR RESPONSE</span><h2>${c.tileId}号 ${esc(c.name)} · 围栏应对</h2><p>下一位经过者（可能是你或对手）会在这里停下，围栏随即移除；仍需正常支付该站租金。围栏也可能挡住后面的高租金，不一定值得拆。</p><div class="counter-options">${option('keep','保留围栏 · 不花卡')}${option('clear','清除这一处 · 继续按原方向走')}${action(clear,'counter-clear','选择清路目标')}${option('reverse','自己转向 · 从另一侧出发')}${action(reverse,'counter-reverse','选择自己转向')}</div><p class="quiet-note">比较当前可见产权与围栏，未计个人状态或随机事件，也不是收益保证。清路只移除选中的一处围栏；使用清路或转向后仍须普通掷骰，本回合不能再遥控、乘船或异地施工。</p><button id="counter-keep" class="primary">保留现状，返回回合</button>`);
 const pick=(t,target)=>{if(!t.count){showTactics();return;}showTacticTarget(t.id);$('tactic-target').value=String(target);$('tactic-target').onchange();};
 $('counter-clear').onclick=()=>pick(clear,c.tileId);$('counter-reverse').onclick=()=>pick(reverse,session.currentPlayer.id);$('counter-keep').onclick=closeModal;
}
$('counterplay-button').onclick=showCounterplay;
function showTactics(){
 if(!active||busy||session.currentPlayer.isAI)return;
 openModal(`<span class="overline">ROUTE TACTICS</span><h2>策略背包</h2><p>持有 ${session.currentPlayer.cardPoints} 点券。掷骰前兑换；每回合策略卡、遥控骰子与异地施工共用一次策略机会。使用道具后仍须普通掷骰，本回合不能再遥控或乘船。未开放的收藏保留在存档中。</p><div class="tactic-cards">${session.getTactics().map(t=>`<article><h3>${t.symbol} ${t.name} <small>持有 ${t.count}</small></h3><p>${t.detail}</p><div class="tactic-actions"><button class="secondary" data-tactic-buy="${t.id}" ${t.buyBlocked?'disabled':''}>兑换 · ${t.cost} 点券</button><button class="primary" data-tactic-pick="${t.id}" ${t.useBlocked?'disabled':''}>选择目标</button></div><small>${esc(t.useBlocked||'可使用；确认目标后才消耗')}${t.buyBlocked?` · 兑换：${esc(t.buyBlocked)}`:''}</small></article>`).join('')}</div>`);
 document.querySelectorAll('[data-tactic-buy]').forEach(b=>b.onclick=()=>{const r=session.buyTactic(b.dataset.tacticBuy);toast(r.success?'已放入策略背包':r.reason);showTactics();});
 document.querySelectorAll('[data-tactic-pick]').forEach(b=>b.onclick=()=>showTacticTarget(b.dataset.tacticPick));
}
function showTacticTarget(id){
 const t=session.getTactics().find(t=>t.id===id);if(!t||t.useBlocked)return;
 openModal(`<span class="overline">CHOOSE A TARGET</span><h2>${t.name}</h2><p>${t.detail}</p><button id="tactic-map" class="secondary">在棋盘上选取 →</button><label for="tactic-target">列表选择（支持键盘）</label><select id="tactic-target">${t.targets.map(o=>`<option value="${o.id}">${['TURN_AROUND','SWAP_STOPS','BORROW_PASS'].includes(id)?'':`${o.id}号 `}${esc(o.label)} ${esc(o.description||'')}</option>`).join('')}</select><p id="tactic-preview" class="story-detail"></p><p>消耗背包中的1张卡，不再扣点券；本回合之后只可普通掷骰。</p><button id="tactic-confirm" class="primary">确认使用</button><button id="tactic-back" class="secondary">返回背包</button>`);
 const preview=()=>{const target=t.targets.find(o=>String(o.id)===$('tactic-target').value);$('tactic-preview').textContent=target.detail;scene.highlight(['TURN_AROUND','SWAP_STOPS','BORROW_PASS'].includes(id)?session.state.players[target.id].currentTile:target.id);};$('tactic-target').onchange=preview;preview();
 $('tactic-map').onclick=()=>beginBoardTactic(id);$('tactic-back').onclick=showTactics;$('tactic-confirm').onclick=()=>{const result=session.useTactic(id,$('tactic-target').value);if(!result.success){toast(result.reason);showTactics();return;}closeModal();showTacticResult(result);audio.play('purchase');speak('event',result.description);scene.react(session.currentPlayer.id,'notice');toast(result.description);render();revealAction();};
}
function showTacticResult(result){
 if(result.cardId==='SWAP_STOPS'){scene.syncPawns(session.state.players);const swap=result.events.find(e=>e.type==='POSITIONS_SWAPPED');scene.react(swap.targetId,'notice');}
 const event=result.events?.find(e=>e.type==='CARD_USED'),target=event?.targetId;
 $('tactic-result').hidden=false;$('tactic-result').textContent=`第${session.state.round}轮 · ${session.currentPlayer.isAI?'AI · ':''}${session.currentPlayer.name}：${result.description.replace('本回合还需普通掷骰。','')}`;
 if(target!=null)scene.highlight(['TURN_AROUND','SWAP_STOPS','BORROW_PASS'].includes(result.cardId)?session.state.players[target].currentTile:Number(target));
}
function beginBoardTactic(id){
 const view=tacticBoardView(session,id);if(!view||busy||session.currentPlayer.isAI)return;
 closeModal();setGardenView(false);boardTactic={id,selectedId:null};document.querySelector('.sidebar').inert=true;document.body.classList.add('tactic-selecting');$('garden-toggle').disabled=true;
 const panel=$('tactic-board-panel');panel.hidden=false;panel.innerHTML=`<strong>${view.name} · 棋盘选取</strong><p>绿色为合法目标，金色为当前预览。点选只预览，确认才消耗；Esc可取消。</p><label for="board-tactic-select">目标（也可用键盘选择）</label><select id="board-tactic-select"><option value="">请选择目标</option>${view.targets.map(t=>`<option value="${t.id}">${view.playerTarget?'':`${t.id}号 `}${esc(t.label)}</option>`).join('')}</select><p id="board-tactic-preview" role="status">尚未选择，不会消耗道具。</p><div><button id="board-tactic-confirm" class="primary" disabled>确认使用 · 1张</button><button id="board-tactic-cancel" class="secondary">取消选取</button></div>`;
 scene.setTacticTargets(view);$('board-tactic-select').onchange=()=>selectBoardTactic($('board-tactic-select').value===''?null:$('board-tactic-select').value);$('board-tactic-cancel').onclick=()=>endBoardTactic();
 $('board-tactic-confirm').onclick=()=>{if(!boardTactic||boardTactic.selectedId===null)return;const {id,selectedId}=boardTactic;const r=session.useTactic(id,selectedId);if(!r.success){endBoardTactic();toast(r.reason);return;}endBoardTactic(false);showTacticResult(r);audio.play('purchase');speak('event',r.description);scene.react(session.currentPlayer.id,'notice');render();revealAction();};
 document.querySelector('.world-panel').scrollIntoView({block:'start'});$('board-tactic-select').focus({preventScroll:true});
}
function selectBoardTactic(targetId){
 if(!boardTactic)return;const view=tacticBoardView(session,boardTactic.id,targetId);
 if(!view){endBoardTactic();return;}
 if(!view.selected){boardTactic.selectedId=null;$('board-tactic-select').value='';$('board-tactic-confirm').disabled=true;scene.setTacticTargets(view);$('board-tactic-preview').textContent='请点选绿色目标，或从列表选择；这次操作未消耗道具。';return;}
 boardTactic.selectedId=view.selected.id;$('board-tactic-select').value=String(view.selected.id);$('board-tactic-confirm').disabled=false;
 $('board-tactic-preview').textContent=view.selected.detail+(view.path.length?` 转向后前三站：${view.path.join(' → ')}；这里只预览方向，不会立即移动。`:'');scene.setTacticTargets(view);
}
function endBoardTactic(focus=true){
 if(!boardTactic)return;boardTactic=null;scene?.setTacticTargets(null);$('tactic-board-panel').hidden=true;document.querySelector('.sidebar').inert=false;document.body.classList.remove('tactic-selecting');$('garden-toggle').disabled=busy;
 if(focus)$('tactics-button').focus();
}
$('tactics-button').onclick=showTactics;
$('remote-button').onclick=()=>{if(busy||session.currentPlayer.isAI)return;openModal(`<span class="overline">CHOOSE YOUR NEXT STOP</span><h2>让这一程，刚刚好。</h2><p>选择要走的步数。消耗一张遥控骰子卡，沿途事件可能影响最终行程，预览不会提前触发事件。</p><div class="remote-options">${session.getTravelOptions().map(option=>`<button data-step="${option.steps}" aria-label="移动${option.steps}步至${esc(option.name)}"><b>${option.steps} 步</b><strong>${esc(option.name)}</strong><small><em>${esc(option.region.name)}</em>${esc(travelDescription(option))}${option.passesStart?'<br>途经出发站':''}</small></button>`).join('')}</div><p>当前地点：${esc(session.state.getTile(session.currentPlayer.currentTile).name)}</p>`);document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{closeModal();humanRoll(Number(b.dataset.step));});};
$('supply-button').onclick=()=>{
 if(busy||session.currentPlayer.isAI)return;
 const result=session.buyRemoteDice();
 if(result.success){audio.play('purchase');toast(`已用 ${result.cost} 点券补充遥控骰子。`);save();}
 else toast(result.reason);
 render();
};
function travelDescription(option){
 const target=session.careers[session.currentPlayer.id]?.active;
 const prefix=target?.kind==='DELIVERY'&&target.targetId===option.tileId?'✉ 委托目的地 · ':'';
 const story=session.getStoryStatus();return (option.obstacleStop?'▥ 围栏会在此截停 · ':'')+prefix+(story.stage>=(highland?1:2)&&story.stage<=3&&story.targetId===option.tileId?`✦ ${session.storyName}目标 · `:'')+travelCostDescription(option);
}
function travelCostDescription(option){
 if(option.event)return `${option.region.name} · ${option.event.title} · 到站自主选择`;
 if(option.blockedReason)return option.blockedReason;
 if(option.kind==='PURCHASE')return `可购买 · ¥${money(option.cost)}`;
 if(option.kind==='UPGRADE')return `可升级 · ¥${money(option.cost)}`;
 if(option.kind==='RENT')return `${option.owner}的地产 · 需结算租金`;
 if(option.kind==='OWN_MAX')return '自家地产 · 已满级';
 return '沿途事件 · 抵达后结算';
}
function appendOccupants(id){
 if(!active)return;const occupants=session.state.players.filter(p=>p.currentTile===id);if(!occupants.length)return;
 const content=document.createElement('section');content.className='tile-occupants';content.innerHTML=`<h3>停在这里的同行者 · ${occupants.length}人</h3><div>${occupants.map(p=>`<article><img src="/shanhai/portraits/${p.characterId}.png" alt=""><span><b>${esc(p.name)}${p.id===session.currentPlayer.id?' · 当前行动':''}</b><small>${p.isBankrupt?'已破产':p.isAI?'AI同行者':'你'} · 现金 ¥${money(p.cash)}</small></span></article>`).join('')}</div><p>人物停留不代表产权；业主与等级见地产说明。</p><button id="focus-crowd" class="secondary">近看这处站位 →</button>`;
 $('modal-content').querySelector('h2')?.after(content);$('focus-crowd').onclick=()=>{closeModal();scene.focusCrowd(id);document.querySelector('.world-panel').scrollIntoView({block:'center'});$('view-home').focus({preventScroll:true});};
}
function inspectTile(id){if(!loaded||busy)return;if(highland&&id===20&&active&&!session.currentPlayer.isAI){scene.highlight(20);showSavings();return;}if(gardenView&&[11,12,13,14].includes(id)){selectGardenTile(id);return;}scene.highlight(id);if(id===12&&active&&!busy){showCommerce();appendOccupants(id);return;}const tile=chapterMap.tiles.find(t=>t.id===id),prop=active?session.state.propertyManager.getProperty(id):null;const owner=prop?.owner!==null&&prop?.owner!==undefined?session.state.players[prop.owner].name:'尚无业主';const departure=chapterRoutes.find(r=>r.from===id);const economic=['PROPERTY','BIG_PROPERTY'].includes(tile.type),event=islandEvent(id);openModal(`<span class="overline">${highland?'MAPLE VALLEY':'BLUE BAY'} · STOP ${String(id).padStart(2,'0')}</span><h2>${esc(tile.name)}</h2><span class="region-tag">${coastRegion(id).name}</span><p>${esc(tile.desc||'沿途的一处风景')}</p>${departure?`<p class="transport-note">⚓ 交通站：掷骰前可前往 ${departure.to}号 ${esc(chapterMap.tiles[departure.to].name)}。定班渡轮 ¥650；快艇 ¥250，有 25% 概率改靠 ${departure.divert}号。跳过起点不领奖。</p>`:''}${economic?`<span class="inline-tag">${esc(owner)} · LV.${prop?.level||0}</span><div class="level-list">${(tile.tolls||[]).map((t,i)=>`<span><b>L${i}</b>¥${money(t)}</span>`).join('')}</div><p>购地 ¥${money(tile.price)} · 基础建设 ¥${money(tile.buildCost)}<br>购地需真实落地；升级也可从第8轮起支付上门费进行异地施工。上方为基础租金，实际结算以规则引擎为准。</p>`:event?`<div class="event-preview"><h3>${event.title}</h3><p>${esc(event.story)}</p>${event.choices.map(c=>`<p><b>${c.name}</b><br>${c.detail}</p>`).join('')}</div>`:'<p>抵达这里时，事件将由规则引擎自动结算。</p>'}`);appendOccupants(id);if(active&&economic){const pm=session.state.propertyManager,rent=pm.calculateToll(id,session.state.newsEffect,session.state.priceIndex),influence=gardenInfluence(session.state),row=influence.rows.find(r=>r.tileId===id);$('modal-content').insertAdjacentHTML('beforeend',`<p class="live-rent">当前参考租金 <b>¥${money(rent)}</b> · ${prop.isMortgaged?'抵押中':esc(owner)}${row&&influence.active&&row.increase?`<br>包含12号花园加成 ¥${money(row.increase)}，无此花园为 ¥${money(row.base)}`:''}<br>含物价、新闻与产权加成；个人免租状态以实际结算为准。</p>${row?'<button id="plot-garden" class="secondary">在地图查看花园影响 →</button>':''}`);if($('plot-garden'))$('plot-garden').onclick=()=>{closeModal();setGardenView(true);selectGardenTile(id);document.querySelector('.world-panel').scrollIntoView({block:'start'});};}if(highland&&active&&[8,20].includes(id)){$('modal-content').insertAdjacentHTML('beforeend','<button id="plot-map-note" class="secondary">读星罗的测绘便笺 →</button>');$('plot-map-note').onclick=()=>showMapNote();}if(highland&&active&&[0,10,16,22].includes(id)){$('modal-content').insertAdjacentHTML('beforeend',storyContent(id));bindStoryActions();}const dock=!highland&&DOCK_NEIGHBORS.find(d=>d.tileId===id);if(dock){const b=document.createElement('button');b.className='secondary';b.textContent=`拜访候船邻里 · ${dock.name}`;b.onclick=()=>showDock(dock.id);$('modal-content').append(b);}}
function showVictory(){
 const r=seasonReport(session);if(!r)return;audio.play('win');
 openModal(`<section class="season-report"><span class="overline">A SEASON TO REMEMBER · ${chapterName}</span><h2>${esc(r.winner?.name||'同行者')}的${chapterName}结算</h2><p class="season-reason">第 ${r.round} 轮 / 上限 ${r.maxRounds} 轮 · ${r.reason}<br>净值同分时先比较现金，再按席位顺序；破产者排在存续玩家之后。</p><nav class="season-actions" aria-label="下一段旅程"><button class="primary" id="replay-button">同阵容 · ${r.maxRounds}轮再玩 →</button><button class="secondary" id="season-select">选择角色再开始</button><button class="secondary" id="season-other-map">去${highland?'蓝湾海岸':'枫谷山城'}启程页 →</button></nav><p class="quiet-note">开始新局会覆盖本图结算存档；另一张图的存档保留。关闭窗口仍可查看本局棋盘。</p><div class="season-rankings">${r.rankings.map((p,i)=>`<article class="season-player" data-result-player="${p.id}"><header><img src="${import.meta.env.BASE_URL}shanhai/portraits/${esc(p.characterId)}.png" alt=""><div><h3>第${i+1}名 · ${esc(p.name)} <small>${p.isAI?'AI':'你'}${p.bankrupt?' · 已破产':''}</small></h3><strong>总资产 ¥${money(p.assets.total)}</strong></div></header><dl>${p.parts.map(([label,value])=>`<div><dt>${label}</dt><dd>¥${money(value)}</dd></div>`).join('')}</dl><p>${p.assets.propertyCount}处地产 · ${p.assets.cardCount}张卡片（不计净值）<br>完成 ${p.completed} 份委托 · 委托收入 ¥${money(p.earned)}<br>${session.storyName}：${esc(p.story.endingInfo?.title||`进度 ${p.story.stage}/4，尚未完成`)}</p></article>`).join('')}</div><p class="quiet-note">土地净值已扣抵押额；建筑按规则建设估值，非出售报价。委托收入已包含在现有资产中，不重复相加。</p><h3>这一季留下的片段</h3><p class="quiet-note">从存档保留的最近50条日志中，各取一条经营、来信或人物行动；不是完整对局历史。</p>${r.highlights.length?`<ol class="season-highlights">${r.highlights.map(h=>`<li><b>${h.label}</b><p>${esc(h.text)}</p></li>`).join('')}</ol>`:'<p>这份存档没有保留可展示的关键片段，最终资产仍可查看。</p>'}<p class="season-next">${esc(r.suggestion)}<br>“${highland?'窑火慢慢熄下，下一季的茶还在山路上。':'灯塔收起晚霞，下一段海风仍在等你。'}”</p></section>`);
 $('replay-button').onclick=()=>{selectCurrentCast();closeModal();launch(false,session.state.maxRounds);};
 $('season-select').onclick=()=>{if(!save(true).success)return;returnToWelcome();};
 $('season-other-map').onclick=()=>{if(save(true).success)location.assign(highland?'./shanhai.html':'./shanhai.html?map=highland');};
}

session.subscribe((state,result)=>{if(active){render();if(result.success&&result.type!=='SLICE_STARTED')save();}});
window.addEventListener('keydown',e=>{if(scene?.characterPreview&&e.key==='Escape'&&!$('info-dialog').open){e.preventDefault();closeCharacterPreview();return;}if(boardTactic){if(e.key==='Escape'){e.preventDefault();endBoardTactic();}return;}if(e.code==='Space'&&!$('info-dialog').open&&active&&!busy&&session.state.phase==='PRE_ROLL_ACTION'&&!['BUTTON','INPUT','SELECT','SUMMARY'].includes(document.activeElement.tagName)){e.preventDefault();humanRoll();}});
document.title=`${chapterName} · 山海都市岛`;
for(const link of document.querySelectorAll('[data-map]'))if(link.dataset.map===chapterMap.id)link.setAttribute('aria-current','page');
$('map-scope').textContent=highland?'山城初版 · 24站经营、山路来信与一窑新茶故事 · 独立存档。':'蓝湾现有章节 · 24站经营、渡轮与花灯支线 · 独立存档。';
if(highland){
 document.body.classList.add('highland');$('start-button').innerHTML='开启山城之旅 <span>→</span>';document.querySelector('.world-panel').setAttribute('aria-label','三维山城棋盘');document.querySelector('.round-header .overline').textContent='山城经营日记';$('turn-guide-optional').textContent='委托、山城故事和职业能力都是可选玩法；留些现金应付租金。';document.querySelector('.welcome-panel .overline').textContent='你的山城故事，从这里开始';document.querySelector('.feature-strip span').innerHTML='<b>24</b>山城地点';$('commission-panel').setAttribute('aria-label','山城委托');$('neighbors-button').hidden=true;$('map-note-button').hidden=false;$('story-panel').hidden=false;$('story-panel').setAttribute('aria-label','一窑新茶故事');
 document.querySelector('.chapter').textContent='枫谷山城 / 原创可玩初版';document.querySelector('.world-heading h1').textContent='沿着茶香，走进山城。';document.querySelector('.world-heading p').textContent='穿行秋色阶地，经营古道街市。';
 document.querySelector('.eyebrow').textContent='CHAPTER 02 · MAPLE VALLEY';document.querySelector('.welcome-panel h2').innerHTML='枫谷山城<span>一条古道，一季秋收。</span>';
 document.querySelector('.intro').textContent='在茶坡与陶窑之间置业，选择山城来信的机会，与同行者完成一季经营。';document.querySelector('.optional-heading').textContent='可选经营与山城生活';$('region-button').textContent='探索三个山城街区 →';
 document.querySelector('.map-caption').textContent='秋色正浓 · 山路宜行';document.querySelector('.footer span').textContent='山海都市岛 / 枫谷山城';
}
refreshAudioControls();
window.addEventListener('beforeunload',()=>{if(active)save();});
// Inspection surface for the existing project's automated browser QA, never used to mutate game state.
window.shanhai={session,get scene(){return scene;},audio,get busy(){return busy;},get ready(){return loaded;},get active(){return active;}};
async function loadScene(){
  try {
    scene=new SliceScene($('world'),chapterMap.tiles,{onSelect:inspectTile,onDock:showDock,onTacticTarget:selectBoardTactic,onResident:()=>{if(active)showStory();else toast('开启山城之旅后，在「一窑新茶」中认识阿棠与陶九。');},mapId:chapterMap.id,ambientMotion});
    await scene.load();
    loaded=true;$('preview-character').disabled=false;refreshCast();
    $('loading').hidden=true;
    $('start-button').disabled=false;
    try{$('resume-button').hidden=!session.saves.storage?.getItem(sliceSaveKey(chapterMap.id));}catch{}
    $('render-status').textContent='THREE.JS r187 · 原创 3D';
  } catch(error) {
    loaded=false;
    scene?.dispose();
    scene=null;
    $('start-button').disabled=true;
    $('resume-button').hidden=true;
    $('loading').hidden=false;
    $('loading').setAttribute('role','alert');
    $('loading').innerHTML='<strong>地图暂时无法打开</strong><p>三维画面或素材未能加载。请检查浏览器的图形支持和网络连接后重试。</p><button class="primary" id="retry-loading">重新加载地图</button>';
    $('retry-loading').onclick=()=>window.location.reload();
    console.error(error);
  }
}
loadScene();
