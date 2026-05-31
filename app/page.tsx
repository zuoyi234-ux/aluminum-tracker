'use client';

import { useState } from 'react';
import type { WeeklyReport } from '@/lib/types';

const COMPANIES = ['中孚实业 600595', '神火股份 000933', '云铝股份 000807'];

export default function Dashboard() {
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-blue-300 text-xs font-semibold tracking-widest uppercase mb-2">周度行业跟踪</p>
          <h1 className="text-2xl font-bold mb-1">铝业股票周报</h1>
          <p className="text-blue-200 text-sm">
            {COMPANIES.join(' · ')}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Cron info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-2">自动推送计划</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            每周一 08:00（北京时间）自动运行：拉取沪铝 + 氧化铝最新行情 →
            重新测算三家公司 2026 年业绩 → Claude 生成分析报告 → 发送至
            <span className="font-mono text-blue-600 mx-1">{process.env.NEXT_PUBLIC_REPORT_EMAIL ?? 'zuoyi234@gmail.com'}</span>
          </p>
        </div>

        {/* Manual trigger */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-3">手动触发</h2>
          <button
            onClick={sendNow}
            disabled={status === 'loading'}
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {status === 'loading' ? '生成中（约 30 秒）…' : '立即生成并发送报告'}
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

        {/* Last report preview */}
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
      </main>
    </div>
  );
}
