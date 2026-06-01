'use client';

import { useState, useMemo } from 'react';
import type { WeeklyReport } from '@/lib/types';
import type { MarketMovers, StockItem } from '@/lib/market-movers';
import type { ValuationResult, SectorData, EnrichedCompany } from '@/lib/valuation';

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

const MOCK_DIGEST: DigestData = {
  date: '06月01日',
  lead: '过去 24 小时里，最值得盯的是两条主线：一是 Anthropic 继续把模型与融资两条战线同时拉满，二是中美围绕 AI 芯片、算力和开发者入口的竞争又有了新动作。今天的前几条，基本都指向同一个问题：谁能更快把更强模型和更大算力变成真实产品与收入。',
  items: [
    { id: 1, title: 'Anthropic 发布 Claude Opus 4.8，旗舰模型继续加码代码与代理能力', body: '新版本在保持原价的同时，上线了"动态工作流"和可调 effort，明显是在正面回应 Codex、Copilot 和 Gemini 这轮开发者竞争。' },
    { id: 2, title: '美国商务部周日补上 AI 芯片出口漏洞', body: '明确对总部在中国、但位于境外的实体也执行先进芯片许可要求。若严格落地，NVIDIA Rubin、Blackwell 以及 AMD MI350x 向中国公司海外子公司的流转空间将被进一步压缩。' },
    { id: 3, title: 'Anthropic 同时宣布完成 650 亿美元 Series H 融资，投后估值达到 9650 亿美元', body: '钱将继续硬向安全研究、算力扩容和 Claude 产品线，这也说明头部模型公司的资本门槛还在抬升。' },
    { id: 4, title: '微软据报将在本周 Build 开发者大会上发布一组自研 AI 模型', body: '其中包括面向 GitHub Copilot 的代码模型。若消息成真，微软会进一步减少对外部模型的依赖，把 Copilot 拉回"平台自控"节奏。' },
    { id: 5, title: 'NVIDIA 与微软据报将于下周亮相首批以 NVIDIA 芯片为主处理器的 Windows PC', body: 'AI PC 这一波如果从 NPU 辅助走向主处理器级别，Windows 端侧 AI 的硬件路线会被重新定义。' },
    { id: 6, title: 'OpenAI 发布 Frontier Governance Framework', body: '把自身前沿模型治理做法与加州透明度法案、欧盟 AI Act 通用模型行为准则对齐。对整个行业来说，前沿模型公司正从"先上车再补规则"转向"边商业化边制度化"。' },
    { id: 7, title: 'OpenAI 还推出 Rosalind Biodefense', body: '并向部分美国政府及盟友公共卫生伙伴扩大 GPT-Rosalind 的可信访问。AI 在生物安全方向的"防御性部署"开始从原则表态走向具体项目。' },
    { id: 8, title: 'TSMC 高管最新表态：AI 正把芯片设计的核心约束从纯算力推向能效', body: '对数据中心和先进制程链条来说，接下来比拼的不只是更大模型，也是谁能把每瓦性能和供电成本压得更低。' },
    { id: 9, title: '数据中心运营商 IREN 宣布斥资约 16 亿美元采购 Dell 提供的 NVIDIA Blackwell 系统', body: '以支撑其 AI 云合同扩容。算力备军竞赛还在继续，但现在比拼的已不只是拿到 GPU，而是能否更快把 GPU 变成稳定收入。' },
    { id: 10, title: '中国首次将国产 AI 芯片纳入"安全可靠"采购目录，九款本土方案进入政府采购视野', body: '结合美国继续收紧先进芯片流向，这意味着中美 AI 供应链正在同时向"更强限制"和"更强国产替代"推进。' },
  ],
  summary: '模型、芯片、云和监管四条线正在同步加速，AI 竞争已经从"谁更会讲故事"全面切向"谁能更快把能力、算力和规则一起落地"。',
};

function DigestSection() {
  const [digest] = useState<DigestData>(MOCK_DIGEST);

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-slate-800 text-base">科技 / AI 十条晨报</h2>
            <p className="text-xs text-slate-400 mt-0.5">{digest.date} · 由 Claude AI 自动生成</p>
          </div>
          <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full">已发送至邮箱</span>
        </div>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{digest.lead}</p>
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
