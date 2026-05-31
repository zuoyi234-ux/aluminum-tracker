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

  return `你是一位专注中国有色金属行业的卖方分析师，请基于以下数据撰写一份简洁、专业的周报，约 600 字，使用中文。

${priceBlock}

三家公司 2026 年业绩重新测算：
${estBlock}

请从以下几个维度展开分析：
1. 本周铝价与氧化铝价格水平评价，与历史均值对比判断高低
2. 三家公司在当前价格下的盈利能力差异及成因（水电优势、自给率等）
3. 对各公司 2026 年 EPS 的核心假设与风险提示
4. 基于上述分析，对三家公司的短期投资建议（推荐 / 中性 / 回避）

语言简练，有观点，不必重复列出表格数据。`;
}

export async function generateNarrative(
  report: Omit<WeeklyReport, 'narrative'>
): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(report) }],
  });

  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');
}
