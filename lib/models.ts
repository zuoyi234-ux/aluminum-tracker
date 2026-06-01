import type { CompanyParams, CompanyEstimateDetailed, Prices } from './types';

// ── 三家公司的核心参数（2026 年经营假设）────────────────────────────────
// 数据来源：公司公告 + Wind 分析师一致预期整理
export const COMPANIES: CompanyParams[] = [
  {
    code: '600595',
    name: '中孚实业',
    alProduction: 48,           // 万吨/年（有效产能）
    aluminaConsumption: 1.92,
    aluminaSelfSupply: 0.05,    // 基本外购
    aluminaSelfCostRatio: 0.65,
    powerConsumption: 13_500,   // kwh/吨
    powerPrice: 0.375,          // 元/kwh（工业用电）
    otherVarCost: 2_600,        // 碳阳极 + 辅料 + 折旧等，元/吨铝
    periodExpenses: 12.0,       // 亿元/年
    otherProfit: 0.5,           // 亿元/年（电缆等）
    taxRate: 0.25,
    shares: 14.1,               // 亿股
  },
  {
    code: '000933',
    name: '神火股份',
    alProduction: 103,
    aluminaConsumption: 1.92,
    aluminaSelfSupply: 0.40,    // 权益氧化铝约 40 万吨
    aluminaSelfCostRatio: 0.62,
    powerConsumption: 13_300,
    powerPrice: 0.360,
    otherVarCost: 2_450,
    periodExpenses: 25.0,
    otherProfit: 7.0,           // 煤炭业务稳定贡献
    taxRate: 0.25,
    shares: 19.0,
  },
  {
    code: '000807',
    name: '云铝股份',
    alProduction: 290,
    aluminaConsumption: 1.92,
    aluminaSelfSupply: 0.48,    // 权益氧化铝约 140 万吨
    aluminaSelfCostRatio: 0.60,
    powerConsumption: 13_000,
    powerPrice: 0.220,          // 水电优势
    otherVarCost: 2_200,
    periodExpenses: 60.0,
    otherProfit: 2.0,
    taxRate: 0.15,              // 高新技术企业
    shares: 61.0,
  },
];

// ── 单家公司测算 ──────────────────────────────────────────────────────────
export function calcEstimate(p: CompanyParams, prices: Prices): CompanyEstimateDetailed {
  const { alPrice, aluminaPrice } = prices;
  const prodTon = p.alProduction * 10_000;

  const aluminaCostPerTon =
    p.aluminaConsumption *
    (p.aluminaSelfSupply * aluminaPrice * p.aluminaSelfCostRatio +
      (1 - p.aluminaSelfSupply) * aluminaPrice);

  const powerCostPerTon = p.powerConsumption * p.powerPrice;
  const varCostPerTon = aluminaCostPerTon + powerCostPerTon + p.otherVarCost;

  const grossProfitPerTon = alPrice - varCostPerTon;
  const grossProfit = (grossProfitPerTon * prodTon) / 1e8;
  const revenue = (alPrice * prodTon) / 1e8;

  const mainOperatingProfit = grossProfit - p.periodExpenses;
  const preTaxProfit = mainOperatingProfit + p.otherProfit;
  const netProfit = preTaxProfit * (1 - p.taxRate);
  const eps = netProfit / p.shares;

  const alSensitivity = ((1_000 * prodTon) / 1e8) * (1 - p.taxRate);
  const aluminaSensitivity =
    ((-100 * p.aluminaConsumption * (1 - p.aluminaSelfSupply) * prodTon) / 1e8) *
    (1 - p.taxRate);

  return {
    code: p.code,
    name: p.name,
    revenue: round2(revenue),
    grossProfit: round2(grossProfit),
    netProfit: round2(netProfit),
    eps: round2(eps),
    alSensitivity: round2(alSensitivity),
    aluminaSensitivity: round2(aluminaSensitivity),
    // source params
    alProduction: p.alProduction,
    aluminaConsumption: p.aluminaConsumption,
    aluminaSelfSupply: p.aluminaSelfSupply,
    powerConsumption: p.powerConsumption,
    powerPrice: p.powerPrice,
    otherVarCostInput: p.otherVarCost,
    periodExpenses: p.periodExpenses,
    otherProfit: p.otherProfit,
    taxRate: p.taxRate,
    shares: p.shares,
    // intermediate steps
    aluminaCostPerTon: round2(aluminaCostPerTon),
    powerCostPerTon: round2(powerCostPerTon),
    varCostPerTon: round2(varCostPerTon),
    grossProfitPerTon: round2(grossProfitPerTon),
    mainOperatingProfit: round2(mainOperatingProfit),
    preTaxProfit: round2(preTaxProfit),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── 全部公司 ──────────────────────────────────────────────────────────────
export function calcAllEstimates(prices: Prices): CompanyEstimateDetailed[] {
  return COMPANIES.map((c) => calcEstimate(c, prices));
}
