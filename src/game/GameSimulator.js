import { AIPlayer } from './AIPlayer.js';
import { GameState } from './GameState.js';
import { TileType } from './BoardData.js';
import { eventManager } from './EventManager.js';

export class GameSimulator {
  constructor({ seed = 1, mapId = 'city-loop', maxRounds = 40 } = {}) {
    this.state = new GameState({ seed, maxRounds });
    this.state.setupGame([
      { profileIndex: 0, name: '模拟甲', isAI: true, aiDifficulty: 'HARD' },
      { profileIndex: 1, name: '模拟乙', isAI: true, aiDifficulty: 'HARD' },
      { profileIndex: 2, name: '模拟丙', isAI: true, aiDifficulty: 'HARD' },
      { profileIndex: 3, name: '模拟丁', isAI: true, aiDifficulty: 'HARD' }
    ], 20000, { mapId, maxRounds });
  }

  run() {
    const maxTurns = this.state.maxRounds * this.state.players.length * 2;
    let turns = 0;
    while (this.state.phase !== 'GAME_OVER' && turns < maxTurns) {
      this.playTurn();
      if (this.state.phase !== 'GAME_OVER') this.state.nextTurn();
      turns++;
    }
    if (this.state.phase !== 'GAME_OVER') this.state.checkWinCondition(true);
    return {
      turns,
      round: this.state.round,
      winnerId: this.state.winner?.id,
      snapshot: this.state.createSnapshot(),
      rankings: this.state.getRankings()
    };
  }

  playTurn() {
    const player = this.state.getCurrentPlayer();
    if (!player || player.isBankrupt) return;

    const stockDecision = AIPlayer.decideStockAction(player, this.state.stockMarket);
    if (stockDecision?.action === 'BUY') {
      this.state.stockMarket.buyStock(player, stockDecision.stockId, stockDecision.shares);
    } else if (stockDecision?.action === 'SELL') {
      this.state.stockMarket.sellStock(player, stockDecision.stockId, stockDecision.shares);
    }

    let steps = player.moveLimitThisTurn === 1 ? 1 : this.state.rng.int(1, player.vehicle === 'CAR' ? 18 : 6);
    if (player.godType === 'BAD') steps = Math.max(1, Math.ceil(steps / 2));
    const path = this.state.mapRuntime.projectPath(
      player.currentTile,
      steps,
      player.direction || 1,
      options => AIPlayer.chooseRoute(player, options, this.state)
    );
    path.forEach(tileId => {
      player.currentTile = tileId;
      if (tileId === this.state.mapDefinition.spawnTile) player.cash += 2000;
    });
    this.resolveArrival(player);
  }

  resolveArrival(player) {
    const tile = this.state.getTile(player.currentTile);
    const property = this.state.propertyManager.getProperty(tile.id);
    if (tile.type === TileType.PROPERTY) {
      if (property.owner === null && AIPlayer.evaluateLandPurchase(player, tile)) {
        player.cash -= tile.price;
        this.state.propertyManager.buyProperty(tile.id, player.id);
      } else if (property.owner === player.id && AIPlayer.evaluateLandUpgrade(player, tile, property.level)) {
        player.cash -= tile.buildCost;
        this.state.propertyManager.upgradeProperty(tile.id);
      } else if (property.owner !== null && property.owner !== player.id
        && player.godType !== 'FORTUNE' && !player.rentShieldActiveThisTurn) {
        const owner = this.state.players[property.owner];
        const toll = this.state.propertyManager.calculateToll(tile.id, this.state.newsEffect);
        player.cash -= toll;
        owner.cash += toll;
      }
    } else if (tile.type === TileType.CARD_SHOP) {
      player.cardPoints += 60;
    } else if (tile.type === TileType.BANK) {
      player.cash += Math.max(0, Math.round(player.cash * 0.1));
    } else if (tile.type === TileType.PRISON) {
      player.jailTurns = 2;
    } else if (tile.type === TileType.HOSPITAL) {
      player.hospitalTurns = 1;
    } else if (tile.type === TileType.CHANCE) {
      const event = eventManager.drawChanceCard();
      player.cash += event.isGain ? event.amount : -event.amount;
    } else if (tile.type === TileType.GOD_FORTUNE) {
      player.godType = tile.id === 28 ? 'LUCK' : 'FORTUNE';
      player.godTurns = 3;
    } else if (tile.type === TileType.GOD_MISFORTUNE) {
      player.godType = 'MISFORTUNE';
      player.godTurns = 3;
    } else if (tile.type === TileType.GOD_EARTH) {
      player.godType = 'EARTH';
      player.godTurns = 3;
    } else if (tile.type === TileType.GOD_BAD) {
      player.godType = 'BAD';
      player.godTurns = 3;
    }
    this.state.checkBankrupt(player);
  }
}

