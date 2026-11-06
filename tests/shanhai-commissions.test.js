import { describe, it, expect } from 'vitest';
import { SliceSession } from '../src/shanhai/SliceSession.js';

const start = characterId => { const s=new SliceSession({storage:null});s.start({characterId,seed:42});return s; };
const arrive = (s,steps) => { expect(s.useRemoteDice(steps).success).toBe(true);s.resolveMovement();return s.resolveLanding(); };

describe('original coastal commissions', () => {
  it('resumes an in-flight delivery, pays the courier specialty once, and blocks duplicate orders', () => {
    const s=start('ayu'),before=s.snapshot();
    expect(s.getCommissionOffers()[0]).toMatchObject({targetId:3,cash:900,points:15,dueRound:3});
    expect(s.state.rng.state).toBe(before.rngState);
    expect(s.acceptCommission('DELIVERY').success).toBe(true);
    expect(s.acceptCommission('RENEWAL').success).toBe(false);
    s.useRemoteDice(3);s.advanceMove();
    const resumed=new SliceSession({storage:null});expect(resumed.restore(s.snapshot()).success).toBe(true);
    resumed.resolveMovement();
    expect(resumed.resolveLanding().commission).toMatchObject({cash:900,points:15,specialist:true});
    expect(resumed.currentPlayer.cash).toBe(before.players[0].cash+900);
    const paid=resumed.currentPlayer.cash;
    expect(resumed.resolveLanding().success).toBe(false);
    expect(resumed.currentPlayer.cash).toBe(paid);
    const reload=new SliceSession({storage:null});reload.restore(resumed.snapshot());
    expect(reload.careers[0]).toMatchObject({active:null,completed:1,earned:900,settledRound:1});
    expect(reload.currentPlayer.cash).toBe(paid);
  });

  it('pays the botanist only after a successful property action and preserves equal starting funds', () => {
    const s=start('qinghe');expect(s.currentPlayer.cash).toBe(16000);
    s.acceptCommission('RENEWAL');arrive(s,1);
    expect(s.careers[0].completed).toBe(0);
    const cost=s.focus.cost,result=s.purchase();
    expect(result.commission).toMatchObject({cash:700,points:35,specialist:true});
    expect(s.currentPlayer.cash).toBe(16000-cost+700);
    expect(s.purchase().success).toBe(false);
    expect(s.careers[0].completed).toBe(1);
    expect(s.commissionReward('DELIVERY')).toMatchObject({cash:600,specialist:false});
    expect(start('ayu').commissionReward('RENEWAL').cash).toBe(400);
  });

  it('expires an unfinished order without charging cash and never rewards merely passing the destination', () => {
    const s=start('ayu');s.acceptCommission('DELIVERY');arrive(s,5);
    expect(s.careers[0].completed).toBe(0);
    const snap=s.snapshot();snap.round=3;expect(s.restore(snap).success).toBe(true);
    const cash=s.currentPlayer.cash;expect(s.endTurn().success).toBe(true);
    expect(s.state.players[0].cash).toBe(cash);
    expect(s.careers[0]).toMatchObject({active:null,last:{status:'EXPIRED'},settledRound:3});
  });

  it('opens older saves without commissions and lets courier AI use the same delivery rules', async () => {
    const s=start('qinghe');const legacy=s.snapshot();delete legacy.slice.careers;
    legacy.players.forEach(p=>{p.skillName='海岛同行';});
    expect(s.restore(legacy).success).toBe(true);
    expect(s.careers[0]).toMatchObject({active:null,completed:0});
    expect(s.currentPlayer.skillName).toBe('街区园艺师');
    arrive(s,1);s.endTurn();
    expect((await s.playAITurn()).success).toBe(true);
    expect(s.careers[1]).toMatchObject({active:null,completed:1,earned:900});
    expect(s.state.players[1].cards).not.toContain('REMOTE_DICE');
  });
});
