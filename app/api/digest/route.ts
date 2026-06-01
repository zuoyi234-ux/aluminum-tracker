import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import Parser from 'rss-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────
interface RawItem { title: string; summary: string; source: string; category: string }

export interface DigestItem { id: number; title: string; body: string }
export interface DigestData {
  date: string;
  lead: string;
  items: DigestItem[];
  summary: string;
}

// ── Config ────────────────────────────────────────────────────────────────
const FEEDS = [
  { name: 'Hacker News',  url: 'https://news.ycombinator.com/rss',       category: '科技' },
  { name: 'TechCrunch',   url: 'https://techcrunch.com/feed/',            category: '科技' },
  { name: 'The Verge',    url: 'https://www.theverge.com/rss/index.xml',  category: '科技' },
  { name: 'Reuters',      url: 'https://feeds.reuters.com/reuters/topNews', category: '国际' },
  { name: 'BBC',          url: 'http://feeds.bbci.co.uk/news/rss.xml',    category: '国际' },
];

const TZ_OFFSET = 8; // Asia/Shanghai

function yesterdayStr(): string {
  const now = new Date(Date.now() + TZ_OFFSET * 3600_000);
  const y = new Date(now);
  y.setUTCDate(y.getUTCDate() - 1);
  return y.toISOString().slice(0, 10);
}

function toLocalDateStr(d: Date): string {
  return new Date(d.getTime() + TZ_OFFSET * 3600_000).toISOString().slice(0, 10);
}

// ── Fetch RSS ─────────────────────────────────────────────────────────────
async function fetchAllNews(): Promise<RawItem[]> {
  const parser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'aluminum-tracker/1.0' } });
  const yest = yesterdayStr();

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items
        .filter((item) => {
          const d = item.pubDate ? new Date(item.pubDate) : null;
          return d && toLocalDateStr(d) === yest;
        })
        .slice(0, 4)
        .map((item) => ({
          title: item.title ?? '',
          summary: (item.contentSnippet ?? item.content ?? '').slice(0, 300),
          source: feed.name,
          category: feed.category,
        }));
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<RawItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .slice(0, 15);
}

// ── Summarize with Claude ─────────────────────────────────────────────────
async function summarize(items: RawItem[], dateLabel: string): Promise<DigestData> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const numbered = items
    .map((it, i) => `${i + 1}. [${it.source}] ${it.title}\n   ${it.summary}`)
    .join('\n');

  const prompt = `你是科技财经新闻编辑，请将以下 ${dateLabel} 的英文新闻整理成面向中国投研人群的中文晨报摘要。

输出严格为 JSON，不要任何 markdown 包裹，结构如下：
{
  "lead": "两三句总览，点出今天最重要的主线",
  "items": [{ "title": "中文标题（简洁）", "body": "1-2句中文摘要，点出关键数字或影响" }],
  "summary": "一句话总结今日核心逻辑"
}

items 数组长度与输入条目相同，顺序一一对应。

新闻原文：
${numbered}`;

  const resp = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude returned unexpected format');

  const parsed = JSON.parse(jsonMatch[0]) as { lead: string; items: { title: string; body: string }[]; summary: string };

  return {
    date: dateLabel,
    lead: parsed.lead,
    items: parsed.items.map((it, i) => ({ id: i + 1, title: it.title, body: it.body })),
    summary: parsed.summary,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function GET() {
  try {
    const yest = yesterdayStr();
    const [m, d] = [yest.slice(5, 7), yest.slice(8, 10)];
    const dateLabel = `${m}月${d}日`;

    const items = await fetchAllNews();

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: '昨日暂无新闻数据（可能是周末或 RSS 源未更新）' },
        { status: 404 }
      );
    }

    const data = await summarize(items, dateLabel);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[digest]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
