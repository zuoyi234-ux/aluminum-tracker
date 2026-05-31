import { NextResponse } from 'next/server';
import { fetchValuation } from '@/lib/valuation';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  try {
    const data = await fetchValuation();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[valuation]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
