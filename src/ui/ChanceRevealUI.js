import { getChancePresentation } from '../game/ChancePresentation.js';

function portraitMarkup(player) {
  if (player?.avatarAtlas) return `<span class="chance-player-avatar" style="--player:${player.color};background-image:url('${player.avatarAtlas}');background-position:${player.avatarPosition || '0% 0%'}" role="img" aria-label="${player.name}"></span>`;
  return `<span class="chance-player-avatar" style="--player:${player?.color || '#38bdf8'}" role="img" aria-label="${player?.name || '玩家'}">${player?.avatar || '🎩'}</span>`;
}

export class ChanceRevealUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
    this.timer = null;
  }

  show({ event, player }) {
    const presentation = getChancePresentation(event?.chance, event);
    if (!presentation || player?.isAI) return;
    this.close();
    const overlay = document.createElement('div');
    overlay.className = `chance-reveal-overlay tone-${presentation.tone}`;
    overlay.style.setProperty('--chance-accent', presentation.tone === 'loss' ? '#fb7185' : presentation.tone === 'blocked' ? '#4ade80' : presentation.category.accent);
    overlay.innerHTML = `
      <div class="chance-stage" role="dialog" aria-modal="true" aria-labelledby="chance-card-title">
        <div class="chance-rays" aria-hidden="true"></div>
        <article class="chance-card rarity-${presentation.rarity.id.toLowerCase()}">
          <div class="chance-card-back"><span>?</span><strong>FORTUNE</strong><small>DESTINY CARD</small></div>
          <div class="chance-card-front">
            <header><span>${presentation.category.label}</span><em>${presentation.rarity.label} · ${presentation.stars}</em></header>
            <div class="chance-card-art"><i></i><span>${presentation.icon}</span><b>${presentation.tone === 'gain' ? 'LUCKY' : presentation.tone === 'blocked' ? 'GUARDED' : 'TWIST'}</b></div>
            <div class="chance-card-copy"><small>NO. ${String(Math.abs([...presentation.title].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 100).padStart(2, '0')}</small><h2 id="chance-card-title">${presentation.title}</h2><p>${presentation.description}</p></div>
            <div class="chance-card-outcome"><span>实际结算</span><strong>${presentation.outcome}</strong></div>
          </div>
        </article>
        <div class="chance-player-result">${portraitMarkup(player)}<div><span>${player?.name || '玩家'} 的命运发生改变</span><strong>${presentation.outcome}</strong></div></div>
        <button type="button" class="btn-primary chance-accept">收下结果</button>
      </div>`;
    const close = () => this.close();
    overlay.querySelector('.chance-accept').onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.audioManager?.playCardSpell?.();
    requestAnimationFrame(() => overlay.classList.add('is-revealed'));
    this.timer = setTimeout(close, 4200);
  }

  close() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.overlay) return;
    const overlay = this.overlay;
    this.overlay = null;
    overlay.classList.remove('is-revealed');
    setTimeout(() => overlay.remove(), 220);
  }
}
