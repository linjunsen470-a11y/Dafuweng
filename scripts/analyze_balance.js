import { PLAYER_PROFILES } from '../src/game/BoardData.js';
import { MAP_DEFINITIONS } from '../src/game/MapData.js';
import { GameSimulator } from '../src/game/GameSimulator.js';

const gameCount = Math.max(1, Number.parseInt(process.env.SIM_GAMES || '1000', 10));
const maps = MAP_DEFINITIONS.map(map => map.id);
const profileStats = new Map(PLAYER_PROFILES.map(profile => [profile.id, {
  id: profile.id,
  name: profile.name,
  games: 0,
  wins: 0,
  totalAssets: 0
}]));
const mapStats = new Map(maps.map(mapId => [mapId, { games: 0, rounds: 0, bankruptcies: 0 }]));

for (let index = 0; index < gameCount; index++) {
  const mapId = maps[index % maps.length];
  const profileIndices = Array.from({ length: 4 }, (_, offset) => (index * 4 + offset) % PLAYER_PROFILES.length);
  const summary = new GameSimulator({
    seed: 100000 + index,
    mapId,
    maxRounds: 40,
    profileIndices
  }).run();
  const winner = summary.snapshot.players.find(player => player.id === summary.winnerId);
  const currentMap = mapStats.get(mapId);
  currentMap.games++;
  currentMap.rounds += summary.round;
  currentMap.bankruptcies += summary.snapshot.players.filter(player => player.isBankrupt).length;

  for (const { player, assets } of summary.rankings) {
    const stats = profileStats.get(player.profileId);
    stats.games++;
    stats.totalAssets += assets.total;
    if (winner?.profileId === player.profileId) stats.wins++;
  }
}

const report = {
  games: gameCount,
  profiles: [...profileStats.values()]
    .filter(stats => stats.games > 0)
    .map(stats => ({
      ...stats,
      winRate: Number((stats.wins / stats.games * 100).toFixed(2)),
      averageFinalAssets: Math.round(stats.totalAssets / stats.games)
    }))
    .sort((left, right) => right.winRate - left.winRate),
  maps: [...mapStats.entries()].map(([mapId, stats]) => ({
    mapId,
    games: stats.games,
    averageRounds: Number((stats.rounds / stats.games).toFixed(2)),
    averageBankruptcies: Number((stats.bankruptcies / stats.games).toFixed(2))
  }))
};

console.log(JSON.stringify(report, null, 2));
