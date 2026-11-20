import { cityPortrait } from './CityPortrait.js';

export function renderDeed(info, name) {
  const card = document.createElement('article');
  card.className = 'deed-card';
  card.style.setProperty('--district',info.deed?.color || '#dbab53');
  const heading=document.createElement('header');
  heading.textContent=info.deed?.district || '棋盘地标';
  const title=document.createElement('h3');
  title.textContent=info.title;
  card.append(heading,title);
  if (info.deed) {
    const d=info.deed;
    const owner=document.createElement('div');
    owner.className='deed-owner';
    const avatar=document.createElement('i');
    if (d.portrait) avatar.style.backgroundImage='url("'+d.portrait+'")';
    else avatar.textContent=d.avatar || '🏳️';
    owner.append(avatar, d.owner || '待购土地');
    const level=document.createElement('b');
    level.textContent=d.icon+' Lv.'+d.level;
    owner.append(level);
    card.append(owner);
  }
  for (const line of info.lines.filter((line,i)=>i>0 || !info.deed || !line.includes('地产') && !line.includes('LV '))) {
    if (line.startsWith('牌价含') || line.startsWith('自己停留')) continue;
    const row=document.createElement('p');
    row.textContent=line;
    if (/连片|垄断/.test(line)) row.className='deed-chain';
    card.append(row);
  }
  if (info.deed?.next != null) {
    const row=document.createElement('p');
    row.textContent='升级后预计租金 $'+info.deed.next.toLocaleString();
    card.append(row);
  }
  if (name) {
    const occupant=document.createElement('small');
    occupant.textContent='此处有 '+name;
    card.append(occupant);
  }
  return card;
}

export function deedDetails(model, owner, level, mapId, standard) {
  return {
    district:model.districtName,color:model.districtColor,icon:model.buildingIcon,
    level,owner:owner?.name,avatar:owner?.avatar,portrait:cityPortrait(owner,mapId),
    next: standard && level+1 < model.rentGrowth.length ? model.rentGrowth[level+1].value : null
  };
}
