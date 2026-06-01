'use client';

import { useState, useMemo, useEffect } from 'react';
import type { WeeklyReport, CompanyEstimateDetailed, WeeklySnapshot, Prices } from '@/lib/types';
import type { MarketMovers, StockItem } from '@/lib/market-movers';
import type { ValuationResult, SectorData, EnrichedCompany } from '@/lib/valuation';

// ── 工具函数 ──────────────────────────────────────────────────────────────
const HISTORY_KEY = 'al_tracker_history';
const MAX_HISTORY = 8;

function isoWeekLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function saveSnapshot(report: WeeklyReport) {
  try {
    const snap: WeeklySnapshot = {
      weekLabel: isoWeekLabel(report.generatedAt),
      at: report.generatedAt,
      alPrice: report.prices.alPrice,
      aluminaPrice: report.prices.aluminaPrice,
      estimates: report.estimates.map((e) => ({
        code: e.code,
        name: e.name,
        netProfit: e.netProfit,
        eps: e.eps,
      })),
    };
    const history: WeeklySnapshot[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    const deduped = history.filter((h) => h.weekLabel !== snap.weekLabel);
    localStorage.setItem(HISTORY_KEY, JSON.stringify([snap, ...deduped].slice(0, MAX_HISTORY)));
  } catch { /* localStorage unavailable */ }
}

function loadHistory(): WeeklySnapshot[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); }
  catch { return []; }
}

// ── 业绩计算过程表 ────────────────────────────────────────────────────────
function CalcBreakdown({ estimates, prices }: { estimates: CompanyEstimateDetailed[]; prices: Prices }) {
  const n = (v: number) => v.toLocaleString('zh-CN');
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

  type DataRow = { label: string; values: string[]; bold?: boolean; accent?: boolean };
  type SectionRow = { section: string };
  type Row = DataRow | SectionRow;

  const rows: Row[] = [
    { section: '基础参数' },
    { label: '铝产量（万吨/年）', values: estimates.map((e) => n(e.alProduction)) },
    { label: '氧化铝消耗（吨/吨铝）', values: estimates.map((e) => e.aluminaConsumption.toFixed(2)) },
    { label: '氧化铝自给率', values: estimates.map((e) => pct(e.aluminaSelfSupply)) },
    { label: '电耗（kWh/吨铝）', values: estimates.map((e) => n(e.powerConsumption)) },
    { label: '电价（元/kWh）', values: estimates.map((e) => e.powerPrice.toFixed(3)) },
    { label: '其他变动成本（元/吨）', values: estimates.map((e) => n(e.otherVarCostInput)) },
    { label: '期间费用（亿元）', values: estimates.map((e) => e.periodExpenses.toFixed(1)) },
    { label: '其他业务净利（亿元）', values: estimates.map((e) => e.otherProfit.toFixed(1)) },
    { label: '所得税率', values: estimates.map((e) => pct(e.taxRate)) },
    { section: '成本结构（元/吨铝）' },
    { label: '  氧化铝成本', values: estimates.map((e) => n(e.aluminaCostPerTon)) },
    { label: '  电力成本', values: estimates.map((e) => n(e.powerCostPerTon)) },
    { label: '  其他变动成本', values: estimates.map((e) => n(e.otherVarCostInput)) },
    { label: '  完全变动成本', values: estimates.map((e) => n(e.varCostPerTon)), bold: true },
    { label: '铝价（元/吨）', values: estimates.map(() => n(prices.alPrice)) },
    { label: '  毛利/吨', values: estimates.map((e) => n(e.grossProfitPerTon)), bold: true, accent: true },
    { section: '利润推导（亿元）' },
    { label: '  毛利总额', values: estimates.map((e) => e.grossProfit.toFixed(2)) },
    { label: '  − 期间费用', values: estimates.map((e) => `(${e.periodExpenses.toFixed(1)})`) },
    { label: '  主业税前利润', values: estimates.map((e) => e.mainOperatingProfit.toFixed(2)) },
    { label: '  + 其他业务利润', values: estimates.map((e) => `+${e.otherProfit.toFixed(1)}`) },
    { label: '  税前利润', values: estimates.map((e) => e.preTaxProfit.toFixed(2)) },
    { label: '  × (1 − 税率)', values: estimates.map((e) => pct(1 - e.taxRate)) },
    { label: '  净利润', values: estimates.map((e) => e.netProfit.toFixed(2)), bold: true, accent: true },
    { label: '  EPS（元/股）', values: estimates.map((e) => e.eps.toFixed(2)), bold: true, accent: true },
    { section: '敏感性分析' },
    { label: '  铝价 +1000 元/吨 → 净利', values: estimates.map((e) => `+${e.alSensitivity.toFixed(2)} 亿`) },
    { label: '  氧化铝 +100 元/吨 → 净利', values: estimates.map((e) => `${e.aluminaSensitivity.toFixed(2)} 亿`) },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 text-sm">业绩计算过程</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          沪铝 {n(prices.alPrice)} 元/吨 · 氧化铝 {n(prices.aluminaPrice)} 元/吨 · {prices.source}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="py-2 px-3 text-left font-medium text-slate-500 min-w-[220px]">指标</th>
              {estimates.map((e) => (
                <th key={e.code} className="py-2 px-3 text-right font-semibold text-slate-700 whitespace-nowrap">
                  {e.name}
                  <span className="ml-1 text-slate-400 font-normal">{e.code}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if ('section' in row) {
                return (
                  <tr key={i} className="bg-blue-50">
                    <td
                      colSpan={estimates.length + 1}
                      className="py-1.5 px-3 text-xs font-semibold text-blue-700 uppercase tracking-wide"
                    >
                      {row.section}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className={`py-2 px-3 ${row.bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {row.label}
                  </td>
                  {row.values.map((v, j) => (
                    <td
                      key={j}
                      className={`py-2 px-3 text-right tabular-nums ${
                        row.accent
                          ? 'text-blue-700 font-semibold'
                          : row.bold
                          ? 'font-semibold text-slate-800'
                          : 'text-slate-700'
                      }`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 周维度趋势 ────────────────────────────────────────────────────────────
function WeeklyTrend({ history }: { history: WeeklySnapshot[] }) {
  if (history.length === 0) return null;

  const names = history[0].estimates.map((e) => e.name);
  const n = (v: number) => v.toLocaleString('zh-CN');

  function DeltaBadge({ curr, prev, decimals = 2 }: { curr: number; prev?: number; decimals?: number }) {
    if (prev === undefined) return null;
    const d = curr - prev;
    if (Math.abs(d) < 0.005) return null;
    const pos = d > 0;
    const sign = pos ? '+' : '';
    return (
      <span className={`ml-1 text-[10px] ${pos ? 'text-rose-500' : 'text-green-600'}`}>
        ({sign}{d.toFixed(decimals)})
      </span>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 text-sm">周维度趋势</h3>
        <p className="text-xs text-slate-400 mt-0.5">最近 {history.length} 周 · 括号内为环比变化 · 本地浏览器缓存</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="py-2 px-3 text-left font-medium">周次</th>
              <th className="py-2 px-3 text-right font-medium">沪铝（元/吨）</th>
              <th className="py-2 px-3 text-right font-medium">氧化铝（元/吨）</th>
              {names.map((nm) => (
                <th key={nm + 'net'} className="py-2 px-3 text-right font-medium whitespace-nowrap">{nm} 净利（亿）</th>
              ))}
              {names.map((nm) => (
                <th key={nm + 'eps'} className="py-2 px-3 text-right font-medium whitespace-nowrap">{nm} EPS</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((snap, i) => {
              const prev = history[i + 1];
              return (
                <tr
                  key={snap.weekLabel}
                  className={`border-t border-slate-50 ${i === 0 ? 'bg-blue-50/40 font-medium' : 'hover:bg-slate-50/60'}`}
                >
                  <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                    {snap.weekLabel}
                    {i === 0 && (
                      <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 px-1 rounded">最新</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                    {n(snap.alPrice)}
                    <DeltaBadge curr={snap.alPrice} prev={prev?.alPrice} decimals={0} />
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                    {n(snap.aluminaPrice)}
                    <DeltaBadge curr={snap.aluminaPrice} prev={prev?.aluminaPrice} decimals={0} />
                  </td>
                  {snap.estimates.map((e, j) => (
                    <td key={e.code + 'net'} className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      {e.netProfit.toFixed(2)}
                      <DeltaBadge curr={e.netProfit} prev={prev?.estimates[j]?.netProfit} />
                    </td>
                  ))}
                  {snap.estimates.map((e, j) => (
                    <td key={e.code + 'eps'} className="py-2.5 px-3 text-right tabular-nums text-slate-700">
                      {e.eps.toFixed(2)}
                      <DeltaBadge curr={e.eps} prev={prev?.estimates[j]?.eps} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 铝业周报 Tab ──────────────────────────────────────────────────────────
function AluminumSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<WeeklySnapshot[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  async function sendNow() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/send-report', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const r: WeeklyReport = data.report;
      setReport(r);
      setStatus('done');
      saveSnapshot(r);
      setHistory(loadHistory());
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-2">自动推送计划</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          每周一 08:00（北京时间）自动运行 → 拉取沪铝 + 氧化铝最新行情 →
          重新测算三家公司 2026 年业绩 → Claude 生成分析报告 → 发送至
          <span className="font-mono text-blue-600 mx-1">
            {process.env.NEXT_PUBLIC_REPORT_EMAIL ?? 'zuoyi234@gmail.com'}
          </span>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-3">手动触发</h2>
        <button
          onClick={sendNow}
          disabled={status === 'loading'}
          className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {status === 'loading' ? '生成中（约 10 秒）…' : '立即生成并发送报告'}
        </button>

        {status === 'done' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            ✓ 报告已发送！沪铝 <strong>{report?.prices.alPrice.toLocaleString()}</strong> 元/吨，
            氧化铝 <strong>{report?.prices.aluminaPrice.toLocaleString()}</strong> 元/吨
          </div>
        )}
        {status === 'error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            发送失败：{errorMsg}
          </div>
        )}
      </div>

      {report && (
        <>
          <CalcBreakdown estimates={report.estimates} prices={report.prices} />

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 text-sm">综合业绩摘要</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 pr-4 text-slate-500 font-medium">公司</th>
                    <th className="text-right py-2 px-4 text-slate-500 font-medium">毛利/吨（元）</th>
                    <th className="text-right py-2 px-4 text-slate-500 font-medium">净利润（亿）</th>
                    <th className="text-right py-2 px-4 text-slate-500 font-medium">EPS（元）</th>
                    <th className="text-right py-2 pl-4 text-slate-500 font-medium">铝价+1000→净利</th>
                  </tr>
                </thead>
                <tbody>
                  {report.estimates.map((e) => (
                    <tr key={e.code} className="border-b border-slate-50">
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {e.name}
                        <span className="ml-2 text-xs text-slate-400">{e.code}</span>
                      </td>
                      <td className="text-right py-2 px-4 text-slate-700">{e.grossProfitPerTon.toLocaleString()}</td>
                      <td className="text-right py-2 px-4">{e.netProfit.toFixed(2)}</td>
                      <td className="text-right py-2 px-4 font-semibold text-blue-700">{e.eps.toFixed(2)}</td>
                      <td className="text-right py-2 pl-4 text-green-600">+{e.alSensitivity.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-slate-50 rounded-lg text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {report.narrative}
            </div>
          </div>
        </>
      )}

      <WeeklyTrend history={history} />
    </div>
  );
}

// ── A股日报 Tab ──────────────────────────────────────────────────────────
function pct(n: number) {
  const s = (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  return <span className={n >= 0 ? 'text-rose-600 font-semibold' : 'text-green-600 font-semibold'}>{s}</span>;
}

function StockTable({ stocks, title, rank }: { stocks: StockItem[]; title: string; rank?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
        <span className="text-xs text-slate-400">{stocks.length} 只</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              {rank && <th className="py-2 pl-4 pr-2 text-left font-medium w-6">#</th>}
              <th className="py-2 px-3 text-left font-medium">股票</th>
              <th className="py-2 px-3 text-right font-medium">涨跌幅</th>
              <th className="py-2 px-3 text-right font-medium">成交额</th>
              <th className="py-2 px-3 text-right font-medium">市值</th>
              <th className="py-2 px-3 text-left font-medium min-w-[160px]">AI 异动原因</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => (
              <tr key={s.code} className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
                {rank && <td className="py-2.5 pl-4 pr-2 text-slate-400">{i + 1}</td>}
                <td className="py-2.5 px-3">
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="ml-1.5 text-slate-400">{s.market}{s.code}</span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">{pct(s.changePercent)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                  {s.volume >= 100
                    ? `${(s.volume / 100).toFixed(1)}百亿`
                    : `${s.volume.toFixed(1)}亿`}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                  {s.marketCap >= 1000
                    ? `${(s.marketCap / 100).toFixed(0)}百亿`
                    : `${s.marketCap}亿`}
                </td>
                <td className="py-2.5 px-3 text-slate-600 leading-snug">{s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState<MarketMovers | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/market-movers');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json.data);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">A股每日行情速览</h2>
            <p className="text-sm text-slate-500">
              市值 200 亿以上涨跌幅前 20 · 全市场成交额前 50 · AI 异动原因（中文）
            </p>
            {data && (
              <p className="text-xs text-slate-400 mt-1">{data.tradeDate} 收盘数据</p>
            )}
          </div>
          <button
            onClick={load}
            disabled={status === 'loading'}
            className="flex-shrink-0 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'loading' ? '加载中（约 15 秒）…' : status === 'done' ? '刷新数据' : '加载今日行情'}
          </button>
        </div>

        {status === 'error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            加载失败：{errorMsg}
          </div>
        )}
      </div>

      {status === 'loading' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">正在拉取行情 + AI 分析异动原因，约需 15 秒…</p>
        </div>
      )}

      {data && (
        <>
          <StockTable stocks={data.gainers} title="📈 涨幅榜 TOP 20（市值≥200亿）" rank />
          <StockTable stocks={data.losers} title="📉 跌幅榜 TOP 20（市值≥200亿）" rank />
          <StockTable stocks={data.topVolume} title="💹 成交额榜 TOP 30（全市场）" rank />
        </>
      )}
    </div>
  );
}

// ── 产业链估值 Tab ────────────────────────────────────────────────────────
function ValuationSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState<ValuationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSector, setActiveSector] = useState<string>('all');
  const [query, setQuery] = useState('');

  async function load() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/valuation');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json.data);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  const displaySectors: SectorData[] = useMemo(() => {
    if (!data) return [];
    const sectors = activeSector === 'all' ? data.sectors : data.sectors.filter((s) => s.id === activeSector);
    if (!query.trim()) return sectors;
    const q = query.trim().toLowerCase();
    return sectors.map((s) => ({
      ...s,
      companies: s.companies.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      ),
    })).filter((s) => s.companies.length > 0);
  }, [data, activeSector, query]);

  return (
    <div className="space-y-5">
      {/* 头部控制栏 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">产业链估值表</h2>
            <p className="text-sm text-slate-500">AI 产业链核心标的 · 实时行情 · 动态 PE / PB</p>
            {data && <p className="text-xs text-slate-400 mt-1">更新时间：{data.updatedAt}</p>}
          </div>
          <button
            onClick={load}
            disabled={status === 'loading'}
            className="flex-shrink-0 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'loading' ? '加载中…' : status === 'done' ? '刷新' : '加载估值表'}
          </button>
        </div>
        {status === 'error' && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            加载失败：{errorMsg}
          </div>
        )}
      </div>

      {status === 'loading' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">拉取实时行情…</p>
        </div>
      )}

      {data && (
        <>
          {/* 板块筛选卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveSector('all')}
              className={`p-3 rounded-xl border text-left transition-all ${
                activeSector === 'all'
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-white border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className={`text-xs font-medium ${activeSector === 'all' ? 'text-blue-100' : 'text-slate-500'}`}>全部</div>
              <div className={`text-sm font-semibold mt-0.5 ${activeSector === 'all' ? 'text-white' : 'text-slate-800'}`}>
                {data.sectors.reduce((n, s) => n + s.companies.length, 0)} 家公司
              </div>
            </button>
            {data.sectors.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSector(s.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  activeSector === s.id
                    ? 'bg-blue-700 border-blue-700 text-white'
                    : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className={`text-xs font-medium ${activeSector === s.id ? 'text-blue-100' : 'text-slate-500'}`}>
                  {s.name}
                </div>
                <div className={`text-sm font-semibold mt-0.5 ${activeSector === s.id ? 'text-white' : 'text-slate-800'}`}>
                  {s.companies.length} 家
                  {s.avgPe !== null && (
                    <span className={`ml-1.5 text-xs font-normal ${activeSector === s.id ? 'text-blue-200' : 'text-slate-400'}`}>
                      PE {s.avgPe}x
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* 搜索 */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="搜索代码 / 公司"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-sm outline-none text-slate-700 placeholder-slate-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            )}
          </div>

          {/* 估值表 */}
          {displaySectors.map((sector) => (
            <ValuationTable key={sector.id} sector={sector} />
          ))}
        </>
      )}
    </div>
  );
}

function ValuationTable({ sector }: { sector: SectorData }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
        <h3 className="font-semibold text-slate-800 text-sm">{sector.name}</h3>
        <span className="text-xs text-slate-400">{sector.companies.length} 家</span>
        {sector.avgPe !== null && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">均PE {sector.avgPe}x</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="py-2 px-3 text-left font-medium">代码</th>
              <th className="py-2 px-3 text-left font-medium">公司</th>
              <th className="py-2 px-3 text-right font-medium">股价</th>
              <th className="py-2 px-3 text-right font-medium">涨跌幅</th>
              <th className="py-2 px-3 text-right font-medium">市值(亿)</th>
              <th className="py-2 px-3 text-right font-medium">动态PE</th>
              <th className="py-2 px-3 text-right font-medium">PB</th>
            </tr>
          </thead>
          <tbody>
            {sector.companies.map((c) => (
              <ValuationRow key={`${c.market}-${c.code}`} company={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ValuationRow({ company: c }: { company: EnrichedCompany }) {
  const isUS = c.market === 'US';
  const chg = c.changePercent;
  return (
    <tr className="border-t border-slate-50 hover:bg-slate-50/60 transition-colors">
      <td className="py-2.5 px-3">
        <span className="font-mono text-slate-500">{c.code}</span>
        <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${
          isUS ? 'bg-purple-50 text-purple-500' : c.market === 'SH' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
        }`}>
          {isUS ? 'US' : c.market}
        </span>
      </td>
      <td className="py-2.5 px-3 font-medium text-slate-800">{c.name}</td>
      <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
        {c.price !== null ? c.price.toLocaleString() : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums">
        {chg !== null ? (
          <span className={chg >= 0 ? 'text-rose-600 font-semibold' : 'text-green-600 font-semibold'}>
            {(chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'}
          </span>
        ) : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
        {c.marketCapCny !== null
          ? c.marketCapCny >= 1000
            ? `${(c.marketCapCny / 1000).toFixed(1)}千亿`
            : `${c.marketCapCny}`
          : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">
        {c.pe !== null ? c.pe.toFixed(1) : <span className="text-slate-300">—</span>}
      </td>
      <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
        {c.pb !== null ? c.pb.toFixed(2) : <span className="text-slate-300">—</span>}
      </td>
    </tr>
  );
}

// ── 科技AI日报 Tab ────────────────────────────────────────────────────────
interface DigestItem { id: number; title: string; body: string }
interface DigestData { date: string; lead: string; items: DigestItem[]; summary: string }

function DigestSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/digest');
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDigest(json.data);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <div className="space-y-4">
      {/* 头部控制栏 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-800 mb-1">科技 / AI 晨报</h2>
            <p className="text-sm text-slate-500">抓取昨日科技新闻 · Claude AI 中文摘要</p>
            {digest && <p className="text-xs text-slate-400 mt-1">{digest.date}</p>}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={status === 'loading'}
            className="flex-shrink-0 px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'loading' ? '生成中（约 20 秒）…' : status === 'done' ? '重新生成' : '生成今日晨报'}
          </button>
        </div>
        {status === 'error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            生成失败：{errorMsg}
          </div>
        )}
      </div>

      {/* 加载中 */}
      {status === 'loading' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">正在抓取 RSS · AI 摘要生成中，约需 20 秒…</p>
        </div>
      )}

      {/* 结果 */}
      {digest && status === 'done' && (
        <>
          {/* 导语 */}
          <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className="text-sm text-slate-600 leading-relaxed">{digest.lead}</p>
          </div>

          {/* 新闻列表 */}
          <div className="space-y-2.5">
            {digest.items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex gap-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                  {item.id}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800 leading-snug">{item.title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed mt-1">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 总结 */}
          <div className="bg-slate-800 rounded-xl px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">一句话总结</p>
            <p className="text-sm text-white leading-relaxed">{digest.summary}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────
type Tab = 'aluminum' | 'market' | 'valuation' | 'digest';

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('aluminum');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold mb-1">投研助手</h1>
          <p className="text-blue-200 text-sm">铝业周报 · A股日报 · 产业链估值 · Claude AI 分析</p>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="max-w-5xl mx-auto px-6 pt-5">
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit shadow-sm">
          {([
            { key: 'aluminum',  label: '🔩 铝业周报' },
            { key: 'market',    label: '📊 A股日报' },
            { key: 'valuation', label: '📈 产业链估值' },
            { key: 'digest',    label: '📰 科技AI日报' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-5">
        {tab === 'aluminum' ? <AluminumSection /> : tab === 'market' ? <MarketSection /> : tab === 'valuation' ? <ValuationSection /> : <DigestSection />}
      </main>
    </div>
  );
}
