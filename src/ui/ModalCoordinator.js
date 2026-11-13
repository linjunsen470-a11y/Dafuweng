/** Coordinates existing dialogs without bypassing their game-specific callbacks. */
export class ModalCoordinator {
  constructor(root = document.body) {
    this.root = root;
    this.stack = [];
    this.returnFocus = new WeakMap();
    this.onKeydown = this.onKeydown.bind(this);
    document.addEventListener('keydown', this.onKeydown, true);
    this.observer = new MutationObserver(() => this.sync());
    this.observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    this.sync();
  }

  get active() { return this.stack.at(-1) || null; }

  sync() {
    const visible = [...this.root.querySelectorAll('.modal:not(.hidden)')];
    const oldTop = this.active;
    this.stack = this.stack.filter(modal => visible.includes(modal));
    for (const modal of visible) {
      if (!this.stack.includes(modal)) {
        this.returnFocus.set(modal, document.activeElement);
        this.stack.push(modal);
      }
    }
    const top = this.active;
    for (const modal of this.root.querySelectorAll('.modal')) {
      const foreground = modal === top;
      modal.inert = !foreground;
      modal.style.visibility = !modal.classList.contains('hidden') && !foreground ? 'hidden' : '';
      modal.style.zIndex = foreground ? '1000' : '';
      const box = modal.querySelector('.modal-box') || modal;
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', foreground ? 'true' : 'false');
      if (!box.hasAttribute('aria-label') && !box.hasAttribute('aria-labelledby')) {
        box.setAttribute('aria-label', modal.querySelector('h2, h3')?.textContent || '游戏对话框');
      }
    }
    for (const id of ['hud-layer', 'game-container', 'setup-screen']) {
      const element = document.getElementById(id);
      if (element) element.inert = !!top;
    }
    if (top !== oldTop) {
      if (top) {
        const target = this.focusable(top)[0] || top.querySelector('.modal-box') || top;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      } else {
        const target = this.returnFocus.get(oldTop);
        if (target?.isConnected && !target.closest('.hidden')) target.focus({ preventScroll: true });
      }
    }
  }

  focusable(modal) {
    return [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')]
      .filter(element => !element.closest('.hidden') && element.getClientRects().length);
  }

  onKeydown(event) {
    const top = this.active;
    if (!top) return;
    if (event.key === 'Escape') {
      // Mandatory choices are never silently dismissed or resolved.
      const close = top.querySelector('.close-modal, #btn-resume-game');
      if (close && !close.disabled) close.click();
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.key === 'Tab') {
      const items = this.focusable(top);
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
  }
}
