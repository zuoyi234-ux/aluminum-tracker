import { SECTORS, secid, type Company } from './valuation-data';

export interface EnrichedCompany extends Company {
  price: number | null;
  changePercent: number | null;
  marketCapCny: number | null;   // 亿元
  pe: number | null;             // 动态市盈率
  pb: number | null;             // 市净率
}

export interface SectorData {
  id: string;
  name: string;
  companies: EnrichedCompany[];
  avgPe: number | null;
}

export interface ValuationResult {
  sectors: SectorData[];
  updatedAt: string;
}

// Batch fetch all A-share stocks from East Money ulist API in one call
async function fetchASharePrices(
  companies: Company[]
): Promise<Map<string, { price: number; changePercent: number; marketCap: number; pe: number; pb: number }>> {
  const ashares = companies.filter((c) => c.market !== 'US');
  if (!ashares.length) return new Map();

  const secids = ashares.map(secid).join(',');
  const url =
    `https://push2.eastmoney.com/api/qt/ulist.np/get` +
    `?fltt=2&fields=f2,f3,f9,f12,f13,f20,f23` +
    `&secids=${secids}&_=${Date.now()}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Referer: 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 0 },
    });
    const json = await res.json();
    const map = new Map<string, { price: number; changePercent: number; marketCap: number; pe: number; pb: number }>();
    for (const item of json?.data?.diff ?? []) {
      map.set(String(item.f12), {
        price: Number(item.f2) || 0,
        changePercent: Number(item.f3) || 0,
        marketCap: Math.round((Number(item.f20) || 0) / 1e8),
        pe: Number(item.f9) || 0,
        pb: Number(item.f23) || 0,
      });
    }
    return map;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchValuation(): Promise<ValuationResult> {
  // Collect all A-share companies across all sectors
  const allCompanies = SECTORS.flatMap((s) => s.companies);
  const priceMap = await fetchASharePrices(allCompanies);

  const sectors: SectorData[] = SECTORS.map((sector) => {
    const companies: EnrichedCompany[] = sector.companies.map((c) => {
      if (c.market === 'US') {
        return { ...c, price: null, changePercent: null, marketCapCny: null, pe: null, pb: null };
      }
      const d = priceMap.get(c.code);
      return {
        ...c,
        price: d?.price ?? null,
        changePercent: d?.changePercent ?? null,
        marketCapCny: d?.marketCap ?? null,
        pe: d?.pe && d.pe > 0 ? d.pe : null,
        pb: d?.pb && d.pb > 0 ? d.pb : null,
      };
    });

    const peValues = companies.map((c) => c.pe).filter((v): v is number => v !== null && v > 0 && v < 500);
    const avgPe = peValues.length ? Math.round((peValues.reduce((a, b) => a + b, 0) / peValues.length) * 10) / 10 : null;

    return { id: sector.id, name: sector.name, companies, avgPe };
  });

  return {
    sectors,
    updatedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
  };
}
