import { quietMotion } from '../engine/EffectTimeline.js';

export function showCombo(stage,combo) {
  if (quietMotion()) return;
  stage.querySelector('.arcade-streak')?.remove();
  const score=document.createElement('b');
  score.className='arcade-streak';
  score.textContent=combo>1 ? '连击 ×'+combo : '命中！';
  stage.append(score);
  setTimeout(()=>score.remove(),520);
  stage.animate?.([{transform:'translateX(-2px)',boxShadow:'inset 0 0 20px #ffdc78'},
    {transform:'translateX(2px)'},{transform:'none'}],{duration:150});
}

export function decorateResult(card,rank) {
  const badge=document.createElement('span');
  badge.className='arcade-stars';
  badge.textContent='★'.repeat(({S:5,A:4,B:3,C:2})[rank] || 1);
  card.prepend(badge);
  if (quietMotion()) return;
  const confetti=document.createElement('div');
  confetti.className='arcade-confetti'; confetti.setAttribute('aria-hidden','true');
  for(let i=0;i<24;i++) {
    const bit=document.createElement('i');
    bit.style.left=(i*29%100)+'%';
    bit.style.setProperty('--delay',(i%5)*48+'ms');
    bit.style.backgroundColor=['#ed704b','#f6c440','#68ad90','#936cc2'][i%4];
    confetti.append(bit);
  }
  card.append(confetti);setTimeout(()=>confetti.remove(),1400);
}
