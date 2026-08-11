import { getModeOverview } from '../game/ModeRules.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

export class ModeUI {
  constructor(gameState) {
    this.state = gameState;
    this.modal = document.getElementById('modal-mode-status');
    this.content = document.getElementById('mode-status-content');
    document.getElementById('mode-status-close').onclick = () => this.hide();
    this.modal.addEventListener('click', event => { if (event.target === this.modal) this.hide(); });
  }

  show() {
    this.render();
    this.modal.classList.remove('hidden');
  }

  hide() { this.modal.classList.add('hidden'); }

  render() {
    const overview = getModeOverview(this.state);
    const { profile } = overview;
    document.getElementById('mode-status-title').textContent = `${profile.icon} ${profile.name}目标中心`;
    document.getElementById('mode-status-summary').textContent = profile.summary;
    const maxAssets = Math.max(1, ...overview.standings.map(entry => entry.assets));
    this.content.innerHTML = `<section class="mode-round-card"><div><span>当前赛程</span><strong>第 ${overview.round} / ${overview.maxRounds} 轮</strong></div>
      <div class="mode-round-progress"><i style="width:${Math.round(overview.roundProgress * 100)}%"></i></div><b>${Math.round(overview.roundProgress * 100)}%</b></section>
      <section><div class="mode-section-title"><strong>本模式专属规则</strong><span>${profile.rules.length} 项</span></div>
        <div class="mode-rule-grid">${profile.rules.map((rule, index) => `<article><span>${index + 1}</span><p>${escapeHTML(rule)}</p></article>`).join('')}</div></section>
      <section><div class="mode-section-title"><strong>目标进度</strong><span>按当前总资产</span></div>
        <div class="mode-standing-list">${overview.standings.map((entry, index) => `<article class="mode-standing-row ${index === 0 ? 'leader' : ''}">
          <b>${index + 1}</b><div><strong>${escapeHTML(entry.name)}</strong><small>${escapeHTML(entry.members.join('、'))} · ${entry.active} 名存活</small>
            <div class="mode-asset-progress"><i style="width:${Math.round(entry.assets / maxAssets * 100)}%"></i></div></div><span>$${entry.assets.toLocaleString()}</span></article>`).join('')}</div></section>
      <footer class="mode-cycle-note">经济周期：每 ${this.state.economicCycle.roundsPerPeriod} 轮结算 · 下一次结算还剩 ${this.state.economicCycle.roundsPerPeriod - ((this.state.round - 1) % this.state.economicCycle.roundsPerPeriod)} 轮</footer>`;
  }
}
