import { BANK_INTEREST_RATE, getBankTransferPreview } from '../game/BankRules.js';

const money = value => `$${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString()}`;

export class BankUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.overlay = null;
  }

  choose({ player, state, passing = false }) {
    this.close();
    return new Promise(resolve => {
      let direction = player.cash > 0 ? 'DEPOSIT' : 'WITHDRAW';
      let amount = Math.floor((direction === 'DEPOSIT' ? player.cash : player.deposit || 0) * 0.25);
      const overlay = document.createElement('div');
      overlay.className = 'modal bank-center-overlay';
      overlay.innerHTML = `
        <section class="bank-center" role="dialog" aria-modal="true" aria-labelledby="bank-center-title">
          <header class="bank-center-header">
            <div><span>${passing ? '🚶 路过银行 · 快速柜台' : '🏦 大富翁银行柜台'}</span><h2 id="bank-center-title">🏦 富翁银行营业厅</h2><p>存钱领利息、取现买豪宅，手紧还能办应急贷款！</p></div>
            <div class="bank-rate"><small>每期活期利息</small><strong>${Math.round(BANK_INTEREST_RATE * 100)}%</strong><em>每 5 轮自动派息</em></div>
            <button type="button" class="close-modal bank-close" aria-label="离开银行">×</button>
          </header>
          <div class="bank-balance-strip">
            <article class="bank-balance-card cash"><span>💵</span><div><small>手头现金</small><strong class="bank-cash-before"></strong><em class="bank-cash-after"></em></div></article>
            <i>⇄</i>
            <article class="bank-balance-card deposit"><span>🏛️</span><div><small>银行存款</small><strong class="bank-deposit-before"></strong><em class="bank-deposit-after"></em></div></article>
            <article class="bank-total-card"><small>已借贷款</small><strong class="bank-loan-before"></strong><span class="bank-liquid-total"></span></article>
          </div>
          <div class="bank-center-body">
            <section class="bank-transfer-panel">
              <div class="bank-section-title"><span>1</span><div><small>柜台业务</small><h3>选择要办理的业务</h3></div></div>
              <div class="bank-direction-tabs" role="tablist">
                <button type="button" data-direction="DEPOSIT">💰 存钱</button>
                <button type="button" data-direction="WITHDRAW">💵 取钱</button>
                <button type="button" data-direction="LOAN">🆘 贷款</button>
                <button type="button" data-direction="REPAY_LOAN">✅ 还款</button>
              </div>
              <div class="bank-amount-display"><span>本次金额</span><label><b>$</b><input type="number" min="0" step="100" aria-label="银行转账金额"></label><small class="bank-source-balance"></small></div>
              <input class="bank-amount-range" type="range" min="0" step="100" aria-label="调整银行转账金额">
              <div class="bank-presets">${[0.25, 0.5, 0.75, 1].map(ratio => `<button type="button" data-ratio="${ratio}">${ratio === 1 ? '全部' : `${ratio * 100}%`}</button>`).join('')}</div>
            </section>
            <section class="bank-forecast-panel">
              <div class="bank-section-title"><span>2</span><div><small>柜员小贴士</small><h3>下期利息与资金安全</h3></div></div>
              <div class="bank-yield-orbit"><span>预计派息</span><strong class="bank-interest"></strong><em class="bank-interest-delta"></em></div>
              <div class="bank-forecast-grid"><div><small>下次结息</small><strong class="bank-settlement"></strong></div><div><small>结息后存款</small><strong class="bank-after-interest"></strong></div></div>
              <div class="bank-risk"><span></span><div><strong></strong><small></small></div></div>
            </section>
          </div>
          <footer class="bank-center-footer"><button type="button" class="btn-secondary bank-cancel">${passing ? '直接路过' : '暂不办理'}</button><button type="button" class="btn-primary bank-confirm"><span></span><small></small></button></footer>
        </section>`;

      const numberInput = overlay.querySelector('.bank-amount-display input');
      const rangeInput = overlay.querySelector('.bank-amount-range');
      const finish = value => {
        if (this.overlay !== overlay) return;
        this.cancel = null;
        this.overlay = null;
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.remove(), 180);
        resolve(value);
      };
      const render = () => {
        const preview = getBankTransferPreview(state, player, direction, amount);
        const source = preview.sourceBalance;
        amount = Math.min(Math.max(0, Math.floor(Number(amount) || 0)), source);
        const current = getBankTransferPreview(state, player, direction, amount);
        numberInput.max = String(source);
        numberInput.value = String(amount);
        rangeInput.max = String(source);
        rangeInput.value = String(amount);
        overlay.querySelectorAll('[data-direction]').forEach(button => {
          button.classList.toggle('selected', button.dataset.direction === direction);
          if (button.dataset.direction === 'REPAY_LOAN') button.disabled = (player.loan || 0) <= 0;
        });
        const sourceLabel = direction === 'DEPOSIT' ? '可存现金'
          : direction === 'WITHDRAW' ? '可取存款'
            : direction === 'LOAN' ? '可贷额度' : '可还贷款';
        overlay.querySelector('.bank-source-balance').textContent = `${sourceLabel} ${money(source)}`;
        overlay.querySelector('.bank-cash-before').textContent = money(current.cash);
        overlay.querySelector('.bank-deposit-before').textContent = money(current.deposit);
        overlay.querySelector('.bank-loan-before').textContent = money(current.loan);
        const cashAfter = overlay.querySelector('.bank-cash-after');
        const depositAfter = overlay.querySelector('.bank-deposit-after');
        cashAfter.textContent = amount ? `→ ${money(current.cashAfter)}` : '';
        depositAfter.textContent = amount && current.depositAfter !== current.deposit ? `→ ${money(current.depositAfter)}` : '';
        cashAfter.className = `bank-cash-after ${current.cashAfter < current.cash ? 'down' : 'up'}`;
        depositAfter.className = `bank-deposit-after ${current.depositAfter < current.deposit ? 'down' : 'up'}`;
        overlay.querySelector('.bank-liquid-total').textContent = `流动资金 ${money(current.liquidTotal)}`;
        overlay.querySelector('.bank-interest').textContent = money(current.projectedInterest);
        const delta = overlay.querySelector('.bank-interest-delta');
        delta.textContent = `${current.interestDelta >= 0 ? '+' : '−'}${money(Math.abs(current.interestDelta))} 利息变化`;
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
        const actionLabels = { DEPOSIT: '确认存入银行', WITHDRAW: '确认取出现金', LOAN: '立即领取贷款', REPAY_LOAN: '确认偿还贷款' };
        confirm.querySelector('span').textContent = actionLabels[direction] || '确认办理';
        confirm.querySelector('small').textContent = current.enabled ? `${money(current.amount)} · 办完手头现金 ${money(current.cashAfter)}` : current.reason;
      };

      overlay.querySelectorAll('[data-direction]').forEach(button => {
        button.onclick = () => {
          direction = button.dataset.direction;
          const preview = getBankTransferPreview(state, player, direction, 0);
          amount = Math.floor(preview.sourceBalance * (direction === 'LOAN' ? 0.5 : 0.25));
          this.audioManager?.playClick?.();
          render();
        };
      });
      overlay.querySelectorAll('[data-ratio]').forEach(button => {
        button.onclick = () => {
          const preview = getBankTransferPreview(state, player, direction, 0);
          amount = Math.floor(preview.sourceBalance * Number(button.dataset.ratio));
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
        const counter = overlay.querySelector('.bank-center');
        if (counter.inert) return;
        counter.inert = true;
        counter.classList.add('is-transferring');
        const decision = { direction, amount: preview.effectiveAmount };
        this.audioManager?.playCoinSound?.(preview.effectiveAmount);
        setTimeout(() => finish(decision), 220);
      };
      overlay.onclick = event => { if (event.target === overlay) finish(null); };

      document.body.appendChild(overlay);
      this.overlay = overlay;
      this.cancel = () => finish(null);
      render();
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
    });
  }

  close() {
    const overlay = this.overlay;
    this.cancel?.();
    overlay?.remove();
  }
}
