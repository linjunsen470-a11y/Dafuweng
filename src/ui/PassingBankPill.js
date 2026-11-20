// Non-blocking Richman-4 "Passed Bank" quick-counter button so players can
// deposit, withdraw, or take an emergency loan right after walking past a bank.
export class PassingBankPill {
  constructor(onOpen) {
    this.onOpen = onOpen;
    this.el = null;
    this.timer = null;
  }

  show(playerName) {
    this.hide();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'passing-bank-pill';
    btn.innerHTML = `<span>🏦</span><div><strong>路过富翁银行！</strong><small>${playerName} · 点此存钱 / 取钱 / 应急贷款</small></div>`;
    btn.onclick = () => {
      this.hide();
      this.onOpen?.();
    };
    document.body.appendChild(btn);
    this.el = btn;
    this.timer = setTimeout(() => this.hide(), 9000);
  }

  hide() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.el?.remove();
    this.el = null;
  }
}
