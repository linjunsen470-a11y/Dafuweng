import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve('public/assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. Generate 12 Character SVGs
const characters = [
  { id: 'lin_xiaoman', name: '林小满', bg: '#ff4757', emoji: '🎀', title: '商业奇才', hat: '#ff6b81' },
  { id: 'gu_tianye', name: '顾田野', bg: '#ffa502', emoji: '🤠', title: '土地公庇护', hat: '#eccc68' },
  { id: 'luo_jingjing', name: '洛晶晶', bg: '#a55eea', emoji: '💎', title: '股市高手', hat: '#8854d0' },
  { id: 'baroque', name: '巴洛克', bg: '#2ed573', emoji: '👳‍♂️', title: '石油大亨', hat: '#26de81' },
  { id: 'fengjian_lan', name: '风间岚', bg: '#1e90ff', emoji: '🥷', title: '疾风忍术', hat: '#4b7bec' },
  { id: 'miya', name: '米娅', bg: '#ff7f50', emoji: '🌴', title: '自然之福', hat: '#ff6348' },
  { id: 'john_joe', name: '约翰乔', bg: '#eb4d4b', emoji: '🤠', title: '牛仔冲锋', hat: '#c0392b' },
  { id: 'danny', name: '小丹尼', bg: '#f0932b', emoji: '⚾', title: '棒球活力', hat: '#e67e22' },
  { id: 'sarah', name: '莎拉公主', bg: '#be2edd', emoji: '👑', title: '皇家威严', hat: '#8e44ad' },
  { id: 'tang_tang', name: '糖糖', bg: '#ff7979', emoji: '🍬', title: '甜心庇佑', hat: '#badc58' },
  { id: 'miyamoto', name: '宫本宝藏', bg: '#485460', emoji: '⚔️', title: '剑道大师', hat: '#2d3436' },
  { id: 'baby_jin', name: '金贝贝', bg: '#badc58', emoji: '👶', title: '商业神童', hat: '#f1c40f' }
];

characters.forEach(char => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="bg_${char.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${char.bg}" />
        <stop offset="100%" stop-color="${char.hat}" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <rect width="200" height="200" rx="40" fill="url(#bg_${char.id})" />
    <circle cx="100" cy="100" r="75" fill="#ffffff" opacity="0.2"/>
    <circle cx="100" cy="90" r="55" fill="#ffffff" filter="url(#shadow)"/>
    <text x="100" y="112" font-size="64" text-anchor="middle">${char.emoji}</text>
    <rect x="20" y="152" width="160" height="32" rx="16" fill="rgba(0,0,0,0.4)"/>
    <text x="100" y="174" font-size="16" font-weight="900" font-family="Noto Sans SC, sans-serif" fill="#ffffff" text-anchor="middle">${char.name}</text>
  </svg>`;
  fs.writeFileSync(path.join(assetsDir, `char_${char.id}.svg`), svg);
});

// 2. Generate 29 Item Card SVGs
const cards = [
  { id: 'REMOTE_DICE', name: '遥控骰子', icon: '🎯', color: '#ff4757' },
  { id: 'OBSTACLE', name: '路障卡', icon: '🚧', color: '#ffa502' },
  { id: 'TURN_AROUND', name: '转向卡', icon: '🔄', color: '#2ed573' },
  { id: 'DEMOLISH', name: '拆房卡', icon: '💣', color: '#ff6b81' },
  { id: 'EQUAL_WEALTH', name: '均富卡', icon: '⚖️', color: '#70a1ff' },
  { id: 'STEAL_LAND', name: '强占卡', icon: '🚩', color: '#a55eea' },
  { id: 'RED_BULL', name: '红霸卡', icon: '📈', color: '#ff4757' },
  { id: 'FORTUNE_GOD', name: '福神卡', icon: '🌟', color: '#eccc68' },
  { id: 'TURTLE', name: '乌龟卡', icon: '🐢', color: '#26de81' },
  { id: 'CAR_CARD', name: '汽车卡', icon: '🏎️', color: '#ff7f50' },
  { id: 'CLEANSE', name: '净化卡', icon: '✨', color: '#00d2d3' },
  { id: 'RENT_SHIELD', name: '护租卡', icon: '🛡️', color: '#54a0ff' },
  { id: 'CASH_TAX', name: '消费税卡', icon: '🧾', color: '#f368e0' },
  { id: 'TELEPORT', name: '跃迁卡', icon: '🌀', color: '#5f27cd' },
  { id: 'CLEAR_ROAD', name: '清障卡', icon: '🚜', color: '#ff9f43' },
  { id: 'BEAR_CARD', name: '绿熊卡', icon: '📉', color: '#10ac84' },
  { id: 'IMMUNITY', name: '好运护符', icon: '🍀', color: '#1dd1a1' },
  { id: 'GIFT_CARD', name: '交换礼券', icon: '🎁', color: '#ff6b6b' },
  { id: 'MISSILE', name: '飞弹卡', icon: '🚀', color: '#ee5253' },
  { id: 'NUKES', name: '核弹卡', icon: '☢️', color: '#ff9f43' },
  { id: 'MINE', name: '地雷卡', icon: '💣', color: '#2f3542' },
  { id: 'HIBERNATE', name: '冬眠卡', icon: '❄️', color: '#48dbfb' },
  { id: 'SLEEPWALK', name: '梦游卡', icon: '🌙', color: '#341f97' },
  { id: 'LAND_BUY', name: '购地卡', icon: '📜', color: '#c8d6e5' },
  { id: 'SWAP_LAND', name: '换地卡', icon: '🔀', color: '#00d2d3' },
  { id: 'TRANSFER_CARD', name: '嫁祸卡', icon: '🃏', color: '#ff4757' },
  { id: 'IMMUNITY_CARD', name: '免罪卡', icon: '🏛️', color: '#10ac84' },
  { id: 'SUMMON_GOD', name: '请神符', icon: '🧧', color: '#ff4757' },
  { id: 'BANISH_GOD', name: '送神符', icon: '💨', color: '#8395a7' }
];

cards.forEach(card => {
  const fileName = `card_${card.id.toLowerCase()}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">
    <defs>
      <linearGradient id="card_bg_${card.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e272e" />
        <stop offset="100%" stop-color="#0984e3" />
      </linearGradient>
      <linearGradient id="gold_border" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffaa00" />
        <stop offset="100%" stop-color="#fffa65" />
      </linearGradient>
    </defs>
    <rect width="240" height="320" rx="20" fill="url(#card_bg_${card.id})" stroke="url(#gold_border)" stroke-width="6"/>
    <rect x="15" y="15" width="210" height="290" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <circle cx="120" cy="120" r="60" fill="${card.color}" opacity="0.3"/>
    <circle cx="120" cy="120" r="48" fill="${card.color}" opacity="0.8"/>
    <text x="120" y="138" font-size="56" text-anchor="middle">${card.icon}</text>
    <rect x="25" y="220" width="190" height="40" rx="10" fill="rgba(0,0,0,0.6)"/>
    <text x="120" y="247" font-size="20" font-weight="900" font-family="Noto Sans SC, sans-serif" fill="#fffa65" text-anchor="middle">${card.name}</text>
    <text x="120" y="285" font-size="14" font-family="Outfit, sans-serif" fill="#00d2d3" text-anchor="middle">ITEM CARD</text>
  </svg>`;
  fs.writeFileSync(path.join(assetsDir, fileName), svg);
});

console.log('✅ Generated 12 character avatars and 29 card illustrations successfully!');
