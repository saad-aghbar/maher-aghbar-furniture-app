/**
 * Optional live API smoke after demo:reset. Requires API on API_URL (default http://localhost:4000).
 */
const API = process.env.API_URL ?? 'http://localhost:4000';

async function login(username: string) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123', client: 'mobile' }),
  });
  if (!res.ok) throw new Error(`${username} login failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { accessToken?: string; token?: string };
  return json.accessToken ?? json.token;
}

async function get(path: string, token: string) {
  const res = await fetch(`${API}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  try {
    const health = await fetch(`${API}/api/v1/health`);
    if (!health.ok) throw new Error(`health ${health.status}`);
  } catch {
    console.log(`live API UAT skipped — ${API} not reachable`);
    process.exit(0);
  }

  const admin = await login('admin');
  const nile = await login('nile');
  await get('/reports/dashboard', admin);
  await get('/reports/admin-home', admin);
  const products = await get('/products?pageSize=20&q=SOF-3S-STD', admin);
  const sku = (products?.data ?? products?.items ?? []).find((p: { sku?: string }) => p.sku === 'SOF-3S-STD');
  if (!sku) throw new Error('SOF-3S-STD missing from live products API');
  await get('/sales-orders?pageSize=10', admin);
  await get('/sales-orders?pageSize=10', nile);
  console.log('live API UAT passed (admin + nile)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
