'use client';

import { useState } from 'react';
import type { WeeklyReport } from '@/lib/types';
import type { MarketMovers, StockItem } from '@/lib/market-movers';

// ── 铝业周报 Tab ──────────────────────────────────────────────────────────
function AluminumSection() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function sendNow() {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/send-report', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReport(data.report);
      setStatus('done');
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
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">本次报告预览</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-slate-500 font-medium">公司</th>
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
      )}
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
          <StockTable stocks={data.topVolume} title="💹 成交额榜 TOP 50（全市场）" rank />
        </>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────
type Tab = 'aluminum' | 'market';

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('aluminum');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl font-bold mb-1">投研助手</h1>
          <p className="text-blue-200 text-sm">铝业周报 · A股日报 · Claude AI 分析</p>
        </div>
      </header>

      {/* Tab 导航 */}
      <div className="max-w-5xl mx-auto px-6 pt-5">
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit shadow-sm">
          {([
            { key: 'aluminum', label: '🔩 铝业周报' },
            { key: 'market',   label: '📊 A股日报' },
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
        {tab === 'aluminum' ? <AluminumSection /> : <MarketSection />}
      </main>
    </div>
  );
}
