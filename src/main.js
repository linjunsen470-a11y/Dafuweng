import * as THREE from 'three';
import { Scene3D } from './engine/Scene3D.js';
import { BoardBuilder } from './engine/BoardBuilder.js';
import { PawnManager } from './engine/PawnManager.js';
import { Dice3D } from './engine/Dice3D.js';
import { audioManager } from './engine/AudioManager.js';

import { GameState, GamePhase } from './game/GameState.js';
import { TileType, PLAYER_PROFILES } from './game/BoardData.js';
import { AIPlayer } from './game/AIPlayer.js';
import { GameEngine } from './game/GameEngine.js';

import { UIRenderer } from './ui/UIRenderer.js';
import { StockUI } from './ui/StockUI.js';
import { ShopUI } from './ui/ShopUI.js';
import { DialogUI } from './ui/DialogUI.js';
import { AssetUI } from './ui/AssetUI.js';
import { MinimapUI } from './ui/MinimapUI.js';

class GameController {
  constructor() {
    this.audioManager = audioManager;
    this.gameState = new GameState();
    this.gameEngine = new GameEngine(this.gameState);

    this.scene3D = new Scene3D('game-container');
    this.boardBuilder = new BoardBuilder(this.scene3D);
    this.pawnManager = new PawnManager(this.scene3D, this.boardBuilder);
    this.dice3D = new Dice3D(this.scene3D);

    this.uiRenderer = new UIRenderer(this.gameState);
    this.stockUI = new StockUI(this.gameState, this.audioManager, () => this.uiRenderer.renderHUD(), this.gameEngine);
    this.shopUI = new ShopUI(this.gameState, this.audioManager, (cardId, idx) => this.handleCardUsage(cardId, idx), () => this.uiRenderer.renderHUD(), this.gameEngine);
    this.dialogUI = new DialogUI(this.audioManager);
    this.assetUI = new AssetUI(this.gameState);
    this.minimapUI = new MinimapUI(this.scene3D, this.gameState);

    this.selectedInitialCash = 20000;
    this.isProcessingAction = false;
    this.syncedAssetRevision = -1;
    this.actionSpeed = 1;
    this.gameEngine.subscribe(event => this.applyDomainEvent(event));

    this.renderSetupScreen();
    this.bindHUDButtons();
    this.bindKeyboardAndCanvasClick();
  }

  applyDomainEvent(event) {
    if (event.type === 'OBSTACLE_CHANGED') {
      this.boardBuilder.setObstacleMesh(event.tileId, event.active);
    } else if (event.type === 'OBSTACLE_CONSUMED') {
      this.boardBuilder.setObstacleMesh(event.tileId, false);
    } else if (event.type === 'MINE_PLACED') {
      this.boardBuilder.setMineMesh(event.tileId, true);
    } else if (event.type === 'MINE_EXPLODED') {
      this.boardBuilder.setMineMesh(event.tileId, false);
    } else if (event.type === 'PROPERTY_CHANGED' || (event.type === 'ASSET_LIQUIDATED' && event.tileId !== undefined)) {
      const property = this.gameState.propertyManager.getProperty(event.tileId);
      const owner = property?.owner === null ? null : this.gameState.players[property?.owner];
      this.boardBuilder.updateBuildingMesh(event.tileId, property?.level || 0, owner?.colorHex);
    } else if (event.type === 'STATUS_CHANGED') {
      this.pawnManager.updateGodAura(event.playerId, event.status);
    } else if (event.type === 'BOARD_GOD_COLLECTED') {
      this.pawnManager.updateGodAura(event.playerId, event.godType);
      this.pawnManager.syncBoardGods(this.gameState.boardGods);
    } else if (event.type === 'PLAYER_BANKRUPT') {
      this.pawnManager.setBankrupt(event.playerId);
    }
  }

  syncBoardAssets(force = false) {
    if (!force && this.syncedAssetRevision === this.gameState.assetRevision) return;
    this.gameState.propertyManager.properties.forEach((property, tileId) => {
      const owner = property.owner === null ? null : this.gameState.players[property.owner];
      this.boardBuilder.updateBuildingMesh(tileId, property.level, owner?.colorHex);
      this.boardBuilder.setObstacleMesh(tileId, property.hasObstacle);
    });
    this.syncedAssetRevision = this.gameState.assetRevision;
  }

  renderSetupScreen() {
    const configList = document.getElementById('player-config-list');
    configList.innerHTML = '';

    const defaultProfiles = [0, 1, 2, 3];
    const defaultTypes = ['HUMAN', 'AI', 'AI', 'AI'];

    const playerCount = parseInt(document.getElementById('player-count')?.value || '4', 10);
    for (let i = 0; i < playerCount; i++) {
      const item = document.createElement('div');
      item.className = 'player-config-item';

      let optionsHtml = '';
      PLAYER_PROFILES.forEach((prof) => {
        optionsHtml += `<option value="${prof.id}" ${prof.id === defaultProfiles[i] ? 'selected' : ''}>${prof.avatar} ${prof.name} (${prof.skillName})</option>`;
      });

      item.innerHTML = `
        <div class="player-info-meta">
          <select class="player-profile-select" name="player-profile-${i}" data-index="${i}" aria-label="选择玩家${i + 1}角色">
            ${optionsHtml}
          </select>
        </div>
        <select class="player-type-select" name="player-type-${i}" data-index="${i}" aria-label="选择玩家${i + 1}类型">
          <option value="HUMAN" ${defaultTypes[i] === 'HUMAN' ? 'selected' : ''}>👤 人类玩家</option>
          <option value="AI" ${defaultTypes[i] === 'AI' ? 'selected' : ''}>🤖 电脑 AI</option>
        </select>
      `;
      configList.appendChild(item);
    }

    // 绑定角色重复选择校验机制 (自动互换，防冲突)
    const profSelects = document.querySelectorAll('.player-profile-select');
    let previousSelections = Array.from(profSelects).map(s => parseInt(s.value, 10));

    profSelects.forEach((sel, changedIdx) => {
      sel.addEventListener('change', (e) => {
        const newValue = parseInt(e.target.value, 10);
        // 检查是否有其他下拉框占用了该角色
        profSelects.forEach((otherSel, otherIdx) => {
          if (changedIdx !== otherIdx && parseInt(otherSel.value, 10) === newValue) {
            // 将被冲突的下拉框值调整为改动前的值 (互换)
            otherSel.value = previousSelections[changedIdx];
          }
        });
        previousSelections = Array.from(profSelects).map(s => parseInt(s.value, 10));
      });
    });

    const cashBtns = document.querySelectorAll('.cash-btn');
    cashBtns.forEach(btn => {
      btn.onclick = () => {
        cashBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedInitialCash = parseInt(btn.dataset.cash, 10);
      };
    });

    document.getElementById('start-game-btn').onclick = () => {
      this.audioManager.playClick();
      this.startGame();
    };

    document.getElementById('player-count').onchange = () => this.renderSetupScreen();

    const autoSave = this.gameEngine.saves.loadAuto();
    const manualSave = this.gameEngine.saves.loadManual();
    const autoButton = document.getElementById('load-auto-save-btn');
    const manualButton = document.getElementById('load-manual-save-btn');
    autoButton.classList.toggle('hidden', !autoSave.success);
    manualButton.classList.toggle('hidden', !manualSave.success);
    autoButton.onclick = () => autoSave.success && this.restoreGame(autoSave.snapshot);
    manualButton.onclick = () => manualSave.success && this.restoreGame(manualSave.snapshot);
  }

  startGame() {
    const setupScreen = document.getElementById('setup-screen');
    setupScreen.classList.remove('active');
    setupScreen.classList.add('hidden');
    setupScreen.setAttribute('aria-hidden', 'true');
    setupScreen.style.display = 'none';

    const hudLayer = document.getElementById('hud-layer');
    hudLayer.classList.remove('hidden');

    const typeSelects = document.querySelectorAll('.player-type-select');
    const profSelects = document.querySelectorAll('.player-profile-select');

    const playerConfigs = [];
    const aiDifficulty = document.getElementById('ai-difficulty').value;
    typeSelects.forEach((sel, idx) => {
      const isAI = sel.value === 'AI';
      const profId = parseInt(profSelects[idx].value, 10);
      const profile = PLAYER_PROFILES.find(p => p.id === profId) || PLAYER_PROFILES[idx];

      playerConfigs.push({
        name: isAI ? `${profile.name} AI` : profile.name,
        profileIndex: profId,
        isAI: isAI,
        aiDifficulty
      });
    });

    const mode = document.getElementById('game-mode').value;
    this.gameState.setupGame(playerConfigs, this.selectedInitialCash, {
      maxRounds: mode === 'QUICK' ? 24 : mode === 'HEAT' ? 30 : 40,
      mapId: document.getElementById('map-select').value,
      mode,
      teams: mode === 'TEAM',
      initialDeposit: Number(document.getElementById('initial-deposit').value || 0)
    });
    this.boardBuilder.applyMapDefinition(this.gameState.mapDefinition);
    this.minimapUI.setMap(this.gameState.mapDefinition);
    this.pawnManager.createPlayerPawns(playerConfigs);
    this.pawnManager.syncBoardGods(this.gameState.boardGods);
    this.uiRenderer.renderHUD();

    this.checkAITurn();
  }

  bindHUDButtons() {
    const btnRoll = document.getElementById('btn-roll');
    btnRoll.onclick = () => {
      this.triggerHumanRoll();
    };

    document.getElementById('btn-toggle-audio').onclick = () => {
      const muted = this.audioManager.toggleMute();
      document.getElementById('btn-toggle-audio').textContent = muted ? '🔇' : '🔊';
    };

    document.getElementById('btn-reset-view').onclick = () => {
      this.scene3D.resetCamera();
    };
    document.getElementById('btn-map-overview').onclick = () => this.scene3D.showOverview();
    document.getElementById('btn-rotate-left').onclick = () => this.scene3D.rotateView(-1);
    document.getElementById('btn-rotate-right').onclick = () => this.scene3D.rotateView(1);
    document.getElementById('btn-follow-view').onclick = () => {
      const current = this.gameState.getCurrentPlayer();
      const position = current && this.boardBuilder.tilePositions[current.currentTile];
      if (position) this.scene3D.focusOnPosition(position);
    };
    document.getElementById('btn-toggle-minimap').onclick = () => this.minimapUI.toggle();

    document.getElementById('btn-weather').onclick = () => {
      const weather = this.scene3D.cycleWeather();
      const labels = {
        CLEAR: ['☀️', '晴朗'],
        RAIN: ['🌧️', '细雨'],
        SNOW: ['❄️', '飘雪'],
        STORM: ['⛈️', '雷暴']
      };
      const [icon, label] = labels[weather];
      const button = document.getElementById('btn-weather');
      button.textContent = icon;
      button.title = `切换天气：${label}`;
      this.gameState.addLog(`${icon} 天气切换为${label}。`, 'accent');
      this.uiRenderer.renderHUD();
    };

    document.getElementById('btn-time-of-day').onclick = () => {
      const timeOfDay = this.scene3D.cycleTimeOfDay();
      const labels = {
        DAY: ['🌤️', '白天'],
        SUNSET: ['🌇', '黄昏'],
        NIGHT: ['🌙', '夜晚']
      };
      const [icon, label] = labels[timeOfDay];
      const button = document.getElementById('btn-time-of-day');
      button.textContent = icon;
      button.title = `切换时间：${label}`;
      this.boardBuilder.setNightMode(timeOfDay === 'NIGHT');
      this.gameState.addLog(`${icon} 场景时间切换为${label}。`, 'accent');
      this.uiRenderer.renderHUD();
    };

    document.getElementById('btn-save-game').onclick = () => {
      if (this.gameState.phase !== GamePhase.PRE_ROLL_ACTION || this.isProcessingAction) {
        this.gameState.addLog('⚠️ 只能在掷骰前保存游戏。', 'danger');
        this.uiRenderer.renderHUD();
        return;
      }
      this.showPauseMenu();
    };

    document.getElementById('btn-assets').onclick = () => this.assetUI.show();
    document.getElementById('btn-pause-game').onclick = () => this.showPauseMenu();

    document.getElementById('btn-stock-market').onclick = () => {
      if (!this.canOpenPlayerAction()) return;
      this.stockUI.show();
    };

    document.getElementById('btn-card-shop').onclick = () => {
      if (!this.canOpenPlayerAction()) return;
      this.shopUI.showShop();
    };

    document.getElementById('btn-use-card').onclick = () => {
      if (!this.canOpenPlayerAction()) return;
      this.shopUI.showInventory();
    };

    document.getElementById('btn-clear-log').onclick = () => {
      this.gameState.logHistory = [];
      this.uiRenderer.renderHUD();
    };
    document.getElementById('btn-resume-game').onclick = () => this.hidePauseMenu();
    document.querySelectorAll('.speed-btn').forEach(button => {
      button.onclick = () => {
        this.actionSpeed = Number(button.dataset.speed);
        this.dice3D.speed = this.actionSpeed;
        document.querySelectorAll('.speed-btn').forEach(item => item.classList.toggle('active', item === button));
      };
    });
    document.getElementById('btn-return-menu').onclick = () => this.returnToMenu();
  }

  showPauseMenu() {
    if (this.isProcessingAction || this.gameState.phase === GamePhase.GAME_OVER) return;
    const paused = this.gameEngine.execute({ type: 'PAUSE_GAME', playerId: this.gameState.currentPlayerIndex });
    if (!paused.success) return;
    document.getElementById('modal-pause').classList.remove('hidden');
    this.renderSaveSlots();
  }

  hidePauseMenu() {
    this.gameEngine.execute({ type: 'RESUME_GAME', playerId: this.gameState.currentPlayerIndex });
    document.getElementById('modal-pause').classList.add('hidden');
    this.uiRenderer.renderHUD();
  }

  renderSaveSlots() {
    const container = document.getElementById('save-slot-list');
    container.innerHTML = '';
    this.gameEngine.saves.listSlots().forEach(slot => {
      const row = document.createElement('div');
      row.className = 'save-slot-row';
      const label = slot.occupied
        ? `${slot.snapshot.saveName || `存档 ${slot.slotId}`} · 第 ${slot.snapshot.round} 轮`
        : `空存档槽 ${slot.slotId}`;
      row.innerHTML = `<span>${label}</span>
        <button class="btn-primary btn-sm slot-save">保存</button>
        <button class="btn-secondary btn-sm slot-load" ${slot.occupied ? '' : 'disabled'}>读取</button>
        <button class="btn-danger btn-sm slot-delete" ${slot.occupied ? '' : 'disabled'}>删除</button>`;
      row.querySelector('.slot-save').onclick = () => {
        const snapshot = this.gameState.createSnapshot();
        if (snapshot.phase === 'PAUSED') {
          snapshot.phase = snapshot.phaseBeforePause || 'PRE_ROLL_ACTION';
          snapshot.phaseBeforePause = null;
        }
        this.gameEngine.saves.saveSlot(slot.slotId, snapshot, `手动存档 ${slot.slotId}`);
        this.renderSaveSlots();
      };
      row.querySelector('.slot-load').onclick = () => {
        const loaded = this.gameEngine.saves.loadSlot(slot.slotId);
        if (loaded.success) {
          document.getElementById('modal-pause').classList.add('hidden');
          this.restoreGame(loaded.snapshot);
        }
      };
      row.querySelector('.slot-delete').onclick = () => {
        this.gameEngine.saves.deleteSlot(slot.slotId);
        this.renderSaveSlots();
      };
      container.appendChild(row);
    });
  }

  canOpenPlayerAction() {
    const player = this.gameState.getCurrentPlayer();
    return !this.isProcessingAction
      && this.gameState.phase === GamePhase.PRE_ROLL_ACTION
      && player
      && !player.isAI
      && !player.isBankrupt;
  }

  returnToMenu() {
    document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
    this.gameState.propertyManager.properties.forEach((property, tileId) => {
      this.boardBuilder.updateBuildingMesh(tileId, 0, null);
      this.boardBuilder.setObstacleMesh(tileId, false);
    });
    this.pawnManager.clearPawns();
    this.gameState.players = [];
    this.gameState.pendingMove = null;
    this.gameState.pendingDebt = null;
    this.gameState.winner = null;
    this.gameState.winReason = null;
    this.gameState.phase = GamePhase.SETUP;
    this.isProcessingAction = false;
    const setup = document.getElementById('setup-screen');
    setup.style.display = '';
    setup.classList.remove('hidden');
    setup.classList.add('active');
    setup.setAttribute('aria-hidden', 'false');
    document.getElementById('hud-layer').classList.add('hidden');
    this.renderSetupScreen();
  }

  restoreGame(snapshot) {
    this.gameEngine.restore(snapshot);
    this.boardBuilder.applyMapDefinition(this.gameState.mapDefinition);
    this.minimapUI.setMap(this.gameState.mapDefinition);
    const setupScreen = document.getElementById('setup-screen');
    setupScreen.classList.remove('active');
    setupScreen.classList.add('hidden');
    setupScreen.style.display = 'none';
    document.getElementById('hud-layer').classList.remove('hidden');

    const configs = this.gameState.players.map(player => ({
      name: player.name,
      profileIndex: player.profileId,
      isAI: player.isAI
    }));
    this.pawnManager.createPlayerPawns(configs);
    this.pawnManager.syncFromGameState(this.gameState);
    this.syncBoardAssets(true);
    this.uiRenderer.renderHUD();
    this.checkAITurn();
  }

  bindKeyboardAndCanvasClick() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
          return;
        }
        e.preventDefault();
        this.triggerHumanRoll();
      }
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('pointerdown', (e) => {
      if (this.gameState.phase !== GamePhase.WAITING_FOR_ROLL) return;
      const curPlayer = this.gameState.getCurrentPlayer();
      if (curPlayer.isAI) return;

      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, this.scene3D.camera);

      const intersects = raycaster.intersectObject(this.dice3D.mesh, true);
      if (intersects.length > 0) {
        this.triggerHumanRoll();
      }
    });
  }

  triggerHumanRoll() {
    if (this.isProcessingAction) return;
    if (this.gameState.phase !== GamePhase.WAITING_FOR_ROLL) return;

    const curPlayer = this.gameState.getCurrentPlayer();
    if (!curPlayer || curPlayer.isAI) return;

    this.doRollDice();
  }

  checkAITurn() {
    if (this.gameState.phase === GamePhase.GAME_OVER) return;

    const curPlayer = this.gameState.getCurrentPlayer();
    if (curPlayer && (curPlayer.isAI || curPlayer.isSleepwalkingThisTurn) && !curPlayer.isBankrupt) {
      this.isProcessingAction = true;
      this.uiRenderer.renderHUD();
      setTimeout(() => {
        this.runAITurn(curPlayer);
      }, Math.round(800 / this.actionSpeed));
    } else {
      this.isProcessingAction = false;
      this.uiRenderer.renderHUD();
    }
  }

  async runAITurn(aiPlayer) {
    if (this.gameState.phase !== GamePhase.WAITING_FOR_ROLL) return;

    if (aiPlayer.isSleepwalkingThisTurn) {
      await this.doRollDice();
      return;
    }

    const purchaseDecision = AIPlayer.decideCardPurchase(aiPlayer, this.gameEngine);
    if (purchaseDecision) {
      this.gameEngine.execute({
        type: 'BUY_CARD',
        playerId: aiPlayer.id,
        payload: { cardId: purchaseDecision.cardId }
      });
    }

    const cardDecision = AIPlayer.decideCardUsage(aiPlayer, this.gameState, this.gameEngine);
    if (cardDecision && cardDecision.cardId === 'REMOTE_DICE' && cardDecision.diceVal
      && this.gameEngine.getCardAction(aiPlayer, cardDecision.cardId).enabled) {
      const result = this.gameEngine.execute({
        type: 'USE_CARD',
        playerId: aiPlayer.id,
        payload: { cardId: cardDecision.cardId, value: cardDecision.diceVal }
      });
      if (result.success) await this.doRollDice(result.followUp.steps);
      return;
    }
    if (cardDecision) {
      await this.handleCardUsage(cardDecision.cardId, aiPlayer.cards.indexOf(cardDecision.cardId), cardDecision.targetId ?? null);
      if (cardDecision.cardId === 'TELEPORT') return;
    }

    const stockDecision = AIPlayer.decideStockAction(aiPlayer, this.gameState.stockMarket);
    if (stockDecision) {
      this.gameEngine.execute({
        type: `${stockDecision.action}_STOCK`,
        playerId: aiPlayer.id,
        payload: { stockId: stockDecision.stockId, shares: stockDecision.shares }
      });
    }

    await this.doRollDice();
  }

  async doRollDice(specifiedDiceVal = null) {
    if (this.gameState.phase !== GamePhase.WAITING_FOR_ROLL) return;
    this.isProcessingAction = true;
    const curPlayer = this.gameState.getCurrentPlayer();
    let diceVal = specifiedDiceVal;
    let dice = specifiedDiceVal ? [specifiedDiceVal] : null;
    if (specifiedDiceVal && curPlayer.godType === 'BAD') {
      diceVal = Math.max(1, Math.ceil(diceVal / 2));
      dice = [diceVal];
    }

    if (!diceVal) {
      const roll = this.gameEngine.execute({ type: 'ROLL_DICE', playerId: curPlayer.id });
      if (!roll.success) {
        this.isProcessingAction = false;
        return;
      }
      diceVal = roll.steps;
      dice = roll.dice;
    }
    this.uiRenderer.renderHUD();
    this.audioManager.playDiceRoll();

    const pawnPos = this.boardBuilder.tilePositions[curPlayer.currentTile];
    this.scene3D.focusOnPosition(pawnPos);

    await this.dice3D.roll(dice[0], pawnPos.clone().add(new THREE.Vector3(0, 4, 0)), dice);

    const diceDetail = dice.length > 1 ? `（${dice.join(' + ')}）` : '';
    this.gameState.addLog(`🎲 ${curPlayer.name} 掷出了 ${diceVal} 点${diceDetail}！`, 'gold');

    await this.doMovePlayer(diceVal);
  }

  async doMovePlayer(steps) {
    const curPlayer = this.gameState.getCurrentPlayer();
    const started = this.gameEngine.execute({
      type: 'BEGIN_MOVE',
      playerId: curPlayer.id,
      payload: { steps, source: 'DICE' }
    });
    if (!started.success) return;

    while (this.gameState.pendingMove) {
      let result = this.gameEngine.execute({ type: 'ADVANCE_MOVE', playerId: curPlayer.id });
      if (result.type === 'ROUTE_CHOICE_REQUIRED') {
        this.boardBuilder.setRouteChoices(result.options);
        this.minimapUI.setRouteChoices(result.options);
        const selected = curPlayer.isSleepwalkingThisTurn
          ? this.gameState.rng.pick(result.options)
          : curPlayer.isAI
            ? AIPlayer.chooseRoute(curPlayer, result.options, this.gameState)
          : await this.dialogUI.chooseTarget({
              title: '前方出现岔路，请选择路线',
              options: result.options.map(tileId => ({
                id: tileId,
                label: this.gameState.getTile(tileId).name,
                description: this.gameState.getTile(tileId).desc || '继续前进'
              }))
            });
        result = this.gameEngine.execute({
          type: 'ADVANCE_MOVE',
          playerId: curPlayer.id,
          payload: { nextTileId: selected ?? result.options[0] }
        });
        this.boardBuilder.setRouteChoices();
        this.minimapUI.setRouteChoices();
      }
      if (!result.success) break;
      await this.pawnManager.animatePlayerStep(curPlayer.id, result.tileId, Math.round(220 / (this.actionSpeed || 1)));
      const stepPosition = this.boardBuilder.tilePositions[result.tileId];
      if (stepPosition) this.scene3D.focusOnPosition(stepPosition);
      if (result.events.some(event => event.type === 'START_BONUS_GRANTED')) this.audioManager.playCoinSound();
    }

    this.uiRenderer.renderHUD();

    await this.handleTileArrival(curPlayer.currentTile);
  }

  async handleTileArrival(tileIndex) {
    const curPlayer = this.gameState.getCurrentPlayer();
    const landing = this.gameEngine.inspectLanding(curPlayer, tileIndex);
    if (landing.kind === 'PURCHASE') {
      if (curPlayer.isAI) {
        if (AIPlayer.evaluateLandPurchase(curPlayer, landing.tile, this.gameState)) this.buyLand(tileIndex, curPlayer);
        else this.gameState.addLog(`🤖 ${curPlayer.name} 放弃购买【${landing.tile.name}】。`);
        return this.finishTurn();
      }
      return this.dialogUI.showLandPurchase({
        tileData: landing.tile,
        currentLevel: 0,
        player: curPlayer,
        onBuy: () => { this.buyLand(tileIndex, curPlayer); this.finishTurn(); },
        onPass: () => this.finishTurn()
      });
    }
    if (landing.kind === 'UPGRADE') {
      if (curPlayer.isAI) {
        if (AIPlayer.evaluateLandUpgrade(curPlayer, landing.tile, landing.property.level, this.gameState)) this.upgradeLand(tileIndex, curPlayer);
        return this.finishTurn();
      }
      return this.dialogUI.showLandPurchase({
        tileData: landing.tile,
        currentLevel: landing.property.level,
        player: curPlayer,
        onUpgrade: () => { this.upgradeLand(tileIndex, curPlayer); this.finishTurn(); },
        onPass: () => this.finishTurn()
      });
    }
    if (landing.kind === 'OWN_MAX') {
      this.gameState.addLog(`🏢 ${curPlayer.name} 视察顶级地产【${landing.tile.name}】。`);
      return this.finishTurn();
    }
    if (landing.kind === 'MORTGAGED') {
      this.gameState.addLog(`🏦 【${landing.tile.name}】处于抵押状态，本次不收取租金。`, 'accent');
      return this.finishTurn();
    }
    if (landing.kind === 'RENT') {
      const result = this.gameEngine.execute({ type: 'SETTLE_RENT', playerId: curPlayer.id, payload: { tileId: tileIndex } });
      if (result.amount > 0) this.audioManager.playCoinSound();
      if (result.type === 'DEBT_REQUIRED') await this.resolvePendingDebt(curPlayer);
      return this.finishTurn();
    }

    const result = this.gameEngine.execute({ type: 'RESOLVE_LANDING', playerId: curPlayer.id, payload: { tileId: tileIndex } });
    if (['CARD_POINTS', 'COUPON_COLLECTED', 'CARD_GAINED'].includes(result.type)) this.audioManager.playCardSpell();
    if (result.type === 'CASH_GAINED' || result.type === 'CASH_LOST') this.audioManager.playCoinSound();
    if (result.type === 'MONSTER_ATTACK') this.triggerExplosionVFX();
    if (result.type === 'STATUS_APPLIED') this.pawnManager.updateGodAura(curPlayer.id, result.status);
    if (result.type === 'OPEN_STOCK' && !curPlayer.isAI) {
      await new Promise(resolve => this.stockUI.show(resolve));
    }
    if (result.type === 'OPEN_BANK') {
      await this.handleBankVisit(curPlayer, tileIndex);
    }
    if (result.type === 'LOTTERY_OFFER') {
      await this.handleLotteryVisit(curPlayer, tileIndex, result);
    }
    if (result.type === 'MAGIC_OFFER') {
      await this.handleMagicVisit(curPlayer, tileIndex, result);
    }
    this.finishTurn();
  }

  async handleBankVisit(player, tileId) {
    if (player.isAI) {
      const amount = Math.max(0, player.cash - 8000);
      if (amount) this.gameEngine.execute({
        type: 'BANK_TRANSFER', playerId: player.id,
        payload: { tileId, direction: 'DEPOSIT', amount }
      });
      return;
    }
    const cash = player.cash;
    const deposit = player.deposit || 0;
    const options = [
      { id: 'DEPOSIT:0.25', label: '存入 25% 现金', description: `$${Math.floor(cash * 0.25).toLocaleString()}` },
      { id: 'DEPOSIT:0.5', label: '存入 50% 现金', description: `$${Math.floor(cash * 0.5).toLocaleString()}` },
      { id: 'DEPOSIT:1', label: '存入全部现金', description: `$${cash.toLocaleString()}` },
      { id: 'WITHDRAW:0.25', label: '取出 25% 存款', description: `$${Math.floor(deposit * 0.25).toLocaleString()}` },
      { id: 'WITHDRAW:0.5', label: '取出 50% 存款', description: `$${Math.floor(deposit * 0.5).toLocaleString()}` },
      { id: 'WITHDRAW:1', label: '取出全部存款', description: `$${deposit.toLocaleString()}` }
    ];
    const choice = await this.dialogUI.chooseTarget({ title: '银行：调整现金与存款', options });
    if (choice === null) return;
    const [direction, ratioText] = String(choice).split(':');
    const ratio = Number(ratioText);
    const amount = Math.floor((direction === 'DEPOSIT' ? cash : deposit) * ratio);
    if (amount > 0) this.gameEngine.execute({ type: 'BANK_TRANSFER', playerId: player.id, payload: { tileId, direction, amount } });
    this.uiRenderer.renderHUD();
  }

  async handleLotteryVisit(player, tileId, offer) {
    if (player.cash < offer.ticketPrice) return;
    const number = player.isAI
      ? this.gameState.rng.int(1, 10)
      : await this.dialogUI.chooseTarget({
          title: `乐透奖池 $${offer.pot.toLocaleString()}：选择号码`,
          options: Array.from({ length: 10 }, (_, index) => ({ id: index + 1, label: `${index + 1} 号`, description: `票价 $${offer.ticketPrice}` }))
        });
    if (number === null) return;
    this.gameEngine.execute({ type: 'BUY_LOTTERY', playerId: player.id, payload: { tileId, number } });
    this.uiRenderer.renderHUD();
  }

  async handleMagicVisit(player, tileId, offer) {
    const magicId = player.isAI
      ? (player.cash < 5000 ? 'CASH_RAIN' : 'PROPERTY_BOOM')
      : await this.dialogUI.chooseTarget({ title: '魔法屋：选择全局魔法', options: offer.options });
    if (magicId === null) return;
    this.gameEngine.execute({ type: 'CAST_MAGIC', playerId: player.id, payload: { tileId, magicId } });
    this.syncBoardAssets(true);
    this.uiRenderer.renderHUD();
  }

  async resolvePendingDebt(player) {
    if (!this.gameState.pendingDebt) return;
    if (player.isAI) {
      this.gameEngine.execute({ type: 'AUTO_SETTLE_DEBT', playerId: player.id });
      return;
    }
    while (this.gameState.pendingDebt && !player.isBankrupt) {
      const legal = this.gameEngine.getLegalActions(player.id).filter(action => action.enabled);
      if (player.cash >= this.gameState.pendingDebt.amountDue) {
        this.gameEngine.execute({ type: 'PAY_DEBT', playerId: player.id });
        break;
      }
      const options = legal.map((action, index) => ({
        id: index,
        label: action.type === 'AUTO_SETTLE_DEBT' ? '自动处置资产'
          : action.type === 'DECLARE_BANKRUPTCY' ? '宣布破产'
          : action.type === 'SELL_BUILDING' ? `出售建筑：${this.gameState.getTile(action.tileId).name}`
          : action.type === 'MORTGAGE_PROPERTY' ? `抵押地产：${this.gameState.getTile(action.tileId).name}`
          : action.type === 'SELL_STOCK' ? `卖出全部股票：${action.stockId}`
          : action.type,
        description: `当前现金 $${player.cash.toLocaleString()} / 欠款 $${this.gameState.pendingDebt.amountDue.toLocaleString()}`
      }));
      const choice = await this.dialogUI.chooseTarget({ title: '现金不足，请处置资产', options });
      const action = legal[choice === null ? legal.findIndex(item => item.type === 'AUTO_SETTLE_DEBT') : Number(choice)];
      if (!action) continue;
      const payload = action.type === 'SELL_STOCK'
        ? { stockId: action.stockId, shares: action.shares }
        : { tileId: action.tileId };
      this.gameEngine.execute({ type: action.type, playerId: player.id, payload });
    }
    this.syncBoardAssets();
    this.uiRenderer.renderHUD();
  }

  buyLand(tileIndex, player) {
    const result = this.gameEngine.execute({ type: 'PURCHASE_PROPERTY', playerId: player.id, payload: { tileId: tileIndex } });
    if (result.success) {
      this.boardBuilder.updateBuildingMesh(tileIndex, 0, player.colorHex);
      this.audioManager.playBuildSound();
    }
    return result;
  }

  upgradeLand(tileIndex, player) {
    const result = this.gameEngine.execute({ type: 'UPGRADE_PROPERTY', playerId: player.id, payload: { tileId: tileIndex } });
    if (result.success) {
      this.boardBuilder.updateBuildingMesh(tileIndex, result.level, player.colorHex);
      this.audioManager.playBuildSound();
    }
    return result;
  }

  triggerCardVFX(cardId) {
    const card = this.gameState.getCardById ? this.gameState.getCardById(cardId) : null;
    const cardImg = card?.cardImg || `/assets/card_${cardId.toLowerCase()}.svg`;
    const cardName = card?.name || cardId;

    const overlay = document.createElement('div');
    overlay.className = 'vfx-card-overlay';
    overlay.innerHTML = `
      <img src="${cardImg}" class="vfx-card-img" alt="${cardName}">
      <div class="vfx-spell-title">✨ 【${cardName}】 发动！</div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1300);
  }

  triggerExplosionVFX() {
    const flash = document.createElement('div');
    flash.className = 'vfx-explosion-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);
  }

  async handleCardUsage(cardId, cardIndex, targetOverride = null) {
    const curPlayer = this.gameState.getCurrentPlayer();
    const action = this.gameEngine.getCardAction(curPlayer, cardId);
    if (!action.enabled) {
      this.gameState.addLog(`⚠️ 卡片未发动：${action.reason}`, 'danger');
      this.uiRenderer.renderHUD();
      return;
    }

    let targetId = targetOverride;
    if (action.targets?.length && targetId === null) {
      targetId = await this.dialogUI.chooseTarget({
        title: '选择卡片目标',
        options: action.targets
      });
      if (targetId === null) return;
    }

    const activate = async (value = null) => {
      this.triggerCardVFX(cardId);
      if (['MISSILE', 'NUKES', 'MINE', 'DEMOLISH'].includes(cardId)) {
        this.triggerExplosionVFX();
      }

      const result = this.gameEngine.execute({
        type: 'USE_CARD',
        playerId: curPlayer.id,
        payload: { cardId, targetId, value }
      });
      if (!result.success) {
        this.gameState.addLog(`⚠️ 卡片未发动：${result.reason}`, 'danger');
        this.uiRenderer.renderHUD();
        return;
      }
      this.audioManager.playCardSpell();
      this.uiRenderer.renderHUD();
      if (result.followUp?.mode === 'ROLL') {
        await this.doRollDice(result.followUp.steps);
      } else if (result.followUp?.mode === 'TELEPORT') {
        const moved = this.gameEngine.execute({
          type: 'TELEPORT_PLAYER',
          playerId: curPlayer.id,
          payload: { tileId: result.followUp.tileId }
        });
        if (moved.success) {
          await this.pawnManager.animatePlayerStep(curPlayer.id, moved.tileId, Math.round(220 / (this.actionSpeed || 1)));
          await this.handleTileArrival(moved.tileId);
        }
      }
    };

    if (cardId === 'REMOTE_DICE' && targetOverride === null) {
      this.dialogUI.showRemoteDice(value => activate(value));
      return;
    }
    await activate(cardId === 'REMOTE_DICE' ? targetOverride : null);
  }

  finishTurn() {
    this.uiRenderer.renderHUD();

    if (this.gameState.checkWinCondition()) {
      this.dialogUI.showVictory(this.gameState.winner, () => {
        this.returnToMenu();
      }, this.gameState);
      return;
    }

    setTimeout(() => {
      const transition = this.gameEngine.execute({
        type: 'END_TURN',
        playerId: this.gameState.currentPlayerIndex
      }).transition;
      this.syncBoardAssets();
      this.gameState.players.forEach(player => {
        this.pawnManager.updateGodAura(player.id, player.godType);
        if (player.isBankrupt) this.pawnManager.setBankrupt(player.id);
      });
      this.pawnManager.syncBoardGods(this.gameState.boardGods);
      this.gameEngine.autoSave();
      this.uiRenderer.renderHUD();
      if (transition?.gameOver && this.gameState.winner) {
        this.dialogUI.showVictory(this.gameState.winner, () => this.returnToMenu(), this.gameState);
      } else {
        this.checkAITurn();
      }
    }, Math.round(800 / this.actionSpeed));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});
