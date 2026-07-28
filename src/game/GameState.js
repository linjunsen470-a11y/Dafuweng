import { BOARD_TILES, TileType, PLAYER_PROFILES } from './BoardData.js';
import { PropertyManager } from './PropertyManager.js';
import { stockMarket } from './StockMarket.js';
import { eventManager } from './EventManager.js';
import { SeededRandom } from './SeededRandom.js';

export const GamePhase = {
  SETUP: 'SETUP',
  TURN_START: 'TURN_START',
  PRE_ROLL_ACTION: 'PRE_ROLL_ACTION',
  WAITING_FOR_ROLL: 'PRE_ROLL_ACTION',
  ROLLING: 'ROLLING',
  MOVING: 'MOVING',
  LANDING_ACTION: 'LANDING_ACTION',
  ACTION_MODAL: 'LANDING_ACTION',
  TURN_END: 'TURN_END',
  GAME_OVER: 'GAME_OVER'
};

export class GameState {
  constructor({ seed = Date.now(), maxRounds = 40 } = {}) {
    this.phase = GamePhase.SETUP;
    this.round = 1;
    this.maxRounds = maxRounds;
    this.currentPlayerIndex = 0;
    this.players = [];
    this.propertyManager = new PropertyManager();
    this.stockMarket = stockMarket;
    this.rng = new SeededRandom(seed);
    this.stockMarket.setRandomSource(() => this.rng.next());
    eventManager.setRandomSource(() => this.rng.next());
    this.newsEffect = null; // { id, remainingRounds }
    this.logHistory = [];
    this.winner = null;
    this.winReason = null;
  }

  setupGame(playerConfigs, initialCash = 20000, options = {}) {
    this.round = 1;
    this.maxRounds = options.maxRounds || this.maxRounds || 40;
    this.currentPlayerIndex = 0;
    this.phase = GamePhase.PRE_ROLL_ACTION;
    this.propertyManager = new PropertyManager();
    this.stockMarket.reset();
    this.newsEffect = null;
    this.winner = null;
    this.winReason = null;

    this.players = playerConfigs.map((cfg, idx) => {
      const profile = PLAYER_PROFILES[cfg.profileIndex !== undefined ? cfg.profileIndex : (idx % PLAYER_PROFILES.length)];
      let cash = initialCash;
      if (profile.skillName === '土地公庇护') {
        cash += 3000;
      }

      return {
        id: idx,
        profileId: profile.id,
        name: cfg.name || profile.name,
        isAI: cfg.isAI,
        aiDifficulty: cfg.aiDifficulty || 'NORMAL',
        avatarImg: profile.avatarImg,
        avatarAtlas: profile.avatarAtlas,
        avatarPosition: profile.avatarPosition,
        avatar: profile.avatar,
        color: profile.color,
        colorHex: profile.colorHex,
        skillName: profile.skillName,
        skillDesc: profile.skillDesc,
        cash: cash,
        cardPoints: 120,
        cards: ['REMOTE_DICE', 'OBSTACLE', 'TURN_AROUND'],
        stocks: {},
        currentTile: 0,
        direction: 1,
        vehicle: 'WALK', // 'WALK', 'MOTOR', 'CAR'
        jailTurns: 0,
        hospitalTurns: 0,
        turtleTurns: 0,
        godType: null, // 'FORTUNE', 'LUCK', 'MISFORTUNE', 'BAD', 'EARTH'
        godTurns: 0,
        rentShieldTurns: 0,
        negativeImmuneTurns: 0,
        isBankrupt: false
      };
    });

    this.addLog(`🎮 《富翁帝国》原创对局开启！基础初始资金 $${initialCash.toLocaleString()}，祝大家日进斗金！`, 'gold');
    this.players.forEach(p => {
      if (p.skillName === '土地公庇护') {
        this.addLog(`🤠 ${p.name} 触发【土地公庇护】技能：获得额外 $3,000 开局创业金补贴！`, 'accent');
      }
    });
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  nextTurn() {
    this.phase = GamePhase.TURN_END;
    let attempts = 0;
    while (attempts < this.players.length * 2) {
      const previous = this.currentPlayerIndex;
      let nextIdx = (previous + 1) % this.players.length;
      while (this.players[nextIdx].isBankrupt && nextIdx !== previous) {
        nextIdx = (nextIdx + 1) % this.players.length;
      }
      if (nextIdx <= previous) {
        this.round++;
        this.onRoundEnd();
      }
      this.currentPlayerIndex = nextIdx;
      if (this.checkWinCondition()) return { gameOver: true, skipped: [] };

      const cur = this.getCurrentPlayer();
      this.tickPlayerStatuses(cur);

      if (cur.jailTurns > 0) {
        cur.jailTurns--;
        this.addLog(`🚔 ${cur.name} 在监狱服刑，剩余 ${cur.jailTurns} 回合，本回合跳过。`, 'danger');
        attempts++;
        continue;
      }
      if (cur.hospitalTurns > 0) {
        cur.hospitalTurns--;
        this.addLog(`🏥 ${cur.name} 在医院疗养，剩余 ${cur.hospitalTurns} 回合，本回合跳过。`, 'danger');
        attempts++;
        continue;
      }
      this.phase = GamePhase.PRE_ROLL_ACTION;
      return { gameOver: false, currentPlayer: cur };
    }
    this.checkWinCondition(true);
    return { gameOver: this.phase === GamePhase.GAME_OVER };
  }

  tickPlayerStatuses(cur) {
    if (cur.godType) {
      cur.godTurns--;
      if (cur.godTurns < 0) {
        this.addLog(`✨ ${cur.name} 的运势精灵效果结束。`, 'accent');
        cur.godType = null;
      }
    }
    if (cur.turtleTurns > 0) {
      this.addLog(`🐢 ${cur.name} 受到迟缓效果，本回合只能移动 1 步。`, 'danger');
      cur.moveLimitThisTurn = 1;
      cur.turtleTurns--;
    } else {
      cur.moveLimitThisTurn = null;
    }
    cur.rentShieldActiveThisTurn = cur.rentShieldTurns > 0;
    if (cur.rentShieldActiveThisTurn) cur.rentShieldTurns--;
    cur.negativeImmuneActiveThisTurn = cur.negativeImmuneTurns > 0;
    if (cur.negativeImmuneActiveThisTurn) cur.negativeImmuneTurns--;
    if (cur.godType === 'MISFORTUNE' && !cur.negativeImmuneActiveThisTurn) {
      const penalty = Math.max(0, Math.round(cur.cash * 0.10));
      cur.cash -= penalty;
      this.addLog(`👻 破财精灵收取 ${cur.name} $${penalty.toLocaleString()}。`, 'danger');
      this.checkBankrupt(cur);
    }
  }

  onRoundEnd() {
    if (this.newsEffect) {
      this.newsEffect.remainingRounds--;
      if (this.newsEffect.remainingRounds <= 0) this.newsEffect = null;
    }
    this.stockMarket.updateMarket();
    this.addLog(`📈 第 ${this.round} 轮开始！股市大盘价格已实时刷新更新！`, 'accent');

    const news = eventManager.triggerRandomNews(this);
    if (news) {
      this.addLog(`⚡ 新闻大事件：【${news.title}】 - ${news.desc}`, 'gold');
    }
  }

  checkBankrupt(player) {
    if (player.cash < 0 && !player.isBankrupt) {
      let totalStockAssets = 0;
      for (const stockId in player.stocks) {
        const holding = player.stocks[stockId];
        const stock = this.stockMarket.stocks.find(s => s.id === stockId);
        if (holding && stock) {
          totalStockAssets += holding.shares * stock.price;
        }
      }

      if (player.cash + totalStockAssets >= 0) {
        this.addLog(`⚠️ ${player.name} 现金不足，自动变卖股票资产抵债！`, 'danger');
        for (const stockId in player.stocks) {
          this.stockMarket.sellStock(player, stockId, player.stocks[stockId].shares);
        }
      } else {
        player.isBankrupt = true;
        this.addLog(`💥 破产公告：${player.name} 宣告破产退场！`, 'danger');

        this.propertyManager.properties.forEach((prop) => {
          if (prop.owner === player.id) {
            prop.owner = null;
            prop.level = 0;
          }
        });
        this.checkWinCondition();
      }
    }
  }

  calculateNetWorth(player) {
    let value = player.cash;
    Object.entries(player.stocks || {}).forEach(([stockId, holding]) => {
      const stock = this.stockMarket.stocks.find(s => s.id === stockId);
      if (stock) value += holding.shares * stock.price;
    });
    this.propertyManager.properties.forEach((prop, tileIndex) => {
      if (prop.owner !== player.id) return;
      const tile = BOARD_TILES[tileIndex];
      value += (tile.price || 0) + (tile.buildCost || 0) * prop.level;
    });
    return Math.round(value);
  }

  checkWinCondition(force = false) {
    const activePlayers = this.players.filter(p => !p.isBankrupt);
    if (activePlayers.length === 1 || force || this.round > this.maxRounds) {
      this.phase = GamePhase.GAME_OVER;
      this.winner = [...activePlayers].sort((a, b) => this.calculateNetWorth(b) - this.calculateNetWorth(a))[0];
      this.winReason = activePlayers.length === 1 ? 'LAST_PLAYER' : 'NET_WORTH';
      this.addLog(`👑 ${this.winner.name} 以总资产 $${this.calculateNetWorth(this.winner).toLocaleString()} 获得胜利！`, 'gold');
      return true;
    }
    return false;
  }

  createSnapshot() {
    const random = this.rng.exportState();
    return {
      version: 1,
      contentVersion: '2026.1',
      savedAt: new Date().toISOString(),
      seed: random.seed,
      rngState: random.state,
      phase: this.phase,
      round: this.round,
      maxRounds: this.maxRounds,
      currentPlayerIndex: this.currentPlayerIndex,
      players: structuredClone(this.players),
      properties: structuredClone([...this.propertyManager.properties.entries()]),
      stocks: structuredClone(this.stockMarket.stocks),
      newsEffect: structuredClone(this.newsEffect),
      logHistory: structuredClone(this.logHistory)
    };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1) throw new Error('不兼容的存档版本');
    this.phase = snapshot.phase;
    this.round = snapshot.round;
    this.maxRounds = snapshot.maxRounds;
    this.currentPlayerIndex = snapshot.currentPlayerIndex;
    this.players = structuredClone(snapshot.players);
    this.propertyManager.properties = new Map(structuredClone(snapshot.properties));
    this.stockMarket.stocks = structuredClone(snapshot.stocks);
    this.newsEffect = structuredClone(snapshot.newsEffect);
    this.logHistory = structuredClone(snapshot.logHistory || []);
    this.rng.importState({ seed: snapshot.seed, state: snapshot.rngState });
  }

  addLog(msg, type = 'normal') {
    this.logHistory.push({ msg, type, time: new Date().toLocaleTimeString() });
    if (this.logHistory.length > 50) this.logHistory.shift();
  }
}
