import type { Prices } from './types';

const TIMEOUT = 8_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// ── 沪铝价格 ──────────────────────────────────────────────────────────────
// 主力: 东方财富公共行情 API（无需 key）
async function fetchSHFEAlFromEastMoney(): Promise<number> {
  // 113 = 上期所，AL0 = 铝主力
  const url =
    'https://push2.eastmoney.com/api/qt/stock/get' +
    '?secid=113.AL0' +
    '&ut=7eea3edcaed734bea9cbfc24409ed989' +
    '&fields=f43,f57,f58' +
    '&cb=jsonp';
  const res = await fetchWithTimeout(url, {
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  });
  const text = await res.text();
  // 去掉 JSONP 包装
  const json = JSON.parse(text.replace(/^jsonp\(/, '').replace(/\);?$/, ''));
  const price = json?.data?.f43;
  if (!price || price <= 0) throw new Error('EastMoney: invalid price');
  // f43 单位为分 * 100，东方财富期货价已经是元/吨
  return Number(price) / 100;
}

// 备用：LME 铝（Yahoo Finance）× 汇率 × 1.13（VAT + 进口贴水估算）
async function fetchSHFEAlFromYahoo(): Promise<number> {
  const [alRes, fxRes] = await Promise.all([
    fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/ALI%3DF?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ),
    fetchWithTimeout(
      'https://query1.finance.yahoo.com/v8/finance/chart/CNY%3DX?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    ),
  ]);
  const alData = await alRes.json();
  const fxData = await fxRes.json();

  const lmeUsd: number =
    alData.chart?.result?.[0]?.meta?.regularMarketPrice ?? 0;
  const usdcny: number =
    fxData.chart?.result?.[0]?.meta?.regularMarketPrice ?? 7.2;

  if (lmeUsd <= 0) throw new Error('Yahoo: invalid LME price');
  // LME 单位是 USD/吨；SHFE 相对 LME 有 VAT + 进口溢价
  return Math.round(lmeUsd * usdcny * 1.13);
}

async function fetchAlPrice(): Promise<number> {
  try {
    return await fetchSHFEAlFromEastMoney();
  } catch {
    console.warn('[prices] EastMoney failed, falling back to Yahoo');
    return fetchSHFEAlFromYahoo();
  }
}

// ── 氧化铝价格 ────────────────────────────────────────────────────────────
// 优先：东方财富氧化铝指数（AO0）
async function fetchAluminaFromEastMoney(): Promise<number> {
  const url =
    'https://push2.eastmoney.com/api/qt/stock/get' +
    '?secid=113.AO0' +
    '&ut=7eea3edcaed734bea9cbfc24409ed989' +
    '&fields=f43' +
    '&cb=jsonp';
  const res = await fetchWithTimeout(url, {
    headers: { 'Referer': 'https://quote.eastmoney.com/' },
  });
  const text = await res.text();
  const json = JSON.parse(text.replace(/^jsonp\(/, '').replace(/\);?$/, ''));
  const price = json?.data?.f43;
  if (!price || price <= 0) throw new Error('EastMoney AO: invalid');
  return Number(price) / 100;
}

// 备用：按铝价的历史比例估算（2023-2025 均值约 16.5%）
async function fetchAluminaFallback(alPrice: number): Promise<number> {
  return Math.round(alPrice * 0.165);
}

// ── 主入口 ────────────────────────────────────────────────────────────────
export async function fetchPrices(): Promise<Prices> {
  const alPrice = await fetchAlPrice();

  let aluminaPrice: number;
  let source: string;
  try {
    aluminaPrice = await fetchAluminaFromEastMoney();
    source = 'EastMoney（沪铝 + 氧化铝期货）';
  } catch {
    console.warn('[prices] alumina source failed, using ratio estimate');
    aluminaPrice = await fetchAluminaFallback(alPrice);
    source = 'EastMoney（沪铝）+ 比例估算（氧化铝）';
  }

  return {
    alPrice,
    aluminaPrice,
    fetchedAt: new Date().toISOString(),
    source,
  };
}
