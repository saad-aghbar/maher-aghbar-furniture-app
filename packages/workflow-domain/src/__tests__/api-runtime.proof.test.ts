/**
 * Optional live API proof (RUN_API_PROOF=1). Uses cookie login + domain simulate/diff.
 */
import {
  canonicalizeWorkflowGraph,
  diffPredecessorSets,
  edgePairs,
  fromRawGraph,
  simulateWorkflowMutation,
  type CanonicalWorkflowGraph,
} from '../index';

const BASE = process.env.API_URL ?? 'http://127.0.0.1:4000';
const RUN = process.env.RUN_API_PROOF === '1';

type Version = {
  id: string;
  revision: number;
  nodes: Array<{
    id: string;
    sortOrder: number;
    stageDefinition?: { id: string; code: string } | null;
  }>;
  edges: Array<{ fromNodeId: string; toNodeId: string }>;
};

function cookieHeader(store: string[]): string {
  return store.map((c) => c.split(';')[0]).join('; ');
}

function absorbCookies(store: string[], res: Response) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return;
  // Node may join multiple; split carefully
  for (const part of raw.split(/,(?=\s*[^;]+=)/)) {
    const pair = part.trim().split(';')[0];
    if (!pair) continue;
    const name = pair.split('=')[0];
    store = store.filter((c) => !c.startsWith(name + '='));
    store.push(pair);
  }
  // mutate array
  store.length = 0;
  // re-parse properly below
}

async function api<T>(
  store: { cookies: string[] },
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader(store.cookies),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = typeof (res.headers as any).getSetCookie === 'function'
    ? (res.headers as any).getSetCookie() as string[]
    : [];
  if (sc.length) {
    for (const c of sc) {
      const pair = c.split(';')[0]!;
      const name = pair.split('=')[0]!;
      store.cookies = store.cookies.filter((x) => !x.startsWith(name + '='));
      store.cookies.push(pair);
    }
  } else {
    const raw = res.headers.get('set-cookie');
    if (raw) {
      const pair = raw.split(';')[0]!;
      const name = pair.split('=')[0]!;
      store.cookies = store.cookies.filter((x) => !x.startsWith(name + '='));
      store.cookies.push(pair);
    }
  }
  void absorbCookies;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function toDomain(v: Version): CanonicalWorkflowGraph {
  return fromRawGraph(
    v.nodes
      .filter((n) => n.stageDefinition?.code)
      .map((n) => ({ id: n.id, code: n.stageDefinition!.code, sortOrder: n.sortOrder })),
    v.edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId })),
  );
}

function rawBefore(v: Version): CanonicalWorkflowGraph {
  const after = toDomain(v);
  const preds: Record<string, string[]> = {};
  for (const n of after.nodes) preds[n.id] = [];
  for (const e of v.edges) {
    preds[e.toNodeId] = preds[e.toNodeId] ?? [];
    preds[e.toNodeId]!.push(e.fromNodeId);
  }
  for (const k of Object.keys(preds)) preds[k] = [...new Set(preds[k])].sort();
  return {
    ...after,
    predecessorsByNode: preds,
    edges: v.edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId })),
  };
}

async function applyDiff(
  store: { cookies: string[] },
  wfId: string,
  verId: string,
  before: Version,
  after: CanonicalWorkflowGraph,
): Promise<Version> {
  let revision = before.revision;
  const patches = diffPredecessorSets(rawBefore(before), after).filter((p) => {
    const code = after.nodes.find((n) => n.id === p.nodeId)?.code ?? '';
    return code !== 'PACKAGING' && code !== 'DELIVERY';
  });
  for (const p of patches) {
    await api(store, 'PATCH', `/api/v1/production-workflows/${wfId}/versions/${verId}/nodes/${p.nodeId}`, {
      runsAfterNodeIds: p.runsAfterNodeIds,
      expectedRevision: revision,
    });
    revision += 1;
  }
  return api(store, 'GET', `/api/v1/production-workflows/${wfId}/versions/${verId}`);
}

(RUN ? describe : describe.skip)('live API preview=saved=reopened', () => {
  jest.setTimeout(60000);

  it('normalize + ADD AFTER + EDIT on draft', async () => {
    const store = { cookies: [] as string[] };
    await api(store, 'POST', '/api/v1/auth/login', { username: 'admin', password: '123' });
    const workflows = await api<Array<{ id: string; code: string }>>(
      store,
      'GET',
      '/api/v1/production-workflows',
    );
    const pick = workflows.find((w) => w.code === 'TEST') ?? workflows[0]!;
    const detail = await api<{
      versions: Array<{ id: string; status: string }>;
      activeVersionId?: string;
    }>(store, 'GET', `/api/v1/production-workflows/${pick.id}`);
    let draft = detail.versions.find((v) => v.status === 'DRAFT');
    if (!draft) {
      draft = await api(store, 'POST', `/api/v1/production-workflows/${pick.id}/drafts`, {
        fromVersionId: detail.activeVersionId ?? detail.versions[0]?.id,
      });
    }
    const wfId = pick.id;
    const verId = draft!.id;

    let version = await api<Version>(
      store,
      'GET',
      `/api/v1/production-workflows/${wfId}/versions/${verId}`,
    );
    for (const path of ['ensure-opening-chain', 'ensure-terminal-chain'] as const) {
      try {
        await api(store, 'POST', `/api/v1/production-workflows/${wfId}/versions/${verId}/${path}`, {
          expectedRevision: version.revision,
        });
        version = await api(store, 'GET', `/api/v1/production-workflows/${wfId}/versions/${verId}`);
      } catch {
        /* optional */
      }
    }

    // Normalize
    {
      const intended = canonicalizeWorkflowGraph({
        nodes: version.nodes
          .filter((n) => n.stageDefinition?.code)
          .map((n) => ({ id: n.id, code: n.stageDefinition!.code, sortOrder: n.sortOrder })),
        edges: version.edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId })),
      });
      const saved = await applyDiff(store, wfId, verId, version, intended);
      const reopen = await api<Version>(
        store,
        'GET',
        `/api/v1/production-workflows/${wfId}/versions/${verId}`,
      );
      expect(edgePairs(toDomain(saved).edges)).toEqual(edgePairs(intended.edges));
      expect(edgePairs(toDomain(reopen).edges)).toEqual(edgePairs(intended.edges));
      version = reopen;
    }

    const library = await api<Array<{ id: string; code: string; isActive?: boolean }>>(
      store,
      'GET',
      '/api/v1/production-stage-library',
    );
    const used = new Set(version.nodes.map((n) => n.stageDefinition?.code));
    const stage = library.find(
      (s) =>
        s.isActive !== false &&
        !used.has(s.code) &&
        !['MATERIAL_PREP', 'INSPECTION', 'PACKAGING', 'DELIVERY'].includes(s.code),
    );
    expect(stage).toBeTruthy();
    const prep = version.nodes.find((n) => n.stageDefinition?.code === 'MATERIAL_PREP');
    expect(prep).toBeTruthy();

    // ADD AFTER prep
    {
      const before = version;
      const placement = { kind: 'AFTER' as const, predecessorIds: [prep!.id] };
      const created = await api<{ id: string }>(
        store,
        'POST',
        `/api/v1/production-workflows/${wfId}/versions/${verId}/nodes`,
        {
          stageDefinitionId: stage!.id,
          isRequiredByDefault: true,
          runsAfterNodeIds: [prep!.id],
          expectedRevision: before.revision,
        },
      );
      const mid = await api<Version>(
        store,
        'GET',
        `/api/v1/production-workflows/${wfId}/versions/${verId}`,
      );
      const intended = simulateWorkflowMutation(toDomain(before), {
        kind: 'ADD',
        nodeId: created.id,
        code: stage!.code,
        placement,
      });
      const saved = await applyDiff(store, wfId, verId, mid, intended);
      const reopen = await api<Version>(
        store,
        'GET',
        `/api/v1/production-workflows/${wfId}/versions/${verId}`,
      );
      expect(edgePairs(toDomain(saved).edges)).toEqual(edgePairs(intended.edges));
      expect(edgePairs(toDomain(reopen).edges)).toEqual(edgePairs(intended.edges));
      version = reopen;
    }

    // EDIT → START
    {
      const before = version;
      const middle = before.nodes.find(
        (n) =>
          n.stageDefinition?.code &&
          !['MATERIAL_PREP', 'INSPECTION', 'PACKAGING', 'DELIVERY'].includes(n.stageDefinition.code),
      )!;
      const intended = simulateWorkflowMutation(toDomain(before), {
        kind: 'EDIT_PLACEMENT',
        nodeId: middle.id,
        placement: { kind: 'START' },
      });
      const saved = await applyDiff(store, wfId, verId, before, intended);
      const reopen = await api<Version>(
        store,
        'GET',
        `/api/v1/production-workflows/${wfId}/versions/${verId}`,
      );
      expect(edgePairs(toDomain(saved).edges)).toEqual(edgePairs(intended.edges));
      expect(edgePairs(toDomain(reopen).edges)).toEqual(edgePairs(intended.edges));
    }
  });
});
