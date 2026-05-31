import Anthropic from '@anthropic-ai/sdk';

export interface StockItem {
  code: string;
  market: string;      // SH / SZ
  name: string;
  price: number;
  changePercent: number;
  changeAmount: number;
  volume: number;      // 成交额，亿元
  marketCap: number;   // 总市值，亿元
  reason: string;      // Claude 生成的异动原因
}

export interface MarketMovers {
  gainers: StockItem[];   // 涨幅前 20（市值>200亿）
  losers: StockItem[];    // 跌幅前 20（市值>200亿）
  topVolume: StockItem[]; // 成交额前 50
  tradeDate: string;
}

// ── 东方财富 clist 公开接口 ──────────────────────────────────────────────
const EM_BASE = 'https://push2.eastmoney.com/api/qt/clist/get';
const ALL_A = 'm:0+t:6,m:0+t:13,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:7+f:!2';
const FIELDS = 'f2,f3,f4,f6,f12,f13,f14,f20';

// f2=价格 f3=涨跌幅% f4=涨跌额 f6=成交额(元) f12=代码 f13=市场 f14=名称 f20=总市值(元)

function marketCode(f13: number): string {
  return f13 === 1 ? 'SH' : 'SZ';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItem(raw: any): StockItem {
  return {
    code: String(raw.f12),
    market: marketCode(Number(raw.f13)),
    name: String(raw.f14 ?? ''),
    price: Number(raw.f2) || 0,
    changePercent: Number(raw.f3) || 0,   // 已是百分比，如 1.23 表示 +1.23%
    changeAmount: Number(raw.f4) || 0,
    volume: Math.round((Number(raw.f6) || 0) / 1e8 * 100) / 100, // 转亿元
    marketCap: Math.round((Number(raw.f20) || 0) / 1e8),         // 转亿元
    reason: '',
  };
}

async function emFetch(fid: string, po: 0 | 1, pz: number): Promise<StockItem[]> {
  const url =
    `${EM_BASE}?pn=1&pz=${pz}&po=${po}&np=1&fltt=2&invt=2` +
    `&fid=${fid}&fs=${ALL_A}&fields=${FIELDS}` +
    `&ut=bd1d9ddb04089700cf9c27f6f7426281&_=${Date.now()}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Referer: 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    });
    const json = await res.json();
    return (json?.data?.diff ?? []).map(parseItem);
  } finally {
    clearTimeout(t);
  }
}

// ── Claude 批量生成异动原因 ──────────────────────────────────────────────
async function generateReasons(
  stocks: StockItem[],
  context: string
): Promise<string[]> {
  if (!stocks.length) return [];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const list = stocks
    .map(
      (s, i) =>
        `${i + 1}. ${s.name}(${s.market}${s.code}) ` +
        `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}% ` +
        `市值${s.marketCap}亿 成交${s.volume}亿`
    )
    .join('\n');

  const prompt =
    `你是A股市场资深分析师。以下是今日${context}股票，` +
    `请根据你对各公司所属行业、近期政策热点、市场情绪的了解，` +
    `为每只股票用一句话（15字以内）给出最可能的异动原因。\n` +
    `严格按格式输出：序号. 原因（不要重复股票名称）\n\n${list}`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    msg.content.filter((b) => b.type === 'text').map((b) => (b as { type: 'text'; text: string }).text).join('');

  // 解析 "1. 原因\n2. 原因\n..." 格式
  const reasons: string[] = Array(stocks.length).fill('市场正常波动');
  const lines = text.split('\n').filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d+)[.、．]\s*(.+)/);
    if (m) {
      const idx = parseInt(m[1]) - 1;
      if (idx >= 0 && idx < stocks.length) reasons[idx] = m[2].trim();
    }
  }
  return reasons;
}

// ── 主入口 ────────────────────────────────────────────────────────────────
export async function fetchMarketMovers(): Promise<MarketMovers> {
  // 并行抓取：涨幅榜100条 + 跌幅榜100条 + 成交额榜30条
  const [gainersRaw, losersRaw, volumeRaw] = await Promise.all([
    emFetch('f3', 1, 100),  // 按涨幅降序
    emFetch('f3', 0, 100),  // 按涨幅升序（即跌幅）
    emFetch('f6', 1, 30),   // 按成交额降序
  ]);

  const MIN_CAP = 200; // 亿元

  const gainers = gainersRaw
    .filter((s) => s.marketCap >= MIN_CAP && s.changePercent > 0)
    .slice(0, 20);

  const losers = losersRaw
    .filter((s) => s.marketCap >= MIN_CAP && s.changePercent < 0)
    .slice(0, 20);

  const topVolume = volumeRaw.slice(0, 30);

  // 合并去重后分组生成原因（gainers + losers + volume 去重，并行调用 Claude）
  const gainerGroup = gainers.map((s) => ({ ...s, _ctx: '涨幅榜' }));
  const loserGroup = losers.map((s) => ({ ...s, _ctx: '跌幅榜' }));
  const volumeGroup = topVolume
    .filter((s) => !gainers.find((g) => g.code === s.code) && !losers.find((l) => l.code === s.code))
    .map((s) => ({ ...s, _ctx: '成交额榜' }));

  // 三组并行调用 Claude，各自独立，总耗时 ≈ 单次最慢耗时
  const [gainerReasons, loserReasons, volumeReasons] = await Promise.all([
    generateReasons(gainerGroup, '涨幅榜'),
    generateReasons(loserGroup, '跌幅榜'),
    generateReasons(volumeGroup, '成交额榜'),
  ]);

  const reasonMap: Record<string, string> = {};
  gainerGroup.forEach((s, i) => { reasonMap[s.code] = gainerReasons[i]; });
  loserGroup.forEach((s, i) => { reasonMap[s.code] = loserReasons[i]; });
  volumeGroup.forEach((s, i) => { reasonMap[s.code] = volumeReasons[i]; });

  const attachReason = (s: StockItem): StockItem => ({
    ...s,
    reason: reasonMap[s.code] ?? '市场正常波动',
  });

  const tradeDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return {
    gainers: gainers.map(attachReason),
    losers: losers.map(attachReason),
    topVolume: topVolume.map(attachReason), // 30 只
    tradeDate,
  };
}
