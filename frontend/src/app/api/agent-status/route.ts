import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ORACLE_BASE =
  process.env.NEXT_PUBLIC_ORACLE_URL || 'https://trustgate-oracle.up.railway.app';

export async function GET() {
  try {
    const res = await fetch(`${ORACLE_BASE}/agent-status`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `oracle returned ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'agent-status proxy failed', detail: (err as Error).message },
      { status: 502 }
    );
  }
}
