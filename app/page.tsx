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

// ── 现货价格环比对比卡 ────────────────────────────────────────────────────
interface PricePoint { weekLabel: string; alPrice: number; aluminaPrice: number }

function PriceComparison({ curr, prev }: { curr: PricePoint; prev?: PricePoint }) {
  const n = (v: number) => v.toLocaleString('zh-CN');

  function PriceCard({ label, currVal, prevVal }: { label: string; currVal: number; prevVal?: number }) {
    const diff = prevVal !== undefined ? currVal - prevVal : null;
    const pct  = prevVal ? ((currVal - prevVal) / prevVal) * 100 : null;
    const up   = diff !== null && diff > 0;
    const down = diff !== null && diff < 0;
    return (
      <div className="flex-1 bg-slate-50 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
          {n(currVal)}
          <span className="text-sm font-normal text-slate-400 ml-1">元/吨</span>
        </p>
        {diff !== null && pct !== null ? (
          <p className={`mt-2 text-sm font-semibold tabular-nums leading-none ${
            up ? 'text-rose-600' : down ? 'text-green-600' : 'text-slate-400'
          }`}>
            {up ? '▲' : down ? '▼' : '—'}&ensp;
            {up ? '+' : ''}{n(Math.round(diff))}
            <span className="ml-1.5 text-xs font-normal opacity-75">
              ({up ? '+' : ''}{pct.toFixed(2)}%)
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">暂无上期对比</p>
        )}
        {prevVal !== undefined && (
          <p className="mt-1.5 text-xs text-slate-400">
            上期（{prev?.weekLabel}）：{n(prevVal)} 元/吨
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-800 text-sm">现货行情</h3>
        <span className="text-xs text-slate-400">
          {curr.weekLabel}{prev ? ` vs ${prev.weekLabel}` : ''}
        </span>
      </div>
      <div className="flex gap-3">
        <PriceCard label="沪铝现货" currVal={curr.alPrice} prevVal={prev?.alPrice} />
        <PriceCard label="氧化铝现货" currVal={curr.aluminaPrice} prevVal={prev?.aluminaPrice} />
      </div>
    </div>
  );
}

// ── 单公司完整测算卡片 ────────────────────────────────────────────────────
function CompanyDetailCard({ est, prices }: { est: CompanyEstimateDetailed; prices: Prices }) {
  const tax = est.preTaxProfit * est.taxRate;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-900 to-slate-800 text-white px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-base">{est.name}</h3>
            <p className="text-blue-200 text-xs mt-0.5">{est.code} · 2026E 业绩测算</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums">{est.netProfit.toFixed(2)}<span className="text-sm font-normal text-blue-200 ml-1">亿净利</span></div>
            <div className="text-blue-100 text-xs">EPS {est.eps.toFixed(2)} 元 · 20xPE ≈ {(est.eps * 20).toFixed(2)} 元</div>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">沪铝现货</div>
            <div className="text-lg font-bold tabular-nums text-slate-800">{prices.alPrice.toLocaleString()}<span className="text-xs font-normal text-slate-400 ml-1">元/吨</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-xs text-slate-500">氧化铝</div>
            <div className="text-lg font-bold tabular-nums text-slate-800">{prices.aluminaPrice.toLocaleString()}<span className="text-xs font-normal text-slate-400 ml-1">元/吨</span></div>
          </div>
        </div>
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">核心经营假设</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            {([
              ['产量', `${est.alProduction} 万吨/年`],
              ['氧化铝自给率', `${(est.aluminaSelfSupply * 100).toFixed(0)}%`],
              ['电耗', `${est.powerConsumption.toLocaleString()} kWh/吨`],
              ['电价', `${est.powerPrice.toFixed(3)} 元/kWh`],
              ['其他变动成本', `${est.otherVarCostInput.toLocaleString()} 元/吨`],
              ['期间费用', `${est.periodExpenses} 亿元`],
              ['其他利润', `${est.otherProfit} 亿元`],
              ['税率', `${(est.taxRate * 100).toFixed(0)}%`],
              ['股本', `${est.shares} 亿股`],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-slate-50 py-1">
                <span className="text-slate-500">{l}</span>
                <span className="font-medium text-slate-700 tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">吨铝成本拆解</h4>
          <div className="space-y-1">
            {([
              ['氧化铝成本', est.aluminaCostPerTon, `1.92 × 自给/外购加权`],
              ['电力成本', est.powerCostPerTon, `${est.powerConsumption.toLocaleString()} kWh × ${est.powerPrice}`],
              ['其他变动成本', est.otherVarCostInput, '碳阳极、辅料、折旧等'],
            ] as [string, number, string][]).map(([label, val, sub]) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 text-sm">
                <span className="text-slate-700">{label}<span className="ml-2 text-xs text-slate-400">{sub}</span></span>
                <span className="tabular-nums font-medium">{val.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold text-slate-800 border-t border-slate-200">
              <span>变动成本合计</span><span className="tabular-nums">{est.varCostPerTon.toLocaleString()} 元/吨</span>
            </div>
            <div className={`flex justify-between py-2 font-bold rounded-lg px-2 ${est.grossProfitPerTon >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>吨铝毛利</span>
              <span className="tabular-nums">{est.grossProfitPerTon >= 0 ? '+' : ''}{est.grossProfitPerTon.toLocaleString()} 元/吨</span>
            </div>
          </div>
        </section>
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">利润表（亿元）</h4>
          <div className="space-y-0.5 text-sm">
            {([
              { label: '铝锭收入', val: est.revenue, indent: false },
              { label: '毛利润', val: est.grossProfit, indent: false, note: `吨毛利 ${est.grossProfitPerTon} × ${est.alProduction}万吨` },
              { label: '减：期间费用', val: -est.periodExpenses, indent: true },
              { label: '主业营业利润', val: est.mainOperatingProfit, indent: false, border: true },
              { label: '加：其他业务利润', val: est.otherProfit, indent: true },
              { label: '税前利润', val: est.preTaxProfit, indent: false, border: true },
              { label: `减：所得税（${(est.taxRate*100).toFixed(0)}%）`, val: -tax, indent: true },
            ] as { label: string; val: number; indent: boolean; note?: string; border?: boolean }[]).map(({ label, val, indent, note, border }) => (
              <div key={label} className={`flex items-center justify-between py-1.5 ${border ? 'border-t border-slate-100 mt-1' : ''}`}>
                <span className={indent ? 'pl-4 text-slate-500' : 'text-slate-700'}>
                  {label}{note && <span className="ml-2 text-xs text-slate-400">{note}</span>}
                </span>
                <span className={`tabular-nums ${val < 0 ? 'text-slate-500' : 'text-slate-700'}`}>
                  {val >= 0 ? val.toFixed(2) : `(${Math.abs(val).toFixed(2)})`}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center py-3 mt-2 border-t-2 border-slate-300 font-bold text-base">
              <span className="text-slate-800">归母净利润</span>
              <span className={`tabular-nums ${est.netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{est.netProfit.toFixed(2)} 亿元</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-slate-500">EPS</span>
              <span className="tabular-nums font-semibold text-blue-700">{est.eps.toFixed(2)} 元/股</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span className="text-slate-500">隐含股价（20x PE）</span>
              <span className="tabular-nums font-semibold text-purple-700">{(est.eps * 20).toFixed(2)} 元</span>
            </div>
          </div>
        </section>
        <section>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">敏感性分析</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-xs text-green-700 mb-1">沪铝 +1,000 元/吨</div>
              <div className="text-lg font-bold text-green-700">+{est.alSensitivity.toFixed(2)} 亿</div>
              <div className="text-xs text-green-600 mt-0.5">EPS +{(est.alSensitivity / est.shares).toFixed(2)} 元</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-xs text-orange-700 mb-1">氧化铝 +100 元/吨</div>
              <div className="text-lg font-bold text-orange-700">{est.aluminaSensitivity.toFixed(2)} 亿</div>
              <div className="text-xs text-orange-600 mt-0.5">EPS {(est.aluminaSensitivity / est.shares).toFixed(2)} 元</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── 情景监测工具（神火 + 云铝，基于用户自定义参数）─────────────────────────
const SENS_COMPANIES = [
  { name: '神火股份', code: '000933', production: 95,  selfSupply: 0.30, aoConsumption: 1.92, powerConsumption: 13_500, powerDiscount: 0,    otherFixedCost: 1_800, coalProfit: 15, taxRate: 0.15, shares: 12.4 },
  { name: '云铝股份', code: '000807', production: 150, selfSupply: 0.50, aoConsumption: 1.92, powerConsumption: 13_500, powerDiscount: 0.10,  otherFixedCost: 1_500, coalProfit: 0,  taxRate: 0.15, shares: 31.6 },
] as const;

type SensCompany = typeof SENS_COMPANIES[number];

function calcSens(p: SensCompany, alPrice: number, aoPrice: number, powerPrice: number) {
  const effPower = powerPrice - p.powerDiscount;
  const aoCost   = p.aoConsumption * (p.selfSupply * aoPrice * 0.60 + (1 - p.selfSupply) * aoPrice);
  const pwCost   = p.powerConsumption * effPower;
  const varCost  = aoCost + pwCost + p.otherFixedCost;
  const grossPerTon  = alPrice - varCost;
  const totalGross   = (grossPerTon * p.production * 10_000) / 1e8;
  const preTax       = totalGross + p.coalProfit;
  const netProfit    = Math.round(preTax * (1 - p.taxRate) * 100) / 100;
  const eps          = Math.round(netProfit / p.shares * 100) / 100;
  return { grossPerTon: Math.round(grossPerTon), totalGross: Math.round(totalGross * 10) / 10, netProfit, eps, price20x: Math.round(eps * 20 * 100) / 100 };
}

const AL_STEPS = [17_000, 17_500, 18_000, 18_500, 19_000, 19_500, 20_000, 20_500, 21_000, 22_000];

function SensitivityTool() {
  const [alPrice,    setAlPrice]    = useState(19_500);
  const [aoPrice,    setAoPrice]    = useState(3_600);
  const [powerPrice, setPowerPrice] = useState(0.35);

  const BASE_AL    = 19_500;
  const BASE_AO    = 3_600;
  const BASE_POWER = 0.35;

  const results = SENS_COMPANIES.map((c) => ({
    company: c,
    curr: calcSens(c, alPrice, aoPrice, powerPrice),
    base: calcSens(c, BASE_AL, BASE_AO, BASE_POWER),
  }));


  function SliderRow({ label, value, min, max, step, onChange, format }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; format: (v: number) => string;
  }) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 w-28 flex-shrink-0">{label}</span>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-1.5 accent-blue-600" />
        <span className="text-sm font-semibold text-slate-800 tabular-nums w-20 text-right">{format(value)}</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800">情景监测工具</h2>
        <p className="text-xs text-slate-400 mt-0.5">实时调整价格变量 · 神火股份 + 云铝股份 · 20x PE 目标价</p>
      </div>

      {/* 滑块控件 */}
      <div className="px-5 py-4 space-y-3 bg-slate-50 border-b border-slate-100">
        <SliderRow label="铝价（元/吨）" value={alPrice} min={15_000} max={25_000} step={500}
          onChange={setAlPrice} format={(v) => v.toLocaleString()} />
        <SliderRow label="氧化铝（元/吨）" value={aoPrice} min={1_500} max={8_000} step={100}
          onChange={setAoPrice} format={(v) => v.toLocaleString()} />
        <SliderRow label="电力成本（元/kWh）" value={powerPrice} min={0.20} max={0.55} step={0.01}
          onChange={setPowerPrice} format={(v) => v.toFixed(2)} />
      </div>

      {/* 公司卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {results.map(({ company: c, curr, base }) => (
          <div key={c.code} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-semibold text-slate-800">{c.name}</span>
                <span className="ml-2 text-xs text-slate-400">{c.code}</span>
              </div>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                产能 {c.production}万吨 · 自给率 {(c.selfSupply*100).toFixed(0)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['吨铝毛利', `${curr.grossPerTon.toLocaleString()} 元`, base.grossPerTon],
                ['总毛利', `${curr.totalGross.toFixed(1)} 亿`, base.totalGross],
                ['净利润', `${curr.netProfit.toFixed(2)} 亿`, base.netProfit],
                ['EPS', `${curr.eps.toFixed(2)} 元`, base.eps],
              ] as [string, string, number][]).map(([label, display, baseVal]) => {
                const currNum = label === '吨铝毛利' ? curr.grossPerTon : label === '总毛利' ? curr.totalGross : label === '净利润' ? curr.netProfit : curr.eps;
                const d = currNum - baseVal;
                return (
                  <div key={label} className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                    <div className={`text-sm font-bold tabular-nums ${curr.netProfit < 0 && (label === '净利润' || label === 'EPS') ? 'text-red-600' : 'text-slate-800'}`}>
                      {display}
                    </div>
                    {Math.abs(d) >= (label === '吨铝毛利' ? 1 : 0.005) && (
                      <div className={`text-[10px] mt-0.5 ${d > 0 ? 'text-rose-500' : 'text-green-600'}`}>
                        {d > 0 ? '+' : ''}{label === '吨铝毛利' ? Math.round(d).toLocaleString() : d.toFixed(2)} vs 基准
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between py-2 px-3 bg-purple-50 rounded-lg">
              <span className="text-xs text-purple-700">20x PE 目标价</span>
              <span className="text-base font-bold tabular-nums text-purple-700">{curr.price20x.toFixed(2)} 元</span>
            </div>
            {c.powerDiscount > 0 && (
              <p className="mt-2 text-xs text-blue-500">水电优惠：-{c.powerDiscount.toFixed(2)} 元/kWh，节约 {Math.round(c.powerConsumption * c.powerDiscount).toLocaleString()} 元/吨</p>
            )}
            {c.coalProfit > 0 && (
              <p className="mt-1 text-xs text-amber-600">煤炭业务：固定贡献 {c.coalProfit} 亿元/年</p>
            )}
          </div>
        ))}
      </div>

      {/* 敏感性矩阵 */}
      <div className="border-t border-slate-100 overflow-x-auto">
        <div className="px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          铝价情景矩阵（氧化铝 {aoPrice.toLocaleString()} · 电价 {powerPrice.toFixed(2)}）
        </div>
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="py-2 px-3 text-left font-medium text-slate-500">铝价（元/吨）</th>
              {SENS_COMPANIES.map((c) => (
                [
                  <th key={c.code+'net'} className="py-2 px-3 text-right font-medium text-slate-500 whitespace-nowrap">{c.name} 净利(亿)</th>,
                  <th key={c.code+'eps'} className="py-2 px-3 text-right font-medium text-slate-500">{c.name} EPS</th>,
                  <th key={c.code+'pe'} className="py-2 px-3 text-right font-medium text-slate-500">@20xPE</th>,
                ]
              ))}
            </tr>
          </thead>
          <tbody>
            {AL_STEPS.map((ap) => {
              const isCurr = ap === alPrice;
              const isBase = ap === BASE_AL;
              return (
                <tr key={ap} className={`border-t border-slate-50 ${isCurr ? 'bg-blue-50/70 font-semibold' : isBase ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
                  <td className="py-2 px-3 tabular-nums text-slate-700">
                    {ap.toLocaleString()}
                    {isBase && !isCurr && <span className="ml-1.5 text-[10px] text-amber-600 bg-amber-100 px-1 rounded">基准</span>}
                    {isCurr && <span className="ml-1.5 text-[10px] text-blue-600 bg-blue-100 px-1 rounded">当前</span>}
                  </td>
                  {SENS_COMPANIES.map((c) => {
                    const r = calcSens(c, ap, aoPrice, powerPrice);
                    const neg = r.netProfit < 0;
                    return [
                      <td key={c.code+'net'} className={`py-2 px-3 text-right tabular-nums ${neg ? 'text-red-500' : 'text-slate-700'}`}>{r.netProfit.toFixed(2)}</td>,
                      <td key={c.code+'eps'} className={`py-2 px-3 text-right tabular-nums font-semibold ${neg ? 'text-red-500' : 'text-blue-700'}`}>{r.eps.toFixed(2)}</td>,
                      <td key={c.code+'pe'} className={`py-2 px-3 text-right tabular-nums ${neg ? 'text-red-500' : 'text-purple-700'}`}>{r.price20x.toFixed(2)}</td>,
                    ];
                  })}
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

  // 快速测算（无邮件/无 Claude）
  const [estStatus, setEstStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [estData, setEstData] = useState<{ prices: Prices; estimates: CompanyEstimateDetailed[] } | null>(null);
  const [activeCode, setActiveCode] = useState('000807');

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

  async function loadEstimate() {
    setEstStatus('loading');
    try {
      const res = await fetch('/api/estimate');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEstData({ prices: data.prices, estimates: data.estimates });
      setEstStatus('done');
    } catch (e) {
      setEstStatus('error');
    }
  }

  const activeEst = estData?.estimates.find((e) => e.code === activeCode) ?? null;

  return (
    <div className="space-y-6">
      {/* 情景监测工具 */}
      <SensitivityTool />

      {/* 单公司完整测算 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold text-slate-800">完整业绩测算</h2>
            <p className="text-sm text-slate-500 mt-0.5">基于实时行情重算，不触发邮件发送</p>
          </div>
          <button onClick={loadEstimate} disabled={estStatus === 'loading'}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors">
            {estStatus === 'loading' ? '拉取中…' : estStatus === 'done' ? '刷新' : '立即测算'}
          </button>
        </div>
        {estData && (
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-4">
            {estData.estimates.map((e) => (
              <button key={e.code} onClick={() => setActiveCode(e.code)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeCode === e.code ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {e.name}
              </button>
            ))}
          </div>
        )}
        {estStatus === 'loading' && (
          <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            拉取实时行情…
          </div>
        )}
      </div>
      {activeEst && estData && <CompanyDetailCard est={activeEst} prices={estData.prices} />}

      <div className="border-t border-slate-100 pt-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">周报推送</p>
      </div>

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
          <PriceComparison
            curr={{
              weekLabel: isoWeekLabel(report.generatedAt),
              alPrice: report.prices.alPrice,
              aluminaPrice: report.prices.aluminaPrice,
            }}
            prev={
              history.length >= 2
                ? { weekLabel: history[1].weekLabel, alPrice: history[1].alPrice, aluminaPrice: history[1].aluminaPrice }
                : undefined
            }
          />

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
