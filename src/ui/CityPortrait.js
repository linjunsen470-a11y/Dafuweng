import { CITY_CHARACTER_PROFILE_IDS } from '../engine/CityCharacterProfiles.js';
// Presentation-only: never replace avatar fields in saved player data.
export function cityPortrait(player, mapId) {
  return mapId === 'grand-bay' && CITY_CHARACTER_PROFILE_IDS.includes(player?.profileId)
    ? `/assets/city-portraits/${player.profileId}.png` : null;
}
