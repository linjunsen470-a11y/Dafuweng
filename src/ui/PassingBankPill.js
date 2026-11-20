// A visit belongs to the player and bank captured by this movement step.
export class PassingBankPill {
  el = null;
  pending = null;
  refresh = null;

  show(playerName, visit) {
    this.hide();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'passing-bank-pill';
    btn.innerHTML = '<span aria-hidden="true">🏦</span><span class="passing-bank-label"><strong>路过富翁银行！</strong><small></small></span>';
    btn.querySelector('small').textContent = playerName + ' · 存钱 / 取钱 / 应急贷款';
    btn.onclick = async () => {
      if (this.el !== btn) return;
      const refresh = this.refresh;
      this.hide();
      const pending = visit();
      this.pending = pending;
      try {
        await pending;
        refresh?.();
      } finally {
        if (this.pending === pending) this.pending = null;
      }
    };
    (document.querySelector('.control-panel') ?? document.body).appendChild(btn);
    this.el = btn;
  }

  dockInLandDialog(actions, refresh) {
    if (!this.el) return;
    // This decision now owns the offer. Buying, passing or leaving closes both.
    actions.before(this.el);
    this.refresh = refresh;
  }

  hide() {
    this.el?.remove();
    this.el = null;
    this.refresh = null;
  }
}
