export class AssetUI {
  constructor(gameState) {
    this.gameState = gameState;
    this.modal = document.getElementById('modal-assets');
    this.body = document.getElementById('asset-ranking-body');
    document.getElementById('asset-modal-close').onclick = () => this.hide();
  }

  show() {
    this.render();
    this.modal.classList.remove('hidden');
  }

  hide() {
    this.modal.classList.add('hidden');
  }

  render() {
    this.body.innerHTML = '';
    this.gameState.getRankings().forEach(({ player, assets }, index) => {
      const row = document.createElement('tr');
      row.className = player.isBankrupt ? 'bankrupt' : '';
      row.innerHTML = `
        <td><strong>${index + 1}</strong></td>
        <td><span style="color:${player.color}">●</span> ${player.name}</td>
        <td>$${assets.cash.toLocaleString()}</td>
        <td>$${assets.landValue.toLocaleString()}</td>
        <td>$${assets.buildingValue.toLocaleString()}</td>
        <td>$${assets.stockValue.toLocaleString()}</td>
        <td>${assets.propertyCount}</td>
        <td><strong>$${assets.total.toLocaleString()}</strong></td>
      `;
      this.body.appendChild(row);
    });
  }
}
