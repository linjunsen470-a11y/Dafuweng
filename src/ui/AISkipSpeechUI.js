import { cityPortrait } from './CityPortrait.js';

const SKIP_TEMPLATES = {
  HOSPITAL: {
    badge: '🏥 医院疗养 · 跳过回合',
    tone: 'danger',
    lines: [
      rem => `哎哟还在医院打点滴呢，这回合先歇着啦～${rem > 0 ? `（还剩 ${rem} 回合）` : '（下回合就能出院！）'}`,
      rem => `医生叮嘱要卧床静养，这回合只好先跳过咯！${rem > 0 ? `（还剩 ${rem} 回合）` : '（马上满血复活！）'}`
    ]
  },
  JAIL: {
    badge: '🚔 监狱反省 · 跳过回合',
    tone: 'danger',
    lines: [
      rem => `铁窗泪啊…各位先走一步，${rem > 0 ? `再蹲 ${rem} 回合` : '下回合'}我就回来翻盘！`,
      rem => `在局子里好好反思中，这回合先跳过！${rem > 0 ? `（剩余 ${rem} 回合）` : '（马上重获自由！）'}`
    ]
  },
  HOTEL: {
    badge: '🏨 旅馆度假 · 跳过回合',
    tone: 'warm',
    lines: [
      rem => `五星级大床太舒服啦，这回合继续躺平享受～${rem > 0 ? `（还剩 ${rem} 回合）` : '（下回合退房出发！）'}`,
      rem => `泡个温泉再继续赚钱，本回合跳过度假去咯！${rem > 0 ? `（还剩 ${rem} 回合）` : '（下回合回归战场！）'}`
    ]
  },
  HIBERNATE: {
    badge: '❄️ 冬眠沉睡 · 跳过回合',
    tone: 'cool',
    lines: [
      rem => `哈欠～冻得动弹不得，这回合先睡过去吧…${rem > 0 ? `（还剩 ${rem} 回合）` : '（下回合苏醒！）'}`,
      rem => `呼噜呼噜…等解冻了再找你们算账！${rem > 0 ? `（还剩 ${rem} 回合）` : '（下回合醒来！）'}`
    ]
  },
  FAST_AI: {
    badge: '⚡ AI 快进 · 回合已过',
    tone: 'info',
    lines: [
      () => '我已火速走完这回合啦，马上交棒给下一位！',
      () => '快进搞定本回合行动，轮到下一位出手咯！'
    ]
  }
};

// Displays a clear, lively Richman-4 speech bubble whenever an AI (or player) turn is skipped
// so players immediately understand why the turn moved on instead of mistaking it for a bug.
export class AISkipSpeechUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.el = null;
    this.timer = null;
    this.resolver = null;
  }

  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.el?.remove();
    this.el = null;
    const resolve = this.resolver;
    this.resolver = null;
    resolve?.();
  }

  async showSkippedTurns(skippedList = [], gameState = null, speed = 1) {
    if (!Array.isArray(skippedList) || !skippedList.length) return;
    for (const entry of skippedList) {
      const player = gameState?.players?.[entry.playerId];
      if (!player) continue;
      await this.showBubble({
        player,
        mapId: gameState?.mapId,
        reason: entry.reason,
        remaining: entry.remaining ?? 0,
        duration: Math.max(650, Math.round(1350 / Math.max(1, Math.min(speed, 2.5))))
      });
    }
  }

  showFastNotice(player, mapId, customLine = null) {
    if (!player) return;
    void this.showBubble({
      player,
      mapId,
      reason: 'FAST_AI',
      remaining: 0,
      customLine,
      duration: 1100,
      blocking: false
    });
  }

  showBubble({ player, mapId, reason = 'HOSPITAL', remaining = 0, customLine = null, duration = 1200, blocking = true }) {
    this.clear();
    if (typeof document === 'undefined' || !document.body) return Promise.resolve();

    const reduced = document.documentElement.classList.contains('reduce-motion')
      || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const spec = SKIP_TEMPLATES[reason] || SKIP_TEMPLATES.HOSPITAL;
    const pick = spec.lines[(player.id + Math.max(0, remaining)) % spec.lines.length];
    const message = customLine || pick(remaining);

    const card = document.createElement('div');
    card.className = `ai-skip-speech tone-${spec.tone}`;
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    card.style.setProperty('--speaker-color', player.color || '#f59e0b');

    const portraitSrc = cityPortrait(player, mapId) || player.avatarImg;
    const avatarHtml = portraitSrc
      ? `<img class="ai-skip-avatar" src="${portraitSrc}" alt="${player.name}" />`
      : `<span class="ai-skip-avatar-emoji">${player.avatar || '🎲'}</span>`;

    card.innerHTML = `
      <div class="ai-skip-portrait">${avatarHtml}</div>
      <div class="ai-skip-body">
        <div class="ai-skip-head">
          <strong class="ai-skip-name"></strong>
          <span class="ai-skip-badge"></span>
        </div>
        <p class="ai-skip-line"></p>
      </div>
    `;
    const hasAiTag = /\bAI\b/i.test(player.name || '');
    card.querySelector('.ai-skip-name').textContent = `${player.name}${player.isAI && !hasAiTag ? ' AI' : ''}`;
    card.querySelector('.ai-skip-badge').textContent = spec.badge;
    card.querySelector('.ai-skip-line').textContent = `“${message}”`;
    document.body.appendChild(card);
    void card.offsetWidth;
    card.classList.add('is-visible');
    this.el = card;

    if (reason !== 'FAST_AI') {
      this.audioManager?.playCharacterVoice?.(player, reason === 'HOTEL' ? 'joy' : 'misfortune');
    }

    const waitMs = reduced ? Math.min(450, duration) : duration;
    const done = new Promise(resolve => {
      this.resolver = resolve;
      const finish = () => {
        if (this.el !== card) return;
        card.classList.remove('is-visible');
        this.timer = setTimeout(() => {
          card.remove();
          if (this.el === card) this.el = null;
          if (this.resolver === resolve) this.resolver = null;
          resolve();
        }, reduced ? 0 : 180);
      };
      card.onclick = finish;
      this.timer = setTimeout(finish, waitMs);
    });
    return blocking ? done : Promise.resolve();
  }
}
