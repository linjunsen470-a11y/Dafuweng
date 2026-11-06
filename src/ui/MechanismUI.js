const money = value => `$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString()}`;

export class MechanismUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  choose({ player, state, offer }) {
    this.close();
    return new Promise(resolve => {
      let selectedIndex = offer.plans.find(plan => plan.enabled)?.routeIndex ?? offer.plans[0]?.routeIndex;
      const overlay = document.createElement('div');
      overlay.className = 'modal mechanism-tower-overlay';
      overlay.innerHTML = `
        <section class="mechanism-tower" role="dialog" aria-modal="true" aria-labelledby="mechanism-tower-title">
          <header class="mechanism-tower-header">
            <div><span>TIDAL TRANSIT CONTROL</span><h2 id="mechanism-tower-title">⚙️ 潮汐交通控制塔</h2><p>锁定全岛三处岔路，改变所有玩家后续通行方案</p></div>
            <div class="mechanism-current"><small>当前路网状态</small><strong></strong><em></em></div>
            <button type="button" class="close-modal mechanism-close" aria-label="离开控制塔">×</button>
          </header>
          <div class="mechanism-tower-body">
            <section class="mechanism-plans-panel">
              <div class="mechanism-section-title"><span>01</span><div><small>NETWORK MODE</small><h3>选择全岛路线方案</h3></div></div>
              <div class="mechanism-plan-list"></div>
            </section>
            <section class="mechanism-map-panel">
              <div class="mechanism-section-title"><span>02</span><div><small>ROUTE SCHEMATIC</small><h3>三处分岔态势</h3></div></div>
              <div class="mechanism-schematic"></div>
              <div class="mechanism-route-metrics"></div>
              <div class="mechanism-player-flow"><span>ROUTE OCCUPANCY</span><div></div></div>
            </section>
          </div>
          <section class="mechanism-impact-preview"><div><span>个人租金风险</span><strong class="mechanism-risk"></strong></div><div><span>自有地产潜在通行费</span><strong class="mechanism-potential"></strong></div><div><span>战略判断</span><strong class="mechanism-verdict"></strong></div></section>
          <footer class="mechanism-tower-footer"><button type="button" class="btn-secondary mechanism-cancel">保持当前路网</button><button type="button" class="btn-primary mechanism-activate"><span>启动路线重构</span><small></small></button></footer>
        </section>`;

      const finish = value => {
        if (!this.overlay) return;
        this.overlay = null;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 180);
        resolve(value);
      };
      const render = () => {
        const selected = offer.plans.find(plan => plan.routeIndex === selectedIndex) || offer.plans[0];
        const active = offer.plans.find(plan => plan.active);
        overlay.querySelector('.mechanism-current strong').textContent = active ? `${active.icon} ${active.name}` : '◇ 自由通行';
        overlay.querySelector('.mechanism-current em').textContent = active ? '全部岔路已锁定' : '玩家可在岔路自行选择';
        overlay.querySelector('.mechanism-plan-list').innerHTML = offer.plans.map(plan => `
          <button type="button" data-route="${plan.routeIndex}" class="mechanism-plan ${plan.routeIndex === selected?.routeIndex ? 'selected' : ''} ${plan.active ? 'active' : ''}" style="--route:${plan.color}">
            <span>${plan.icon}</span><div><small>${plan.id} NETWORK${plan.active ? ' · ACTIVE' : ''}</small><strong>${plan.name}</strong><p>${plan.description}</p></div><b>${plan.nodeCount}<em>节点</em></b>
          </button>`).join('');
        overlay.querySelectorAll('[data-route]').forEach(button => {
          button.onclick = () => { selectedIndex = Number(button.dataset.route); this.audioManager?.playClick?.(); render(); };
        });
        const maxNodes = Math.max(...offer.plans.map(plan => plan.nodeCount), 1);
        overlay.querySelector('.mechanism-schematic').innerHTML = selected.segments.map((segment, index) => `
          <article class="mechanism-branch" style="--route:${selected.color}"><header><span>JUNCTION ${index + 1}</span><strong>${segment.branchName}</strong><em>${segment.nodeCount} 节点</em></header><div class="mechanism-line"><i></i>${segment.nodeIds.slice(0, 8).map((id, nodeIndex) => `<b class="${nodeIndex === 0 ? 'entry' : nodeIndex === Math.min(segment.nodeIds.length, 8) - 1 ? 'rejoin' : ''}" title="${segment.nodeNames[nodeIndex]}">${nodeIndex === 0 ? 'A' : nodeIndex === Math.min(segment.nodeIds.length, 8) - 1 ? 'B' : ''}</b>`).join('')}</div><small>${segment.nodeNames.slice(0, 3).join(' → ')}${segment.nodeNames.length > 3 ? ' → …' : ''}</small></article>`).join('');
        overlay.querySelector('.mechanism-route-metrics').innerHTML = `
          <div><small>覆盖节点</small><strong>${selected.nodeCount}</strong><i style="width:${selected.nodeCount / maxNodes * 100}%"></i></div>
          <div><small>地产数量</small><strong>${selected.propertyCount}</strong><i style="width:${selected.propertyCount / Math.max(1, selected.nodeCount) * 100}%"></i></div>
          <div><small>特殊设施</small><strong>${selected.facilityCount} ${selected.facilityIcons.join('')}</strong><i style="width:${selected.facilityCount / Math.max(1, selected.nodeCount) * 100}%"></i></div>`;
        const players = overlay.querySelector('.mechanism-player-flow div');
        players.innerHTML = selected.playersOnRoute.length ? selected.playersOnRoute.map(candidate => `<span style="--player:${candidate.color}"><i></i>${candidate.name}${candidate.isCaster ? ' · 操作者' : ''}</span>`).join('') : '<em>当前没有玩家位于该方案路径</em>';
        overlay.querySelector('.mechanism-risk').textContent = money(selected.tollExposure);
        overlay.querySelector('.mechanism-potential').textContent = money(selected.ownTollPotential);
        overlay.querySelector('.mechanism-verdict').textContent = selected.tollExposure > selected.ownTollPotential ? '⚠️ 该路线对你更危险' : selected.ownTollPotential > 0 ? '🏙️ 有利于引流至自有地产' : selected.facilityCount >= 3 ? '✨ 设施密集，机会更多' : '🛣️ 路程稳定，风险可控';
        const activate = overlay.querySelector('.mechanism-activate');
        activate.disabled = !selected.enabled;
        activate.querySelector('span').textContent = selected.active ? '该方案正在运行' : `启用${selected.name}`;
        activate.querySelector('small').textContent = selected.enabled ? `同步切换 ${selected.segments.length} 处岔路 · ${selected.nodeCount} 个路径节点` : selected.reason;
      };

      overlay.querySelector('.mechanism-close').onclick = () => finish(null);
      overlay.querySelector('.mechanism-cancel').onclick = () => finish(null);
      overlay.querySelector('.mechanism-activate').onclick = () => {
        const selected = offer.plans.find(plan => plan.routeIndex === selectedIndex);
        if (!selected?.enabled) return;
        overlay.querySelector('.mechanism-tower').classList.add('is-switching');
        this.audioManager?.playConfirm?.();
        setTimeout(() => finish(selected.routeIndex), 540);
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
