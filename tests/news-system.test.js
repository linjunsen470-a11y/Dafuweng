import { describe, expect, it } from 'vitest';
import { EventManager, NEWS_EVENTS } from '../src/game/EventManager.js';
import { GameState } from '../src/game/GameState.js';
import { captureNewsMetrics, summarizeNewsImpact } from '../src/game/NewsRules.js';

const configs = [
  { profileIndex: 0, name: '甲', isAI: false },
  { profileIndex: 1, name: '乙', isAI: true }
];

describe('city news rules', () => {
  it('gives every event stable presentation metadata', () => {
    expect(NEWS_EVENTS).toHaveLength(24);
    expect(new Set(NEWS_EVENTS.map(news => news.id)).size).toBe(24);
    NEWS_EVENTS.forEach(news => {
      expect(news).toMatchObject({
        id: expect.stringMatching(/^NEWS_\d+$/),
        category: expect.any(String),
        icon: expect.any(String),
        tone: expect.any(String)
      });
    });
  });

  it('captures exact per-player cash impact when a subsidy news item fires', () => {
    const state = new GameState({ seed: 5 });
    state.setupGame(configs, 10000);
    const manager = new EventManager();
    const values = [0, 1.1 / NEWS_EVENTS.length];
    manager.setRandomSource(() => values.shift());
    const news = manager.triggerRandomNews(state);

    expect(news.title).toBe('中央银行降息利好');
    expect(news.impacts).toEqual([
      { icon: '💵', label: '甲', detail: '现金 +$1,000', tone: 'gain' },
      { icon: '💵', label: '乙', detail: '现金 +$1,000', tone: 'gain' }
    ]);
  });

  it('summarizes stock, road and timed market changes', () => {
    const state = new GameState({ seed: 8 });
    state.setupGame(configs, 10000);
    const before = captureNewsMetrics(state);
    state.stockMarket.stocks[0].price = Math.round(state.stockMarket.stocks[0].price * 1.1);
    state.roadEntities.push({ id: 'NEWS_GIFT', type: 'GIFT_BOX', tileId: 2 });
    state.newsEffect = { id: 'DOUBLE_RENT', remainingRounds: 1 };
    const impacts = summarizeNewsImpact(before, captureNewsMetrics(state));

    expect(impacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ icon: '📈', tone: 'gain' }),
      expect.objectContaining({ label: '道路设施', detail: '新增 1 个' }),
      expect.objectContaining({ label: '限时市场效果', detail: '持续 1 轮' })
    ]));
  });

  it('records a bounded history and emits a domain event at round settlement', () => {
    const state = new GameState({ seed: 12 });
    state.setupGame(configs, 10000);
    const values = [0, 1.1 / NEWS_EVENTS.length];
    state.eventManager.setRandomSource(() => values.shift() ?? 1);
    state.onRoundEnd();

    expect(state.newsHistory[0]).toMatchObject({ id: 'NEWS_2', round: 1, title: '中央银行降息利好' });
    expect(state.pendingDomainEvents).toContainEqual(expect.objectContaining({ type: 'NEWS_FLASH', news: expect.objectContaining({ id: 'NEWS_2' }) }));
    const restored = new GameState({ seed: 1 });
    restored.restoreSnapshot(state.createSnapshot());
    expect(restored.newsHistory).toEqual(state.newsHistory);
  });
});
