import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/game/CardManager.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';

function createCardGame(cardId) {
  const state = new GameState({ seed: 20260731 });
  state.setupGame([
    { profileIndex: 0, name: 'Player A', isAI: false },
    { profileIndex: 1, name: 'Player B', isAI: true }
  ], 50000);
  const [player, opponent] = state.players;
  player.cards = [cardId, 'REMOTE_DICE'];
  opponent.cards = ['OBSTACLE', 'TURN_AROUND'];
  player.currentTile = 1;
  state.propertyManager.buyProperty(1, player.id);
  state.propertyManager.upgradeProperty(1);
  state.propertyManager.upgradeProperty(1);
  state.propertyManager.buyProperty(3, opponent.id);
  state.propertyManager.upgradeProperty(3);
  state.propertyManager.getProperty(5).hasObstacle = true;
  if (cardId === 'CLEANSE') {
    player.turtleTurns = 2;
    player.godType = 'MISFORTUNE';
    player.godTurns = 2;
  }
  if (cardId === 'IMMUNITY_CARD') player.jailTurns = 2;
  if (cardId === 'BANISH_GOD') {
    player.godType = 'MISFORTUNE';
    player.godTurns = 3;
  }
  return { state, engine: new GameEngine(state), player };
}

describe('card effect registry contract', () => {
  it('has unique IDs and a source asset for every card', () => {
    expect(new Set(CARDS.map(card => card.id)).size).toBe(CARDS.length);
    for (const card of CARDS) {
      const assetPath = path.join(process.cwd(), 'public', card.cardImg.replace(/^\/assets\//, 'assets/'));
      expect(fs.existsSync(assetPath), `${card.id} is missing ${assetPath}`).toBe(true);
    }
  });

  it.each(CARDS)('executes $id through the command facade and consumes one card', card => {
    const { engine, player } = createCardGame(card.id);
    const action = engine.getCardAction(player, card.id);
    expect(action.enabled, action.reason).toBe(true);
    const targetId = action.targets?.[0]?.id ?? null;
    const before = player.cards.filter(id => id === card.id).length;
    const opponentCashBefore = engine.state.players[1].cash;
    const result = engine.execute({
      type: 'USE_CARD',
      playerId: player.id,
      payload: { cardId: card.id, targetId, value: card.id === 'REMOTE_DICE' ? 3 : null }
    });
    expect(result.success, result.reason).toBe(true);
    expect(player.cards.filter(id => id === card.id)).toHaveLength(before - 1);

    const opponent = engine.state.players[1];
    const target = targetId === null ? null : Number(targetId);
    switch (card.id) {
      case 'REMOTE_DICE': expect(result.followUp).toMatchObject({ mode: 'ROLL', steps: 3 }); break;
      case 'OBSTACLE': expect(engine.state.propertyManager.getProperty(target).hasObstacle).toBe(true); break;
      case 'TURN_AROUND': expect(engine.state.players[target].direction).toBe(-1); break;
      case 'SWAP_STOPS': expect(player.currentTile).toBe(0); expect(opponent.currentTile).toBe(1); expect(opponent.cash).toBe(opponentCashBefore); break;
      case 'DEMOLISH': expect(engine.state.propertyManager.getProperty(target).level).toBe(0); break;
      case 'EQUAL_WEALTH': expect(player.cash).toBe(opponent.cash); break;
      case 'STEAL_LAND': expect(engine.state.propertyManager.getProperty(target).owner).toBe(player.id); break;
      case 'RED_BULL': expect(engine.state.stockMarket.stocks.find(stock => stock.id === targetId).change).toBe(10); break;
      case 'FORTUNE_GOD': expect(player).toMatchObject({ godType: 'LUCK', godTurns: 3 }); break;
      case 'TURTLE': expect(engine.state.players[target].turtleTurns).toBe(3); break;
      case 'CAR_CARD': expect(player.vehicle).toBe('CAR'); break;
      case 'CLEANSE': expect(player).toMatchObject({ turtleTurns: 0, godType: null }); break;
      case 'RENT_SHIELD': expect(player.rentShieldTurns).toBe(2); break;
      case 'CASH_TAX': expect(opponent.cash).toBeLessThan(opponentCashBefore); break;
      case 'TELEPORT': expect(result.followUp).toMatchObject({ mode: 'TELEPORT', tileId: target }); break;
      case 'CLEAR_ROAD': expect(engine.state.propertyManager.getProperty(target).hasObstacle).toBe(false); break;
      case 'BEAR_CARD': expect(engine.state.stockMarket.stocks.find(stock => stock.id === targetId).change).toBe(-10); break;
      case 'IMMUNITY': expect(player.negativeImmuneTurns).toBe(3); break;
      case 'GIFT_CARD': expect(opponent.cards).toContain('REMOTE_DICE'); break;
      case 'MISSILE': expect(engine.state.propertyManager.getProperty(1).level).toBe(1); break;
      case 'NUKES': expect(engine.state.propertyManager.getProperty(1).level).toBe(0); break;
      case 'MINE': expect(engine.state.propertyManager.getProperty(target).hasMine).toBe(true); break;
      case 'HIBERNATE': expect(opponent.hibernateTurns).toBe(3); break;
      case 'SLEEPWALK': expect(opponent.sleepwalkTurns).toBe(3); break;
      case 'LAND_BUY': expect(engine.state.propertyManager.getProperty(target).owner).toBe(player.id); break;
      case 'SWAP_LAND': expect(engine.state.propertyManager.getProperty(1).owner).toBe(opponent.id); break;
      case 'TRANSFER_CARD': expect(player.penaltyTransferTargetId).toBe(opponent.id); break;
      case 'IMMUNITY_CARD': expect(player).toMatchObject({ jailTurns: 0, negativeImmuneTurns: 3 }); break;
      case 'SUMMON_GOD': expect(player.godType).toBeTruthy(); break;
      case 'BANISH_GOD': expect(player.godType).toBeNull(); break;
      default: break;
    }
  });
});
