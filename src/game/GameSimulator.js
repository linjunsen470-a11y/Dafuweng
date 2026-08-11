import { AIPlayer } from './AIPlayer.js';
import { getAIMinigameScore } from './MinigameRules.js';
import { getAIAuctionBid } from './AuctionRules.js';
import { GameState } from './GameState.js';
import { GameEngine } from './GameEngine.js';
import { chooseAIMarketAction } from './MarketRules.js';
import { chooseAIPropertyManagement } from './PropertyRules.js';
import { chooseAICompanyPolicy } from './CompanyRules.js';

export class GameSimulator {
  constructor({
    seed = 1,
    mapId = 'city-loop',
    maxRounds = 40,
    profileIndices = [0, 1, 2, 3],
    aiDifficulty = 'HARD',
    mode = 'STANDARD'
  } = {}) {
    this.state = new GameState({ seed, maxRounds });
    this.state.setupGame(profileIndices.map((profileIndex, index) => ({
      profileIndex,
      name: `模拟玩家 ${index + 1}`,
      isAI: true,
      aiDifficulty,
      aiStrategy: ['ECONOMY', 'PROPERTY', 'CARD', 'ATTACK'][index % 4]
    })), 20000, { mapId, maxRounds, mode, teams: mode === 'TEAM' });
    this.engine = new GameEngine(this.state);
  }

  run() {
    const maxTurns = this.state.maxRounds * this.state.players.length * 2;
    let turns = 0;
    while (this.state.phase !== 'GAME_OVER' && turns < maxTurns) {
      this.playTurn();
      if (this.state.phase !== 'GAME_OVER') {
        this.engine.execute({ type: 'END_TURN', playerId: this.state.currentPlayerIndex });
      }
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

    const purchaseDecision = player.isSleepwalkingThisTurn ? null : AIPlayer.decideCardPurchase(player, this.engine);
    if (purchaseDecision) {
      this.engine.execute({
        type: 'BUY_CARD',
        playerId: player.id,
        payload: { cardId: purchaseDecision.cardId }
      });
    }

    const itemToBuy = player.isSleepwalkingThisTurn ? null : AIPlayer.decideItemPurchase(player, this.engine);
    if (itemToBuy) this.engine.execute({ type: 'BUY_ITEM', playerId: player.id, payload: { itemId: itemToBuy } });

    let forcedSteps = null;
    let teleportTile = null;
    const itemDecision = player.isSleepwalkingThisTurn ? null : AIPlayer.decideItemUsage(player, this.state, this.engine);
    if (itemDecision) {
      const used = this.engine.execute({ type: 'USE_ITEM', playerId: player.id, payload: itemDecision });
      forcedSteps = used.followUp?.mode === 'ROLL' ? used.followUp.steps : null;
      teleportTile = used.followUp?.mode === 'TELEPORT' ? used.followUp.tileId : null;
    }
    const cardDecision = player.isSleepwalkingThisTurn ? null : AIPlayer.decideCardUsage(player, this.state, this.engine);
    if (cardDecision && forcedSteps === null && teleportTile === null) {
      const used = this.engine.execute({
        type: 'USE_CARD',
        playerId: player.id,
        payload: {
          cardId: cardDecision.cardId,
          targetId: cardDecision.targetId,
          value: cardDecision.diceVal
        }
      });
      forcedSteps = used.followUp?.steps || null;
      teleportTile = used.followUp?.mode === 'TELEPORT' ? used.followUp.tileId : null;
    }

    const stockDecision = player.isSleepwalkingThisTurn ? null : AIPlayer.decideStockAction(player, this.state.stockMarket);
    if (stockDecision?.action === 'BUY') {
      this.engine.execute({ type: 'BUY_STOCK', playerId: player.id, payload: stockDecision });
    } else if (stockDecision?.action === 'SELL') {
      this.engine.execute({ type: 'SELL_STOCK', playerId: player.id, payload: stockDecision });
    }

    const marketDecision = player.isSleepwalkingThisTurn ? null : chooseAIMarketAction(player, this.state);
    if (marketDecision?.type === 'BUY') {
      this.engine.execute({ type: 'ACCEPT_MARKET_OFFER', playerId: player.id, payload: { offerId: marketDecision.offerId } });
    } else if (marketDecision?.type === 'LIST') {
      this.engine.execute({ type: 'CREATE_MARKET_OFFER', playerId: player.id, payload: marketDecision.payload });
    }

    const propertyDecision = player.isSleepwalkingThisTurn ? null : chooseAIPropertyManagement(player, this.state);
    if (propertyDecision) this.engine.execute({ type: propertyDecision.type, playerId: player.id, payload: propertyDecision });

    const companyDecision = player.isSleepwalkingThisTurn ? null : chooseAICompanyPolicy(player, this.state);
    if (companyDecision) this.engine.execute({ type: 'SET_COMPANY_POLICY', playerId: player.id, payload: companyDecision });

    if (teleportTile !== null) {
      this.engine.execute({ type: 'TELEPORT_PLAYER', playerId: player.id, payload: { tileId: teleportTile } });
    } else {
      if (!forcedSteps) {
        const maxDice = player.vehicle === 'CAR' || player.vehicle === 'ENGINEER' ? 3 : player.vehicle === 'MOTOR' ? 2 : 1;
        this.engine.execute({ type: 'SELECT_DICE_COUNT', playerId: player.id, payload: { count: maxDice } });
      }
      const roll = forcedSteps ? null : this.engine.execute({ type: 'ROLL_DICE', playerId: player.id });
      const steps = forcedSteps || roll.steps;
      this.engine.execute({ type: 'BEGIN_MOVE', playerId: player.id, payload: { steps, source: forcedSteps ? 'CARD' : 'DICE' } });
      while (this.state.pendingMove) {
        let moved = this.engine.execute({ type: 'ADVANCE_MOVE', playerId: player.id });
        if (moved.type === 'ROUTE_CHOICE_REQUIRED') {
          moved = this.engine.execute({
            type: 'ADVANCE_MOVE',
            playerId: player.id,
            payload: {
              nextTileId: player.isSleepwalkingThisTurn
                ? this.state.rng.pick(moved.options)
                : AIPlayer.chooseRoute(player, moved.options, this.state)
            }
          });
        }
        if (!moved.success) break;
      }
    }
    this.resolveArrival(player);
  }

  resolveArrival(player) {
    const tile = this.state.getTile(player.currentTile);
    const landing = this.engine.inspectLanding(player, tile.id);
    if (landing.kind === 'PURCHASE' && AIPlayer.evaluateLandPurchase(player, tile, this.state)) {
      this.engine.execute({
        type: 'PURCHASE_PROPERTY',
        playerId: player.id,
        payload: { tileId: tile.id, buildingType: tile.type === 'BIG_PROPERTY' ? AIPlayer.chooseCommercialBuilding(player, this.state) : null }
      });
    } else if (landing.kind === 'UPGRADE' && AIPlayer.evaluateLandUpgrade(player, tile, landing.property.level, this.state)) {
      this.engine.execute({ type: 'UPGRADE_PROPERTY', playerId: player.id, payload: { tileId: tile.id } });
    } else if (landing.kind === 'LAB') {
      const option = landing.researchOptions.find(item => !player.items.includes(item.id));
      if (option) this.engine.execute({ type: 'START_RESEARCH', playerId: player.id, payload: { tileId: tile.id, itemId: option.id } });
    } else if (landing.kind === 'RENT') {
      const rent = this.engine.execute({ type: 'SETTLE_RENT', playerId: player.id, payload: { tileId: tile.id } });
      if (rent.type === 'DEBT_REQUIRED') {
        this.engine.execute({ type: 'AUTO_SETTLE_DEBT', playerId: player.id });
        this.resolveAuctions();
      }
    } else if (landing.kind === 'SPECIAL') {
      const special = this.engine.execute({ type: 'RESOLVE_LANDING', playerId: player.id, payload: { tileId: tile.id } });
      if (special.type === 'OPEN_BANK') {
        const amount = Math.max(0, player.cash - 8000);
        if (amount) this.engine.execute({
          type: 'BANK_TRANSFER',
          playerId: player.id,
          payload: { tileId: tile.id, direction: 'DEPOSIT', amount }
        });
      } else if (special.type === 'LOTTERY_OFFER' && player.cash >= special.ticketPrice + 3000) {
        this.engine.execute({
          type: 'BUY_LOTTERY',
          playerId: player.id,
          payload: { tileId: tile.id, number: this.state.rng.int(1, 10) }
        });
      } else if (special.type === 'MAGIC_OFFER') {
        const magic = AIPlayer.chooseMagic(player, this.state);
        this.engine.execute({ type: 'RESOLVE_MAGIC', playerId: player.id, payload: { tileId: tile.id, ...magic } });
      } else if (special.type === 'MINIGAME_OFFER') {
        const score = getAIMinigameScore(special.gameId, player.aiDifficulty, this.state.rng);
        this.engine.execute({ type: 'SUBMIT_MINIGAME_RESULT', playerId: player.id, payload: { tileId: tile.id, gameId: special.gameId, score } });
      }
    }
  }

  resolveAuctions() {
    while (this.state.auction) {
      const auction = this.state.auction;
      const bidder = this.state.players[auction.bidderOrder[auction.bidderIndex]];
      const amount = getAIAuctionBid(bidder, auction, this.state);
      this.engine.execute({ type: 'PLACE_BID', playerId: bidder.id, payload: { amount } });
    }
  }
}
