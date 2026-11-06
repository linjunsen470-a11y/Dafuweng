export function createImpactCard(impact) {
  const item = document.createElement('div');
  item.className = `news-impact tone-${impact.tone || 'neutral'}`;
  const icon = document.createElement('span');
  icon.className = 'news-impact-icon';
  icon.textContent = impact.icon || '◆';
  const copy = document.createElement('div');
  const label = document.createElement('strong');
  label.textContent = impact.label || '城市状态';
  const detail = document.createElement('span');
  detail.textContent = impact.detail || '影响已经生效';
  copy.append(label, detail);
  item.append(icon, copy);
  return item;
}

export class NewsUI {
  constructor() {
    this.activeOverlay = null;
    this.activeTimer = null;
    this.keyHandler = null;
  }

  close() {
    if (this.activeTimer) clearTimeout(this.activeTimer);
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.activeTimer = null;
    this.keyHandler = null;
    this.activeOverlay?.remove();
    this.activeOverlay = null;
  }

  mount(overlay) {
    this.close();
    this.activeOverlay = overlay;
    document.body.appendChild(overlay);
    this.keyHandler = event => {
      if (event.key === 'Escape') this.close();
    };
    window.addEventListener('keydown', this.keyHandler);
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
  }

  show(news) {
    if (!news) return;
    const overlay = document.createElement('div');
    overlay.className = `news-flash-overlay tone-${news.tone || 'breaking'}`;
    overlay.innerHTML = `
      <article class="news-flash-card" role="dialog" aria-modal="true" aria-labelledby="news-flash-title">
        <div class="news-flash-masthead">
          <span class="news-live-dot"></span>
          <strong>FORTUNE CITY NEWS</strong>
          <span class="news-round-label"></span>
        </div>
        <div class="news-flash-body">
          <div class="news-category-row"><span class="news-category-icon"></span><span class="news-category"></span><time>城市快报</time></div>
          <h2 id="news-flash-title"></h2>
          <p class="news-flash-description"></p>
          <div class="news-impact-grid" aria-label="事件影响"></div>
        </div>
        <div class="news-flash-footer">
          <span>本消息已记录到新闻历史</span>
          <button type="button" class="btn-primary news-dismiss">继续游戏</button>
        </div>
        <span class="news-auto-progress" aria-hidden="true"></span>
      </article>
    `;
    overlay.querySelector('.news-round-label').textContent = `ROUND ${news.round}`;
    overlay.querySelector('.news-category-icon').textContent = news.icon || '📰';
    overlay.querySelector('.news-category').textContent = news.category || '快讯';
    overlay.querySelector('h2').textContent = news.title;
    overlay.querySelector('.news-flash-description').textContent = news.desc;
    const grid = overlay.querySelector('.news-impact-grid');
    (news.impacts || []).forEach(impact => grid.appendChild(createImpactCard(impact)));
    overlay.querySelector('.news-dismiss').onclick = () => this.close();
    overlay.onclick = event => {
      if (event.target === overlay) this.close();
    };
    this.mount(overlay);
    this.activeTimer = setTimeout(() => this.close(), 6500);
  }

  showHistory(history = []) {
    const overlay = document.createElement('div');
    overlay.className = 'modal news-history-overlay';
    overlay.innerHTML = `
      <div class="glass-card modal-box news-history-box" role="dialog" aria-modal="true" aria-labelledby="news-history-title">
        <div class="modal-header">
          <div><span class="minigame-kicker">FORTUNE CITY ARCHIVE</span><h2 id="news-history-title">📰 城市新闻档案</h2></div>
          <button type="button" class="close-btn news-history-close" aria-label="关闭新闻历史">✕</button>
        </div>
        <p class="news-history-summary"></p>
        <div class="news-history-list"></div>
      </div>
    `;
    overlay.querySelector('.news-history-summary').textContent = history.length
      ? `已保存最近 ${history.length} 条影响对局的城市事件。`
      : '当前对局尚未发生城市新闻事件。';
    const list = overlay.querySelector('.news-history-list');
    history.forEach(news => {
      const article = document.createElement('article');
      article.className = `news-history-item tone-${news.tone || 'breaking'}`;
      const heading = document.createElement('div');
      const badge = document.createElement('span');
      badge.textContent = `${news.icon || '📰'} ${news.category || '快讯'}`;
      const round = document.createElement('time');
      round.textContent = `第 ${news.round} 轮`;
      heading.append(badge, round);
      const title = document.createElement('h3');
      title.textContent = news.title;
      const description = document.createElement('p');
      description.textContent = news.desc;
      const impacts = document.createElement('div');
      impacts.className = 'news-history-impacts';
      (news.impacts || []).forEach(impact => {
        const chip = document.createElement('span');
        chip.className = `tone-${impact.tone || 'neutral'}`;
        chip.textContent = `${impact.icon || '◆'} ${impact.label} · ${impact.detail}`;
        impacts.appendChild(chip);
      });
      article.append(heading, title, description, impacts);
      list.appendChild(article);
    });
    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'news-history-empty';
      empty.textContent = '📡 新闻中心正在等待下一条城市快讯';
      list.appendChild(empty);
    }
    overlay.querySelector('.news-history-close').onclick = () => this.close();
    overlay.onclick = event => {
      if (event.target === overlay) this.close();
    };
    this.mount(overlay);
  }
}
