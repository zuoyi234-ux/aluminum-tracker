import { NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/prices';
import { calcAllEstimates } from '@/lib/models';
import { generateNarrative } from '@/lib/report';
import { sendReport } from '@/lib/email';
import type { WeeklyReport } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Vercel max for hobby plan

export async function GET(request: Request) {
  // 验证 Vercel Cron 密钥（防止公开触发）
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prices = await fetchPrices();
    const estimates = calcAllEstimates(prices);
    const partial = { prices, estimates, generatedAt: new Date().toISOString() };
    const narrative = await generateNarrative(partial);

    const report: WeeklyReport = { ...partial, narrative };
    await sendReport(report);

    return NextResponse.json({ ok: true, generatedAt: report.generatedAt });
  } catch (err) {
    console.error('[cron/report]', err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
