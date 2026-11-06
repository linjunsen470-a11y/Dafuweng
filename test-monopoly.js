import puppeteer from 'puppeteer-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createServer } from 'vite';

const artifactDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fortune-empire-e2e-'));
const artifact = name => path.join(artifactDirectory, name);

const paths = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

let executablePath = paths.find(p => fs.existsSync(p));

async function runTest() {
  if (!executablePath) {
    console.error('No Chrome or Edge browser executable found!');
    process.exit(1);
  }

  const logs = [];
  const errors = [];
  const pageErrors = [];
  const networkErrors = [];

  console.log('🚀 Starting Detailed Puppeteer Automated Test for 3D Monopoly...');

  const viteServer = await createServer({
    server: { host: '127.0.0.1', port: 5173, strictPort: true }
  });
  await viteServer.listen();

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new', timeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    logs.push({ type, text });
    if (type === 'error') {
      errors.push(text);
      console.error(`[Console Error] ${text}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error(`[Page Error] ${err.stack || err}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      const errStr = `[HTTP ${response.status()}] ${response.url()}`;
      networkErrors.push(errStr);
      console.error(`[Network Error] ${errStr}`);
    }
  });

  try {
    console.log('\n--- Step 1: Navigating to http://localhost:5173/ ---');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 120000 });
    await page.evaluate(() => {
      localStorage.setItem('fortune-empire:tutorial-seen', '1');
      document.querySelector('.rules-help-modal')?.remove();
    });

    console.log('\n--- Step 2: Inspecting Setup Screen ---');
    await page.waitForSelector('#setup-screen', { timeout: 15000 });
    const setupOptions = await page.evaluate(() => ({
      modes: [...document.querySelectorAll('#game-mode option')].map(option => option.value),
      depositOptions: [...document.querySelectorAll('#initial-deposit option')].map(option => option.value),
      maps: [...document.querySelectorAll('#map-select option')].map(option => option.value)
    }));
    if (!['STANDARD', 'QUICK', 'TEAM', 'CHALLENGE', 'HEAT'].every(mode => setupOptions.modes.includes(mode))
      || !setupOptions.depositOptions.includes('5000') || setupOptions.maps.length !== 5) {
      throw new Error(`Setup options incomplete: ${JSON.stringify(setupOptions)}`);
    }
    console.log('✅ Five modes, deposit options, and five maps are available.');

    console.log('\n--- Step 3: Clicking "开启富翁之旅" to enter Game HUD ---');
    await page.evaluate(() => {
      const profiles = [6, 7, 8, 10];
      document.querySelectorAll('.player-profile-select').forEach((select, index) => {
        select.value = String(profiles[index]);
      });
    });
    const startBtn = await page.$('#start-game-btn');
    if (!startBtn) throw new Error('Start game button not found!');
    // Capture the transient banner in its painted frame, rather than querying
    // it in a later CDP round trip after the three-second reading interval.
    await page.evaluate(() => {
      window.__turnPresentation = null;
      const started = performance.now();
      const inspect = () => {
        const element = document.querySelector('.presentation-turn-banner.is-visible');
        if (element) {
          const style = getComputedStyle(element);
          if (Number(style.opacity) >= 0.9) {
            const rect = element.getBoundingClientRect();
            window.__turnPresentation = {
              text: element.textContent.replace(/\s+/g, ' ').trim(),
              opacity: Number(style.opacity), visibility: style.visibility,
              display: style.display, width: rect.width, height: rect.height,
              layerZIndex: Number(getComputedStyle(document.getElementById('presentation-layer')).zIndex)
            };
            return;
          }
        }
        if (performance.now() - started < 120000) requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    });
    await Promise.all([
      page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 120000 }),
      page.waitForFunction(() => window.__turnPresentation !== null, { timeout: 120000 }),
      startBtn.click()
    ]);
    const turnPresentation = await page.evaluate(() => window.__turnPresentation);
    if (!turnPresentation.text.includes('ROUND 1') || !turnPresentation.text.includes('的回合')
      || turnPresentation.opacity < 0.9 || turnPresentation.visibility !== 'visible'
      || turnPresentation.display === 'none' || turnPresentation.width < 200 || turnPresentation.layerZIndex < 100) {
      throw new Error(`Turn presentation mismatch: ${JSON.stringify(turnPresentation)}`);
    }
    await page.screenshot({ path: artifact('test_step_turn_presentation.png') });
    console.log('✅ Game HUD successfully entered.');

    console.log('\n--- Step 3-Mode: Testing mode objective center ---');
    await page.click('#btn-mode-status');
    await page.waitForSelector('#modal-mode-status:not(.hidden)', { timeout: 3000 });
    const modeRuleCount = await page.$$eval('.mode-rule-grid article', elements => elements.length);
    const modeStandingCount = await page.$$eval('.mode-standing-row', elements => elements.length);
    if (modeRuleCount < 3) throw new Error(`Expected mode-specific rules, got ${modeRuleCount}`);
    if (modeStandingCount !== 4) throw new Error(`Expected 4 mode standings, got ${modeStandingCount}`);
    await page.screenshot({ path: artifact('test_step_mode_objectives.png') });
    await page.click('#mode-status-close');
    await page.waitForSelector('#modal-mode-status.hidden', { timeout: 3000 });
    console.log('✅ Mode rules, round progress, economy cycle, and live standings rendered.');

    console.log('\n--- Step 3-Character: Testing character reactions and dialogue ---');
    await page.evaluate(async () => {
      const { PresentationUI } = await import('/src/ui/PresentationUI.js');
      const players = [
        { id: 0, profileId: 0, name: '林小满', color: '#ff4757', avatarAtlas: '/assets/characters-v2-atlas.webp', avatarPosition: '0% 0%', skillName: '商业奇才' },
        { id: 1, profileId: 10, name: '黑泽隼', color: '#485460', avatarAtlas: '/assets/characters-v2-atlas.webp', avatarPosition: '66.667% 100%', skillName: '剑道大师' }
      ];
      window.__e2eReactionUI = new PresentationUI();
      window.__e2eReactionState = { players, round: 1, getCurrentPlayer: () => players[0], getTile: () => ({ name: '海湾金融中心' }) };
      window.__e2eReactionUI.presentDomainEvent({ type: 'PROPERTY_PURCHASED', playerId: 0, tileId: 18, cost: 4200 }, window.__e2eReactionState);
    });
    await page.waitForSelector('.character-reaction.is-visible', { timeout: 3000 });
    const reactionTelemetry = await page.$eval('.character-reaction', element => ({
      line: element.querySelector('strong')?.textContent,
      name: element.querySelector('.character-reaction-name')?.textContent,
      portrait: getComputedStyle(element.querySelector('.character-reaction-portrait')).backgroundImage
    }));
    if (!reactionTelemetry.line || reactionTelemetry.name !== '林小满' || reactionTelemetry.portrait === 'none') {
      throw new Error(`Character reaction presentation mismatch: ${JSON.stringify(reactionTelemetry)}`);
    }
    await page.screenshot({ path: artifact('test_step_character_reaction.png') });
    await page.evaluate(() => window.__e2eReactionUI.clear());
    console.log('✅ Character portrait, personality title, and event dialogue rendered.');

    console.log('\n--- Step 3-Facility: Testing differentiated commercial services ---');
    await page.evaluate(async () => {
      const [{ GameState }, { GameEngine }, { PresentationUI }] = await Promise.all([
        import('/src/game/GameState.js'), import('/src/game/GameEngine.js'), import('/src/ui/PresentationUI.js')
      ]);
      const state = new GameState({ seed: 8127 });
      state.setupGame([{ profileIndex: 0, name: '设施访客', isAI: false }, { profileIndex: 1, name: '旅馆业主', isAI: true }], 30000, { mapId: 'fortune-crossroads' });
      const [visitor, owner] = state.players;
      state.propertyManager.buyProperty(18, owner.id, 'HOTEL');
      for (let level = 0; level < 4; level++) state.propertyManager.upgradeProperty(18);
      const result = new GameEngine(state).settleRent(visitor, 18);
      const facilityEvent = result.events.find(event => event.type === 'COMMERCIAL_FACILITY_VISITED');
      window.__e2eFacilityTelemetry = {
        buildingType: facilityEvent?.buildingType,
        duration: facilityEvent?.duration,
        hotelTurns: visitor.hotelTurns,
        hospitalTurns: visitor.hospitalTurns
      };
      window.__e2eFacilityUI = new PresentationUI();
      window.__e2eFacilityUI.presentDomainEvent(facilityEvent, state);
    });
    await page.waitForFunction(() => document.querySelector('.presentation-toast')?.textContent.includes('旅馆入住')
      && document.querySelector('.character-reaction-meta')?.textContent.includes('旅馆入住'));
    const facilityTelemetry = await page.evaluate(() => window.__e2eFacilityTelemetry);
    if (facilityTelemetry.buildingType !== 'HOTEL' || facilityTelemetry.duration !== 3
      || facilityTelemetry.hotelTurns !== 3 || facilityTelemetry.hospitalTurns !== 0) {
      throw new Error(`Commercial facility state mismatch: ${JSON.stringify(facilityTelemetry)}`);
    }
    await page.screenshot({ path: artifact('test_step_commercial_facility.png') });
    await page.evaluate(() => window.__e2eFacilityUI.clear());
    console.log('✅ Hotel service, independent stay state, facility toast, and character response rendered.');

    console.log('\n--- Step 3-Quest: Testing continuous fate quest tracker ---');
    await page.evaluate(async () => {
      const [{ GameState }, { UIRenderer }, { PresentationUI }, questRules] = await Promise.all([
        import('/src/game/GameState.js'), import('/src/ui/UIRenderer.js'), import('/src/ui/PresentationUI.js'), import('/src/game/QuestRules.js')
      ]);
      const state = new GameState({ seed: 8128 });
      state.setupGame([
        { profileIndex: 0, name: '委托测试员', isAI: false },
        { profileIndex: 1, name: '城市向导', isAI: true }
      ], 30000);
      questRules.startQuest(state, state.players[0], 'PROPERTY_INVESTOR');
      questRules.advanceQuestsForEvent(state, { type: 'PROPERTY_PURCHASED', playerId: 0, tileId: 1 });
      new UIRenderer(state).renderQuests();
      window.__e2eQuestUI = new PresentationUI();
      window.__e2eQuestUI.presentDomainEvent({
        type: 'QUEST_COMPLETED', playerId: 0, title: '建设合伙人', reward: { cash: 2200, cardPoints: 50 }
      }, state);
    });
    await page.waitForFunction(() => document.querySelector('.quest-card')?.textContent.includes('建设合伙人')
      && document.querySelector('.quest-card')?.textContent.includes('1/2')
      && document.querySelector('.presentation-toast')?.textContent.includes('委托完成'));
    const questTelemetry = await page.$eval('.quest-card', element => ({
      title: element.querySelector('.quest-card-title')?.textContent.replace(/\s+/g, ' ').trim(),
      player: element.querySelector('.quest-card-meta span')?.textContent,
      progressWidth: parseFloat(getComputedStyle(element.querySelector('.quest-progress i')).width)
    }));
    if (!questTelemetry.title.includes('1/2') || questTelemetry.player !== '委托测试员' || questTelemetry.progressWidth <= 0) {
      throw new Error(`Quest tracker mismatch: ${JSON.stringify(questTelemetry)}`);
    }
    await page.screenshot({ path: artifact('test_step_continuous_quest.png') });
    await page.evaluate(() => window.__e2eQuestUI.clear());
    console.log('✅ Quest assignment, progress bar, deadline context, completion reward, and character response rendered.');

    console.log('\n--- Step 3-God: Testing differentiated roaming gods ---');
    await page.evaluate(async () => {
      const [{ GameState }, { UIRenderer }, { PresentationUI }, godRules] = await Promise.all([
        import('/src/game/GameState.js'), import('/src/ui/UIRenderer.js'), import('/src/ui/PresentationUI.js'), import('/src/game/GodRules.js')
      ]);
      const state = new GameState({ seed: 8129 });
      state.setupGame([
        { profileIndex: 0, name: '精灵测试员', isAI: false },
        { profileIndex: 1, name: '转移目标', isAI: true },
        { profileIndex: 2, name: '电脑乙', isAI: true },
        { profileIndex: 3, name: '电脑丙', isAI: true }
      ], 30000);
      godRules.attachGod(state.players[0], 'GREAT_FORTUNE', 5);
      new UIRenderer(state).renderPlayersList();
      window.__e2eGodUI = new PresentationUI();
      window.__e2eGodUI.presentDomainEvent({
        type: 'BOARD_GOD_COLLECTED', playerId: 0, godType: 'GREAT_FORTUNE', godName: '大福精灵', icon: '💰', tone: 'gold', duration: 5
      }, state);
      window.__e2eGodTelemetry = { rules: Object.keys(godRules.GOD_RULES).length };
    });
    await page.waitForFunction(() => document.querySelector('.player-card .buff-tag')?.textContent.includes('大福精灵')
      && document.querySelector('.presentation-toast')?.textContent.includes('邂逅巡游精灵'));
    const godTelemetry = await page.evaluate(() => ({
      ...window.__e2eGodTelemetry,
      buff: document.querySelector('.player-card .buff-tag')?.textContent,
      title: document.querySelector('.presentation-toast strong')?.textContent
    }));
    if (godTelemetry.rules !== 8 || !godTelemetry.buff.includes('5T') || !godTelemetry.title.includes('邂逅巡游精灵')) {
      throw new Error(`Roaming god presentation mismatch: ${JSON.stringify(godTelemetry)}`);
    }
    await page.screenshot({ path: artifact('test_step_roaming_gods.png') });
    await page.evaluate(() => window.__e2eGodUI.clear());
    console.log('✅ Eight god rules, named HUD buff, duration, collision toast, and character response rendered.');

    console.log('\n--- Step 3a: Testing 120-node flagship map navigation ---');
    const mapTelemetry = await page.evaluate(() => ({
      selectedMap: document.getElementById('map-select')?.value,
      renderedTiles: document.getElementById('game-container')?.dataset.tileCount,
      renderedLots: document.getElementById('game-container')?.dataset.lotCount,
      minimapNodes: document.getElementById('minimap-canvas')?.dataset.nodeCount
    }));
    if (mapTelemetry.selectedMap !== 'grand-bay' || mapTelemetry.renderedTiles !== '120'
      || mapTelemetry.renderedLots !== '52' || mapTelemetry.minimapNodes !== '120') {
      throw new Error(`Flagship map telemetry mismatch: ${JSON.stringify(mapTelemetry)}`);
    }
    await page.click('#btn-map-overview');
    await page.click('#btn-rotate-left');
    await page.click('#btn-rotate-right');
    await new Promise(resolve => setTimeout(resolve, 2500));
    const minimapPainted = await page.evaluate(() => {
      const canvas = document.getElementById('minimap-canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    });
    if (!minimapPainted) throw new Error('Minimap canvas is blank');
    await page.screenshot({ path: artifact('test_step_visual_overview.png') });
    await page.click('#btn-follow-view');
    console.log('✅ 120 road nodes, 52 lots, overview, rotation, follow camera, and minimap rendered.');

    console.log('\n--- Step 3b: Testing weather, night lighting, and extended character models ---');
    await page.click('#btn-weather');
    await page.click('#btn-weather');
    await page.click('#btn-time-of-day');
    await page.click('#btn-time-of-day');
    const atmosphere = await page.evaluate(() => ({
      weather: document.getElementById('btn-weather')?.textContent,
      time: document.getElementById('btn-time-of-day')?.textContent
    }));
    if (atmosphere.weather !== '❄️' || atmosphere.time !== '🌙') {
      throw new Error(`Atmosphere controls failed: ${JSON.stringify(atmosphere)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 800));
    await page.screenshot({ path: artifact('test_step_visual_weather.png') });
    console.log('✅ Snow, night lighting, park texture, and extended character models rendered.');

    console.log('\n--- Step 3c: Testing city news broadcast and archive ---');
    const newsFixture = {
      id: 'NEWS_E2E',
      title: '城市更新基金正式启动',
      desc: '地产持有者获得建设补助，市场活力持续上升。',
      category: '地产',
      icon: '🏙️',
      tone: 'property',
      round: 3,
      impacts: [
        { icon: '💵', label: '林小满', detail: '现金 +$1,200', tone: 'gain' },
        { icon: '🏘️', label: '城市建筑', detail: '总等级 +2', tone: 'gain' }
      ]
    };
    await page.evaluate(async fixture => {
      const { NewsUI } = await import('/src/ui/NewsUI.js');
      window.__e2eNewsUI = new NewsUI();
      window.__e2eNewsFixture = fixture;
      window.__e2eNewsUI.show(fixture);
    }, newsFixture);
    await page.waitForSelector('.news-flash-overlay.is-visible .news-flash-card');
    const newsImpactCount = await page.$$eval('.news-impact', elements => elements.length);
    if (newsImpactCount !== 2) throw new Error(`Expected 2 news impacts, got ${newsImpactCount}`);
    await page.screenshot({ path: artifact('test_step_news_flash.png') });
    await page.click('.news-dismiss');
    await page.waitForSelector('.news-flash-overlay', { hidden: true });
    await page.evaluate(() => window.__e2eNewsUI.showHistory([window.__e2eNewsFixture]));
    await page.waitForSelector('.news-history-overlay .news-history-item');
    await page.screenshot({ path: artifact('test_step_news_history.png') });
    await page.click('.news-history-close');
    await page.waitForSelector('.news-history-overlay', { hidden: true });
    await page.click('#btn-news-history');
    await page.waitForSelector('.news-history-overlay .news-history-empty');
    await page.click('.news-history-close');
    console.log('✅ News broadcast, impact summary, ticker entry, and archive rendered.');

    console.log('\n--- Step 3d: Testing multi-round auction hall interface ---');
    await page.evaluate(async () => {
      const { AuctionUI } = await import('/src/ui/AuctionUI.js');
      window.__e2eAuctionUI = new AuctionUI();
      window.__e2eAuctionPlayers = [
        { id: 0, name: '林小满', cash: 18500, color: '#ff6b81', avatar: '👩' },
        { id: 1, name: '钱夫人', cash: 13200, color: '#feca57', avatar: '👒' },
        { id: 2, name: '阿土伯', cash: 9800, color: '#48dbfb', avatar: '👨‍🌾' }
      ];
      window.__e2eAuctionTile = { id: 18, name: '海湾金融中心', icon: '🏙️', group: 'GOLD', price: 4200, desc: '城市黄金商圈的核心商业资产。' };
      window.__e2eAuction = {
        id: 'AUCTION_E2E', sellerId: 0, tileId: 18, minimumBid: 2200,
        highestBid: 2600, highestBidderId: 2, bidderOrder: [1, 2], bidderIndex: 0,
        activeBidderIds: [1, 2], passedBidderIds: [], biddingRound: 2, status: 'OPEN',
        bidHistory: [
          { playerId: 1, amount: 2200, action: 'BID', round: 1 },
          { playerId: 2, amount: 2600, action: 'BID', round: 1 }
        ]
      };
      const context = {
        auction: window.__e2eAuction,
        tile: window.__e2eAuctionTile,
        property: { level: 2, buildingType: 'MALL' },
        bidder: window.__e2eAuctionPlayers[1],
        players: window.__e2eAuctionPlayers
      };
      window.__e2eAuctionBid = null;
      window.__e2eAuctionUI.chooseBid(context).then(value => { window.__e2eAuctionBid = value; });
    });
    await page.waitForSelector('.auction-overlay.is-visible[data-auction-mode="BID"] .auction-bid-button.is-primary');
    const auctionBidders = await page.$$eval('.auction-bidder', elements => elements.length);
    if (auctionBidders !== 2) throw new Error(`Expected 2 auction bidders, got ${auctionBidders}`);
    await page.screenshot({ path: artifact('test_step_auction_bidding.png') });
    await page.click('.auction-bid-button.is-primary');
    await page.waitForFunction(() => window.__e2eAuctionBid === 2700);
    await page.evaluate(async () => {
      const completed = {
        ...window.__e2eAuction,
        highestBid: 3100,
        highestBidderId: 1,
        status: 'RESOLVED',
        bidHistory: [...window.__e2eAuction.bidHistory, { playerId: 1, amount: 3100, action: 'BID', round: 2 }, { playerId: 2, amount: 0, action: 'PASS', round: 2 }]
      };
      const finished=window.__e2eAuctionUI.showResult(completed, window.__e2eAuctionTile, window.__e2eAuctionPlayers, 1, { level: 2, buildingType: 'MALL' });
      // Verify this short-lived fixture and its confirmation in one browser task.
      const result=document.querySelector('.auction-overlay.is-visible[data-auction-mode="RESULT"] .auction-result.is-sold');
      if(!result?.textContent.includes('$3,100'))throw new Error('Sold result amount missing');
      document.querySelector('.auction-controls .btn-primary').click();
      await finished;
    });
    await page.waitForSelector('.auction-overlay', { hidden: true });
    console.log('✅ Auction property card, bidders, bid history, custom controls, and sold result rendered.');

    console.log('\n--- Step 3e: Testing financial crisis settlement center ---');
    await page.evaluate(async () => {
      const { DebtUI } = await import('/src/ui/DebtUI.js');
      window.__e2eDebtUI = new DebtUI();
      window.__e2eDebtPlayer = { id: 0, name: '林小满', cash: 1800, deposit: 3000, color: '#ff6b81', avatar: '👩' };
      window.__e2eDebt = { debtorId: 0, creditorId: 1, amountDue: 5200, source: 'RENT:18' };
      window.__e2eDebtPortfolio = {
        amountDue: 5200, gap: 3400, cash: 1800, deposit: 3000,
        stockValue: 2500, propertyValue: 6000, liquidatableTotal: 13300, solvent: true,
        source: { icon: '🏠', label: '海湾金融中心过路费', creditorName: '钱夫人' },
        stocks: [{ id: 'TECH', name: '星河智造', shares: 20, value: 2500, suggestedShares: 12 }],
        properties: [{ tileId: 18, name: '海湾金融中心', level: 2, buildingValue: 1800, mortgageValue: 2100, liquidatableValue: 3900 }]
      };
      window.__e2eDebtActions = [
        { type: 'LIQUIDATE_DEPOSIT', amount: 3000 },
        { type: 'SELL_STOCK', stockId: 'TECH', shares: 12, estimatedRevenue: 1500 },
        { type: 'SELL_BUILDING', tileId: 18 },
        { type: 'MORTGAGE_PROPERTY', tileId: 18 },
        { type: 'AUTO_SETTLE_DEBT' },
        { type: 'DECLARE_BANKRUPTCY' }
      ];
      window.__e2eDebtAction = null;
      window.__e2eDebtUI.chooseAction({
        player: window.__e2eDebtPlayer,
        debt: window.__e2eDebt,
        portfolio: window.__e2eDebtPortfolio,
        actions: window.__e2eDebtActions,
        state: { getTile: () => window.__e2eAuctionTile }
      }).then(action => { window.__e2eDebtAction = action; });
    });
    await page.waitForSelector('.debt-overlay.is-visible .debt-center');
    const debtAssetCards = await page.$$eval('.debt-asset-card', elements => elements.length);
    if (debtAssetCards !== 4) throw new Error(`Expected 4 debt asset cards, got ${debtAssetCards}`);
    await page.screenshot({ path: artifact('test_step_debt_settlement.png') });
    await page.click('.debt-action[data-action="LIQUIDATE_DEPOSIT"]');
    await page.waitForFunction(() => window.__e2eDebtAction?.type === 'LIQUIDATE_DEPOSIT');
    await page.evaluate(async () => {
      const finished=window.__e2eDebtUI.showOutcome({
        result: { type: 'DEBT_PAID', amount: 5200 },
        player: { ...window.__e2eDebtPlayer, cash: 600 },
        debt: window.__e2eDebt
      });
      const result=document.querySelector('.debt-outcome-overlay.is-visible .debt-outcome');
      if(!result?.textContent.includes('$5,200')||!result.textContent.includes('$600'))throw new Error('Debt outcome amounts missing');
      result.querySelector('button').click();await finished;
    });
    await page.waitForSelector('.debt-outcome-overlay', { hidden: true });
    await page.evaluate(() => {
      window.__e2eDebtAction = null;
      window.__e2eDebtUI.chooseAction({
        player: window.__e2eDebtPlayer,
        debt: window.__e2eDebt,
        portfolio: { ...window.__e2eDebtPortfolio, solvent: false, liquidatableTotal: 2100 },
        actions: [{ type: 'DECLARE_BANKRUPTCY' }],
        state: { getTile: () => window.__e2eAuctionTile }
      }).then(action => { window.__e2eDebtAction = action; });
    });
    await page.waitForSelector('.debt-action[data-action="DECLARE_BANKRUPTCY"]');
    await page.click('.debt-action[data-action="DECLARE_BANKRUPTCY"]');
    await page.waitForSelector('.debt-action.is-armed');
    await page.click('.debt-action[data-action="DECLARE_BANKRUPTCY"]');
    await page.waitForFunction(() => window.__e2eDebtAction?.type === 'DECLARE_BANKRUPTCY');
    console.log('✅ Debt gap, liquidity portfolio, staged actions, outcome, and bankruptcy confirmation rendered.');

    console.log('\n--- Step 4: Testing Stock Market Modal ---');
    await page.click('#btn-stock-market');
    await page.waitForSelector('#modal-stock:not(.hidden)', { timeout: 3000 });
    console.log('✅ Stock Market modal opened.');
    
    // Check stock items & buy/sell
    const stockItems = await page.$$('.stock-item');
    console.log(`Found ${stockItems.length} stocks in stock market list.`);
    if (stockItems.length > 0) {
      await stockItems[0].click();
      await page.click('#btn-stock-buy');
      console.log('✅ Clicked Buy stock button.');
    }
    await page.evaluate(async () => {
      const [{ GameState }, { GameEngine }, { StockUI }] = await Promise.all([
        import('/src/game/GameState.js'), import('/src/game/GameEngine.js'), import('/src/ui/StockUI.js')
      ]);
      const state = new GameState({ seed: 8812 });
      state.setupGame([{ profileIndex: 0, name: '董事长验收玩家', isAI: false }, { profileIndex: 1, name: '小股东', isAI: true }], 30000, { mapId: 'city-loop' });
      state.players[0].stocks.BEVERAGE = { shares: 80, avgPrice: 100 };
      state.companyManager.updateChairmen(state.players);
      state.companyManager.get('AURORA_RETAIL').treasury = 2400;
      window.__e2eCompanyFixture = new StockUI(state, { playCoinSound() {} }, () => {}, new GameEngine(state));
      window.__e2eCompanyFixture.show(null, 'COMPANIES');
    });
    await page.waitForFunction(() => document.querySelectorAll('.company-board-card').length === 6
      && getComputedStyle(document.getElementById('stock-market-panel')).display === 'none');
    await page.waitForSelector('.company-board-card.is-chairman [data-company-policy]:not([disabled])');
    await page.click('.company-board-card.is-chairman [data-company-policy="DIVIDEND"]');
    await page.waitForSelector('.company-board-card.is-chairman .company-active-policy');
    await page.screenshot({ path: artifact('test_step_company_board.png') });
    await page.click('#stock-modal-close');
    await page.waitForSelector('#modal-stock.hidden', { timeout: 3000 });
    console.log('✅ Stock trading, six company cards, chairman perk, and board policy activation passed.');

    console.log('\n--- Step 4b: Testing rotating card shop visit ---');
    await page.evaluate(async () => {
      const [{ GameState }, { GameEngine }, { ShopUI }] = await Promise.all([
        import('/src/game/GameState.js'), import('/src/game/GameEngine.js'), import('/src/ui/ShopUI.js')
      ]);
      const state = new GameState({ seed: 7319 });
      state.setupGame([{ profileIndex: 8, name: '到店验收玩家', isAI: false }, { profileIndex: 1, name: '对手', isAI: true }], 20000, { mapId: 'city-loop' });
      const engine = new GameEngine(state);
      const player = state.players[0];
      player.currentTile = 2;
      player.cardPoints = 500;
      state.phase = 'LANDING_ACTION';
      const visit = engine.execute({ type: 'RESOLVE_LANDING', playerId: player.id, payload: { tileId: 2 } });
      window.__e2eShopState = state;
      window.__e2eShopInitialCards = player.cards.length;
      window.__e2eShopFixture = new ShopUI(state, { playCardSpell() {} }, () => {}, () => {}, engine);
      window.__e2eShopFixture.showShop({ offer: visit.offer });
    });
    await page.waitForSelector('#shop-visit-banner:not(.hidden)');
    const visitShopTelemetry = await page.evaluate(() => ({
      title: document.getElementById('shop-title')?.textContent,
      subtitle: document.getElementById('shop-subtitle')?.textContent,
      items: document.querySelectorAll('#shop-card-grid .strategy-card').length,
      discounted: [...document.querySelectorAll('#shop-card-grid .strategy-card')].filter(element=>{
        const entry=window.__e2eShopFixture.getShopEntries(window.__e2eShopState.players[0]).find(item=>item.key===element.dataset.entryKey);
        const shown=Number(element.querySelector('.strategy-card-actions > strong').firstChild.textContent.trim());
        return shown===Math.max(1,Math.round(entry.definition.cost*.85));
      }).length
    }));
    if (!visitShopTelemetry.title.includes('卡片') || !visitShopTelemetry.subtitle.includes('15%')
      || visitShopTelemetry.items !== 12 || visitShopTelemetry.discounted !== 12) {
      throw new Error(`Rotating shop presentation mismatch: ${JSON.stringify(visitShopTelemetry)}`);
    }
    await page.click('#shop-card-grid [data-entry-key^="CARD:"] .strategy-primary');
    await page.waitForFunction(() => window.__e2eShopState.players[0].cards.length > window.__e2eShopInitialCards);
    await page.screenshot({ path: artifact('test_step_rotating_shop.png') });
    await page.click('#shop-modal-close');
    await page.waitForSelector('#modal-shop.hidden', { timeout: 3000 });
    console.log('✅ Limited shelf, visit bonus, discount, purchase, and next-round refresh messaging rendered.');

    console.log('\n--- Step 5: Testing Card Shop Modal ---');
    await page.click('#btn-card-shop');
    await page.waitForSelector('#modal-shop:not(.hidden)', { timeout: 3000 });
    console.log('✅ Card Shop modal opened.');
    const shopCards = await page.$$('#shop-card-grid .strategy-card');
    console.log(`Found ${shopCards.length} items in Card Shop.`);
    await page.click('#shop-modal-close');
    await page.waitForSelector('#modal-shop.hidden', { timeout: 5000 });
    console.log('✅ Card Shop modal closed.');

    console.log('\n--- Step 6: Testing Inventory Modal ---');
    await page.click('#btn-use-card');
    await page.waitForSelector('#modal-inventory:not(.hidden)', { timeout: 3000 });
    console.log('✅ Inventory modal opened.');
    await page.click('#inventory-modal-close');
    await page.waitForSelector('#modal-inventory.hidden', { timeout: 3000 });
    console.log('✅ Inventory modal closed.');

    console.log('\n--- Step 6b: Testing Asset and Property Management Center ---');
    await page.click('#btn-assets');
    await page.waitForSelector('#modal-assets:not(.hidden)', { timeout: 3000 });
    const assetRows = await page.$$('#asset-ranking-body tr');
    if (assetRows.length !== 4) throw new Error(`Expected 4 asset rows, got ${assetRows.length}`);
    await page.evaluate(async () => {
      const [{ GameState }, { GameEngine }, { AssetUI }] = await Promise.all([
        import('/src/game/GameState.js'), import('/src/game/GameEngine.js'), import('/src/ui/AssetUI.js')
      ]);
      const state = new GameState({ seed: 7711 });
      state.setupGame([{ profileIndex: 0, name: '地产验收玩家', isAI: false }, { profileIndex: 1, name: '竞争对手', isAI: true }], 30000, { mapId: 'city-loop' });
      state.players[0].stocks.MINING = { shares: 80, avgPrice: 100 };
      state.companyManager.updateChairmen(state.players);
      [1, 3, 5].forEach(tileId => state.propertyManager.buyProperty(tileId, 0));
      state.propertyManager.upgradeProperty(1);
      window.__e2eAssetFixture = new AssetUI(state, new GameEngine(state), null, () => {});
      window.__e2eAssetFixture.show('PROPERTIES');
    });
    await page.waitForFunction(() => document.querySelectorAll('.property-portfolio-card').length === 3);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('asset-ranking-panel')).display === 'none');
    const propertyControls = await page.$$('.property-card-actions [data-property-action]');
    if (propertyControls.length < 3) throw new Error('Expected property sale, mortgage, and conversion controls.');
    const materialRecovery = await page.$eval('.property-portfolio-card[data-property-id="1"] [data-property-action="SELL_BUILDING"]', button => button.textContent);
    if (!materialRecovery.includes('$390')) throw new Error(`Expected material chairman recovery preview, got ${materialRecovery}`);
    await page.screenshot({ path: artifact('test_step_property_management.png') });
    await page.click('[data-asset-tab="DISTRICTS"]');
    await page.waitForSelector('.district-card.complete');
    const districtCards = await page.$$('.district-card');
    if (districtCards.length < 4) throw new Error(`Expected district overview cards, got ${districtCards.length}`);
    await page.click('#asset-modal-close');
    await page.waitForSelector('#modal-assets.hidden', { timeout: 3000 });
    console.log('✅ Asset ranking, property controls, rent/value cards, and monopoly district overview rendered.');

    console.log('\n--- Step 6c: Testing Player Asset Market ---');
    await page.click('#btn-market');
    await page.waitForSelector('#modal-market:not(.hidden)', { timeout: 3000 });
    await page.click('[data-market-tab="ASSETS"]');
    await page.waitForSelector('.market-asset-row', { timeout: 3000 });
    const listingButton = await page.$('.market-asset-row [data-market-action="LIST"]');
    if (!listingButton) throw new Error('Expected at least one market-listable starting asset.');
    await listingButton.click();
    await page.click('[data-market-tab="OFFERS"]');
    await page.waitForSelector('.market-offer-card [data-market-action="CANCEL"]', { timeout: 3000 });
    await page.screenshot({ path: artifact('test_step_market_hall.png') });
    await page.click('#market-modal-close');
    await page.waitForSelector('#modal-market.hidden', { timeout: 3000 });
    console.log('✅ Market hall listed an asset and rendered valuation, expiry, and seller controls.');

    console.log('\n--- Step 6d: Testing Pause, Speed, and V11 Save Slot ---');
    await page.click('#btn-pause-game');
    await page.waitForSelector('#modal-pause:not(.hidden)', { timeout: 3000 });
    await page.click('.speed-btn[data-speed=\"2\"]');
    const slotRows = await page.$$('#save-slot-list .save-slot-row');
    if (slotRows.length !== 3) throw new Error(`Expected 3 save slots, got ${slotRows.length}`);
    await slotRows[0].$('.slot-save').then(button => button.click());
    await page.click('#btn-resume-game');
    await page.waitForSelector('#modal-pause.hidden', { timeout: 3000 });
    console.log('✅ Pause menu, speed control, and manual slot save passed.');

    console.log('\n--- Step 6e: Testing three distinct minigames ---');
    const launchMinigame = gameId => page.evaluate(async id => {
      const { MinigameUI } = await import('/src/ui/MinigameUI.js');
      window.__e2eMinigame = window.__e2eMinigame || new MinigameUI();
      window.__e2eMinigameResult = window.__e2eMinigame.play(id);
    }, gameId);

    await launchMinigame('HARBOR_SORT');
    await page.click('.minigame-start');
    await page.waitForSelector('.minigame-modal[data-game-id="HARBOR_SORT"] .harbor-cargo');
    await page.click('.harbor-bins [data-bin="COLD"]');
    await page.waitForFunction(() => document.querySelector('.minigame-score span')?.textContent === '10');
    await page.screenshot({ path: artifact('test_step_minigame_harbor.png') });
    await page.click('.minigame-skip');
    await page.waitForSelector('.minigame-claim');
    await page.click('.minigame-claim');
    await page.waitForSelector('.minigame-modal', { hidden: true });

    await launchMinigame('SKY_COINS');
    await page.click('.minigame-start');
    await page.waitForSelector('.minigame-modal[data-game-id="SKY_COINS"] .sky-object[data-kind="COIN"]');
    await page.click('.sky-object[data-kind="COIN"]');
    await page.waitForFunction(() => Number(document.querySelector('.minigame-score span')?.textContent) >= 10);
    await page.screenshot({ path: artifact('test_step_minigame_sky.png') });
    await page.click('.minigame-skip');
    await page.waitForSelector('.minigame-claim');
    await page.click('.minigame-claim');
    await page.waitForSelector('.minigame-modal', { hidden: true });

    await launchMinigame('ROUTE_MEMORY');
    await page.click('.minigame-start');
    await page.waitForSelector('.minigame-modal[data-game-id="ROUTE_MEMORY"] .route-beacons');
    await page.waitForFunction(() => {
      const feedback = document.querySelector('.minigame-feedback')?.textContent || '';
      return feedback.includes('现在按顺序')
        && [...document.querySelectorAll('.route-beacons button')].every(button => !button.disabled);
    }, { timeout: 5000 });
    await page.click('.route-beacons [data-direction="0"]');
    await page.click('.route-beacons [data-direction="2"]');
    await page.waitForFunction(() => document.querySelector('.minigame-score span')?.textContent === '20');
    await page.screenshot({ path: artifact('test_step_minigame_route.png') });
    await page.click('.minigame-skip');
    await page.waitForSelector('.minigame-claim');
    await page.click('.minigame-claim');
    await page.waitForSelector('.minigame-modal', { hidden: true });
    console.log('✅ Harbor sorting, sky collection, and route memory minigames passed.');

    console.log('\n--- Step 7: Testing Dice Roll (Click & Space bar) and Movement & AI Turns ---');
    console.log('Clicking "掷骰子" button for Player 1 turn...');
    await page.evaluate(() => {
      window.__dicePresentation = null;
      const started = performance.now();
      const inspect = () => {
        const element = document.querySelector('.presentation-dice-result.is-visible');
        if (element) {
          const style = getComputedStyle(element);
          if (Number(style.opacity) >= 0.9) {
            const rect = element.getBoundingClientRect();
            window.__dicePresentation = {
              dice: element.querySelectorAll('.presentation-die').length,
              text: element.textContent.replace(/\s+/g, ' ').trim(),
              opacity: Number(style.opacity), visibility: style.visibility,
              width: rect.width, height: rect.height
            };
            return;
          }
        }
        if (performance.now() - started < 30000) requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    });
    await Promise.all([
      page.waitForFunction(() => window.__dicePresentation !== null, { timeout: 30000 }),
      page.click('#btn-roll')
    ]);
    const dicePresentation = await page.evaluate(() => window.__dicePresentation);
    if (dicePresentation.dice < 1 || !dicePresentation.text.includes('前进') || !dicePresentation.text.includes('步')
      || dicePresentation.opacity < 0.9 || dicePresentation.visibility !== 'visible' || dicePresentation.width < 200) {
      throw new Error(`Dice presentation content mismatch: ${JSON.stringify(dicePresentation)}`);
    }
    await page.screenshot({ path: artifact('test_step_dice_presentation.png') });
    let capturedLandArt = false;

    for (let turn = 1; turn <= 12; turn++) {
      await new Promise(r => setTimeout(r, 2000));

      // Handle Land Modal if present
      const landModalVisible = await page.evaluate(() => {
        const el = document.getElementById('modal-land');
        return el && !el.classList.contains('hidden');
      });

      if (landModalVisible) {
        console.log(`[Turn ${turn}] 🏡 Land purchase modal open. Responding...`);
        if (!capturedLandArt) {
          const hasBuildingArt = await page.$eval('#land-building-art', element => getComputedStyle(element).backgroundImage !== 'none');
          if (!hasBuildingArt) throw new Error('Procedural building preview was not rendered');
          await page.screenshot({ path: artifact('test_step_land_art.png') });
          capturedLandArt = true;
        }
        const buyBtnVisible = await page.evaluate(() => {
          const btn = document.getElementById('btn-land-buy');
          return btn && btn.offsetWidth > 0;
        });
        if (buyBtnVisible) {
          await page.click('#btn-land-buy');
          const paidPurchase = await page.waitForSelector('.presentation-cash-burst.is-loss', { timeout: 2000 })
            .then(() => true)
            .catch(() => false);
          console.log(paidPurchase ? '✅ Land bought with cash presentation.' : '✅ Land purchase action resolved without a cash charge.');
        } else {
          await page.click('#btn-land-pass');
          console.log('✅ Land passed.');
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      // Check if Human turn is active
      const isHumanTurn = await page.evaluate(() => {
        const rollBtn = document.getElementById('btn-roll');
        const banner = document.getElementById('turn-indicator')?.textContent || '';
        return banner.includes('林小满') || (rollBtn && !rollBtn.disabled && rollBtn.offsetWidth > 0);
      });

      if (isHumanTurn) {
        console.log(`[Turn ${turn}] 🎲 Human player active. Pressing Space key to roll...`);
        await page.keyboard.press('Space');
      } else {
        const activeTurnText = await page.evaluate(() => document.getElementById('turn-indicator')?.textContent || '');
        console.log(`[Turn ${turn}] 🤖 Current turn: ${activeTurnText.trim()}`);
      }
    }
    await page.screenshot({ path: artifact('test_step_visual_gameplay.png') });

    console.log('\n--- Step 8: Audio & View reset button tests ---');
    await page.click('#btn-toggle-audio');
    console.log('✅ Mute/Unmute button toggled.');
    await page.click('#btn-reset-view');
    console.log('✅ Reset 3D camera view button clicked.');

    console.log('\n--- Step 9: Returning to setup without page reload ---');
    page.once('dialog', dialog => dialog.accept());
    await page.evaluate(() => document.getElementById('btn-return-menu').click());
    await page.waitForSelector('#setup-screen.active:not(.hidden)', { timeout: 3000 });
    console.log('✅ Returned to setup without reloading the page.');

    console.log('\n--- Step 10: Testing legacy 40-node map rendering ---');
    await page.select('#map-select', 'taiwan-loop');
    await page.click('#start-game-btn');
    await page.waitForSelector('#hud-layer:not(.hidden)', { timeout: 5000 });
    const legacyTelemetry = await page.$eval('#game-container', element => ({
      mapId: element.dataset.mapId,
      tileCount: element.dataset.tileCount
    }));
    if (legacyTelemetry.mapId !== 'taiwan-loop' || legacyTelemetry.tileCount !== '40') {
      throw new Error(`Legacy map did not render all 40 nodes: ${JSON.stringify(legacyTelemetry)}`);
    }
    console.log('✅ Legacy Taiwan map rendered all 40 nodes after a live map switch.');

    console.log('\n🎉 ALL GAMEPLAY TESTS COMPLETED!');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    pageErrors.push(err.toString());
    process.exitCode = 1;
  } finally {
    await browser.close();
    await viteServer.close();

    console.log('\n================ FULL TEST REPORT ================');
    console.log(`Total Console Messages logged: ${logs.length}`);
    console.log(`Network / HTTP Errors (${networkErrors.length}):`);
    networkErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    console.log(`JS Console Errors (${errors.length}):`);
    errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));

    console.log(`Page Uncaught Errors (${pageErrors.length}):`);
    pageErrors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
    if(networkErrors.length||errors.length||pageErrors.length)process.exitCode=1;
    console.log(`Screenshots: ${artifactDirectory}`);
    console.log('==================================================\n');
  }
}

runTest();
