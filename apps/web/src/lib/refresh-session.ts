const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let inFlight: Promise<boolean> | null = null;

export async function refreshWebSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  const run = doRefresh().finally(() => {
    inFlight = null;
  });
  inFlight = run;
  return run;
}

export function resetRefreshFlight(): void {
  inFlight = null;
}

async function doRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok;
}
