import { getMinimumAuctionBid } from '../game/AuctionRules.js';

const money = value => `$${Math.max(0, Number(value || 0)).toLocaleString()}`;

export class AuctionUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.activeOverlay = null;
    this.activeCancel = null;
  }

  close(resolveValue = 0) {
    const cancel = this.activeCancel;
    this.activeCancel = null;
    this.activeOverlay?.remove();
    this.activeOverlay = null;
    cancel?.(resolveValue);
  }

  createView({ auction, tile, property, bidder, players }, mode = 'BID') {
    const overlay = document.createElement('div');
    overlay.className = 'modal auction-overlay';
    overlay.dataset.auctionMode = mode;
    overlay.innerHTML = `
      <div class="auction-hall" role="dialog" aria-modal="true" aria-labelledby="auction-title">
        <header class="auction-header">
          <div><span class="auction-kicker">FORTUNE ESTATE AUCTION</span><h2 id="auction-title">🔨 城市地产拍卖会</h2></div>
          <div class="auction-round"><span>竞价轮次</span><strong></strong></div>
        </header>
        <div class="auction-main">
          <section class="auction-property-card">
            <span class="auction-lot-number"></span>
            <div class="auction-property-icon"></div>
            <span class="auction-property-zone"></span>
            <h3></h3>
            <p class="auction-property-description"></p>
            <div class="auction-property-stats">
              <div><span>基础地价</span><strong class="auction-base-price"></strong></div>
              <div><span>建筑等级</span><strong class="auction-level"></strong></div>
              <div><span>拍卖性质</span><strong class="auction-kind"></strong></div>
            </div>
          </section>
          <section class="auction-bidding-panel">
            <div class="auction-current-bid"><span>当前最高价</span><strong></strong><small></small></div>
            <div class="auction-bidders" aria-label="竞拍玩家"></div>
            <div class="auction-status-line" aria-live="polite"></div>
            <div class="auction-history" aria-label="竞价记录"></div>
            <div class="auction-controls"></div>
          </section>
        </div>
      </div>
    `;
    overlay.querySelector('.auction-round strong').textContent = String(auction.biddingRound || 1);
    overlay.querySelector('.auction-lot-number').textContent = `LOT ${String(auction.tileId).padStart(3, '0')}`;
    overlay.querySelector('.auction-property-icon').textContent = tile.icon || (property?.buildingType === 'HOTEL' ? '🏨' : '🏙️');
    overlay.querySelector('.auction-property-zone').textContent = tile.group ? `${tile.group} DISTRICT` : 'CITY PROPERTY';
    overlay.querySelector('.auction-property-card h3').textContent = tile.name;
    overlay.querySelector('.auction-property-description').textContent = tile.desc || '城市核心资产，竞得后立即完成产权交割。';
    overlay.querySelector('.auction-base-price').textContent = money(tile.price);
    overlay.querySelector('.auction-level').textContent = `LV ${property?.level || 0}`;
    overlay.querySelector('.auction-kind').textContent = auction.bankruptcy ? '司法清算' : '公开委托';
    overlay.querySelector('.auction-current-bid strong').textContent = money(auction.highestBid);
    const leader = players.find(player => player.id === auction.highestBidderId);
    overlay.querySelector('.auction-current-bid small').textContent = leader ? `领先：${leader.name}` : `起拍价 ${money(auction.minimumBid)}`;

    const bidderHost = overlay.querySelector('.auction-bidders');
    auction.bidderOrder.forEach(playerId => {
      const player = players.find(item => item.id === playerId);
      if (!player) return;
      const card = document.createElement('div');
      card.className = `auction-bidder ${player.id === bidder?.id ? 'is-current' : ''} ${player.id === auction.highestBidderId ? 'is-leading' : ''} ${auction.passedBidderIds?.includes(player.id) ? 'has-passed' : ''}`;
      card.style.setProperty('--bidder-color', player.color || '#67e8f9');
      const avatar = document.createElement('span');
      avatar.className = 'auction-bidder-avatar';
      if (player.avatarAtlas) {
        avatar.style.backgroundImage = `url('${player.avatarAtlas}')`;
        avatar.style.backgroundPosition = player.avatarPosition || '0% 0%';
      } else if (player.avatarImg) {
        avatar.style.backgroundImage = `url('${player.avatarImg}')`;
        avatar.style.backgroundPosition = 'center';
        avatar.style.backgroundSize = 'cover';
      } else avatar.textContent = player.avatar || '🎩';
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = player.name;
      const state = document.createElement('span');
      state.textContent = auction.passedBidderIds?.includes(player.id) ? '已退出' : player.id === auction.highestBidderId ? '最高出价' : money(player.cash);
      copy.append(name, state);
      card.append(avatar, copy);
      bidderHost.appendChild(card);
    });

    const history = overlay.querySelector('.auction-history');
    const records = (auction.bidHistory || []).slice(-7).reverse();
    records.forEach(record => {
      const row = document.createElement('div');
      const player = players.find(item => item.id === record.playerId);
      const label = document.createElement('span');
      label.textContent = `R${record.round} · ${player?.name || '竞拍者'}`;
      const action = document.createElement('strong');
      action.textContent = record.action === 'BID' ? money(record.amount) : record.action === 'AUTO_PASS' ? '资金不足' : '放弃竞拍';
      row.className = record.action === 'BID' ? 'is-bid' : 'is-pass';
      row.append(label, action);
      history.appendChild(row);
    });
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'auction-history-empty';
      empty.textContent = '等待第一声落槌报价';
      history.appendChild(empty);
    }
    return overlay;
  }

  mount(overlay) {
    this.close();
    this.activeOverlay = overlay;
    document.body.appendChild(overlay);
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
  }

  chooseBid(context) {
    return new Promise(resolve => {
      const overlay = this.createView(context, 'BID');
      const { auction, bidder, tile } = context;
      const minimum = getMinimumAuctionBid(auction);
      const controls = overlay.querySelector('.auction-controls');
      const status = overlay.querySelector('.auction-status-line');
      status.textContent = `${bidder.name} 正在决策 · 可用现金 ${money(bidder.cash)}`;

      const finish = amount => {
        this.activeCancel = null;
        this.activeOverlay = null;
        overlay.remove();
        this.audioManager?.playClick();
        resolve(amount);
      };
      const pass = document.createElement('button');
      pass.type = 'button';
      pass.className = 'auction-pass-button';
      pass.textContent = '放弃竞拍';
      pass.onclick = () => finish(0);
      controls.appendChild(pass);

      const increments = [0, Math.max(200, Math.round(Number(tile.price || minimum) * 0.1 / 100) * 100), Math.max(500, Math.round(Number(tile.price || minimum) * 0.25 / 100) * 100)];
      [...new Set(increments.map(increment => minimum + increment))]
        .filter(amount => amount <= bidder.cash)
        .forEach((amount, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = index === 0 ? 'auction-bid-button is-primary' : 'auction-bid-button';
          button.innerHTML = `<span>${index === 0 ? '最低加价' : '主动抬价'}</span><strong>${money(amount)}</strong>`;
          button.onclick = () => finish(amount);
          controls.appendChild(button);
        });

      const custom = document.createElement('form');
      custom.className = 'auction-custom-bid';
      custom.innerHTML = `<label>自定义出价 <input type="number" step="100" min="${minimum}" max="${bidder.cash}" value="${minimum}"></label><button type="submit">确认报价</button>`;
      custom.onsubmit = event => {
        event.preventDefault();
        const amount = Number(custom.querySelector('input').value);
        if (amount < minimum || amount > bidder.cash || amount % 100 !== 0) {
          status.textContent = `请输入 ${money(minimum)} 至 ${money(bidder.cash)} 的整百报价`;
          status.classList.add('is-error');
          return;
        }
        finish(amount);
      };
      controls.appendChild(custom);
      this.mount(overlay);
      this.activeCancel = value => {
        this.activeOverlay = null;
        overlay.remove();
        resolve(value);
      };
    });
  }

  async showAIBid(context, amount, speed = 1) {
    const overlay = this.createView(context, 'AI');
    const status = overlay.querySelector('.auction-status-line');
    status.textContent = `${context.bidder.name} 正在评估地价与现金储备…`;
    const controls = overlay.querySelector('.auction-controls');
    const verdict = document.createElement('div');
    verdict.className = 'auction-ai-verdict';
    verdict.textContent = 'AI VALUATION IN PROGRESS';
    controls.appendChild(verdict);
    this.mount(overlay);
    await new Promise(resolve => setTimeout(resolve, Math.round(420 / Math.max(.5, speed))));
    status.textContent = amount ? `${context.bidder.name} 举牌出价 ${money(amount)}` : `${context.bidder.name} 选择退出竞拍`;
    verdict.textContent = amount ? `🔨 ${money(amount)}` : '✋ PASS';
    verdict.classList.add(amount ? 'is-bid' : 'is-pass');
    await new Promise(resolve => setTimeout(resolve, Math.round(360 / Math.max(.5, speed))));
    this.close();
  }

  async showResult(auction, tile, players, speed = 1, property = null) {
    const winner = players.find(player => player.id === auction.highestBidderId);
    const context = { auction, tile, property, bidder: winner, players };
    const overlay = this.createView(context, 'RESULT');
    const status = overlay.querySelector('.auction-status-line');
    status.textContent = winner ? `落槌成交 · ${winner.name} 获得产权` : '拍卖结束 · 本标的流拍';
    const controls = overlay.querySelector('.auction-controls');
    const result = document.createElement('div');
    result.className = `auction-result ${winner ? 'is-sold' : 'is-cancelled'}`;
    const resultLabel = document.createElement('span');
    const resultValue = document.createElement('strong');
    const resultDetail = document.createElement('small');
    resultLabel.textContent = winner ? '🎉 SOLD' : '流拍';
    resultValue.textContent = winner ? money(auction.highestBid) : 'NO BID';
    resultDetail.textContent = winner
      ? `${winner.name} · ${auction.bidHistory.length} 次竞价动作`
      : '无人达到最低成交条件';
    result.append(resultLabel, resultValue, resultDetail);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn-primary';
    close.textContent = '确认结果';
    controls.append(result, close);
    this.mount(overlay);
    await new Promise(resolve => {
      const timer = setTimeout(resolve, Math.round(1350 / Math.max(.5, speed)));
      close.onclick = () => { clearTimeout(timer); resolve(); };
    });
    this.close();
  }
}
