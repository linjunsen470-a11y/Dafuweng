// @ts-check

import { COMPANIES } from './ContentRegistry.js';

/** @typedef {import('./types.js').CompanyState & { icon: string, baseFee: number, perk: string }} RuntimeCompany */
/** @typedef {{ id: number, isBankrupt: boolean, cash: number, stocks?: Record<string, { shares: number }> }} CompanyPlayer */
/** @typedef {{ int(min: number, max: number): number }} RandomSource */
/** @typedef {{ companyId: string, previousId: number | null, chairmanId: number | null }} ChairmanChange */
/** @typedef {{ playerId: number, amount: number }} DividendPayment */
/** @typedef {{ companyId: string, operation: number, dividendPool: number, payments: DividendPayment[], treasury: number }} CompanySettlement */

export class CompanyManager {
  constructor() {
    /** @type {RuntimeCompany[]} */
    this.companies = [];
    this.reset();
  }

  reset() {
    this.companies = COMPANIES.map(definition => ({
      ...definition,
      treasury: 1200,
      periodRevenue: 0,
      chairmanId: null,
      lastDividend: 0
    }));
  }

  /** @param {string} companyId */
  get(companyId) {
    return this.companies.find(company => company.id === companyId) || null;
  }

  /** @param {string} companyId @param {number} amount */
  recordRevenue(companyId, amount) {
    const company = this.get(companyId);
    if (!company) return 0;
    const value = Math.max(0, Math.round(amount));
    company.treasury += value;
    company.periodRevenue += value;
    return value;
  }

  /** @param {CompanyPlayer[]} players @returns {ChairmanChange[]} */
  updateChairmen(players) {
    /** @type {ChairmanChange[]} */
    const changes = [];
    this.companies.forEach(company => {
      const ranking = players
        .filter(player => !player.isBankrupt)
        .map(player => ({ playerId: player.id, shares: player.stocks?.[company.stockId]?.shares || 0 }))
        .filter(entry => entry.shares > 0)
        .sort((a, b) => b.shares - a.shares || a.playerId - b.playerId);
      const chairmanId = ranking[0]?.playerId ?? null;
      if (chairmanId !== company.chairmanId) {
        changes.push({ companyId: company.id, previousId: company.chairmanId, chairmanId });
        company.chairmanId = chairmanId;
      }
    });
    return changes;
  }

  /** @param {CompanyPlayer[]} players @param {RandomSource} rng @returns {CompanySettlement[]} */
  settle(players, rng) {
    /** @type {CompanySettlement[]} */
    const results = [];
    this.companies.forEach(company => {
      const operation = rng.int(-350, 850);
      company.treasury = Math.max(0, company.treasury + operation);
      const holders = players
        .map(player => ({ player, shares: player.stocks?.[company.stockId]?.shares || 0 }))
        .filter(entry => !entry.player.isBankrupt && entry.shares > 0);
      const totalShares = holders.reduce((sum, entry) => sum + entry.shares, 0);
      const dividendPool = totalShares ? Math.min(company.treasury, Math.max(0, Math.round(company.periodRevenue * 0.6 + operation * 0.25))) : 0;
      /** @type {DividendPayment[]} */
      const payments = [];
      holders.forEach(({ player, shares }) => {
        const amount = Math.floor(dividendPool * shares / totalShares);
        if (amount <= 0) return;
        player.cash += amount;
        payments.push({ playerId: player.id, amount });
      });
      company.treasury -= payments.reduce((sum, payment) => sum + payment.amount, 0);
      company.lastDividend = dividendPool;
      company.periodRevenue = 0;
      results.push({ companyId: company.id, operation, dividendPool, payments, treasury: company.treasury });
    });
    return results;
  }
}
