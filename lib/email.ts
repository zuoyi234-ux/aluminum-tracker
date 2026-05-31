import { Resend } from 'resend';
import type { WeeklyReport } from './types';

const resend = new Resend(process.env.RESEND_API_KEY);

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sign(n: number): string {
  return n >= 0 ? `+${fmt(n)}` : fmt(n);
}

function buildHtml(report: WeeklyReport): string {
  const date = new Date(report.generatedAt).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const rows = report.estimates
    .map(
      (e) => `
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#1e293b">${e.name}<br>
          <span style="font-size:11px;font-weight:400;color:#94a3b8">${e.code}</span></td>
        <td style="padding:10px 16px;text-align:right">${fmt(e.revenue)}</td>
        <td style="padding:10px 16px;text-align:right">${fmt(e.netProfit)}</td>
        <td style="padding:10px 16px;text-align:right;font-weight:600;color:#1d4ed8">${fmt(e.eps)}</td>
        <td style="padding:10px 16px;text-align:right;color:#16a34a">${sign(e.alSensitivity)}</td>
        <td style="padding:10px 16px;text-align:right;color:#dc2626">${sign(e.aluminaSensitivity)}</td>
      </tr>`
    )
    .join('');

  const narrativeHtml = report.narrative
    .split('\n')
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px;line-height:1.75;color:#334155">${line}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'PingFang SC',system-ui,sans-serif">
<div style="max-width:680px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e3a5f,#1d4ed8);padding:28px 32px">
    <p style="margin:0 0 4px;font-size:12px;color:#93c5fd;letter-spacing:0.08em;text-transform:uppercase">周度行业跟踪</p>
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#fff">铝业股票周报</h1>
    <p style="margin:0;font-size:13px;color:#bfdbfe">${date} &nbsp;·&nbsp; 中孚实业 · 神火股份 · 云铝股份</p>
  </div>

  <!-- Price snapshot -->
  <div style="padding:24px 32px;background:#f1f5f9;border-bottom:1px solid #e2e8f0">
    <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.06em;text-transform:uppercase">本周行情</p>
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      <div>
        <p style="margin:0 0 2px;font-size:12px;color:#64748b">沪铝现货</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#1e293b">${report.prices.alPrice.toLocaleString()} <span style="font-size:13px;font-weight:400;color:#64748b">元/吨</span></p>
      </div>
      <div>
        <p style="margin:0 0 2px;font-size:12px;color:#64748b">氧化铝现货</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#1e293b">${report.prices.aluminaPrice.toLocaleString()} <span style="font-size:13px;font-weight:400;color:#64748b">元/吨</span></p>
      </div>
    </div>
    <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">数据来源：${report.prices.source}</p>
  </div>

  <!-- Estimates table -->
  <div style="padding:24px 32px">
    <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.06em;text-transform:uppercase">2026 年业绩重新测算</p>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 16px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">公司</th>
            <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">收入（亿）</th>
            <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">净利润（亿）</th>
            <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">EPS（元）</th>
            <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">铝价+1000→净利</th>
            <th style="padding:10px 16px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">氧化铝+100→净利</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">注：敏感性为税后净利润变化，单位亿元；氧化铝敏感性为负值代表成本上升。</p>
  </div>

  <!-- Claude narrative -->
  <div style="padding:0 32px 24px">
    <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.06em;text-transform:uppercase">AI 分析师点评</p>
    <div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:16px 20px;border-radius:0 8px 8px 0">
      ${narrativeHtml}
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0">
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
      本报告由 Claude AI 辅助生成，仅供参考，不构成投资建议。<br>
      生成时间：${new Date(report.generatedAt).toLocaleString('zh-CN')} &nbsp;·&nbsp; Aluminum Tracker
    </p>
  </div>

</div>
</body>
</html>`;
}

export async function sendReport(report: WeeklyReport): Promise<void> {
  const to = process.env.REPORT_EMAIL ?? 'zuoyi234@gmail.com';
  const date = new Date(report.generatedAt).toLocaleDateString('zh-CN');

  await resend.emails.send({
    from: 'Aluminum Tracker <report@resend.dev>',
    to,
    subject: `铝业周报 ${date} | 沪铝 ${report.prices.alPrice.toLocaleString()} 元/吨`,
    html: buildHtml(report),
  });
}
