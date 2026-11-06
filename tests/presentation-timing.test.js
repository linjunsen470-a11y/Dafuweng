// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresentationUI } from '../src/ui/PresentationUI.js';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('presentation reading time on slow first frames', () => {
  it.each([
    ['dice', 650, '.presentation-dice-result'],
    ['turn', 3000, '.presentation-turn-banner']
  ])('keeps the %s result visible for its reading interval after paint', async (kind, duration, selector) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const frames = [];
    vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
    document.body.innerHTML = '<div id="presentation-dice-host"></div><div id="presentation-banner-host"></div>';
    const ui = new PresentationUI();
    const player = { name: '测试玩家', color: '#67e8f9' };
    const completion = kind === 'dice'
      ? ui.showDice({ player, dice: [3], steps: 3, speed: 2 })
      : ui.showTurn(player);
    const result = document.querySelector(selector);
    await vi.advanceTimersByTimeAsync(5000);
    expect(result.classList.contains('is-visible')).toBe(true);
    // Resume the browser's first painting opportunity after a long stall.
    frames.shift()(5000);
    frames.shift()(5016);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(duration - 1);
    expect(result.classList.contains('is-visible')).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await completion;
    expect(result.classList.contains('is-visible')).toBe(false);
  });
});
