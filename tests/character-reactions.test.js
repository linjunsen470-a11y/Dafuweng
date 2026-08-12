import { describe, expect, it } from 'vitest';
import { CHARACTER_VOICES, describeCharacterReactions } from '../src/game/CharacterReactions.js';

function createState() {
  const players = [
    { id: 0, profileId: 0, name: '林小满' },
    { id: 1, profileId: 10, name: '黑泽隼' }
  ];
  return { players, getCurrentPlayer: () => players[0] };
}

describe('character reactions', () => {
  it('provides complete personality voices for all twelve characters', () => {
    expect(Object.keys(CHARACTER_VOICES)).toHaveLength(12);
    Object.values(CHARACTER_VOICES).forEach(voice => {
      expect(voice).toEqual(expect.objectContaining({ title: expect.any(String) }));
      ['gain', 'win', 'loss', 'crisis', 'bankrupt'].forEach(category => expect(voice[category].length).toBeGreaterThanOrEqual(2));
    });
  });

  it('creates a two-character exchange for rent settlement', () => {
    const reactions = describeCharacterReactions({ type: 'RENT_PAID', amount: 900, ownerId: 1 }, createState());
    expect(reactions).toHaveLength(2);
    expect(reactions[0]).toMatchObject({ kind: 'reaction', playerId: 0, emotion: 'loss' });
    expect(reactions[1]).toMatchObject({ kind: 'reaction', playerId: 1, emotion: 'win' });
    expect(reactions.map(item => item.line).every(Boolean)).toBe(true);
  });

  it('uses crisis and farewell dialogue for debt and bankruptcy', () => {
    const state = createState();
    expect(describeCharacterReactions({ type: 'DEBT_REQUIRED', playerId: 0, amountDue: 5000 }, state)[0])
      .toMatchObject({ emotion: 'crisis', label: '现金流危机' });
    expect(describeCharacterReactions({ type: 'PLAYER_BANKRUPT', playerId: 1 }, state)[0])
      .toMatchObject({ playerId: 1, emotion: 'bankrupt', label: '宣告破产' });
  });

  it('covers strategic progression events with the correct character owner', () => {
    const state = createState();
    expect(describeCharacterReactions({ type: 'RESEARCH_COMPLETED', playerId: 1, success: true }, state)[0])
      .toMatchObject({ playerId: 1, emotion: 'win', label: '研发项目完成' });
    expect(describeCharacterReactions({ type: 'CHAIRMAN_CHANGED', chairmanId: 1 }, state)[0])
      .toMatchObject({ playerId: 1, emotion: 'win', label: '当选公司董事长' });
    expect(describeCharacterReactions({ type: 'DEBT_PAID', playerId: 0, amount: 2400 }, state)[0])
      .toMatchObject({ playerId: 0, emotion: 'win', label: '解除财务危机' });
  });

  it('creates a buyer and seller exchange for player market deals', () => {
    const reactions = describeCharacterReactions({
      type: 'MARKET_OFFER_ACCEPTED', buyerId: 0, sellerId: 1, price: 2600
    }, createState());
    expect(reactions).toHaveLength(2);
    expect(reactions[0]).toMatchObject({ playerId: 0, emotion: 'gain', label: '交易大厅成功购入' });
    expect(reactions[1]).toMatchObject({ playerId: 1, emotion: 'win', label: '交易大厅成功售出' });
  });

  it('uses the facility emotion and service title for commercial visits', () => {
    expect(describeCharacterReactions({
      type: 'COMMERCIAL_FACILITY_VISITED', playerId: 0, title: '旅馆入住', emotion: 'loss', duration: 2
    }, createState())[0]).toMatchObject({ playerId: 0, emotion: 'loss', label: '旅馆入住' });
  });

  it('reacts to quest acceptance, completion, and failure', () => {
    const state = createState();
    expect(describeCharacterReactions({ type: 'QUEST_STARTED', playerId: 0, title: '环城巡礼' }, state)[0])
      .toMatchObject({ emotion: 'gain', label: '接受委托「环城巡礼」' });
    expect(describeCharacterReactions({ type: 'QUEST_COMPLETED', playerId: 1, title: '策略演习' }, state)[0])
      .toMatchObject({ playerId: 1, emotion: 'win' });
    expect(describeCharacterReactions({ type: 'QUEST_FAILED', playerId: 0, title: '地标巡访' }, state)[0])
      .toMatchObject({ emotion: 'loss' });
  });

  it('selects dialogue deterministically without consuming game randomness', () => {
    const state = createState();
    const event = { type: 'PROPERTY_PURCHASED', playerId: 0, tileId: 7, cost: 1800 };
    expect(describeCharacterReactions(event, state)).toEqual(describeCharacterReactions(event, state));
  });

  it('stays silent for per-step movement to avoid visual spam', () => {
    expect(describeCharacterReactions({ type: 'PLAYER_STEPPED', playerId: 0, tileId: 2 }, createState())).toEqual([]);
  });
});
