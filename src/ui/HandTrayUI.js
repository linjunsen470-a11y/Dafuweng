import { inventoryEntries } from './InventoryEntries.js';

export class HandTrayUI {
  constructor(engine, canPlay, play) {
    this.engine = engine;
    this.canPlay = canPlay;
    this.play = play;
    this.cards = document.getElementById('tray-cards');
    this.hint = document.getElementById('tray-hint');
    const toggle = document.getElementById('tray-toggle');
    toggle.onclick = () => {
      this.cards.hidden = !this.cards.hidden;
      toggle.setAttribute('aria-expanded', String(!this.cards.hidden));
      toggle.textContent = this.cards.hidden ? '手牌 ▸' : '手牌 ▾';
      this.hideHint();
    };
    const buttonAt = event => event.target.closest('button[data-key]');
    const show = button => {
      if (!button) return;
      this.hint.textContent = button.dataset.hint;
      this.hint.hidden = false;
    };
    this.cards.onpointerover = event => { if (event.pointerType === 'mouse') show(buttonAt(event)); };
    this.cards.onfocusin = event => show(buttonAt(event));
    this.cards.onfocusout = this.cards.onpointerleave = () => this.hideHint();
    this.cards.onpointerdown = event => {
      this.held = false;
      this.pressStart = event.timeStamp;
      clearTimeout(this.timer);
      const button = buttonAt(event);
      if (button && event.pointerType !== 'mouse') {
        this.timer = setTimeout(() => { this.held = true; show(button); }, 450);
      }
    };
    this.cards.onpointercancel = this.cards.onscroll = () => this.hideHint();
    this.cards.onpointerup = event => {
      clearTimeout(this.timer);
      if (event.timeStamp - this.pressStart < 450) this.held = false;
    };
    this.cards.oncontextmenu = event => event.preventDefault();
    this.cards.onclick = async event => {
      const button = buttonAt(event);
      if (!button) return;
      if (this.held && event.detail) { this.held = false; show(button); return; }
      const entry = this.entries.find(item => item.key === button.dataset.key);
      if (!entry || this.working || !this.canPlay() || !entry.presentation.enabled) { show(button); return; }
      this.hideHint();
      this.working = true;
      try { await this.play(entry); } finally { this.working = false; }
    };
  }

  hideHint() {
    clearTimeout(this.timer);
    this.hint.hidden = true;
  }

  render(player) {
    this.entries = inventoryEntries(player, this.engine);
    const canPlay = !player.isAI && !player.isBankrupt && this.engine.state.phase === 'PRE_ROLL_ACTION';
    const buttons = this.entries.map(({key, presentation: card}) => {
      const enabled = canPlay && card.enabled;
      const reason = canPlay ? card.disabledReason : '请在自己的掷骰前使用';
      const hint = enabled ? card.desc : reason;
      const button = document.createElement('button');
      button.dataset.key = key;
      button.dataset.hint = hint;
      button.setAttribute('aria-label', card.name + '，' + hint);
      button.setAttribute('aria-disabled', String(!enabled));
      button.innerHTML = `<img src="${card.cardImg}" alt=""><span>${card.name}</span>` +
        (card.ownedCount > 1 ? `<b>×${card.ownedCount}</b>` : '');
      return button;
    });
    const focused = this.cards.contains(document.activeElement) && document.activeElement.dataset.key;
    this.hideHint();
    this.cards.replaceChildren(...buttons);
    if (!buttons.length) this.cards.textContent = '手牌已用完';
    if (focused) buttons.find(button => button.dataset.key === focused)?.focus({preventScroll:true});
  }
}
