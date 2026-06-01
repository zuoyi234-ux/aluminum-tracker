import { NextResponse } from 'next/server';
import { fetchPrices } from '@/lib/prices';
import { calcAllEstimates } from '@/lib/models';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// 轻量接口：只拉价格 + 重算业绩，不生成 Claude 叙述也不发邮件
export async function GET() {
  try {
    const prices = await fetchPrices();
    const estimates = calcAllEstimates(prices);
    return NextResponse.json({ ok: true, prices, estimates });
  } catch (err) {
    console.error('[estimate]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
