import { NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/prices';
import { calcAllEstimates } from '@/lib/models';
import { generateNarrative } from '@/lib/report';
import { sendReport } from '@/lib/email';
import type { WeeklyReport } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 手动触发接口（Dashboard 上的"立即发送"按钮调用此路由）
export async function POST() {
  try {
    const prices = await fetchPrices();
    const estimates = calcAllEstimates(prices);
    const partial = { prices, estimates, generatedAt: new Date().toISOString() };
    const narrative = await generateNarrative(partial);
    const report: WeeklyReport = { ...partial, narrative };
    await sendReport(report);

    return NextResponse.json({ ok: true, report });
  } catch (err) {
    console.error('[send-report]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
