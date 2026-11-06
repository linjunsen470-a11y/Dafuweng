import fs from 'node:fs';
import assert from 'node:assert/strict';
import { SliceSession } from '../src/shanhai/SliceSession.js';

const results = [];
for (let seed = 1; seed <= 100; seed++) {
  const session = new SliceSession({ storage: null, seed });
  session.start({ seed });
  let turns = 0;
  while (session.state.phase !== 'GAME_OVER' && turns++ < 100) {
    if (session.currentPlayer.isAI) {
      assert.equal((await session.playAITurn()).success, true);
    } else {
      assert.equal(session.roll().success, true);
      assert.equal(session.resolveMovement().success, true);
      assert.equal(session.resolveLanding().success, true);
      if (session.pendingEvent) assert.equal(session.chooseIslandEvent(session.getIslandChoices()[0].id).success, true);
      if (!session.getPropertyBlockReason()) {
        if (session.focus.kind === 'PURCHASE') assert.equal(session.purchase().success, true);
        else if (session.focus.kind === 'UPGRADE') assert.equal(session.upgrade().success, true);
      }
      if (session.state.phase !== 'GAME_OVER') assert.equal(session.endTurn().success, true);
    }
  }
  assert.equal(session.state.phase, 'GAME_OVER');
  assert.ok(turns < 100);
  assert.ok(session.state.winner);
  for (const player of session.state.players) assert.ok(Number.isFinite(session.state.calculateNetWorth(player)));
  for (const property of session.state.propertyManager.properties.values()) {
    assert.ok(property.level >= 0 && property.level <= 4);
  }
  results.push({ seed, round: session.state.round, turns, winner: session.state.winner.id });
}
fs.mkdirSync('qa', { recursive: true });
fs.writeFileSync('qa/cloud-slice-simulation.json', JSON.stringify({
  success: true, games: results.length, maxTurns: Math.max(...results.map(result => result.turns)), results
}, null, 2) + '\n');
console.log('100 seeded coastal matches passed with strategic AI and current property restrictions.');
