import { BANK_INTEREST_RATE, getBankTransferPreview } from '../game/BankRules.js';

const money = value => `$${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString()}`;

export class BankUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  choose({ player, state }) {
    this.close();
    return new Promise(resolve => {
      let direction = player.cash > 0 ? 'DEPOSIT' : 'WITHDRAW';
      let amount = Math.floor((direction === 'DEPOSIT' ? player.cash : player.deposit || 0) * 0.25);
      const overlay = document.createElement('div');
      overlay.className = 'modal bank-center-overlay';
      overlay.innerHTML = `
        <section class="bank-center" role="dialog" aria-modal="true" aria-labelledby="bank-center-title">
          <header class="bank-center-header">
            <div><span>FORTUNE CAPITAL BANK</span><h2 id="bank-center-title">🏦 山海资产管理中心</h2><p>在流动现金与定期存款之间调配资金</p></div>
            <div class="bank-rate"><small>周期存款利率</small><strong>${Math.round(BANK_INTEREST_RATE * 100)}%</strong><em>每期复利结算</em></div>
            <button type="button" class="close-modal bank-close" aria-label="离开银行">×</button>
          </header>
          <div class="bank-balance-strip">
            <article class="bank-balance-card cash"><span>💵</span><div><small>可用现金</small><strong class="bank-cash-before"></strong><em class="bank-cash-after"></em></div></article>
            <i>⇄</i>
            <article class="bank-balance-card deposit"><span>🏛️</span><div><small>定期存款</small><strong class="bank-deposit-before"></strong><em class="bank-deposit-after"></em></div></article>
            <article class="bank-total-card"><small>流动资产合计</small><strong class="bank-liquid-total"></strong><span>转账不改变净资产</span></article>
          </div>
          <div class="bank-center-body">
            <section class="bank-transfer-panel">
              <div class="bank-section-title"><span>01</span><div><small>TRANSFER DESK</small><h3>选择资金方向与金额</h3></div></div>
              <div class="bank-direction-tabs" role="tablist"><button type="button" data-direction="DEPOSIT">存入定期账户</button><button type="button" data-direction="WITHDRAW">取回可用现金</button></div>
              <div class="bank-amount-display"><span>本次操作金额</span><label><b>$</b><input type="number" min="0" step="100" aria-label="银行转账金额"></label><small class="bank-source-balance"></small></div>
              <input class="bank-amount-range" type="range" min="0" step="100" aria-label="调整银行转账金额">
              <div class="bank-presets">${[.25,.5,.75,1].map(ratio => `<button type="button" data-ratio="${ratio}">${ratio === 1 ? '全部' : `${ratio * 100}%`}</button>`).join('')}</div>
            </section>
            <section class="bank-forecast-panel">
              <div class="bank-section-title"><span>02</span><div><small>YIELD FORECAST</small><h3>下一期收益预测</h3></div></div>
              <div class="bank-yield-orbit"><span>预计利息</span><strong class="bank-interest"></strong><em class="bank-interest-delta"></em></div>
              <div class="bank-forecast-grid"><div><small>结息时间</small><strong class="bank-settlement"></strong></div><div><small>结息后存款</small><strong class="bank-after-interest"></strong></div></div>
              <div class="bank-risk"><span></span><div><strong></strong><small></small></div></div>
            </section>
          </div>
          <footer class="bank-center-footer"><button type="button" class="btn-secondary bank-cancel">暂不调整</button><button type="button" class="btn-primary bank-confirm"><span></span><small></small></button></footer>
        </section>`;

      const numberInput = overlay.querySelector('.bank-amount-display input');
      const rangeInput = overlay.querySelector('.bank-amount-range');
      const finish = value => {
        if (!this.overlay) return;
        this.overlay = null;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 180);
        resolve(value);
      };
      const render = () => {
        const preview = getBankTransferPreview(state, player, direction, amount);
        const source = direction === 'DEPOSIT' ? preview.cash : preview.deposit;
        amount = Math.min(Math.max(0, Math.floor(Number(amount) || 0)), source);
        const current = getBankTransferPreview(state, player, direction, amount);
        numberInput.max = String(source);
        numberInput.value = String(amount);
        rangeInput.max = String(source);
        rangeInput.value = String(amount);
        overlay.querySelectorAll('[data-direction]').forEach(button => button.classList.toggle('selected', button.dataset.direction === direction));
        overlay.querySelector('.bank-source-balance').textContent = `${direction === 'DEPOSIT' ? '现金' : '存款'}可调配余额 ${money(source)}`;
        overlay.querySelector('.bank-cash-before').textContent = money(current.cash);
        overlay.querySelector('.bank-deposit-before').textContent = money(current.deposit);
        const cashAfter = overlay.querySelector('.bank-cash-after');
        const depositAfter = overlay.querySelector('.bank-deposit-after');
        cashAfter.textContent = amount ? `→ ${money(current.cashAfter)}` : '';
        depositAfter.textContent = amount ? `→ ${money(current.depositAfter)}` : '';
        cashAfter.className = `bank-cash-after ${current.cashAfter < current.cash ? 'down' : 'up'}`;
        depositAfter.className = `bank-deposit-after ${current.depositAfter < current.deposit ? 'down' : 'up'}`;
        overlay.querySelector('.bank-liquid-total').textContent = money(current.liquidTotal);
        overlay.querySelector('.bank-interest').textContent = money(current.projectedInterest);
        const delta = overlay.querySelector('.bank-interest-delta');
        delta.textContent = `${current.interestDelta >= 0 ? '+' : '−'}${money(Math.abs(current.interestDelta))} 较当前方案`;
        delta.className = `bank-interest-delta ${current.interestDelta >= 0 ? 'positive' : 'negative'}`;
        overlay.querySelector('.bank-settlement').textContent = current.roundsUntilSettlement === 0 ? '本轮结束' : `${current.roundsUntilSettlement} 轮后`;
        overlay.querySelector('.bank-after-interest').textContent = money(current.depositAfter + current.projectedInterest);
        const risk = overlay.querySelector('.bank-risk');
        risk.className = `bank-risk risk-${current.risk.id.toLowerCase()}`;
        risk.querySelector('span').textContent = current.risk.icon;
        risk.querySelector('strong').textContent = current.risk.label;
        risk.querySelector('small').textContent = current.risk.description;
        const confirm = overlay.querySelector('.bank-confirm');
        confirm.disabled = !current.enabled;
        confirm.querySelector('span').textContent = direction === 'DEPOSIT' ? '确认存入定期账户' : '确认取回可用现金';
        confirm.querySelector('small').textContent = current.enabled ? `${money(current.amount)} · 操作后现金 ${money(current.cashAfter)}` : current.reason;
      };

      overlay.querySelectorAll('[data-direction]').forEach(button => {
        button.onclick = () => {
          direction = button.dataset.direction;
          const source = direction === 'DEPOSIT' ? player.cash : player.deposit || 0;
          amount = Math.floor(source * 0.25);
          this.audioManager?.playClick?.();
          render();
        };
      });
      overlay.querySelectorAll('[data-ratio]').forEach(button => {
        button.onclick = () => {
          const source = direction === 'DEPOSIT' ? player.cash : player.deposit || 0;
          amount = Math.floor(source * Number(button.dataset.ratio));
          this.audioManager?.playClick?.();
          render();
        };
      });
      numberInput.oninput = () => { amount = Number(numberInput.value); render(); };
      rangeInput.oninput = () => { amount = Number(rangeInput.value); render(); };
      overlay.querySelector('.bank-close').onclick = () => finish(null);
      overlay.querySelector('.bank-cancel').onclick = () => finish(null);
      overlay.querySelector('.bank-confirm').onclick = () => {
        const preview = getBankTransferPreview(state, player, direction, amount);
        if (!preview.enabled) return;
        overlay.querySelector('.bank-center').classList.add('is-transferring');
        this.audioManager?.playCoinSound?.();
        setTimeout(() => finish({ direction, amount: preview.amount }), 450);
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
