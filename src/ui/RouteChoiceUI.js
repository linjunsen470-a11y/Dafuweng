import { getRouteChoicePlans } from '../game/RouteDecisionRules.js';

const money = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`;

export class RouteChoiceUI {
  constructor(audioManager = null) { this.audioManager = audioManager; this.overlay = null; }

  choose({ player, state, options, remainingSteps }) {
    this.close();
    const plans = getRouteChoicePlans(state, player, options, remainingSteps);
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal route-choice-overlay';
      overlay.innerHTML = `<section class="route-choice" role="dialog" aria-modal="true" aria-labelledby="route-choice-title">
        <header class="route-choice-header"><div><span>TACTICAL NAVIGATION · ${remainingSteps} STEPS</span><h2 id="route-choice-title">🧭 岔路战术导航</h2><p>${player.name}，前方路线会影响本次移动的实际落点与沿途遭遇</p></div><div class="route-choice-legend"><span><i class="good"></i>收益</span><span><i class="danger"></i>风险</span></div></header>
        <div class="route-choice-list">${plans.map((plan, index) => `<button type="button" class="route-plan ${plan.recommended ? 'recommended' : ''}" data-route="${plan.optionId}" style="--route:${index ? '#c084fc' : '#38bdf8'}">
          <header><span>ROUTE ${String.fromCharCode(65 + index)}</span>${plan.recommended ? '<b>AI 推荐</b>' : ''}<em class="${plan.tone}">${plan.label}</em></header>
          <div class="route-plan-destination"><i>${plan.destinationIcon}</i><div><small>预计实际落点</small><strong>${plan.destinationName}</strong><span>${plan.outcome}</span></div></div>
          <div class="route-path"><i></i>${plan.tiles.map((tile, tileIndex) => `<span class="${tileIndex === plan.tiles.length - 1 ? 'destination' : ''}" title="${tile.name}"><b>${tile.icon}</b><small>${tile.name}</small></span>`).join('')}</div>
          <div class="route-encounters">${plan.encounters.length ? plan.encounters.slice(0, 4).map(event => `<span class="${event.tone}">${event.icon} ${event.label}</span>`).join('') : '<span class="neutral">✓ 沿途未发现特殊事件</span>'}</div>
          <footer><span>${plan.pathIds.length} 格${plan.stoppedEarly ? ' · 将提前截停' : ''}${plan.alternateCount ? ` · 后续还有 ${plan.alternateCount} 种分支` : ''}</span><strong>${plan.stoppedEarly ? '危险事件截停' : plan.toll ? `租金风险 ${money(plan.toll)}` : plan.purchasePrice ? `购地机会 ${money(plan.purchasePrice)}` : '安全落点'}</strong></footer>
        </button>`).join('')}</div>
        <footer class="route-choice-footer"><span>路线评估已计入路障、地雷、神明、玩家与最终租金</span><strong>点击路线卡继续</strong></footer>
      </section>`;
      const finish = optionId => { if (!this.overlay) return; this.overlay = null; overlay.classList.remove('is-visible'); setTimeout(() => overlay.remove(), 170); resolve(optionId); };
      overlay.querySelectorAll('[data-route]').forEach(button => { button.onclick = () => { this.audioManager?.playConfirm?.(); button.classList.add('is-selected'); setTimeout(() => finish(Number(button.dataset.route)), 220); }; });
      document.body.appendChild(overlay);
      this.overlay = overlay;
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
    });
  }

  close() { if (!this.overlay) return; this.overlay.remove(); this.overlay = null; }
}
