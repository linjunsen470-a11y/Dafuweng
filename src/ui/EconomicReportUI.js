import { createImpactCard } from './NewsUI.js';
import { getEconomicReportHeadline } from '../game/EconomicReportRules.js';

const money = value => `${Number(value) < 0 ? '−' : ''}$${Math.abs(Math.round(Number(value) || 0)).toLocaleString()}`;

function sparkline(values = []) {
  if (values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values.map((value, index) => `${Math.round(index / (values.length - 1) * 72)},${Math.round(26 - (value - min) / spread * 22)}`).join(' ');
  return `<svg viewBox="0 0 72 30" aria-hidden="true"><polyline points="${points}"/></svg>`;
}

function avatarMarkup(player) {
  if (player.avatarAtlas) {
    return `<span class="economic-player-avatar" role="img" aria-label="${player.name}" style="background-image:url('${player.avatarAtlas}');background-position:${player.avatarPosition || '0% 0%'}"></span>`;
  }
  return `<span class="economic-player-avatar" role="img" aria-label="${player.name}">${player.avatar || '🎩'}</span>`;
}

export class EconomicReportUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  show(report, newsHistory = []) {
    if (!report) return;
    this.close();
    const headline = getEconomicReportHeadline(report);
    const lottery = report.lottery || {};
    const overlay = document.createElement('div');
    overlay.className = 'modal economic-report-overlay';
    overlay.innerHTML = `
      <section class="economic-report" role="dialog" aria-modal="true" aria-labelledby="economic-report-title">
        <header class="economic-report-header">
          <div><span>FORTUNE CITY · PERIOD ${report.period}</span><h2 id="economic-report-title">🧾 城市经济周期财报</h2><p>第 ${report.round} 轮结算 · 物价指数 ${Number(report.priceIndex || 1).toFixed(1)}x</p></div>
          <button type="button" class="close-modal economic-report-close" aria-label="关闭周期财报">×</button>
        </header>
        <div class="economic-report-body">
          <section class="economic-report-hero">
            <div class="economic-headline-icon">${headline.icon}</div>
            <div><span>本期焦点</span><h3>${headline.title}</h3><p>${headline.detail}</p></div>
            <div class="economic-total"><span>全体资金净流量</span><strong class="${report.totals.playerGain >= 0 ? 'gain' : 'loss'}">${money(report.totals.playerGain)}</strong></div>
          </section>
          <div class="economic-report-grid">
            <section class="economic-panel economic-player-panel">
              <div class="economic-panel-title"><div><span>PLAYER INCOME</span><h3>玩家周期收益榜</h3></div><em>利息 ${money(report.totals.interest)} · 分红池 ${money(report.totals.dividends)}</em></div>
              <div class="economic-player-list"></div>
            </section>
            <div class="economic-side-column">
              <section class="economic-panel economic-lottery-panel">
                <div class="lottery-number"><span>本期开奖号码</span><strong>${lottery.number ?? '—'}</strong></div>
                <div><span>🎰 城市乐透</span><h3>${lottery.rollover ? '本期无人命中' : `${lottery.winnerNames?.join('、')} 喜提大奖`}</h3><p>${lottery.rollover ? `奖池累积至 ${money(lottery.potAfter)}` : `每位赢家获得 ${money(lottery.prize)}`}</p></div>
              </section>
              <section class="economic-panel economic-market-panel">
                <div class="economic-panel-title"><div><span>MARKET PULSE</span><h3>市场脉搏</h3></div></div>
                <div class="economic-stock-list"></div>
              </section>
            </div>
          </div>
          <section class="economic-panel economic-company-panel">
            <div class="economic-panel-title"><div><span>CORPORATE RESULTS</span><h3>公司经营与股东回报</h3></div><em>按分红规模排序</em></div>
            <div class="economic-company-list"></div>
          </section>
        </div>
        <footer class="economic-report-footer"><span>财报已存入顶部菜单，可随时回看</span><button type="button" class="btn-primary economic-report-continue">继续财富竞逐</button></footer>
      </section>
    `;

    const playerList = overlay.querySelector('.economic-player-list');
    report.players.forEach((player, index) => {
      const row = document.createElement('article');
      row.className = `economic-player-row ${index === 0 ? 'is-leader' : ''} ${player.isBankrupt ? 'is-bankrupt' : ''}`;
      row.style.setProperty('--player-color', player.color || '#67e8f9');
      row.innerHTML = `
        <b class="economic-rank">${index + 1}</b>${avatarMarkup(player)}
        <div class="economic-player-name"><strong>${player.name}</strong><span>现金 ${money(player.cash)} · 存款 ${money(player.deposit)}</span></div>
        <div class="economic-income-breakdown"><span>利息 <b>${money(player.interest)}</b></span><span>分红 <b>${money(player.dividend)}</b></span>${player.pointsDelta ? `<span>点券 <b>+${player.pointsDelta}</b></span>` : ''}</div>
        <strong class="economic-player-gain ${player.cycleGain >= 0 ? 'gain' : 'loss'}">${player.cycleGain >= 0 ? '+' : '−'}$${Math.abs(player.cycleGain).toLocaleString()}</strong>
      `;
      playerList.appendChild(row);
    });

    const stockList = overlay.querySelector('.economic-stock-list');
    report.stocks.forEach(stock => {
      const row = document.createElement('div');
      row.className = `economic-stock-row ${stock.change >= 0 ? 'up' : 'down'}`;
      row.innerHTML = `<div><strong>${stock.name}</strong><span>${stock.code} · $${stock.price}</span></div>${sparkline(stock.history)}<b>${stock.change >= 0 ? '+' : ''}${stock.change}%</b>`;
      stockList.appendChild(row);
    });

    const companyList = overlay.querySelector('.economic-company-list');
    report.companies.forEach(company => {
      const card = document.createElement('article');
      card.className = `economic-company-card ${company.operation >= 0 ? 'profitable' : 'loss-making'}`;
      card.innerHTML = `<span>${company.icon}</span><div><strong>${company.name}</strong><small>${company.policyId ? `完成政策 · ${company.policyId}` : '常规经营'}</small></div><div><small>经营损益</small><b>${company.operation >= 0 ? '+' : '−'}$${Math.abs(company.operation).toLocaleString()}</b></div><div><small>股东分红</small><b>${money(company.dividendPool)}</b></div>`;
      companyList.appendChild(card);
    });

    const close = () => this.close();
    overlay.querySelector('.economic-report-close').onclick = close;
    overlay.querySelector('.economic-report-continue').onclick = close;
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.reportRound = report.round;
    newsHistory.filter(news => news.round === report.round).forEach(news => this.appendNews(news));
    this.audioManager?.playSFX?.('confirm');
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  // Both events have already settled. Combine only the currently open, same-round
  // report; an unrelated later headline still receives its normal news display.
  appendNews(news) {
    if (!news || !this.overlay || news.round !== this.reportRound) return false;
    let section = this.overlay.querySelector('.economic-round-news');
    if (!section) {
      section = document.createElement('section');
      section.className = 'economic-panel economic-round-news';
      const heading = document.createElement('h3');
      heading.textContent = `第 ${news.round} 轮城市新闻 · 结算后生效`;
      section.appendChild(heading);
      this.overlay.querySelector('.economic-report-body').prepend(section);
    }
    const article = document.createElement('article');
    const title = document.createElement('h4');
    title.textContent = `${news.icon || '📰'} ${news.category || '快讯'} · ${news.title}`;
    const description = document.createElement('p');
    description.textContent = news.desc;
    const impacts = document.createElement('div');
    impacts.className = 'news-impact-grid';
    (news.impacts || []).forEach(impact => impacts.appendChild(createImpactCard(impact)));
    article.append(title, description, impacts);
    section.appendChild(article);
    return true;
  }

  close() {
    if (!this.overlay) return;
    const overlay = this.overlay;
    this.overlay = null;
    this.reportRound = null;
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 180);
  }
}
