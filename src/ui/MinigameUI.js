import { MINIGAMES } from '../game/ContentRegistry.js';
import {
  HARBOR_CARGO,
  ROUTE_PATTERNS,
  SKY_OBJECTS,
  clampMinigameScore,
  scoreHarborAttempt,
  scoreRouteRound,
  scoreSkyObject
} from '../game/MinigameRules.js';

export class MinigameUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.activeFinish = null;
  }

  play(gameId) {
    this.activeFinish?.(0);
    const definition = MINIGAMES.find(game => game.id === gameId);
    if (!definition) return Promise.resolve(0);

    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal minigame-modal';
      overlay.dataset.gameId = definition.id;
      overlay.innerHTML = `
        <div class="glass-card modal-box minigame-box">
          <div class="modal-header minigame-header">
            <div><span class="minigame-kicker">WEALTH CHALLENGE</span><h2>${definition.icon} ${definition.name}</h2></div>
            <strong class="minigame-timer" aria-label="剩余时间">${Math.ceil(definition.durationMs / 1000)}.0s</strong>
          </div>
          <p class="minigame-instructions">${definition.instructions}</p>
          <div class="minigame-stage" role="application" aria-label="${definition.name}游戏区域"></div>
          <div class="minigame-footer">
            <strong class="minigame-score" aria-live="polite">得分：<span>0</span></strong>
            <span class="minigame-progress">准备开始</span>
            <button type="button" class="btn-secondary minigame-skip">结束挑战</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const stage = overlay.querySelector('.minigame-stage');
      const scoreValue = overlay.querySelector('.minigame-score span');
      const progress = overlay.querySelector('.minigame-progress');
      const timerLabel = overlay.querySelector('.minigame-timer');
      const timers = new Set();
      let score = 0;
      let finished = false;
      const keyHandlers = new Set();

      const later = (callback, delay) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!finished) callback();
        }, delay);
        timers.add(timer);
        return timer;
      };
      const every = (callback, delay) => {
        const timer = setInterval(() => !finished && callback(), delay);
        timers.add(timer);
        return timer;
      };
      const updateScore = value => {
        score = clampMinigameScore(value, definition.maxScore);
        scoreValue.textContent = String(score);
        scoreValue.parentElement.classList.remove('score-pop');
        void scoreValue.parentElement.offsetWidth;
        scoreValue.parentElement.classList.add('score-pop');
      };
      const onKey = handler => {
        keyHandlers.add(handler);
        window.addEventListener('keydown', handler);
      };
      const finish = finalScore => {
        if (finished) return;
        finished = true;
        timers.forEach(timer => {
          clearTimeout(timer);
          clearInterval(timer);
        });
        keyHandlers.forEach(handler => window.removeEventListener('keydown', handler));
        overlay.remove();
        this.activeFinish = null;
        resolve(clampMinigameScore(finalScore, definition.maxScore));
      };
      this.activeFinish = finish;
      overlay.querySelector('.minigame-skip').onclick = () => finish(score);
      onKey(event => {
        if (event.key === 'Escape') finish(score);
      });

      const startedAt = performance.now();
      every(() => {
        const remaining = Math.max(0, definition.durationMs - (performance.now() - startedAt));
        timerLabel.textContent = `${(remaining / 1000).toFixed(1)}s`;
        timerLabel.classList.toggle('is-urgent', remaining < 3000);
        if (remaining <= 0) finish(score);
      }, 100);

      const session = { definition, stage, progress, later, every, onKey, finish, updateScore, getScore: () => score };
      if (gameId === 'HARBOR_SORT') this.playHarborSort(session);
      else if (gameId === 'SKY_COINS') this.playSkyCoins(session);
      else this.playRouteMemory(session);
    });
  }

  playHarborSort(session) {
    const bins = [
      { id: 'COLD', icon: '❄️', label: '冷链仓' },
      { id: 'GENERAL', icon: '📦', label: '普通仓' },
      { id: 'HAZARD', icon: '⚠️', label: '特管仓' }
    ];
    session.stage.classList.add('harbor-sort-stage');
    session.stage.innerHTML = `
      <div class="harbor-crane" aria-hidden="true">🏗️</div>
      <div class="harbor-conveyor"><div class="harbor-cargo" aria-live="polite"></div></div>
      <div class="harbor-bins">${bins.map((bin, index) => `<button type="button" data-bin="${bin.id}"><span>${bin.icon}</span><strong>${index + 1} · ${bin.label}</strong></button>`).join('')}</div>
      <div class="minigame-feedback" aria-live="polite">选择对应仓位</div>
    `;
    const cargoElement = session.stage.querySelector('.harbor-cargo');
    const feedback = session.stage.querySelector('.minigame-feedback');
    const buttons = [...session.stage.querySelectorAll('[data-bin]')];
    let cargoIndex = 0;
    let locked = false;

    const renderCargo = () => {
      const cargo = HARBOR_CARGO[cargoIndex];
      cargoElement.innerHTML = `<span>${cargo.icon}</span><strong>${cargo.name}</strong><small>货物 ${cargoIndex + 1}/${HARBOR_CARGO.length}</small>`;
      session.progress.textContent = `已处理 ${cargoIndex}/${HARBOR_CARGO.length} 件`;
      locked = false;
      buttons.forEach(button => { button.disabled = false; });
    };
    const choose = binId => {
      if (locked || cargoIndex >= HARBOR_CARGO.length) return;
      locked = true;
      buttons.forEach(button => { button.disabled = true; });
      const cargo = HARBOR_CARGO[cargoIndex];
      const correct = cargo.bin === binId;
      session.updateScore(scoreHarborAttempt(session.getScore(), correct));
      feedback.textContent = correct ? '✅ 分拣正确 +10' : `❌ 应送往 ${bins.find(bin => bin.id === cargo.bin).label} -5`;
      feedback.className = `minigame-feedback ${correct ? 'is-correct' : 'is-wrong'}`;
      this.audioManager?.playClick();
      cargoIndex++;
      if (cargoIndex >= HARBOR_CARGO.length) session.later(() => session.finish(session.getScore()), 450);
      else session.later(renderCargo, 180);
    };
    buttons.forEach(button => { button.onclick = () => choose(button.dataset.bin); });
    session.onKey(event => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < buttons.length) choose(buttons[index].dataset.bin);
    });
    renderCargo();
  }

  playSkyCoins(session) {
    session.stage.classList.add('sky-coins-stage');
    session.stage.innerHTML = `
      <div class="skyline-cloud cloud-one" aria-hidden="true">☁️</div>
      <div class="skyline-cloud cloud-two" aria-hidden="true">☁️</div>
      <div class="sky-airship" aria-hidden="true">🎈</div>
      <div class="minigame-feedback" aria-live="polite">点击金币，避开炸弹</div>
    `;
    const feedback = session.stage.querySelector('.minigame-feedback');
    const positions = [[12, 18], [37, 54], [68, 20], [80, 62], [24, 68], [53, 30], [8, 48], [71, 70]];
    let spawnIndex = 0;
    const spawn = () => {
      const definition = SKY_OBJECTS[spawnIndex % SKY_OBJECTS.length];
      const [left, top] = positions[(spawnIndex * 3 + 1) % positions.length];
      spawnIndex++;
      const object = document.createElement('button');
      object.type = 'button';
      object.className = `sky-object kind-${definition.kind.toLowerCase()}`;
      object.dataset.kind = definition.kind;
      object.style.left = `${left}%`;
      object.style.top = `${top}%`;
      object.textContent = definition.icon;
      object.setAttribute('aria-label', definition.kind === 'BOMB' ? '炸弹，不要点击' : `${definition.kind === 'STAR' ? '星星' : '金币'}，点击收集`);
      object.onclick = () => {
        session.updateScore(scoreSkyObject(session.getScore(), definition.points));
        feedback.textContent = definition.points > 0 ? `✨ +${definition.points}` : `💥 ${definition.points}`;
        feedback.className = `minigame-feedback ${definition.points > 0 ? 'is-correct' : 'is-wrong'}`;
        this.audioManager?.playClick();
        object.remove();
      };
      session.stage.appendChild(object);
      session.later(() => object.remove(), 1800);
      session.progress.textContent = `空中目标 ${spawnIndex}`;
    };
    spawn();
    session.every(spawn, 520);
  }

  playRouteMemory(session) {
    const directions = [
      { icon: '⬆️', label: '北方航标' },
      { icon: '➡️', label: '东方航标' },
      { icon: '⬇️', label: '南方航标' },
      { icon: '⬅️', label: '西方航标' }
    ];
    session.stage.classList.add('route-memory-stage');
    session.stage.innerHTML = `
      <div class="route-radar" aria-hidden="true"><span></span></div>
      <div class="route-beacons">${directions.map((direction, index) => `<button type="button" data-direction="${index}" aria-label="${direction.label}"><span>${direction.icon}</span><small>${index + 1}</small></button>`).join('')}</div>
      <div class="minigame-feedback" aria-live="polite">观察航标顺序</div>
    `;
    const buttons = [...session.stage.querySelectorAll('[data-direction]')];
    const feedback = session.stage.querySelector('.minigame-feedback');
    let round = 0;
    let inputIndex = 0;
    let accepting = false;

    const sleep = delay => new Promise(resolve => session.later(resolve, delay));
    const reveal = async () => {
      accepting = false;
      inputIndex = 0;
      buttons.forEach(button => { button.disabled = true; });
      feedback.textContent = `第 ${round + 1} 轮 · 观察航线`;
      session.progress.textContent = `记忆 ${ROUTE_PATTERNS[round].length} 个航标`;
      await sleep(350);
      for (const direction of ROUTE_PATTERNS[round]) {
        const button = buttons[direction];
        button.classList.add('is-lit');
        await sleep(350);
        button.classList.remove('is-lit');
        await sleep(130);
      }
      buttons.forEach(button => { button.disabled = false; });
      accepting = true;
      feedback.textContent = '现在按顺序复现航线';
    };
    const choose = direction => {
      if (!accepting) return;
      const expected = ROUTE_PATTERNS[round][inputIndex];
      const button = buttons[direction];
      button.classList.add(direction === expected ? 'is-correct' : 'is-wrong');
      session.later(() => button.classList.remove('is-correct', 'is-wrong'), 220);
      this.audioManager?.playClick();
      if (direction !== expected) {
        accepting = false;
        feedback.textContent = '❌ 航线错误，挑战结束';
        feedback.className = 'minigame-feedback is-wrong';
        session.later(() => session.finish(session.getScore()), 650);
        return;
      }
      inputIndex++;
      if (inputIndex < ROUTE_PATTERNS[round].length) return;
      round++;
      session.updateScore(scoreRouteRound(round));
      feedback.textContent = `✅ 完成第 ${round} 轮 +20`;
      feedback.className = 'minigame-feedback is-correct';
      if (round >= ROUTE_PATTERNS.length) session.later(() => session.finish(session.getScore()), 650);
      else session.later(reveal, 650);
    };
    buttons.forEach(button => { button.onclick = () => choose(Number(button.dataset.direction)); });
    session.onKey(event => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < buttons.length) choose(index);
    });
    session.later(reveal, 450);
  }
}
