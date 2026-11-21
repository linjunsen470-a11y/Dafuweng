import { formatDeedMoney } from './MapTileDetails.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function ownerRow(deed) {
  const row = element('div', 'deed-owner');
  const portrait = element('i', 'deed-portrait');
  portrait.setAttribute('aria-hidden', 'true');
  if (deed.portrait) {
    portrait.style.backgroundImage = 'url("' + deed.portrait + '")';
    if (deed.atlasPosition) {
      portrait.style.backgroundSize = '400% 300%';
      portrait.style.backgroundPosition = deed.atlasPosition;
    }
  } else portrait.textContent = deed.avatar || '⚑';
  const name = element('span', 'deed-owner-name', deed.owner ? '地主 · ' + deed.owner : '无主地产');
  row.append(portrait, name);
  return row;
}

export function renderDeed(info, occupant) {
  const card = element('article', 'deed-card');
  card.dataset.tileId = String(info.id);
  const deed = info.deed;
  card.style.setProperty('--district', deed?.color || '#dbab53');
  const heading = element('div', 'deed-heading');
  heading.append(element('span', 'deed-district', deed?.district || '棋盘地标'),
    element('span', 'deed-number', '第 ' + info.id + ' 格'));
  card.append(heading, element('h3', 'deed-title', info.name));
  if (deed) {
    const owner = ownerRow(deed);
    owner.append(element('b', 'deed-level', `${deed.icon} Lv.${deed.level}`));
    const stats = element('div', 'deed-stats');
    const rent = element('div', 'deed-rent');
    rent.append(element('small', '', deed.rentLabel),
      element('strong', '', deed.rent == null ? '按补给结算' : formatDeedMoney(deed.rent)));
    const chain = element('div', 'deed-chain');
    chain.append(element('small', '', '街区加成'),
      element('b', '', deed.multiplier > 1 ? deed.chainLabel + ' ×' + deed.multiplier : deed.chainLabel));
    if (deed.multiplier > 1) chain.classList.add('active');
    stats.append(rent, chain);
    card.append(owner, stats);
    if (deed.price != null) card.append(element('p', 'deed-quote', '当前购价 ' + formatDeedMoney(deed.price)));
    if (deed.next != null) card.append(element('p', 'deed-quote', `升至 Lv.${deed.level + 1} 预计租金 ${formatDeedMoney(deed.next)}`));
  }
  for (const line of info.notes) card.append(element('p', 'deed-note', line));
  if (occupant) card.append(element('small', 'deed-note', '此处有 ' + occupant));
  return card;
}
