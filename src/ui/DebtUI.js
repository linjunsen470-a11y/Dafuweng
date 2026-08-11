const money = value => `$${Math.max(0, Number(value || 0)).toLocaleString()}`;

function createPortrait(player) {
  const portrait = document.createElement('span');
  portrait.className = 'debt-player-portrait';
  if (player.avatarAtlas) {
    portrait.style.backgroundImage = `url('${player.avatarAtlas}')`;
    portrait.style.backgroundPosition = player.avatarPosition || '0% 0%';
  } else if (player.avatarImg) {
    portrait.style.backgroundImage = `url('${player.avatarImg}')`;
    portrait.style.backgroundPosition = 'center';
    portrait.style.backgroundSize = 'cover';
  } else portrait.textContent = player.avatar || '🎩';
  return portrait;
}

function actionPriority(type) {
  return ({ LIQUIDATE_DEPOSIT: 1, SELL_STOCK: 2, SELL_BUILDING: 3, MORTGAGE_PROPERTY: 4, AUTO_SETTLE_DEBT: 8, DECLARE_BANKRUPTCY: 9 })[type] || 7;
}

export class DebtUI {
  constructor(audioManager = null) {
    this.audioManager = audioManager;
    this.activeOverlay = null;
    this.activeResolve = null;
  }

  close(value = null) {
    const resolve = this.activeResolve;
    this.activeResolve = null;
    this.activeOverlay?.remove();
    this.activeOverlay = null;
    resolve?.(value);
  }

  createShell({ player, debt, portfolio }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal debt-overlay';
    overlay.innerHTML = `
      <div class="debt-center" role="dialog" aria-modal="true" aria-labelledby="debt-title">
        <header class="debt-header">
          <div class="debt-title-group"><span class="debt-alert-pulse">!</span><div><span class="debt-kicker">FINANCIAL SETTLEMENT CENTER</span><h2 id="debt-title">财务危机处理中心</h2></div></div>
          <div class="debt-case-number"><span>CASE</span><strong></strong></div>
        </header>
        <div class="debt-main">
          <aside class="debt-summary">
            <div class="debt-player"></div>
            <div class="debt-demand-card">
              <span class="debt-source-icon"></span>
              <div><small>债务项目</small><strong class="debt-source-label"></strong><span class="debt-creditor"></span></div>
            </div>
            <div class="debt-amounts">
              <div><span>应付总额</span><strong class="debt-total"></strong></div>
              <div><span>当前现金</span><strong class="debt-cash"></strong></div>
              <div class="is-gap"><span>资金缺口</span><strong class="debt-gap"></strong></div>
            </div>
            <div class="debt-coverage"><div><span></span></div><small></small></div>
            <div class="debt-solvency"></div>
          </aside>
          <section class="debt-workspace">
            <div class="debt-assets-title"><div><span class="debt-kicker">LIQUIDITY OVERVIEW</span><h3>可变现资产</h3></div><strong class="debt-liquid-total"></strong></div>
            <div class="debt-asset-grid"></div>
            <div class="debt-strategy-note"><strong>自动处置顺序</strong><span>存款 → 低收益股票 → 低租金建筑 → 空地抵押；达到欠款金额后立即停止。</span></div>
            <div class="debt-actions-title"><strong>选择本次处理方式</strong><span>你可以分步处置，界面会实时重新计算缺口</span></div>
            <div class="debt-actions"></div>
          </section>
        </div>
      </div>
    `;
    overlay.querySelector('.debt-case-number strong').textContent = `R${String(debt.amountDue).slice(-4).padStart(4, '0')}`;
    const playerHost = overlay.querySelector('.debt-player');
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = player.name;
    const status = document.createElement('span');
    status.textContent = '债务清算中 · 暂停其他行动';
    identity.append(name, status);
    playerHost.append(createPortrait(player), identity);
    overlay.querySelector('.debt-source-icon').textContent = portfolio.source.icon;
    overlay.querySelector('.debt-source-label').textContent = portfolio.source.label;
    overlay.querySelector('.debt-creditor').textContent = `收款方：${portfolio.source.creditorName}`;
    overlay.querySelector('.debt-total').textContent = money(portfolio.amountDue);
    overlay.querySelector('.debt-cash').textContent = money(portfolio.cash);
    overlay.querySelector('.debt-gap').textContent = money(portfolio.gap);
    const coverage = portfolio.amountDue ? Math.min(100, Math.round((portfolio.cash / portfolio.amountDue) * 100)) : 100;
    overlay.querySelector('.debt-coverage span').style.width = `${coverage}%`;
    overlay.querySelector('.debt-coverage small').textContent = `现金覆盖率 ${coverage}%`;
    const solvency = overlay.querySelector('.debt-solvency');
    solvency.className = `debt-solvency ${portfolio.solvent ? 'is-solvent' : 'is-insolvent'}`;
    solvency.textContent = portfolio.solvent
      ? `✓ 可变现资产足以覆盖欠款，预计清偿后保留 ${money(portfolio.liquidatableTotal - portfolio.amountDue)}`
      : `⚠ 资不抵债，全部变现后仍缺 ${money(portfolio.amountDue - portfolio.liquidatableTotal)}`;
    overlay.querySelector('.debt-liquid-total').textContent = money(portfolio.liquidatableTotal);

    const assetGrid = overlay.querySelector('.debt-asset-grid');
    [
      { icon: '💵', label: '现金', value: portfolio.cash, detail: '立即可用' },
      { icon: '🏦', label: '银行存款', value: portfolio.deposit, detail: portfolio.deposit ? '可按缺口提取' : '无余额' },
      { icon: '📈', label: '股票持仓', value: portfolio.stockValue, detail: `${portfolio.stocks.length} 支股票` },
      { icon: '🏘️', label: '地产权益', value: portfolio.propertyValue, detail: `${portfolio.properties.length} 处资产` }
    ].forEach(asset => {
      const card = document.createElement('div');
      card.className = 'debt-asset-card';
      const icon = document.createElement('span');
      icon.textContent = asset.icon;
      const copy = document.createElement('div');
      const label = document.createElement('small');
      label.textContent = asset.label;
      const value = document.createElement('strong');
      value.textContent = money(asset.value);
      const detail = document.createElement('span');
      detail.textContent = asset.detail;
      copy.append(label, value, detail);
      card.append(icon, copy);
      assetGrid.appendChild(card);
    });
    return overlay;
  }

  getActionCopy(action, context) {
    const { portfolio, state } = context;
    if (action.type === 'LIQUIDATE_DEPOSIT') return { icon: '🏦', title: `提取存款 ${money(action.amount)}`, detail: '只提取当前资金缺口所需金额', value: `+${money(action.amount)}`, tone: 'safe' };
    if (action.type === 'SELL_STOCK') {
      const stock = portfolio.stocks.find(item => item.id === action.stockId);
      return { icon: '📉', title: `卖出 ${stock?.name || action.stockId}`, detail: `${action.shares} 股 · 保留其余持仓`, value: `约 +${money(action.estimatedRevenue)}`, tone: 'asset' };
    }
    if (action.type === 'SELL_BUILDING') {
      const property = portfolio.properties.find(item => item.tileId === action.tileId);
      const value = property?.level ? Math.round(property.buildingValue / property.level) : 0;
      return { icon: '🏗️', title: `出售 ${property?.name || state.getTile(action.tileId)?.name} 一层建筑`, detail: `当前 LV ${property?.level || 0}，地产产权保留`, value: `+${money(value)}`, tone: 'asset' };
    }
    if (action.type === 'MORTGAGE_PROPERTY') {
      const property = portfolio.properties.find(item => item.tileId === action.tileId);
      return { icon: '🏠', title: `抵押 ${property?.name || state.getTile(action.tileId)?.name}`, detail: '抵押期间不收取过路费，之后可加价赎回', value: `+${money(property?.mortgageValue)}`, tone: 'warning' };
    }
    if (action.type === 'AUTO_SETTLE_DEBT') return {
      icon: '⚙️',
      title: portfolio.solvent ? '智能自动清偿（推荐）' : '清算全部资产',
      detail: portfolio.solvent ? '按保值优先顺序处置，凑足即停止' : '资产不足，处置后将进入破产程序',
      value: portfolio.solvent ? `补足 ${money(portfolio.gap)}` : '可能破产',
      tone: portfolio.solvent ? 'recommended' : 'danger'
    };
    return { icon: '📉', title: '宣布破产', detail: '退出对局；地产进入司法拍卖，卡片和道具清空', value: '不可撤销', tone: 'danger' };
  }

  chooseAction(context) {
    return new Promise(resolve => {
      const overlay = this.createShell(context);
      const actionsHost = overlay.querySelector('.debt-actions');
      [...context.actions].sort((a, b) => actionPriority(a.type) - actionPriority(b.type)).forEach(action => {
        const copy = this.getActionCopy(action, context);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `debt-action tone-${copy.tone}`;
        button.dataset.action = action.type;
        const icon = document.createElement('span');
        icon.className = 'debt-action-icon';
        icon.textContent = copy.icon;
        const text = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = copy.title;
        const detail = document.createElement('span');
        detail.textContent = copy.detail;
        text.append(title, detail);
        const value = document.createElement('b');
        value.textContent = copy.value;
        button.append(icon, text, value);
        if (action.type === 'DECLARE_BANKRUPTCY') {
          let armed = false;
          button.onclick = () => {
            if (!armed) {
              armed = true;
              button.classList.add('is-armed');
              title.textContent = '再次点击确认破产';
              detail.textContent = '此操作将清空库存并退出本局';
              return;
            }
            this.finish(overlay, resolve, action);
          };
        } else button.onclick = () => this.finish(overlay, resolve, action);
        actionsHost.appendChild(button);
      });
      this.close();
      this.activeOverlay = overlay;
      this.activeResolve = resolve;
      document.body.appendChild(overlay);
      void overlay.offsetWidth;
      overlay.classList.add('is-visible');
    });
  }

  finish(overlay, resolve, action) {
    this.activeResolve = null;
    this.activeOverlay = null;
    overlay.remove();
    this.audioManager?.playClick();
    resolve(action);
  }

  async showOutcome({ result, player, debt }, speed = 1) {
    const bankrupt = result?.type === 'PLAYER_BANKRUPT';
    const overlay = document.createElement('div');
    overlay.className = 'modal debt-overlay debt-outcome-overlay';
    overlay.innerHTML = `
      <div class="debt-outcome" role="dialog" aria-modal="true">
        <span class="debt-outcome-icon"></span>
        <span class="debt-kicker">SETTLEMENT RESULT</span>
        <h2></h2><p></p><strong></strong>
        <button type="button" class="btn-primary">继续</button>
      </div>
    `;
    overlay.querySelector('.debt-outcome-icon').textContent = bankrupt ? '📉' : '✅';
    overlay.querySelector('h2').textContent = bankrupt ? '破产清算程序启动' : '债务已全部清偿';
    overlay.querySelector('p').textContent = bankrupt
      ? `${player.name} 已退出本局，剩余地产将进入公开司法拍卖。`
      : `${player.name} 已完成 ${money(debt.amountDue)} 的债务支付。`;
    overlay.querySelector('.debt-outcome > strong').textContent = bankrupt ? 'BANKRUPTCY' : `剩余现金 ${money(player.cash)}`;
    this.close();
    this.activeOverlay = overlay;
    document.body.appendChild(overlay);
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
    await new Promise(resolve => {
      const timer = setTimeout(resolve, Math.round(1500 / Math.max(.5, speed)));
      overlay.querySelector('button').onclick = () => { clearTimeout(timer); resolve(); };
    });
    this.activeOverlay = null;
    overlay.remove();
  }
}
