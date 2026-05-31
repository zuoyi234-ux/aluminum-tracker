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
  // 敏感性：铝价每涨 1000 元/吨 对净利的影响
  alSensitivity: number; // 亿元
  // 敏感性：氧化铝价每涨 100 元/吨 对净利的影响
  aluminaSensitivity: number; // 亿元
}

export interface WeeklyReport {
  prices: Prices;
  estimates: CompanyEstimate[];
  narrative: string; // Claude 生成的中文分析
  generatedAt: string;
}
