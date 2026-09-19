import type { AuthUser } from '@maher/types';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function loadSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const header = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (!header.includes('access_token') && !header.includes('refresh_token')) {
    return null;
  }
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { cookie: header },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}
