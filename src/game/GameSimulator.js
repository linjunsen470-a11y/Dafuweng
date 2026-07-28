import { AIPlayer } from './AIPlayer.js';
import { GameState } from './GameState.js';
import { GameEngine } from './GameEngine.js';

export class GameSimulator {
  constructor({ seed = 1, mapId = 'city-loop', maxRounds = 40 } = {}) {
    this.state = new GameState({ seed, maxRounds });
    this.state.setupGame([
      { profileIndex: 0, name: '模拟甲', isAI: true, aiDifficulty: 'HARD' },
      { profileIndex: 1, name: '模拟乙', isAI: true, aiDifficulty: 'HARD' },
      { profileIndex: 2, name: '模拟丙', isAI: true, aiDifficulty: 'HARD' },
      { profileIndex: 3, name: '模拟丁', isAI: true, aiDifficulty: 'HARD' }
    ], 20000, { mapId, maxRounds });
    this.engine = new GameEngine(this.state);
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
    const landing = this.engine.inspectLanding(player, tile.id);
    if (landing.kind === 'PURCHASE' && AIPlayer.evaluateLandPurchase(player, tile)) {
      this.engine.purchaseProperty(player, tile.id);
    } else if (landing.kind === 'UPGRADE' && AIPlayer.evaluateLandUpgrade(player, tile, landing.property.level)) {
      this.engine.upgradeProperty(player, tile.id);
    } else if (landing.kind === 'RENT') {
      this.engine.settleRent(player, tile.id);
    } else if (landing.kind === 'SPECIAL') {
      this.engine.resolveSpecialLanding(player, tile.id);
    }
    this.state.checkBankrupt(player);
  }
}
