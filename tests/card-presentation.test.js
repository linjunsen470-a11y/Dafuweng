import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/game/ContentRegistry.js';
import { CARDS } from '../src/game/CardManager.js';
import {
  CARD_CATEGORIES,
  CARD_RARITIES,
  CARD_TARGET_LABELS,
  createCardPresentation,
  createItemPresentation,
  filterCardPresentations,
  getCardCategory,
  getCardRarity
} from '../src/game/CardPresentation.js';

describe('card presentation catalogue', () => {
  it('classifies every strategy card with valid decision metadata', () => {
    expect(CARDS).toHaveLength(32);
    CARDS.forEach(card => {
      const view = createCardPresentation(card);
      expect(Object.values(CARD_CATEGORIES)).toContain(view.category);
      expect(Object.values(CARD_RARITIES)).toContain(view.rarity);
      expect(view.targetLabel).toBe(CARD_TARGET_LABELS[card.targetType]);
      expect(view.tacticalNote.length).toBeGreaterThan(12);
      expect(view.sellPrice).toBe(Math.round(card.cost * 0.5));
      expect(view.cardImg).toBe(card.cardImg);
      expect(view.artClass).toBe(`card-art-${view.category.id.toLowerCase()}`);
      expect(view.serial).toMatch(/^FE-\d{2}$/);
      expect(view.rarityStars).toHaveLength(view.rarity.rank);
    });
  });

  it('gives every tool an album illustration and a printable rarity ribbon', () => {
    for (const item of ITEMS) {
      const view = createItemPresentation(item);
      expect(view.cardImg).toBe(`/assets/item_${item.id.toLowerCase()}.svg`);
      expect(view.rarityStars).toBe('✦'.repeat(view.rarity.rank));
    }
  });

  it('reserves legendary presentation for match-changing cards', () => {
    expect(getCardRarity(CARDS.find(card => card.id === 'NUKES')).id).toBe('LEGENDARY');
    expect(getCardRarity(CARDS.find(card => card.id === 'STEAL_LAND')).id).toBe('LEGENDARY');
    expect(getCardRarity(CARDS.find(card => card.id === 'REMOTE_DICE')).id).toBe('COMMON');
    expect(getCardCategory('LAND_BUY').id).toBe('PROPERTY');
    expect(getCardCategory('BEAR_CARD').id).toBe('MARKET');
  });

  it('exposes affordability and live legal-action state', () => {
    const card = CARDS.find(entry => entry.id === 'TELEPORT');
    const view = createCardPresentation(card, {
      cost: 72,
      points: 50,
      ownedCount: 2,
      action: { enabled: false, reason: '当前没有合法目标', targets: [] }
    });
    expect(view.affordable).toBe(false);
    expect(view.enabled).toBe(false);
    expect(view.disabledReason).toBe('当前没有合法目标');
    expect(view.ownedCount).toBe(2);
  });

  it('filters a mixed catalogue by strategic category', () => {
    const views = CARDS.map(card => createCardPresentation(card));
    const propertyCards = filterCardPresentations(views, 'PROPERTY');
    expect(propertyCards.map(card => card.id)).toEqual(expect.arrayContaining(['DEMOLISH', 'LAND_BUY', 'AUCTION_CARD']));
    expect(propertyCards.every(card => card.category.id === 'PROPERTY')).toBe(true);
    expect(filterCardPresentations(views, 'ALL')).toHaveLength(32);
  });

  it('gives the auction card its own production artwork', () => {
    const auction = CARDS.find(card => card.id === 'AUCTION_CARD');
    const equalWealth = CARDS.find(card => card.id === 'EQUAL_WEALTH');
    expect(auction.cardImg).toBe('/assets/card_auction_card.svg');
    expect(auction.cardImg).not.toBe(equalWealth.cardImg);
  });
});
