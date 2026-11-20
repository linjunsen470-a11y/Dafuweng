import { GameSimulator } from '../src/game/GameSimulator.js';
import { MAP_DEFINITIONS } from '../src/game/MapData.js';
import { GAME_MODES } from '../src/game/ContentRegistry.js';

const seedsPerCombination = Math.max(1, Number(process.argv[2] || 30));
const rows = [];
let totalGames = 0;
let totalEliminationWins = 0;
let totalBankruptcies = 0;
let totalPlayerSeats = 0;

for (const [mapIndex, map] of MAP_DEFINITIONS.entries()) {
  for (const [modeIndex, mode] of GAME_MODES.entries()) {
    const rounds = [];
    let bankruptcies = 0;
    let eliminationWins = 0;
    let playerSeats = 0;
    let netWorthSum = 0;
    const winnerProfiles = new Map();

    for (let seedIndex = 1; seedIndex <= seedsPerCombination; seedIndex++) {
      const seed = 10_000_000 + mapIndex * 100_000 + modeIndex * 10_000 + seedIndex;
      const result = new GameSimulator({ seed, mapId: map.id, mode: mode.id, maxRounds: mode.maxRounds }).run();
      if (result.winnerId === undefined || result.snapshot.phase !== 'GAME_OVER') {
        throw new Error(`${map.id}/${mode.id}/seed ${seed} did not finish`);
      }

      const players = result.snapshot.players;
      let activeSurvivors = 0;
      for (const player of players) {
        const numericValues = [player.cash, player.deposit, player.cardPoints];
        if (numericValues.some(value => !Number.isFinite(value))) {
          throw new Error(`${map.id}/${mode.id}/seed ${seed} produced a non-finite asset`);
        }
        playerSeats++;
        if (player.isBankrupt) bankruptcies++;
        else activeSurvivors++;
        netWorthSum += Math.max(0, player.cash) + Math.max(0, player.deposit);
      }

      if (activeSurvivors <= 1 || result.round < mode.maxRounds) {
        eliminationWins++;
      }

      const winner = players[result.winnerId];
      winnerProfiles.set(winner.profileId, (winnerProfiles.get(winner.profileId) || 0) + 1);
      rounds.push(result.round);
    }

    const sortedWinners = [...winnerProfiles.entries()].sort((a, b) => b[1] - a[1]);
    const topEntry = sortedWinners[0];
    const maxWinShare = topEntry ? Math.round((topEntry[1] / seedsPerCombination) * 100) : 0;

    totalGames += seedsPerCombination;
    totalEliminationWins += eliminationWins;
    totalBankruptcies += bankruptcies;
    totalPlayerSeats += playerSeats;

    rows.push({
      map: map.id,
      mode: mode.id,
      games: seedsPerCombination,
      avgRound: Number((rounds.reduce((sum, value) => sum + value, 0) / rounds.length).toFixed(1)),
      minMaxRound: `${Math.min(...rounds)}-${Math.max(...rounds)}`,
      elimWinPct: `${Math.round((eliminationWins / seedsPerCombination) * 100)}%`,
      bankruptPct: `${Math.round((bankruptcies / Math.max(1, playerSeats)) * 100)}%`,
      avgLiquid: Math.round(netWorthSum / Math.max(1, playerSeats)),
      topWinner: topEntry ? `P${topEntry[0]}(${maxWinShare}%)` : '-'
    });
  }
}

console.table(rows);
console.log(
  `Validated ${totalGames} deterministic games | `
  + `Elimination wins: ${totalEliminationWins}/${totalGames} (${Math.round((totalEliminationWins / Math.max(1, totalGames)) * 100)}%) | `
  + `Seat bankruptcy rate: ${totalBankruptcies}/${totalPlayerSeats} (${Math.round((totalBankruptcies / Math.max(1, totalPlayerSeats)) * 100)}%)`
);
