import { quietMotion } from '../engine/EffectTimeline.js';
import { SKY_OBJECTS, scoreSkyObject } from '../game/MinigameRules.js';

// Real-time Richman-4 "Catch Coins" arcade stage with smooth mouse/touch/keyboard basket
// plus accessible clickable falling coins for full keyboard & test compatibility.
export function launchSkyCoinsArcade(session, audioManager) {
  const stage = session.stage;
  const motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  stage.classList.add('sky-coins-stage', 'is-arcade-canvas');
  stage.innerHTML = `
    <canvas class="sky-arcade-canvas" width="560" height="270" aria-hidden="true"></canvas>
    <div class="sky-arcade-layer"></div>
    <div class="sky-basket" aria-hidden="true"><span>🧺</span><b>接金币</b></div>
    <div class="minigame-feedback" aria-live="polite">左右移动篮子或直接点击金币，小心炸弹！</div>
  `;
  const canvas = stage.querySelector('.sky-arcade-canvas');
  const ctx = canvas?.getContext?.('2d');
  const layer = stage.querySelector('.sky-arcade-layer');
  const basket = stage.querySelector('.sky-basket');
  const feedback = stage.querySelector('.minigame-feedback');

  let basketX = 50; // percentage 8..92
  let basketActive = false;
  let spawnIndex = 0;
  const activeDrops = [];
  const particles = [];

  const setBasket = (pct, activate = false) => {
    if (activate) {
      basketActive = true;
      basket.classList.add('is-active');
    }
    basketX = Math.max(10, Math.min(90, pct));
    basket.style.left = `${basketX}%`;
  };
  setBasket(50, false);

  const onMove = event => {
    if (event.type === 'pointerdown' && event.target?.closest?.('.sky-object')) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0) setBasket(((event.clientX - rect.left) / rect.width) * 100, true);
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerdown', onMove);

  session.onKey(event => {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      setBasket(basketX - 7, true);
    }
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      setBasket(basketX + 7, true);
    }
  });

  const spawnBurst = (xPct, yPct, text, good) => {
    particles.push({ x: xPct, y: yPct, text, good, life: 1 });
  };

  const collect = (drop, viaBasket = false) => {
    if (drop.done) return;
    drop.done = true;
    drop.el.remove();
    const pts = drop.def.points;
    const good = pts > 0;
    session.updateScore(scoreSkyObject(session.getScore(), pts), good ? 'HIT' : 'MISS');
    feedback.textContent = good ? `✨ ${viaBasket ? '稳稳接住' : '精准命中'} +${pts}` : `💥 哎呀踩雷 ${pts}`;
    feedback.className = `minigame-feedback ${good ? 'is-correct' : 'is-wrong'}`;
    if (good) audioManager?.playCoinSound?.();
    else audioManager?.playSceneSound?.('mine');
    if (!quietMotion(motionPreference)) spawnBurst(drop.x, drop.y, good ? `+${pts}` : `${pts}`, good);
    basket.classList.toggle('is-hit', !good);
    basket.classList.toggle('is-catch', good);
    session.later(() => basket.classList.remove('is-hit', 'is-catch'), 180);
  };

  const positions = [14, 42, 72, 26, 60, 84, 34, 52, 18, 76];
  const spawn = () => {
    const def = SKY_OBJECTS[spawnIndex % SKY_OBJECTS.length];
    const x = positions[(spawnIndex * 3 + 1) % positions.length];
    spawnIndex++;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `sky-object kind-${def.kind.toLowerCase()}`;
    el.dataset.kind = def.kind;
    el.style.left = `${x}%`;
    el.style.top = '8%';
    el.textContent = def.icon;
    el.setAttribute('aria-label', def.kind === 'BOMB' ? '炸弹，不要点击' : `${def.kind === 'STAR' ? '星星' : '金币'}，点击收集`);
    const drop = { def, x, y: 8, vy: def.kind === 'STAR' ? 1.55 : 1.25 + (spawnIndex % 3) * 0.2, el, done: false };
    el.onpointerdown = event => {
      if (event.isPrimary && event.button === 0) {
        event.preventDefault();
        collect(drop, false);
      }
    };
    el.onclick = () => collect(drop, false);
    layer.appendChild(el);
    activeDrops.push(drop);
    session.progress.textContent = `已落下 ${spawnIndex} 个宝物`;
  };

  // Physics & animated sky backdrop tick (30fps interval cleaned automatically by session.every)
  let cloudOffset = 0;
  let lastTick = performance.now();
  session.every(() => {
    const now = performance.now();
    // Keep the visible target reachable after a stalled frame; the session clock
    // still ends the round on wall time.
    const frames = Math.min(2, (now - lastTick) / 33);
    lastTick = now;
    if (!quietMotion(motionPreference)) cloudOffset = (cloudOffset + 0.6 * frames) % 560;
    for (let i = activeDrops.length - 1; i >= 0; i--) {
      const d = activeDrops[i];
      if (d.done) { activeDrops.splice(i, 1); continue; }
      const previousY = d.y;
      d.y += d.vy * 1.45 * frames;
      d.el.style.top = `${d.y}%`;
      if (basketActive && d.y >= 74 && previousY <= 92 && Math.abs(d.x - basketX) <= 13) {
        collect(d, true);
        activeDrops.splice(i, 1);
      } else if (d.y > 96) {
        d.done = true;
        d.el.remove();
        activeDrops.splice(i, 1);
      }
    }
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#8fe2ff');
    sky.addColorStop(0.75, '#fff4cf');
    sky.addColorStop(1, '#f4cf86');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Drifting cartoon clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let c = 0; c < 3; c++) {
      const cx = (cloudOffset + c * 200) % (w + 120) - 60;
      const cy = 36 + c * 32;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx + 18, cy - 6, 24, 0, Math.PI * 2);
      ctx.arc(cx + 38, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating score popups
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y -= 1.4 * frames;
      p.life -= 0.06 * frames;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = p.good ? '#d47400' : '#c62828';
      const px = (p.x / 100) * w;
      const py = (p.y / 100) * h;
      ctx.strokeText(p.text, px, py);
      ctx.fillText(p.text, px, py);
      ctx.restore();
    }
  }, 33);

  spawn();
  session.every(spawn, 480);
}
