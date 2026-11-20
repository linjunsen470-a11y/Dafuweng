import { PLAYER_PROFILES } from '../game/BoardData.js';
import { CHARACTER_VOICES } from '../game/CharacterReactions.js';
import { cityPortrait } from './CityPortrait.js';

const SETUP_MAP_PRESENTATION = {
  'grand-bay': {
    icon: '🌊', name: '山海都市岛', description: '穿越蓝湾、榕城、星河与云顶，争夺旗舰群岛的财富王冠。',
    stats: [['120', '格棋盘'], ['4', '大区域'], ['旗舰', '难度']]
  },
  'fortune-crossroads': {
    icon: '🍀', name: '福星岔路岛', description: '在多条财富捷径之间权衡风险，用路线选择扭转每一轮局势。',
    stats: [['32', '格棋盘'], ['多线', '岔路'], ['经典', '难度']]
  },
  'city-loop': {
    icon: '🌃', name: '霓虹财富城', description: '环绕不夜金融城高速周转，让地产连锁与股市波动彼此放大。',
    stats: [['32', '格棋盘'], ['都市', '环线'], ['激进', '节奏']]
  },
  'island-fork': {
    icon: '🏝️', name: '潮汐宝藏岛', description: '沿双岔海岸搜寻机会，在潮汐般变化的路线中抢占黄金地段。',
    stats: [['32', '格棋盘'], ['双岔', '路线'], ['探索', '节奏']]
  },
  'taiwan-loop': {
    icon: '🚂', name: '宝岛环岛图', description: '乘环岛路线串联城市与港湾，以稳定经营完成一场长线财富旅行。',
    stats: [['40', '格棋盘'], ['环岛', '路线'], ['均衡', '难度']]
  }
};

function paintPortrait(node, profile, mapId) {
  const model = cityPortrait({ profileId: profile.id }, mapId);
  const atlas = !model && profile.avatarAtlas;
  node.style.backgroundImage = `url("${model || atlas || profile.avatarImg}")`;
  node.style.backgroundSize = atlas ? '400% 300%' : 'cover';
  node.style.backgroundPosition = atlas ? profile.avatarPosition : 'center';
}

export class SetupScreenUI {
  constructor(saves, actions) {
    this.saves = saves;
    this.actions = actions;
    this.seats = document.getElementById('player-config-list');
    this.roster = document.getElementById('character-roster');
    this.preview = document.getElementById('character-preview');
    this.map = document.getElementById('map-select');
    this.count = document.getElementById('player-count');
    this.active = 0;
    this.count.onchange = () => this.renderSeats();
    this.map.onchange = () => this.update();
    this.roster.onclick = event => {
      const button = event.target.closest('[data-profile]');
      if (!button) return;
      const select = this.seats.querySelectorAll('.player-profile-select')[this.active];
      select.value = button.dataset.profile;
      select.dispatchEvent(new Event('change'));
    };
    document.getElementById('start-game-btn').onclick = actions.start;
    const cash = document.querySelectorAll('.cash-btn');
    cash.forEach(button => button.onclick = () => {
      cash.forEach(other => other.classList.toggle('active', other === button));
      actions.cash(Number(button.dataset.cash));
    });
    const maps = document.getElementById('map-cards');
    maps.innerHTML = Object.entries(SETUP_MAP_PRESENTATION).map(([id, map]) =>
      `<button data-map="${id}"><i>${map.icon}</i><b>${map.name}</b><small>${map.stats[1].join(' ')}</small></button>`).join('');
    maps.onclick = event => {
      const button = event.target.closest('[data-map]');
      if (button) { this.map.value = button.dataset.map; this.update(); }
    };
    this.roster.innerHTML = PLAYER_PROFILES.map(profile =>
      `<button data-profile="${profile.id}" style="--portrait-color:${profile.color}"><i></i>${profile.name}</button>`).join('');
  }

  render() {
    this.renderSeats(true);
    for (const [id, load] of [['auto', this.saves.loadAuto()], ['manual', this.saves.loadManual()]]) {
      const button = document.getElementById(`load-${id}-save-btn`);
      button.classList.toggle('hidden', !load.success);
      button.onclick = () => load.success && this.actions.restore(load.snapshot);
    }
  }

  renderSeats(reset = false) {
    const count = Number(this.count.value);
    const previous = reset ? [] : [...this.seats.children].slice(0, count).map(seat => ({
      id: Number(seat.querySelector('.player-profile-select').value), type: seat.querySelector('.player-type-select').value
    }));
    this.active = reset ? 0 : Math.min(this.active, count - 1);
    this.seats.replaceChildren();
    const options = PLAYER_PROFILES.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const used = new Set(previous.map(seat => seat.id));
    for (let index = 0; index < count; index++) {
      const id = previous[index]?.id ?? PLAYER_PROFILES.find(p => !used.has(p.id)).id;
      used.add(id);
      const seat = document.createElement('div');
      seat.className = 'lobby-seat';
      seat.innerHTML = `<button aria-label="选择席位 ${index + 1}"><small>${index + 1}P</small><b></b></button>
        <select hidden class="player-profile-select">${options}</select>
        <select class="player-type-select" aria-label="席位 ${index + 1} 的操控方式"><option value="HUMAN">玩家</option><option value="AI">电脑</option></select>`;
      const select = seat.querySelector('.player-profile-select');
      select.value = String(id);
      select.dataset.previous = select.value;
      seat.querySelector('.player-type-select').value = previous[index]?.type ?? (index ? 'AI' : 'HUMAN');
      seat.querySelector('button').onclick = () => { this.active = index; this.update(); };
      select.onchange = () => {
        const previousId = select.dataset.previous;
        for (const other of this.seats.querySelectorAll('.player-profile-select')) {
          if (other !== select && other.value === select.value) other.value = previousId;
          other.dataset.previous = other.value;
        }
        this.active = index;
        this.update();
      };
      this.seats.append(seat);
    }
    this.update();
  }

  update() {
    const map = SETUP_MAP_PRESENTATION[this.map.value];
    document.querySelectorAll('[data-map]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.map === this.map.value)));
    for (const key of ['name', 'description', 'icon']) document.getElementById('setup-map-' + key).textContent = map[key];
    document.getElementById('setup-map-stats').innerHTML = map.stats.map(([v,l]) => `<span><b>${v}</b> ${l}</span>`).join('');
    const selects = this.seats.querySelectorAll('.player-profile-select');
    const profile = PLAYER_PROFILES.find(p => p.id === Number(selects[this.active].value));
    selects.forEach((select, index) => {
      const button = select.previousElementSibling;
      button.querySelector('b').textContent = select.selectedOptions[0].textContent;
      button.setAttribute('aria-pressed', String(index === this.active));
    });
    const voice = CHARACTER_VOICES[profile.id];
    this.preview.style.setProperty('--portrait-color', profile.color);
    this.preview.innerHTML = `<i aria-hidden="true"></i><div><small>${voice?.title || '城市投资人'}</small>
      <h3>${profile.name}</h3><p>${voice?.gain[0] || ''}</p><strong>${profile.skillName}</strong> ${profile.skillDesc}</div>`;
    paintPortrait(this.preview.firstElementChild, profile, this.map.value);
    [...this.roster.children].forEach((button, index) => {
      const p = PLAYER_PROFILES[index];
      button.setAttribute('aria-pressed', String(p === profile));
      paintPortrait(button.firstElementChild, p, this.map.value);
    });
  }
}
