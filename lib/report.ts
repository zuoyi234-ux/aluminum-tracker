import Anthropic from '@anthropic-ai/sdk';
import type { WeeklyReport } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(report: Omit<WeeklyReport, 'narrative'>): string {
  const { prices, estimates } = report;

  const priceBlock = `
当前行情（${new Date(prices.fetchedAt).toLocaleDateString('zh-CN')}）：
- 沪铝现货价：${prices.alPrice.toLocaleString()} 元/吨
- 氧化铝现货价：${prices.aluminaPrice.toLocaleString()} 元/吨
- 数据来源：${prices.source}`;

  const estBlock = estimates
    .map(
      (e) => `
【${e.name}（${e.code}）】
  2026E 收入：${e.revenue} 亿元
  2026E 毛利：${e.grossProfit} 亿元
  2026E 净利润：${e.netProfit} 亿元
  2026E EPS：${e.eps} 元/股
  铝价每涨 1000 元/吨 → 净利 +${e.alSensitivity} 亿元
  氧化铝每涨 100 元/吨  → 净利 ${e.aluminaSensitivity} 亿元`
    )
    .join('\n');

  return `你是中国有色金属行业卖方分析师。基于以下数据，用中文写一份300字左右的周报摘要，分四段：①铝价/氧化铝价格水平点评 ②三家公司盈利能力差异及成因 ③各公司EPS核心假设与风险 ④投资建议（推荐/中性/回避）。直接输出正文，无需标题。

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
