import { describe, expect, it } from 'vitest';
import { getAdaptiveMusicMood, getAdaptiveMusicProfile, MUSIC_MOOD_PROFILES } from '../src/game/AdaptiveMusicRules.js';
import { AudioManager } from '../src/engine/AudioManager.js';

describe('adaptive soundtrack direction', () => {
  it('moves through calm, drive, tension, crisis, and finale contexts', () => {
    expect(getAdaptiveMusicMood({ round: 1, maxRounds: 40 })).toBe('CALM');
    expect(getAdaptiveMusicMood({ round: 12, maxRounds: 40 })).toBe('DRIVE');
    expect(getAdaptiveMusicMood({ round: 26, maxRounds: 40 })).toBe('TENSION');
    expect(getAdaptiveMusicMood({ round: 3, maxRounds: 40, eventType: 'DEBT_REQUIRED' })).toBe('CRISIS');
    expect(getAdaptiveMusicMood({ round: 34, maxRounds: 40 })).toBe('FINALE');
  });

  it('prioritizes active crises over ordinary progress and supports environmental tension', () => {
    expect(getAdaptiveMusicMood({ round: 35, maxRounds: 40, pendingDebt: true })).toBe('CRISIS');
    expect(getAdaptiveMusicMood({ round: 4, maxRounds: 40, weather: 'STORM' })).toBe('TENSION');
    expect(getAdaptiveMusicMood({ round: 2, maxRounds: 40, gameMode: 'HEAT' })).toBe('DRIVE');
  });

  it('defines materially different layer density for every mood', () => {
    expect(Object.keys(MUSIC_MOOD_PROFILES)).toEqual(['CALM', 'DRIVE', 'TENSION', 'CRISIS', 'FINALE']);
    expect(new Set(Object.values(MUSIC_MOOD_PROFILES).map(profile => profile.percussion)).size).toBe(5);
    expect(getAdaptiveMusicProfile({ gameOver: true })).toMatchObject({ mood: 'FINALE', label: '终局决战' });
  });

  it('updates a manager mood without requiring a Web Audio device', () => {
    const manager = new AudioManager();
    expect(manager.setMusicContext({ round: 1, maxRounds: 40 })).toMatchObject({ mood: 'CALM' });
    expect(manager.setMusicContext({ round: 28, maxRounds: 40 })).toMatchObject({ mood: 'TENSION' });
    expect(manager.musicMood).toBe('TENSION');
    manager.setAtmosphere({ weather: 'STORM', timeOfDay: 'NIGHT' });
    expect(manager.atmosphere).toEqual({ weather: 'STORM', timeOfDay: 'NIGHT' });
  });
});
