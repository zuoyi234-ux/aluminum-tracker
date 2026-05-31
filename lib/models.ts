import type { CompanyParams, CompanyEstimate, Prices } from './types';

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
export function calcEstimate(p: CompanyParams, prices: Prices): CompanyEstimate {
  const { alPrice, aluminaPrice } = prices;
  const prodTon = p.alProduction * 10_000; // 转换为吨

  // 氧化铝成本（元/吨铝）
  const aluminaCostPerTon =
    p.aluminaConsumption *
    (p.aluminaSelfSupply * aluminaPrice * p.aluminaSelfCostRatio +
      (1 - p.aluminaSelfSupply) * aluminaPrice);

  // 电力成本（元/吨铝）
  const powerCostPerTon = p.powerConsumption * p.powerPrice;

  // 完全变动成本（元/吨铝）
  const varCostPerTon = aluminaCostPerTon + powerCostPerTon + p.otherVarCost;

  // 毛利（亿元）
  const grossProfitPerTon = alPrice - varCostPerTon;
  const grossProfit = (grossProfitPerTon * prodTon) / 1e8;

  // 收入（亿元）
  const revenue = (alPrice * prodTon) / 1e8;

  // 主业税前利润
  const mainOperatingProfit = grossProfit - p.periodExpenses;

  // 合并其他业务，计税
  const preTaxProfit = mainOperatingProfit + p.otherProfit;
  const netProfit = preTaxProfit * (1 - p.taxRate);

  const eps = netProfit / p.shares;

  // ── 敏感性分析 ────────────────────────────────────────────────────────
  // 铝价 +1000 元/吨 → 净利变化（亿元）
  const alSensitivity =
    ((1_000 * prodTon) / 1e8) * (1 - p.taxRate);

  // 氧化铝价 +100 元/吨 → 净利变化（亿元，负值代表成本上升）
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
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── 全部公司 ──────────────────────────────────────────────────────────────
export function calcAllEstimates(prices: Prices): CompanyEstimate[] {
  return COMPANIES.map((c) => calcEstimate(c, prices));
}
