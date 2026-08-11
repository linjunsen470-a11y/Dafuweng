import { describe, expect, it } from 'vitest';
import {
  clampMinigameScore,
  getAIMinigameScore,
  scoreHarborAttempt,
  scoreRouteRound,
  scoreSkyObject
} from '../src/game/MinigameRules.js';

describe('minigame scoring rules', () => {
  it('normalizes scores into the supported reward range', () => {
    expect(clampMinigameScore(-12)).toBe(0);
    expect(clampMinigameScore(42.9)).toBe(42);
    expect(clampMinigameScore(180)).toBe(100);
    expect(clampMinigameScore('invalid')).toBe(0);
  });

  it('scores harbor choices without allowing a negative total', () => {
    expect(scoreHarborAttempt(20, true)).toBe(30);
    expect(scoreHarborAttempt(20, false)).toBe(15);
    expect(scoreHarborAttempt(0, false)).toBe(0);
  });

  it('scores sky objects and caps large bonuses', () => {
    expect(scoreSkyObject(30, 20)).toBe(50);
    expect(scoreSkyObject(10, -15)).toBe(0);
    expect(scoreSkyObject(95, 20)).toBe(100);
  });

  it('awards twenty points for each completed route round', () => {
    expect(scoreRouteRound(0)).toBe(0);
    expect(scoreRouteRound(3)).toBe(60);
    expect(scoreRouteRound(5)).toBe(100);
    expect(scoreRouteRound(9)).toBe(100);
  });
});

describe('AI minigame performance', () => {
  const minimumRoll = { int: minimum => minimum };
  const maximumRoll = { int: (_minimum, maximum) => maximum };

  it('keeps difficulty bands distinct and game-aware', () => {
    expect(getAIMinigameScore('SKY_COINS', 'EASY', minimumRoll)).toBe(28);
    expect(getAIMinigameScore('HARBOR_SORT', 'NORMAL', maximumRoll)).toBe(84);
    expect(getAIMinigameScore('ROUTE_MEMORY', 'HARD', maximumRoll)).toBe(93);
  });

  it('falls back to normal difficulty for unknown settings', () => {
    expect(getAIMinigameScore('SKY_COINS', 'UNKNOWN', minimumRoll)).toBe(48);
  });
});
