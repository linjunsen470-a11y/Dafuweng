import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/game/GameEngine.js';
import { GameState } from '../src/game/GameState.js';
import { cardManager } from '../src/game/CardManager.js';
import { getCardShopOffer, isOfferedAtShop } from '../src/game/ShopRules.js';

function setup(profileIndex = 0) {
  const state = new GameState({ seed: 7319 });
  state.setupGame([
    { profileIndex, name: '到店玩家', isAI: false },
    { profileIndex: 1, name: '对手', isAI: true }
  ], 20000);
  return { state, engine: new GameEngine(state), player: state.players[0] };
}

describe('rotating card shop', () => {
  it('builds a deterministic limited catalogue without consuming game RNG', () => {
    const { state } = setup();
    const before = state.rng.exportState();
    const first = getCardShopOffer(state, 2);
    const repeated = getCardShopOffer(state, 2);
    expect(first).toEqual(repeated);
    expect(first.cardIds).toHaveLength(8);
    expect(first.itemIds).toHaveLength(4);
    expect(new Set(first.cardIds).size).toBe(first.cardIds.length);
    expect(state.rng.exportState()).toEqual(before);

    state.round++;
    expect(getCardShopOffer(state, 2).cardIds).not.toEqual(first.cardIds);
  });

  it('grants the character shop bonus and exposes the landing offer', () => {
    const { state, engine, player } = setup(4);
    player.currentTile = 2;
    state.phase = 'LANDING_ACTION';
    const before = player.cardPoints;
    const visit = engine.execute({ type: 'RESOLVE_LANDING', playerId: player.id, payload: { tileId: 2 } });
    expect(visit).toMatchObject({ success: true, type: 'CARD_SHOP_OFFER', amount: 120 });
    expect(visit.offer.cardIds).toHaveLength(8);
    expect(player.cardPoints).toBe(before + 120);
  });

  it('allows discounted landing purchases only from the rotating shelf', () => {
    const { state, engine, player } = setup();
    player.currentTile = 2;
    player.cardPoints = 1000;
    state.phase = 'LANDING_ACTION';
    const offer = engine.execute({ type: 'RESOLVE_LANDING', playerId: player.id, payload: { tileId: 2 } }).offer;
    const offeredCard = cardManager.getCardById(offer.cardIds[0]);
    const bought = engine.execute({
      type: 'BUY_CARD', playerId: player.id, payload: { cardId: offeredCard.id, tileId: 2 }
    });
    expect(bought).toMatchObject({ success: true, cardId: offeredCard.id, shopTileId: 2 });
    expect(bought.cost).toBe(Math.round(offeredCard.cost * 0.85 * (1 - offer.discountRate)));

    const absent = cardManager.getAllCards().find(card => !isOfferedAtShop(offer, 'CARD', card.id));
    expect(engine.execute({ type: 'BUY_CARD', playerId: player.id, payload: { cardId: absent.id, tileId: 2 } }))
      .toMatchObject({ success: false, reason: '本轮货架没有该卡片' });
  });

  it('keeps the full catalogue available during normal pre-roll shopping', () => {
    const { state, engine, player } = setup();
    player.cardPoints = 1000;
    const offer = getCardShopOffer(state, 2);
    const absent = cardManager.getAllCards().find(card => !isOfferedAtShop(offer, 'CARD', card.id));
    const bought = engine.execute({ type: 'BUY_CARD', playerId: player.id, payload: { cardId: absent.id } });
    expect(bought).toMatchObject({ success: true, cardId: absent.id, shopTileId: null });
  });

  it('rejects forged shop purchases away from the card shop', () => {
    const { state, engine, player } = setup();
    player.currentTile = 1;
    state.phase = 'LANDING_ACTION';
    expect(engine.execute({ type: 'BUY_CARD', playerId: player.id, payload: { cardId: 'REMOTE_DICE', tileId: 2 } }))
      .toMatchObject({ success: false, reason: '只能在掷骰前或到访卡片屋时购买' });
  });
});
