import * as THREE from 'three';
import { Scene3D } from './engine/Scene3D.js';
import { BoardBuilder } from './engine/BoardBuilder.js';
import { PawnManager } from './engine/PawnManager.js';
import { Dice3D } from './engine/Dice3D.js';
import { audioManager } from './engine/AudioManager.js';

import { GameState, GamePhase } from './game/GameState.js';
import { TileType, PLAYER_PROFILES } from './game/BoardData.js';
import { AIPlayer } from './game/AIPlayer.js';
import { eventManager } from './game/EventManager.js';
import { GameEngine } from './game/GameEngine.js';

import { UIRenderer } from './ui/UIRenderer.js';
import { StockUI } from './ui/StockUI.js';
import { ShopUI } from './ui/ShopUI.js';
import { DialogUI } from './ui/DialogUI.js';
import { AssetUI } from './ui/AssetUI.js';

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
    this.stockUI = new StockUI(this.gameState, this.audioManager, () => this.uiRenderer.renderHUD());
    this.shopUI = new ShopUI(this.gameState, this.audioManager, (cardId, idx) => this.handleCardUsage(cardId, idx), () => this.uiRenderer.renderHUD());
    this.dialogUI = new DialogUI(this.audioManager);
    this.assetUI = new AssetUI(this.gameState);

    this.selectedInitialCash = 20000;
    this.isProcessingAction = false;

    this.renderSetupScreen();
    this.bindHUDButtons();
    this.bindKeyboardAndCanvasClick();
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
      maxRounds: mode === 'QUICK' ? 24 : 40,
      mapId: document.getElementById('map-select').value
    });
    this.boardBuilder.applyMapDefinition(this.gameState.mapDefinition);
    this.pawnManager.createPlayerPawns(playerConfigs);
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

    document.getElementById('btn-save-game').onclick = () => {
      if (this.gameState.phase !== GamePhase.PRE_ROLL_ACTION || this.isProcessingAction) {
        this.gameState.addLog('⚠️ 只能在掷骰前保存游戏。', 'danger');
        this.uiRenderer.renderHUD();
        return;
      }
      const name = window.prompt('请输入存档名称', '我的富翁对局');
      if (name === null) return;
      const result = this.gameEngine.saveManual(name || '我的富翁对局');
      this.gameState.addLog(result.success ? '💾 手动存档成功。' : `⚠️ ${result.msg}`, result.success ? 'success' : 'danger');
      this.uiRenderer.renderHUD();
    };

    document.getElementById('btn-assets').onclick = () => this.assetUI.show();

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
  }

  canOpenPlayerAction() {
    const player = this.gameState.getCurrentPlayer();
    return !this.isProcessingAction
      && this.gameState.phase === GamePhase.PRE_ROLL_ACTION
      && player
      && !player.isAI
      && !player.isBankrupt;
  }

  restoreGame(snapshot) {
    this.gameEngine.restore(snapshot);
    this.boardBuilder.applyMapDefinition(this.gameState.mapDefinition);
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
    this.gameState.propertyManager.properties.forEach((prop, tileIndex) => {
      if (prop.owner !== null) {
        const owner = this.gameState.players[prop.owner];
        this.boardBuilder.updateBuildingMesh(tileIndex, prop.level, owner?.colorHex);
      }
      if (prop.hasObstacle) this.boardBuilder.setObstacleMesh(tileIndex, true);
    });
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
    if (curPlayer && curPlayer.isAI && !curPlayer.isBankrupt) {
      this.isProcessingAction = true;
      this.uiRenderer.renderHUD();
      setTimeout(() => {
        this.runAITurn(curPlayer);
      }, 800);
    } else {
      this.isProcessingAction = false;
      this.uiRenderer.renderHUD();
    }
  }

  async runAITurn(aiPlayer) {
    if (this.gameState.phase !== GamePhase.WAITING_FOR_ROLL) return;

    const cardDecision = AIPlayer.decideCardUsage(aiPlayer, this.gameState);
    if (cardDecision && cardDecision.cardId === 'REMOTE_DICE' && cardDecision.diceVal
      && this.gameEngine.getCardAction(aiPlayer, cardDecision.cardId).enabled) {
      this.gameState.addLog(`🤖 ${aiPlayer.name} 使用【遥控骰子】，指定行走 ${cardDecision.diceVal} 步！`, 'accent');
      const idx = aiPlayer.cards.indexOf('REMOTE_DICE');
      if (idx !== -1) aiPlayer.cards.splice(idx, 1);
      await this.doMovePlayer(cardDecision.diceVal);
      return;
    }
    if (cardDecision?.cardId === 'FORTUNE_GOD'
      && this.gameEngine.getCardAction(aiPlayer, cardDecision.cardId).enabled) {
      await this.handleCardUsage(cardDecision.cardId, aiPlayer.cards.indexOf(cardDecision.cardId));
    }

    if (aiPlayer.aiDifficulty === 'HARD') {
      const tacticalCard = ['CASH_TAX', 'TURTLE', 'TURN_AROUND', 'BEAR_CARD']
        .find(cardId => aiPlayer.cards.includes(cardId) && this.gameEngine.getCardAction(aiPlayer, cardId).enabled);
      if (tacticalCard) {
        const legalAction = this.gameEngine.getCardAction(aiPlayer, tacticalCard);
        const target = legalAction.targets[0]?.id;
        await this.handleCardUsage(tacticalCard, aiPlayer.cards.indexOf(tacticalCard), target);
      }
    }

    const stockDecision = AIPlayer.decideStockAction(aiPlayer, this.gameState.stockMarket);
    if (stockDecision) {
      if (stockDecision.action === 'BUY') {
        this.gameState.stockMarket.buyStock(aiPlayer, stockDecision.stockId, stockDecision.shares);
      } else if (stockDecision.action === 'SELL') {
        this.gameState.stockMarket.sellStock(aiPlayer, stockDecision.stockId, stockDecision.shares);
      }
    }

    await this.doRollDice();
  }

  async doRollDice(specifiedDiceVal = null) {
    if (this.gameState.phase !== GamePhase.WAITING_FOR_ROLL) return;
    this.isProcessingAction = true;
    this.gameState.phase = GamePhase.ROLLING;
    this.uiRenderer.renderHUD();

    this.audioManager.playDiceRoll();

    const curPlayer = this.gameState.getCurrentPlayer();
    let diceVal = specifiedDiceVal;

    if (!diceVal) {
      if (curPlayer.moveLimitThisTurn === 1) {
        diceVal = 1; // 乌龟状态强行只能走 1 步
      } else {
        diceVal = this.gameState.rng.int(1, 6);
        if (curPlayer.vehicle === 'CAR') {
          // 汽车可掷 2~3 颗骰子累加步数
          const bonusRoll = this.gameState.rng.int(2, 13);
          diceVal += bonusRoll;
        }
      }
    }
    if (curPlayer.godType === 'BAD') diceVal = Math.max(1, Math.ceil(diceVal / 2));

    const pawnPos = this.boardBuilder.tilePositions[curPlayer.currentTile];
    this.scene3D.focusOnPosition(pawnPos);

    await this.dice3D.roll(Math.min(diceVal, 6), pawnPos.clone().add(new THREE.Vector3(0, 4, 0)));

    this.gameState.addLog(`🎲 ${curPlayer.name} 掷出了 ${diceVal} 点！`, 'gold');

    await this.doMovePlayer(diceVal);
  }

  async doMovePlayer(steps) {
    this.gameState.phase = GamePhase.MOVING;
    const curPlayer = this.gameState.getCurrentPlayer();
    const direction = curPlayer.direction || 1;

    await this.pawnManager.movePawnAlongPath(curPlayer.id, steps, direction, this.gameState, (currentTileIdx) => {
      if (currentTileIdx === 0) {
        curPlayer.cash += 2000;
        this.audioManager.playCoinSound();
        this.gameState.addLog(`🚩 ${curPlayer.name} 经过起点，领取补贴奖金 $2,000！`, 'gold');
      }

      // 疾风忍术：内置 30% 概率无视路障。
      const prop = this.gameState.propertyManager.getProperty(currentTileIdx);
      if (prop && prop.hasObstacle) {
        if (curPlayer.skillName === '疾风忍术' && this.gameState.rng.next() < 0.3) {
          this.gameState.addLog(`🥷 ${curPlayer.name} 触发【疾风忍术】，施展轻功跳过了路障！`, 'accent');
        } else {
          prop.hasObstacle = false;
          this.boardBuilder.setObstacleMesh(currentTileIdx, false);
          this.gameState.addLog(`🚧 ${curPlayer.name} 被路障拦截，被迫在【${this.gameState.getTile(currentTileIdx).name}】停下！`, 'danger');
          return true;
        }
      }

      // 土地公附体状态：所经之处直接免费强占地皮！
      if (curPlayer.godType === 'EARTH' && this.gameState.getTile(currentTileIdx).type === TileType.PROPERTY) {
        if (prop.owner !== curPlayer.id) {
          prop.owner = curPlayer.id;
          if (prop.level === 0) prop.level = 1;
          this.boardBuilder.updateBuildingMesh(currentTileIdx, prop.level, curPlayer.colorHex);
          this.gameState.addLog(`⛰️ ${curPlayer.name} 地契精灵生效，直接占领了【${this.gameState.getTile(currentTileIdx).name}】！`, 'gold');
        }
      }

      return false;
    }, this.gameState.mapRuntime, async (options) => {
      if (curPlayer.isAI) return AIPlayer.chooseRoute(curPlayer, options, this.gameState);
      const choice = await this.dialogUI.chooseTarget({
        title: '前方出现岔路，请选择路线',
        options: options.map(tileId => {
          const tile = this.gameState.getTile(tileId);
          return { id: tileId, label: tile.name, description: tile.desc || '继续前进' };
        })
      });
      return choice === null ? options[0] : Number(choice);
    });

    this.uiRenderer.renderHUD();

    await this.handleTileArrival(curPlayer.currentTile);
  }

  async handleTileArrival(tileIndex) {
    const curPlayer = this.gameState.getCurrentPlayer();
    const tileData = this.gameState.getTile(tileIndex);
    const prop = this.gameState.propertyManager.getProperty(tileIndex);

    this.gameState.phase = GamePhase.ACTION_MODAL;

    if (tileData.type === TileType.PROPERTY) {
      if (prop.owner === null) {
        if (curPlayer.isAI) {
          if (AIPlayer.evaluateLandPurchase(curPlayer, tileData)) {
            this.buyLand(tileIndex, curPlayer);
          } else {
            this.gameState.addLog(`🤖 ${curPlayer.name} 评估资金风险，放弃购买【${tileData.name}】。`);
          }
          this.finishTurn();
        } else {
          this.dialogUI.showLandPurchase({
            tileData,
            currentLevel: 0,
            player: curPlayer,
            onBuy: () => {
              this.buyLand(tileIndex, curPlayer);
              this.finishTurn();
            },
            onPass: () => this.finishTurn()
          });
        }
      } else if (prop.owner === curPlayer.id) {
        if (prop.level < 3) {
          if (curPlayer.isAI) {
            if (AIPlayer.evaluateLandUpgrade(curPlayer, tileData, prop.level)) {
              this.upgradeLand(tileIndex, curPlayer);
            }
            this.finishTurn();
          } else {
            this.dialogUI.showLandPurchase({
              tileData,
              currentLevel: prop.level,
              player: curPlayer,
              onUpgrade: () => {
                this.upgradeLand(tileIndex, curPlayer);
                this.finishTurn();
              },
              onPass: () => this.finishTurn()
            });
          }
        } else {
          this.gameState.addLog(`🏢 ${curPlayer.name} 视察自家【${tileData.name}】(顶级豪华大楼)。`);
          this.finishTurn();
        }
      } else {
        const ownerPlayer = this.gameState.players[prop.owner];

        if (curPlayer.godType === 'FORTUNE' || curPlayer.rentShieldActiveThisTurn) {
          this.gameState.addLog(`🧙‍♂️ ${curPlayer.name} ${curPlayer.godType === 'FORTUNE' ? '财神' : '福神'}庇护，免除【${tileData.name}】过路费！`, 'gold');
        } else if (curPlayer.skillName === '股市高手' && this.gameState.rng.next() < 0.25) {
          this.gameState.addLog(`💎 ${curPlayer.name} 凭借【股市高手】人脉手腕，巧妙化解了【${tileData.name}】过路费！`, 'gold');
        } else {
          let toll = this.gameState.propertyManager.calculateToll(tileIndex, this.gameState.newsEffect);
          if (curPlayer.godType === 'MISFORTUNE') {
            toll *= 2;
          }
          if (ownerPlayer && ownerPlayer.skillName === '土地公庇护') {
            toll = Math.round(toll * 1.2);
          }

          curPlayer.cash -= toll;
          ownerPlayer.cash += toll;

          this.audioManager.playCoinSound();
          this.gameState.addLog(`💸 ${curPlayer.name} 停留在 ${ownerPlayer.name} 的【${tileData.name}】，支付过路费 $${toll.toLocaleString()}！`, 'danger');
          this.gameState.checkBankrupt(curPlayer);
        }
        this.finishTurn();
      }
    } else if (tileData.type === TileType.CARD_SHOP) {
      const bonusPts = curPlayer.skillName === '疾风忍术' ? 120 : 60;
      curPlayer.cardPoints += bonusPts;
      this.audioManager.playCardSpell();
      this.gameState.addLog(`🃏 ${curPlayer.name} 踩中【${tileData.name}】，获得 ${bonusPts} 卡片积分！`, 'accent');
      this.finishTurn();
    } else if (tileData.type === TileType.BANK) {
      const bonus = Math.round(curPlayer.cash * 0.1);
      curPlayer.cash += bonus;
      this.audioManager.playCoinSound();
      this.gameState.addLog(`🏦 ${curPlayer.name} 踩中【${tileData.name}】，获得 10% 存款利息 $${bonus.toLocaleString()}！`, 'gold');
      this.finishTurn();
    } else if (tileData.type === TileType.PRISON) {
      curPlayer.jailTurns = 2;
      this.gameState.addLog(`🚔 ${curPlayer.name} 入狱，暂停行动 2 回合！`, 'danger');
      this.finishTurn();
    } else if (tileData.type === TileType.HOSPITAL) {
      curPlayer.hospitalTurns = 1;
      this.gameState.addLog(`🏥 ${curPlayer.name} 入院疗养，暂停行动 1 回合！`, 'danger');
      this.finishTurn();
    } else if (tileData.type === TileType.CHANCE) {
      const card = eventManager.drawChanceCard();
      if (card.isGain || curPlayer.skillName === '自然之福') {
        const gainAmount = Math.abs(card.amount);
        curPlayer.cash += gainAmount;
        this.audioManager.playCoinSound();
        this.gameState.addLog(`❓ 命运卡【${card.title}】：${card.desc}，获得 $${gainAmount.toLocaleString()}！`, 'gold');
      } else if (curPlayer.negativeImmuneActiveThisTurn) {
        this.gameState.addLog(`🍀 ${curPlayer.name} 的好运护符抵消了【${card.title}】。`, 'gold');
      } else {
        curPlayer.cash -= card.amount;
        this.gameState.addLog(`❓ 命运卡【${card.title}】：${card.desc}，损失 $${card.amount.toLocaleString()}！`, 'danger');
        this.gameState.checkBankrupt(curPlayer);
      }
      this.finishTurn();
    } else if (tileData.type === TileType.GOD_FORTUNE) {
      curPlayer.godType = tileIndex === 28 ? 'LUCK' : 'FORTUNE';
      curPlayer.godTurns = curPlayer.skillName === '石油大亨' ? 4 : 3;
      this.pawnManager.updateGodAura(curPlayer.id, curPlayer.godType);
      this.gameState.addLog(curPlayer.godType === 'LUCK'
        ? `🌟 建造精灵陪伴 ${curPlayer.name}，未来 ${curPlayer.godTurns} 回合免费建造！`
        : `🧙‍♂️ 免租精灵陪伴 ${curPlayer.name}，未来 ${curPlayer.godTurns} 回合免过路费！`, 'gold');
      this.finishTurn();
    } else if (tileData.type === TileType.GOD_MISFORTUNE) {
      curPlayer.godType = 'MISFORTUNE';
      curPlayer.godTurns = curPlayer.skillName === '石油大亨' ? 4 : 3;
      this.pawnManager.updateGodAura(curPlayer.id, 'MISFORTUNE');
      this.gameState.addLog(`👻 穷神降临附体 ${curPlayer.name}！未来 ${curPlayer.godTurns} 回合过路费加倍！`, 'danger');
      this.finishTurn();
    } else if (tileData.type === TileType.GOD_EARTH) {
      curPlayer.godType = 'EARTH';
      curPlayer.godTurns = curPlayer.skillName === '石油大亨' ? 4 : 3;
      this.pawnManager.updateGodAura(curPlayer.id, 'EARTH');
      this.gameState.addLog(`⛰️ 土地公降临附体 ${curPlayer.name}！所经土地直接免费夺取！`, 'gold');
      this.finishTurn();
    } else if (tileData.type === TileType.GOD_BAD) {
      curPlayer.godType = 'BAD';
      curPlayer.godTurns = 3;
      this.pawnManager.updateGodAura(curPlayer.id, 'BAD');
      this.gameState.addLog(`📉 衰神缠身 ${curPlayer.name}！未来 3 回合买地失败，步数减半！`, 'danger');
      this.finishTurn();
    } else if (tileData.type === TileType.STOCK) {
      this.gameState.addLog(`📈 ${curPlayer.name} 到达【证券交易所】。`, 'accent');
      if (!curPlayer.isAI) {
        await new Promise(resolve => this.stockUI.show(resolve));
      }
      this.finishTurn();
    } else {
      this.finishTurn();
    }
  }

  buyLand(tileIndex, player) {
    if (player.godType === 'BAD') {
      this.gameState.addLog(`📉 ${player.name} 衰神附体，买地失败！`, 'danger');
      return;
    }

    const tileData = this.gameState.getTile(tileIndex);
    let price = tileData.price;
    if (player.godType === 'LUCK') {
      price = 0; // 福神完全免费
    } else if (player.skillName === '商业奇才') {
      price = Math.round(price * 0.85);
    }

    if (player.cash >= price) {
      player.cash -= price;
      this.gameState.propertyManager.buyProperty(tileIndex, player.id);
      this.boardBuilder.updateBuildingMesh(tileIndex, 0, player.colorHex);
      this.audioManager.playBuildSound();
      this.gameState.addLog(`🏗️ ${player.name} 成功购买【${tileData.name}】(花费 $${price.toLocaleString()})！`, 'success');
    }
  }

  upgradeLand(tileIndex, player) {
    if (player.godType === 'BAD') {
      this.gameState.addLog(`📉 ${player.name} 衰神附体，升级建筑失败！`, 'danger');
      return;
    }

    const tileData = this.gameState.getTile(tileIndex);
    const prop = this.gameState.propertyManager.getProperty(tileIndex);
    let cost = tileData.buildCost;
    if (player.godType === 'LUCK') {
      cost = 0; // 福神升级完全免费
    } else if (player.skillName === '商业奇才') {
      cost = Math.round(cost * 0.85);
    }

    if (player.cash >= cost && prop.level < 3) {
      player.cash -= cost;
      this.gameState.propertyManager.upgradeProperty(tileIndex);
      this.boardBuilder.updateBuildingMesh(tileIndex, prop.level, player.colorHex);
      this.audioManager.playBuildSound();
      this.gameState.addLog(`✨ ${player.name} 将【${tileData.name}】升级至 LV ${prop.level} 建筑(花费 $${cost.toLocaleString()})！`, 'gold');
    }
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

    const consume = () => {
      const liveIndex = curPlayer.cards.indexOf(cardId);
      if (liveIndex !== -1) curPlayer.cards.splice(liveIndex, 1);
    };

    if (cardId === 'REMOTE_DICE') {
      this.dialogUI.showRemoteDice((val) => {
        consume();
        this.gameState.addLog(`🎯 ${curPlayer.name} 发动【遥控骰子】，指定前进行走 ${val} 步！`, 'accent');
        this.doRollDice(val);
      });
    } else if (cardId === 'OBSTACLE') {
      const targetTile = Number(targetId);
      this.gameState.propertyManager.getProperty(targetTile).hasObstacle = true;
      this.boardBuilder.setObstacleMesh(targetTile, true);
      consume();
      this.gameState.addLog(`🚧 ${curPlayer.name} 在【${this.gameState.getTile(targetTile).name}】放置了路障！`, 'danger');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'TURN_AROUND') {
      const target = this.gameState.players[Number(targetId)];
      target.direction = (target.direction || 1) * -1;
      consume();
      this.gameState.addLog(`🔄 ${curPlayer.name} 令 ${target.name} 掉转了行走方向！`, 'accent');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'RED_BULL') {
      this.gameState.stockMarket.forceStockSurge(String(targetId), true);
      consume();
      this.gameState.addLog(`📈 ${curPlayer.name} 使用【红霸卡】，指定股票上涨 10%！`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'DEMOLISH') {
      const targetTile = Number(targetId);
      const prop = this.gameState.propertyManager.getProperty(targetTile);
      if (prop && prop.level > 0) {
        prop.level--;
        const owner = this.gameState.players[prop.owner];
        this.boardBuilder.updateBuildingMesh(targetTile, prop.level, owner?.colorHex);
        this.gameState.addLog(`💣 ${curPlayer.name} 使用【拆房卡】，成功拆除【${this.gameState.getTile(targetTile).name}】1层建筑！`, 'danger');
      } else {
        this.gameState.addLog(`💣 当前停留位置无可拆除房屋！`, 'accent');
      }
      consume();
      this.uiRenderer.renderHUD();
    } else if (cardId === 'EQUAL_WEALTH') {
      const activePlayers = this.gameState.players.filter(p => !p.isBankrupt);
      const totalCash = activePlayers.reduce((acc, p) => acc + p.cash, 0);
      const avgCash = Math.round(totalCash / activePlayers.length);
      activePlayers.forEach(p => p.cash = avgCash);
      consume();
      this.gameState.addLog(`⚖️ ${curPlayer.name} 使用【均富卡】，场上所有玩家现金重新平分为 $${avgCash.toLocaleString()}！`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'STEAL_LAND') {
      const targetTile = Number(targetId);
      const prop = this.gameState.propertyManager.getProperty(targetTile);
      if (this.gameState.getTile(targetTile).type === TileType.PROPERTY) {
        prop.owner = curPlayer.id;
        if (prop.level === 0) prop.level = 1;
        this.boardBuilder.updateBuildingMesh(targetTile, prop.level, curPlayer.colorHex);
        this.gameState.addLog(`🚩 ${curPlayer.name} 使用【强占卡】，强行将【${this.gameState.getTile(targetTile).name}】夺为己有！`, 'gold');
      }
      consume();
      this.uiRenderer.renderHUD();
    } else if (cardId === 'FORTUNE_GOD') {
      curPlayer.godType = 'LUCK';
      curPlayer.godTurns = 3;
      this.pawnManager.updateGodAura(curPlayer.id, 'LUCK');
      consume();
      this.gameState.addLog(`🌟 ${curPlayer.name} 召唤建造精灵，未来 3 回合免费建造！`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'TURTLE') {
      const target = this.gameState.players[Number(targetId)];
      target.turtleTurns = 3;
      consume();
      this.gameState.addLog(`🐢 ${curPlayer.name} 对 ${target.name} 发动迟缓卡，持续 3 回合！`, 'danger');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'CAR_CARD') {
      curPlayer.vehicle = 'CAR';
      consume();
      this.gameState.addLog(`🏎️ ${curPlayer.name} 使用【汽车卡】，装备豪华赛车，投掷骰子步数翻倍！`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'CLEANSE') {
      curPlayer.turtleTurns = 0;
      if (curPlayer.godType === 'MISFORTUNE' || curPlayer.godType === 'BAD') {
        curPlayer.godType = null;
        curPlayer.godTurns = 0;
        this.pawnManager.updateGodAura(curPlayer.id, null);
      }
      consume();
      this.gameState.addLog(`✨ ${curPlayer.name} 清除了所有负面状态。`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'RENT_SHIELD') {
      curPlayer.rentShieldTurns = 2;
      consume();
      this.gameState.addLog(`🛡️ ${curPlayer.name} 获得 2 回合免租护盾。`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'CASH_TAX') {
      const target = this.gameState.players[Number(targetId)];
      const amount = target.negativeImmuneActiveThisTurn
        ? 0
        : Math.min(2500, Math.max(0, Math.round(target.cash * 0.12)));
      target.cash -= amount;
      curPlayer.cash += amount;
      consume();
      this.gameState.checkBankrupt(target);
      this.gameState.addLog(amount > 0
        ? `🧾 ${curPlayer.name} 从 ${target.name} 收取 $${amount.toLocaleString()}。`
        : `🍀 ${target.name} 的好运护符抵消了消费税。`, amount > 0 ? 'danger' : 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'TELEPORT') {
      const targetTile = Number(targetId);
      const projected = this.gameState.mapRuntime.projectPath(
        curPlayer.currentTile,
        10,
        curPlayer.direction || 1
      );
      const steps = projected.indexOf(targetTile) + 1;
      consume();
      this.gameState.addLog(`🌀 ${curPlayer.name} 发动跃迁卡。`, 'accent');
      if (steps > 0) await this.doMovePlayer(steps);
    } else if (cardId === 'CLEAR_ROAD') {
      const targetTile = Number(targetId);
      this.gameState.propertyManager.getProperty(targetTile).hasObstacle = false;
      this.boardBuilder.setObstacleMesh(targetTile, false);
      consume();
      this.gameState.addLog(`🚜 ${curPlayer.name} 清除了【${this.gameState.getTile(targetTile).name}】的路障。`, 'success');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'BEAR_CARD') {
      this.gameState.stockMarket.forceStockSurge(String(targetId), false);
      consume();
      this.gameState.addLog(`📉 ${curPlayer.name} 令指定股票下跌 10%。`, 'danger');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'IMMUNITY') {
      curPlayer.negativeImmuneTurns = 3;
      consume();
      this.gameState.addLog(`🍀 ${curPlayer.name} 获得 3 回合负面免疫。`, 'gold');
      this.uiRenderer.renderHUD();
    } else if (cardId === 'GIFT_CARD') {
      const target = this.gameState.players[Number(targetId)];
      if (target.cards.length && curPlayer.cards.length > 1) {
        const own = curPlayer.cards.find(id => id !== cardId);
        const other = this.gameState.rng.pick(target.cards);
        curPlayer.cards[curPlayer.cards.indexOf(own)] = other;
        target.cards[target.cards.indexOf(other)] = own;
      }
      consume();
      this.gameState.addLog(`🎁 ${curPlayer.name} 与 ${target.name} 交换了礼券。`, 'accent');
      this.uiRenderer.renderHUD();
    } else {
      this.gameState.addLog('⚠️ 该卡片效果尚未注册。', 'danger');
    }
  }

  finishTurn() {
    this.uiRenderer.renderHUD();

    if (this.gameState.checkWinCondition()) {
      this.dialogUI.showVictory(this.gameState.winner, () => {
        window.location.reload();
      }, this.gameState);
      return;
    }

    setTimeout(() => {
      const transition = this.gameState.nextTurn();
      this.gameState.players.forEach(player => {
        this.pawnManager.updateGodAura(player.id, player.godType);
        if (player.isBankrupt) this.pawnManager.setBankrupt(player.id);
      });
      this.gameEngine.autoSave();
      this.uiRenderer.renderHUD();
      if (transition?.gameOver && this.gameState.winner) {
        this.dialogUI.showVictory(this.gameState.winner, () => window.location.reload(), this.gameState);
      } else {
        this.checkAITurn();
      }
    }, 800);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});
