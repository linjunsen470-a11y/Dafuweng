import { MAGIC_CONDITION_META, MAGIC_EFFECT_META, getMagicPreview } from '../game/MagicRules.js';

function avatarMarkup(target) {
  if (target.avatarAtlas) return `<span class="magic-target-avatar" style="--target-color:${target.color};background-image:url('${target.avatarAtlas}');background-position:${target.avatarPosition || '0% 0%'}" role="img" aria-label="${target.name}"></span>`;
  return `<span class="magic-target-avatar" style="--target-color:${target.color}" role="img" aria-label="${target.name}">${target.avatar || '🎩'}</span>`;
}

export class MagicHouseUI {
  constructor(audioManager) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  choose({ player, state, offer }) {
    this.close();
    return new Promise(resolve => {
      let conditionId = offer.conditions.some(condition => condition.id === 'SELF') ? 'SELF' : offer.conditions[0]?.id;
      let effectId = offer.effects.some(effect => effect.id === 'CASH_RAIN') ? 'CASH_RAIN' : offer.effects[0]?.id;
      const overlay = document.createElement('div');
      overlay.className = 'modal magic-house-overlay';
      overlay.innerHTML = `
        <section class="magic-house" role="dialog" aria-modal="true" aria-labelledby="magic-house-title">
          <header class="magic-house-header">
            <div><span>ARCANE FORTUNE LAB</span><h2 id="magic-house-title">🔮 星辉魔法屋</h2><p>组合目标符文与效果符文，确认本次命运改写</p></div>
            <button type="button" class="close-modal magic-house-close" aria-label="离开魔法屋">×</button>
          </header>
          <div class="magic-house-body">
            <section class="magic-rune-section magic-condition-section"><div class="magic-section-title"><b>01</b><div><span>TARGET RUNE</span><h3>选择目标条件</h3></div></div><div class="magic-rune-grid magic-condition-grid"></div></section>
            <div class="magic-orb-column"><div class="magic-orb"><i></i><span>✦</span><b>命运回路</b></div><div class="magic-formula"><span class="magic-formula-condition"></span><i>＋</i><span class="magic-formula-effect"></span></div></div>
            <section class="magic-rune-section magic-effect-section"><div class="magic-section-title"><b>02</b><div><span>EFFECT RUNE</span><h3>选择施法结果</h3></div></div><div class="magic-rune-grid magic-effect-grid"></div></section>
          </div>
          <section class="magic-preview-panel" aria-live="polite">
            <div class="magic-preview-copy"><span>CAST PREVIEW</span><h3></h3><p></p></div>
            <div class="magic-preview-targets"></div>
            <div class="magic-preview-verdict"><span></span><strong></strong></div>
          </section>
          <footer class="magic-house-footer"><button type="button" class="btn-secondary magic-house-cancel">放弃施法</button><button type="button" class="btn-primary magic-house-cast"><span>发动命运魔法</span><small></small></button></footer>
        </section>
      `;

      const finish = value => {
        if (!this.overlay) return;
        this.overlay = null;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 180);
        resolve(value);
      };

      const render = () => {
        const conditionGrid = overlay.querySelector('.magic-condition-grid');
        conditionGrid.innerHTML = '';
        offer.conditions.forEach(option => {
          const meta = MAGIC_CONDITION_META[option.id];
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `magic-rune-button ${conditionId === option.id ? 'selected' : ''}`;
          button.innerHTML = `<span>${meta?.icon || '◆'}</span><div><strong>${meta?.label || option.label}</strong><small>${meta?.category || '目标'}</small></div>`;
          button.onclick = () => { conditionId = option.id; render(); };
          conditionGrid.appendChild(button);
        });
        const effectGrid = overlay.querySelector('.magic-effect-grid');
        effectGrid.innerHTML = '';
        offer.effects.forEach(option => {
          const meta = MAGIC_EFFECT_META[option.id];
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `magic-rune-button tone-${meta?.tone?.toLowerCase() || 'chaos'} ${effectId === option.id ? 'selected' : ''}`;
          button.innerHTML = `<span>${meta?.icon || '✦'}</span><div><strong>${meta?.label || option.label}</strong><small>${'◆'.repeat(meta?.power || 1)}</small></div>`;
          button.onclick = () => { effectId = option.id; render(); };
          effectGrid.appendChild(button);
        });

        const preview = getMagicPreview(state, player, conditionId, effectId);
        overlay.querySelector('.magic-formula-condition').textContent = preview.condition?.icon || '◆';
        overlay.querySelector('.magic-formula-effect').textContent = preview.effect?.icon || '✦';
        overlay.querySelector('.magic-preview-copy h3').textContent = `${preview.condition?.label || '未知目标'} · ${preview.effect?.label || '未知效果'}`;
        overlay.querySelector('.magic-preview-copy p').textContent = preview.effect?.description || '';
        const targetHost = overlay.querySelector('.magic-preview-targets');
        targetHost.innerHTML = preview.targets.length ? preview.targets.map(target => `
          <article class="magic-target-chip ${target.isCaster ? 'is-caster' : ''}">${avatarMarkup(target)}<div><strong>${target.name}</strong><small>现金 $${target.cash.toLocaleString()} · ${target.properties} 块地产</small></div>${target.isCaster ? '<em>施法者</em>' : ''}</article>
        `).join('') : '<div class="magic-no-target">当前没有符合符文条件的玩家</div>';
        const verdict = overlay.querySelector('.magic-preview-verdict');
        verdict.className = `magic-preview-verdict tone-${preview.effect?.tone?.toLowerCase() || 'chaos'} ${preview.enabled ? '' : 'is-blocked'}`;
        verdict.querySelector('span').textContent = preview.selfRisk ? '⚠️ 该组合会影响施法者本人' : preview.enabled ? '✦ 符文回路稳定' : '⛔ 无法发动';
        verdict.querySelector('strong').textContent = preview.enabled ? preview.outcome : preview.reason;
        const cast = overlay.querySelector('.magic-house-cast');
        cast.disabled = !preview.enabled;
        cast.querySelector('small').textContent = preview.enabled ? `${preview.targets.length} 名目标 · 威力 ${preview.effect?.power || 1}` : preview.reason;
      };

      overlay.querySelector('.magic-house-close').onclick = () => finish(null);
      overlay.querySelector('.magic-house-cancel').onclick = () => finish(null);
      overlay.querySelector('.magic-house-cast').onclick = () => {
        if (!getMagicPreview(state, player, conditionId, effectId).enabled) return;
        overlay.querySelector('.magic-house').classList.add('is-casting');
        this.audioManager.playCardSpell();
        setTimeout(() => finish({ conditionId, effectId }), 520);
      };
      overlay.addEventListener('click', event => { if (event.target === overlay) finish(null); });
      document.body.appendChild(overlay);
      this.overlay = overlay;
      render();
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
    });
  }

  close() {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
  }
}
