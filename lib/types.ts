export interface Prices {
  alPrice: number;       // 沪铝现货价，元/吨
  aluminaPrice: number;  // 氧化铝现货价，元/吨
  fetchedAt: string;     // ISO timestamp
  source: string;
}

export interface CompanyParams {
  code: string;
  name: string;
  // 产量
  alProduction: number;        // 万吨/年
  // 成本结构
  aluminaConsumption: number;  // 吨氧化铝/吨铝，行业约 1.92
  aluminaSelfSupply: number;   // 氧化铝自给率 0~1
  aluminaSelfCostRatio: number;// 自产氧化铝的成本/市价，通常 0.60~0.70
  powerConsumption: number;    // kwh/吨铝
  powerPrice: number;          // 元/kwh
  otherVarCost: number;        // 其他可变成本，元/吨铝
  // 公司层面
  periodExpenses: number;      // 期间费用，亿元/年
  otherProfit: number;         // 其他业务净利（煤炭等），亿元/年
  taxRate: number;             // 所得税率
  shares: number;              // 总股本，亿股
}

export interface CompanyEstimate {
  code: string;
  name: string;
  revenue: number;       // 亿元
  grossProfit: number;   // 亿元
  netProfit: number;     // 亿元
  eps: number;           // 元/股
  alSensitivity: number; // 亿元，铝价每涨 1000 元/吨
  aluminaSensitivity: number; // 亿元，氧化铝价每涨 100 元/吨
}

// 含完整计算中间值，用于前端"业绩计算过程"展示
export interface CompanyEstimateDetailed extends CompanyEstimate {
  // 输入参数（便于审计）
  alProduction: number;        // 万吨/年
  aluminaConsumption: number;  // 吨氧化铝/吨铝
  aluminaSelfSupply: number;   // 自给率 0~1
  powerConsumption: number;    // kWh/吨铝
  powerPrice: number;          // 元/kWh
  otherVarCostInput: number;   // 其他变动成本，元/吨铝
  periodExpenses: number;      // 期间费用，亿元
  otherProfit: number;         // 其他业务净利，亿元
  taxRate: number;             // 所得税率
  shares: number;              // 总股本，亿股
  // 计算中间值
  aluminaCostPerTon: number;   // 氧化铝成本，元/吨铝
  powerCostPerTon: number;     // 电力成本，元/吨铝
  varCostPerTon: number;       // 完全变动成本，元/吨铝
  grossProfitPerTon: number;   // 毛利/吨，元
  mainOperatingProfit: number; // 主业税前利润，亿元
  preTaxProfit: number;        // 合并税前利润，亿元
}

export interface WeeklyReport {
  prices: Prices;
  estimates: CompanyEstimateDetailed[];
  narrative: string;
  generatedAt: string;
}

export interface WeeklySnapshot {
  weekLabel: string; // e.g. "2026-W23"
  at: string;        // ISO timestamp
  alPrice: number;
  aluminaPrice: number;
  estimates: Array<{ code: string; name: string; netProfit: number; eps: number }>;
}
