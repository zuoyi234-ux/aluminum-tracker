import { NextResponse } from 'next/server';
import { fetchMarketMovers } from '@/lib/market-movers';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  try {
    const data = await fetchMarketMovers();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[market-movers]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
