import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const COOKIE = 'maher_dealer_basket';
const MAX_AGE = 60 * 60 * 24 * 30;

export async function GET() {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ lines: [] });
  try {
    const parsed = JSON.parse(raw) as { lines?: unknown[] };
    return NextResponse.json({ lines: Array.isArray(parsed.lines) ? parsed.lines : [] });
  } catch {
    return NextResponse.json({ lines: [] });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { lines?: unknown } | null;
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  const payload = JSON.stringify({ version: 1, lines, updatedAt: new Date().toISOString() });
  cookies().set(COOKIE, payload, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return NextResponse.json({ ok: true, count: lines.length });
}
