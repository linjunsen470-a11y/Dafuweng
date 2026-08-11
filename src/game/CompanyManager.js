// @ts-check

import { COMPANIES } from './ContentRegistry.js';
import { COMPANY_POLICIES } from './CompanyRules.js';

/** @typedef {import('./types.js').CompanyState & { icon: string, baseFee: number, perk: string }} RuntimeCompany */
/** @typedef {{ id: number, isBankrupt: boolean, cash: number, cardPoints?: number, stocks?: Record<string, { shares: number }> }} CompanyPlayer */
/** @typedef {{ int(min: number, max: number): number }} RandomSource */
/** @typedef {{ companyId: string, previousId: number | null, chairmanId: number | null }} ChairmanChange */
/** @typedef {{ playerId: number, amount: number }} DividendPayment */
/** @typedef {{ companyId: string, operation: number, dividendPool: number, payments: DividendPayment[], treasury: number, policyId: string | null }} CompanySettlement */

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
      lastDividend: 0,
      policyId: null,
      policyStartedRound: null,
      policyHistory: []
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

  /** @param {RuntimeCompany[]} companies */
  importState(companies = []) {
    const saved = new Map(companies.map(company => [company.id, company]));
    this.companies = COMPANIES.map(definition => ({
      ...definition,
      treasury: 1200, periodRevenue: 0, chairmanId: null, lastDividend: 0,
      policyId: null, policyStartedRound: null, policyHistory: [],
      ...(saved.get(definition.id) || {})
    }));
  }

  /** @param {string} companyId @param {number} playerId @param {string} policyId @param {number} round */
  startPolicy(companyId, playerId, policyId, round) {
    const company = this.get(companyId);
    const policy = COMPANY_POLICIES.find(entry => entry.id === policyId);
    if (!company || !policy) return { success: false, reason: '公司或经营政策无效' };
    if (company.chairmanId !== playerId) return { success: false, reason: '只有公司董事长可以决策' };
    if (company.policyId) return { success: false, reason: '公司本周期已有经营政策' };
    if (company.treasury < policy.cost) return { success: false, reason: '公司金库不足', cost: policy.cost };
    company.treasury -= policy.cost;
    company.policyId = policy.id;
    company.policyStartedRound = round;
    return { success: true, companyId, policyId, cost: policy.cost, treasury: company.treasury };
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
      const policy = COMPANY_POLICIES.find(entry => entry.id === company.policyId) || null;
      let operation = policy?.id === 'EXPANSION' ? rng.int(-150, 1100) : rng.int(-350, 850);
      if (policy?.id === 'RESERVE') operation = Math.max(-50, operation);
      if (policy?.id === 'INNOVATION') {
        operation += 300;
        const chairman = players.find(player => player.id === company.chairmanId);
        if (chairman) chairman.cardPoints = (chairman.cardPoints || 0) + 80;
      }
      company.treasury = Math.max(0, company.treasury + operation);
      const holders = players
        .map(player => ({ player, shares: player.stocks?.[company.stockId]?.shares || 0 }))
        .filter(entry => !entry.player.isBankrupt && entry.shares > 0);
      const totalShares = holders.reduce((sum, entry) => sum + entry.shares, 0);
      const revenueRatio = policy?.id === 'DIVIDEND' ? 0.85 : policy?.id === 'EXPANSION' ? 0.7 : policy?.id === 'RESERVE' ? 0.45 : 0.6;
      const operationRatio = policy?.id === 'RESERVE' ? 0.1 : 0.25;
      const dividendPool = totalShares ? Math.min(company.treasury, Math.max(0, Math.round(company.periodRevenue * revenueRatio + operation * operationRatio))) : 0;
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
      if (policy) company.policyHistory = [...(company.policyHistory || []), { policyId: policy.id, round: company.policyStartedRound, dividendPool, operation }].slice(-8);
      company.policyId = null;
      company.policyStartedRound = null;
      results.push({ companyId: company.id, operation, dividendPool, payments, treasury: company.treasury, policyId: policy?.id || null });
    });
    return results;
  }
}
