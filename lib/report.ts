import Anthropic from '@anthropic-ai/sdk';
import type { WeeklyReport, CompanyEstimateDetailed } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(report: Omit<WeeklyReport, 'narrative'>): string {
  const { prices, estimates } = report;

  const priceBlock = `
当前行情（${new Date(prices.fetchedAt).toLocaleDateString('zh-CN')}）：
- 沪铝主力价：${prices.alPrice.toLocaleString()} 元/吨
- 氧化铝主力价：${prices.aluminaPrice.toLocaleString()} 元/吨
- 数据来源：${prices.source}`;

  const estBlock = (estimates as CompanyEstimateDetailed[])
    .map(
      (e) => `
【${e.name}（${e.code}）】
  产量：${e.alProduction} 万吨/年，氧化铝自给率 ${(e.aluminaSelfSupply * 100).toFixed(0)}%，电价 ${e.powerPrice} 元/kWh
  完全变动成本：${e.varCostPerTon.toLocaleString()} 元/吨  毛利/吨：${e.grossProfitPerTon.toLocaleString()} 元
  2026E 净利润：${e.netProfit} 亿元  EPS：${e.eps} 元/股
  铝价每涨 1000 元/吨 → 净利 +${e.alSensitivity} 亿元
  氧化铝每涨 100 元/吨 → 净利 ${e.aluminaSensitivity} 亿元`
    )
    .join('\n');

  return `你是中国有色金属行业卖方分析师。基于以下数据，用中文写一份350字左右的周报摘要，分四段：①铝价/氧化铝价格水平及趋势点评 ②三家公司成本结构与盈利能力差异分析 ③各公司EPS核心驱动与风险 ④投资建议（推荐/中性/回避及理由）。直接输出正文，无需标题。

${priceBlock}

${estBlock}`;
}

export async function generateNarrative(
  report: Omit<WeeklyReport, 'narrative'>
): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: buildPrompt(report) }],
  });

  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');
}
