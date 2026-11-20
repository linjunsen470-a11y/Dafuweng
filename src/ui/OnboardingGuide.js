const steps = [
  ['#btn-roll', '掷骰前可以先出牌。准备好后，点「掷骰子」出发。'],
  ['#tray-toggle', '点手牌即可发动，长按可查看效果。更多牌在「全部卡包」。'],
  ['#players-list', '点玩家卡可以找到棋子，也能查看现金、存款和点券。']
];
const key = 'fortune-empire:tutorial-seen';

export class OnboardingGuide {
  start() {
    try { if (this.seen || localStorage.getItem(key)) return; } catch {}
    this.seen = true;
    try { localStorage.setItem(key, '1'); } catch {}
    this.bubble = document.createElement('aside');
    this.bubble.className = 'onboarding-guide';
    this.bubble.setAttribute('aria-label', '新手提示');
    this.bubble.innerHTML = '<p aria-live="polite"></p><button data-skip>跳过</button><button data-next></button>';
    document.body.append(this.bubble);
    let index = 0;
    const show = () => {
      this.anchor?.classList.remove('guide-target');
      this.anchor = document.querySelector(steps[index][0]);
      this.anchor.classList.add('guide-target');
      this.bubble.querySelector('p').textContent = (index + 1) + ' / 3　' + steps[index][1];
      this.bubble.querySelector('[data-next]').textContent = index === 2 ? '开始玩' : '下一步';
    };
    this.bubble.querySelector('[data-skip]').onclick = () => this.close();
    this.bubble.querySelector('[data-next]').onclick = () => ++index === steps.length ? this.close() : show();
    this.dismiss = event => {
      if (event.key === 'Escape' || event.target.closest?.('#hud-layer button')) this.close();
    };
    document.addEventListener('click', this.dismiss, true);
    document.addEventListener('keydown', this.dismiss);
    show();
  }

  close() {
    this.anchor?.classList.remove('guide-target');
    this.bubble?.remove();
    if (this.dismiss) {
      document.removeEventListener('click', this.dismiss, true);
      document.removeEventListener('keydown', this.dismiss);
    }
  }
}
