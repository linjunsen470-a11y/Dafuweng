import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/game/CardManager.js';
import {
  CARD_CATEGORIES,
  CARD_ART_ATLAS,
  CARD_ART_SLOTS,
  CARD_RARITIES,
  CARD_TARGET_LABELS,
  createCardPresentation,
  filterCardPresentations,
  getCardCategory,
  getCardRarity
} from '../src/game/CardPresentation.js';

describe('card presentation catalogue', () => {
  it('classifies every strategy card with valid decision metadata', () => {
    expect(CARDS).toHaveLength(31);
    CARDS.forEach(card => {
      const view = createCardPresentation(card);
      expect(Object.values(CARD_CATEGORIES)).toContain(view.category);
      expect(Object.values(CARD_RARITIES)).toContain(view.rarity);
      expect(view.targetLabel).toBe(CARD_TARGET_LABELS[card.targetType]);
      expect(view.tacticalNote.length).toBeGreaterThan(12);
      expect(view.sellPrice).toBe(Math.round(card.cost * 0.5));
      expect(view.artAtlas).toBe(CARD_ART_ATLAS);
      expect(view.artClass).toBe(CARD_ART_SLOTS[view.category.id].className);
      expect(view.serial).toMatch(/^FE-\d{2}$/);
      expect(view.rarityStars).toHaveLength(view.rarity.rank);
    });
  });

  it('maps the six strategic categories to distinct atlas panels', () => {
    const strategicSlots = Object.values(CARD_ART_SLOTS);
    expect(strategicSlots).toHaveLength(6);
    expect(new Set(strategicSlots.map(slot => slot.position)).size).toBe(6);
    expect(new Set(strategicSlots.map(slot => slot.className)).size).toBe(6);
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
    expect(filterCardPresentations(views, 'ALL')).toHaveLength(31);
  });

  it('gives the auction card its own production artwork', () => {
    const auction = CARDS.find(card => card.id === 'AUCTION_CARD');
    const equalWealth = CARDS.find(card => card.id === 'EQUAL_WEALTH');
    expect(auction.cardImg).toBe('/assets/card_auction_card.svg');
    expect(auction.cardImg).not.toBe(equalWealth.cardImg);
  });
});
