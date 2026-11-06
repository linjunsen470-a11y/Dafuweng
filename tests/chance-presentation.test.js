import { describe, expect, it } from 'vitest';
import { CHANCE_CARDS } from '../src/game/EventManager.js';
import { CHANCE_RARITIES, getChancePresentation } from '../src/game/ChancePresentation.js';

describe('destiny-card presentation model', () => {
  it('authors a complete category, rarity and visual identity for all chance cards', () => {
    expect(CHANCE_CARDS).toHaveLength(48);
    CHANCE_CARDS.forEach(chance => {
      const card = getChancePresentation(chance, {});
      expect(card.title).toBe(chance.title);
      expect(card.category.label.length).toBeGreaterThan(2);
      expect(card.category.accent).toMatch(/^#/);
      expect(Object.keys(CHANCE_RARITIES)).toContain(card.rarity.id);
      expect(card.stars).toHaveLength(card.rarity.stars);
      expect(['gain', 'loss']).toContain(card.tone);
    });
  });

  it('uses actual resolved cash amounts instead of only authored descriptions', () => {
    const gain = CHANCE_CARDS.find(card => card.title === '中头彩大奖');
    const loss = CHANCE_CARDS.find(card => card.title === '超速罚单');
    expect(getChancePresentation(gain, { type: 'CASH_GAINED', amount: 3000 })).toMatchObject({ tone: 'gain', outcome: '现金增加 $3,000' });
    expect(getChancePresentation(loss, { type: 'CASH_LOST', amount: 500 })).toMatchObject({ tone: 'loss', outcome: '现金减少 $500' });
  });

  it('describes special inventory, quest, lottery and protected outcomes', () => {
    const quest = CHANCE_CARDS.find(card => card.kind === 'QUEST');
    const item = CHANCE_CARDS.find(card => card.kind === 'ITEM');
    const lottery = CHANCE_CARDS.find(card => card.kind === 'LOTTERY');
    expect(getChancePresentation(quest, { type: 'QUEST_STARTED', target: 3, expiresRound: 8 }).outcome).toContain('3 个目标');
    expect(getChancePresentation(item, { type: 'INVENTORY_CHANGED', inventory: 'ITEM', itemId: 'CAR' }).outcome).toContain('CAR');
    expect(getChancePresentation(lottery, { type: 'LOTTERY_BOUGHT', number: 9 }).outcome).toContain('9 号');
    expect(getChancePresentation(item, { type: 'NEGATIVE_BLOCKED' })).toMatchObject({ tone: 'blocked', outcome: '护佑生效 · 本次负面事件已抵消' });
  });

  it('promotes authored high-impact cards to premium rarities', () => {
    expect(getChancePresentation(CHANCE_CARDS.find(card => card.kind === 'GOD'), {}).rarity.id).toBe('LEGENDARY');
    expect(getChancePresentation(CHANCE_CARDS.find(card => card.kind === 'PROPERTY_UP'), {}).rarity.id).toBe('EPIC');
    expect(getChancePresentation(CHANCE_CARDS.find(card => card.kind === 'CARD'), {}).rarity.id).toBe('RARE');
  });
});
