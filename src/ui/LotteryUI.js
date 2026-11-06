import { getLotteryPurchasePreview } from '../game/LotteryRules.js';

const money = value => `$${Math.max(0, Number(value) || 0).toLocaleString()}`;

export class LotteryUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  choose({ player, state }) {
    this.close();
    return new Promise(resolve => {
      let selections = [];
      const overlay = document.createElement('div');
      overlay.className = 'modal lottery-center-overlay';
      overlay.innerHTML = `
        <section class="lottery-center" role="dialog" aria-modal="true" aria-labelledby="lottery-center-title">
          <header class="lottery-center-header">
            <div><span>FORTUNE CITY LOTTERY</span><h2 id="lottery-center-title">🎰 山海城市乐透</h2><p>选择至多三组幸运号码，经济周期末统一开奖</p></div>
            <div class="lottery-jackpot"><small>本期累积奖池</small><strong></strong><em></em></div>
            <button type="button" class="close-modal lottery-close" aria-label="离开乐透中心">×</button>
          </header>
          <div class="lottery-center-body">
            <aside class="lottery-intel">
              <span>DRAW INTELLIGENCE</span><h3>本期投注情报</h3>
              <div class="lottery-intel-grid"></div>
              <div class="lottery-owned"><small>MY TICKETS</small><div></div></div>
              <button type="button" class="btn-secondary lottery-recommend">✨ 智选冷门号码</button>
            </aside>
            <section class="lottery-board">
              <div class="lottery-board-title"><div><span>01</span><h3>选择幸运号码</h3></div><p>号码越拥挤，命中后需要与更多赢家平分奖池</p></div>
              <div class="lottery-number-grid"></div>
              <div class="lottery-legend"><span><i class="is-clear"></i>无人选择</span><span><i class="is-warm"></i>已有投注</span><span><i class="is-owned"></i>本期已持有</span></div>
            </section>
          </div>
          <section class="lottery-preview" aria-live="polite">
            <div><span>投注金额</span><strong class="lottery-preview-cost"></strong></div>
            <div><span>独立中奖概率</span><strong class="lottery-preview-chance"></strong></div>
            <div><span>理论期望回报</span><strong class="lottery-preview-ev"></strong></div>
            <div class="lottery-preview-message"><span>SELECTION REVIEW</span><strong></strong></div>
          </section>
          <footer class="lottery-center-footer"><button type="button" class="btn-secondary lottery-cancel">放弃购买</button><button type="button" class="btn-primary lottery-buy"><span>确认购买乐透券</span><small></small></button></footer>
        </section>`;

      const finish = value => {
        if (!this.overlay) return;
        this.overlay = null;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 180);
        resolve(value);
      };
      const render = () => {
        const preview = getLotteryPurchasePreview(state, player, selections);
        overlay.querySelector('.lottery-jackpot strong').textContent = money(preview.pot);
        overlay.querySelector('.lottery-jackpot em').textContent = preview.roundsUntilDraw === 0 ? '本轮结束开奖' : `${preview.roundsUntilDraw} 轮后开奖`;
        overlay.querySelector('.lottery-intel-grid').innerHTML = `
          <div><small>全场票数</small><strong>${preview.totalTickets}</strong></div>
          <div><small>上期号码</small><strong>${preview.lastNumber ?? '—'}</strong></div>
          <div><small>我的现金</small><strong>${money(player.cash)}</strong></div>
          <div><small>单票价格</small><strong>${money(preview.ticketPrice)}</strong></div>`;
        overlay.querySelector('.lottery-owned div').innerHTML = preview.ownNumbers.length
          ? preview.ownNumbers.map(number => `<b>${number}</b>`).join('')
          : '<span>本期尚未持票</span>';
        overlay.querySelector('.lottery-number-grid').innerHTML = preview.numbers.map(item => {
          const selected = selections.includes(item.number);
          const crowd = item.ticketCount ? `${item.ticketCount} 张已售` : '冷门号码';
          const holders = item.holderNames.length ? item.holderNames.join('、') : '尚无人选择';
          return `<button type="button" data-number="${item.number}" class="lottery-number-button ${selected ? 'selected' : ''} ${item.owned ? 'owned' : ''}" ${item.owned ? 'disabled' : ''} aria-pressed="${selected}">
            <span>${item.number}</span><div><strong>${crowd}</strong><small>${holders}</small></div>${item.number === preview.lastNumber ? '<em>上期</em>' : ''}
          </button>`;
        }).join('');
        overlay.querySelectorAll('[data-number]').forEach(button => {
          button.onclick = () => {
            const number = Number(button.dataset.number);
            if (selections.includes(number)) selections = selections.filter(value => value !== number);
            else if (selections.length < preview.maxSelection) selections = [...selections, number];
            else {
              overlay.querySelector('.lottery-preview-message strong').textContent = `单次最多选择 ${preview.maxSelection} 个号码`;
              this.audioManager?.playDanger?.();
              return;
            }
            this.audioManager?.playClick?.();
            render();
          };
        });
        overlay.querySelector('.lottery-preview-cost').textContent = money(preview.cost);
        overlay.querySelector('.lottery-preview-chance').textContent = `${Math.round(preview.winChance * 100)}%`;
        overlay.querySelector('.lottery-preview-ev').textContent = money(preview.expectedPayout);
        const message = overlay.querySelector('.lottery-preview-message strong');
        message.textContent = !selections.length ? `可选择 1–${preview.maxSelection} 个不同号码`
          : preview.crowdedSelections.length ? `${preview.crowdedSelections.join('、')} 号已有其他投注，中奖时可能平分`
            : '当前组合均为无人持有的冷门号码';
        const buy = overlay.querySelector('.lottery-buy');
        buy.disabled = !preview.enabled;
        buy.querySelector('small').textContent = preview.enabled ? `${selections.join(' · ')} 号 · 奖池将增至 ${money(preview.projectedPot)}` : preview.reason;
      };

      overlay.querySelector('.lottery-recommend').onclick = () => {
        const preview = getLotteryPurchasePreview(state, player, []);
        const count = Math.min(preview.maxSelection, Math.floor(player.cash / preview.ticketPrice), preview.recommendedNumbers.length);
        selections = preview.recommendedNumbers.slice(0, count);
        this.audioManager?.playConfirm?.();
        render();
      };
      overlay.querySelector('.lottery-close').onclick = () => finish(null);
      overlay.querySelector('.lottery-cancel').onclick = () => finish(null);
      overlay.querySelector('.lottery-buy').onclick = () => {
        const preview = getLotteryPurchasePreview(state, player, selections);
        if (!preview.enabled) return;
        overlay.querySelector('.lottery-center').classList.add('is-purchasing');
        this.audioManager?.playCoinSound?.();
        setTimeout(() => finish([...selections]), 480);
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
