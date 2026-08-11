import { GameSimulator } from '../src/game/GameSimulator.js';
import { MAP_DEFINITIONS } from '../src/game/MapData.js';
import { GAME_MODES } from '../src/game/ContentRegistry.js';

const seedsPerCombination = Math.max(1, Number(process.argv[2] || 100));
const rows = [];

for (const [mapIndex, map] of MAP_DEFINITIONS.entries()) {
  for (const [modeIndex, mode] of GAME_MODES.entries()) {
    const rounds = [];
    let bankruptcies = 0;
    const winnerProfiles = new Map();
    for (let seedIndex = 1; seedIndex <= seedsPerCombination; seedIndex++) {
      const seed = 10_000_000 + mapIndex * 100_000 + modeIndex * 10_000 + seedIndex;
      const result = new GameSimulator({ seed, mapId: map.id, mode: mode.id, maxRounds: mode.maxRounds }).run();
      if (result.winnerId === undefined || result.snapshot.phase !== 'GAME_OVER') {
        throw new Error(`${map.id}/${mode.id}/seed ${seed} did not finish`);
      }
      for (const player of result.snapshot.players) {
        const numericValues = [player.cash, player.deposit, player.cardPoints];
        if (numericValues.some(value => !Number.isFinite(value))) throw new Error(`${map.id}/${mode.id}/seed ${seed} produced a non-finite asset`);
        bankruptcies += Number(player.isBankrupt);
      }
      const winner = result.snapshot.players[result.winnerId];
      winnerProfiles.set(winner.profileId, (winnerProfiles.get(winner.profileId) || 0) + 1);
      rounds.push(result.round);
    }
    rows.push({
      map: map.id,
      mode: mode.id,
      games: seedsPerCombination,
      avgRound: Number((rounds.reduce((sum, value) => sum + value, 0) / rounds.length).toFixed(1)),
      minRound: Math.min(...rounds),
      maxRound: Math.max(...rounds),
      bankruptcies,
      topWinner: [...winnerProfiles.entries()].sort((a, b) => b[1] - a[1])[0]?.join(':') || '-'
    });
  }
}

console.table(rows);
console.log(`Validated ${rows.length * seedsPerCombination} deterministic games.`);
