import { getResearchProjectViews } from '../game/ResearchRules.js';

export class ResearchLabUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  choose({ player, state, tileId }) {
    this.close();
    return new Promise(resolve => {
      const initial = getResearchProjectViews(state, player, tileId);
      let selectedId = initial.find(project => project.active)?.id || initial.find(project => project.enabled)?.id || initial[0]?.id;
      const overlay = document.createElement('div');
      overlay.className = 'modal research-lab-overlay';
      overlay.innerHTML = `
        <section class="research-lab" role="dialog" aria-modal="true" aria-labelledby="research-lab-title">
          <header class="research-lab-header">
            <div><span>FORTUNE ADVANCED RESEARCH</span><h2 id="research-lab-title">🧪 未来科技研发中心</h2><p>沿科技树解锁战略道具，成果将在经济轮次推进时交付</p></div>
            <div class="research-lab-level"><small>研究设施等级</small><strong></strong><em></em></div>
            <button type="button" class="close-modal research-close" aria-label="离开研究所">×</button>
          </header>
          <div class="research-queue-banner"></div>
          <div class="research-lab-body">
            <section class="research-tree-panel">
              <div class="research-section-title"><span>01</span><div><small>TECHNOLOGY TREE</small><h3>选择研发项目</h3></div></div>
              <div class="research-tree"></div>
            </section>
            <section class="research-dossier">
              <div class="research-dossier-art"><i></i><span></span><b></b></div>
              <div class="research-dossier-copy"><span></span><h3></h3><p></p></div>
              <div class="research-spec-grid"></div>
              <div class="research-tactical"><span>TACTICAL ANALYSIS</span><strong></strong></div>
              <div class="research-inventory"><div><span>科技道具容量</span><strong></strong></div><div class="research-inventory-track"></div></div>
            </section>
          </div>
          <footer class="research-lab-footer"><button type="button" class="btn-secondary research-cancel">离开研究所</button><button type="button" class="btn-primary research-start"><span>启动研发项目</span><small></small></button></footer>
        </section>`;

      const finish = value => {
        if (!this.overlay) return;
        this.overlay = null;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 180);
        resolve(value);
      };
      const render = () => {
        const projects = getResearchProjectViews(state, player, tileId);
        const selected = projects.find(project => project.id === selectedId) || projects[0];
        const activeTask = projects[0]?.activeTask;
        overlay.querySelector('.research-lab-level strong').textContent = `LV ${selected?.labLevel || 0}`;
        overlay.querySelector('.research-lab-level em').textContent = selected?.accelerated ? '云端计算董事长 · 研发加速' : `已解锁 ${projects.filter(project => project.unlocked).length}/${projects.length} 项科技`;
        const queue = overlay.querySelector('.research-queue-banner');
        const activeProject = projects.find(project => project.active);
        queue.className = `research-queue-banner ${activeTask ? 'is-active' : ''}`;
        queue.innerHTML = activeTask
          ? `<span>${activeProject?.icon || '⚙️'}</span><div><small>ACTIVE RESEARCH QUEUE</small><strong>${activeProject?.name || activeTask.itemId}</strong><em>剩余 ${activeTask.roundsRemaining} 轮 · 研发完成后自动进入道具栏</em></div><b>${activeTask.roundsRemaining}</b>`
          : '<span>◇</span><div><small>RESEARCH QUEUE AVAILABLE</small><strong>研发队列空闲</strong><em>选择下方科技项目开始新任务</em></div><b>READY</b>';
        overlay.querySelector('.research-tree').innerHTML = projects.map((project, index) => `
          <button type="button" data-project="${project.id}" class="research-project ${project.id === selected?.id ? 'selected' : ''} ${project.unlocked ? '' : 'locked'} ${project.active ? 'active' : ''}" style="--project:${project.color}">
            <i>${String(index + 1).padStart(2, '0')}</i><span>${project.icon}</span><div><small>LV ${project.researchLevel} · ${project.label}</small><strong>${project.name}</strong><em>${project.active ? `研发中 · ${project.activeTask.roundsRemaining} 轮` : project.unlocked ? `${project.rounds} 轮完成` : `研究所 LV ${project.researchLevel} 解锁`}</em></div>${project.ownedCount ? `<b>持有 ${project.ownedCount}</b>` : ''}
          </button>`).join('');
        overlay.querySelectorAll('[data-project]').forEach(button => {
          button.onclick = () => { selectedId = button.dataset.project; this.audioManager?.playClick?.(); render(); };
        });
        if (!selected) return;
        const art = overlay.querySelector('.research-dossier-art');
        art.style.setProperty('--project', selected.color);
        art.querySelector('span').textContent = selected.icon;
        art.querySelector('b').textContent = `TIER ${selected.researchLevel}`;
        overlay.querySelector('.research-dossier-copy > span').textContent = selected.label.toUpperCase();
        overlay.querySelector('.research-dossier-copy h3').textContent = selected.name;
        overlay.querySelector('.research-dossier-copy p').textContent = selected.description;
        overlay.querySelector('.research-spec-grid').innerHTML = `
          <div><small>科技等级</small><strong>LV ${selected.researchLevel}</strong></div>
          <div><small>研发周期</small><strong>${selected.rounds} 轮${selected.accelerated ? ' ⚡' : ''}</strong></div>
          <div><small>预计交付</small><strong>第 ${selected.completesRound} 轮</strong></div>
          <div><small>当前持有</small><strong>${selected.ownedCount} 件</strong></div>`;
        overlay.querySelector('.research-tactical strong').textContent = selected.tactical;
        overlay.querySelector('.research-inventory strong').textContent = `${selected.inventoryCount} / ${selected.inventoryCapacity}`;
        overlay.querySelector('.research-inventory-track').innerHTML = Array.from({ length: selected.inventoryCapacity }, (_, index) => `<i class="${index < selected.inventoryCount ? 'filled' : ''}"></i>`).join('');
        const start = overlay.querySelector('.research-start');
        start.disabled = !selected.enabled;
        start.querySelector('span').textContent = selected.active ? '项目正在研发' : selected.unlocked ? '启动研发项目' : '科技尚未解锁';
        start.querySelector('small').textContent = selected.enabled ? `${selected.name} · ${selected.rounds} 轮后交付` : selected.reason;
      };

      overlay.querySelector('.research-close').onclick = () => finish(null);
      overlay.querySelector('.research-cancel').onclick = () => finish(null);
      overlay.querySelector('.research-start').onclick = () => {
        const selected = getResearchProjectViews(state, player, tileId).find(project => project.id === selectedId);
        if (!selected?.enabled) return;
        overlay.querySelector('.research-lab').classList.add('is-starting');
        this.audioManager?.playCardSpell?.();
        setTimeout(() => finish(selected.id), 520);
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
