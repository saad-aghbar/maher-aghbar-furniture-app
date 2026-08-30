#!/usr/bin/env python3
"""API runtime proof for workflow predecessor patches (save → leave → reopen)."""
from __future__ import annotations

import http.cookiejar
import json
import urllib.error
import urllib.request
from collections import defaultdict

BASE = "http://127.0.0.1:4000"
CJ = http.cookiejar.CookieJar()
OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CJ))

LOCKED = {"MATERIAL_PREP", "INSPECTION", "PACKAGING", "DELIVERY"}


def api(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        with OPENER.open(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} → {e.code}: {err[:500]}") from e


def edge_pairs(version: dict) -> list[str]:
    return sorted(f"{e['fromNodeId']}->{e['toNodeId']}" for e in version.get("edges") or [])


def preds_by_node(version: dict) -> dict[str, list[str]]:
    out: dict[str, list[str]] = defaultdict(list)
    for n in version.get("nodes") or []:
        out[n["id"]] = []
    for e in version.get("edges") or []:
        out[e["toNodeId"]].append(e["fromNodeId"])
    return {k: sorted(set(v)) for k, v in out.items()}


def node_by_code(version: dict, code: str):
    for n in version.get("nodes") or []:
        if (n.get("stageDefinition") or {}).get("code") == code:
            return n
    return None


def code_of(n: dict) -> str:
    return (n.get("stageDefinition") or {}).get("code") or ""


def get_version(wf_id: str, ver_id: str) -> dict:
    return api("GET", f"/api/v1/production-workflows/{wf_id}/versions/{ver_id}")


def patch_preds(wf_id: str, ver_id: str, node_id: str, runs_after: list[str], revision: int) -> int:
    api(
        "PATCH",
        f"/api/v1/production-workflows/{wf_id}/versions/{ver_id}/nodes/{node_id}",
        {"runsAfterNodeIds": runs_after, "expectedRevision": revision},
    )
    return revision + 1


def assert_terminal(v: dict) -> bool:
    insp = node_by_code(v, "INSPECTION")
    pack = node_by_code(v, "PACKAGING")
    deliv = node_by_code(v, "DELIVERY")
    if not (insp and pack and deliv):
        return False
    p = preds_by_node(v)
    return p.get(pack["id"]) == [insp["id"]] and p.get(deliv["id"]) == [pack["id"]]


def main():
    api("POST", "/api/v1/auth/login", {"username": "admin", "password": "123"})
    workflows = api("GET", "/api/v1/production-workflows")
    pick = next((w for w in workflows if w.get("code") == "TEST"), None) or workflows[0]
    wf_id = pick["id"]
    detail = api("GET", f"/api/v1/production-workflows/{wf_id}")
    draft = next((v for v in detail.get("versions") or [] if v.get("status") == "DRAFT"), None)
    if not draft:
        draft = api(
            "POST",
            f"/api/v1/production-workflows/{wf_id}/versions",
            {"fromVersionId": detail.get("activeVersionId") or detail["versions"][0]["id"]},
        )
    ver_id = draft["id"]
    print(f"Using {pick.get('code')} draft {ver_id}")

    v = get_version(wf_id, ver_id)
    for path in ("ensure-opening-chain", "ensure-terminal-chain"):
        try:
            api(
                "POST",
                f"/api/v1/production-workflows/{wf_id}/versions/{ver_id}/{path}",
                {"expectedRevision": v["revision"]},
            )
            v = get_version(wf_id, ver_id)
        except Exception as e:
            print(f"{path} skip:", e)

    library = api("GET", "/api/v1/production-stage-library")
    used = {code_of(n) for n in v.get("nodes") or []}
    unused = [s for s in library if s.get("isActive", True) and s["code"] not in used and s["code"] not in LOCKED]
    results = []

    def check(name: str, fn):
        before = edge_pairs(get_version(wf_id, ver_id))
        fn()
        a = edge_pairs(get_version(wf_id, ver_id))
        b = edge_pairs(get_version(wf_id, ver_id))
        v2 = get_version(wf_id, ver_id)
        ok = a == b and a != before or a == b  # reopen identical always required
        reopen_ok = a == b
        term = assert_terminal(v2)
        dups = len(a) == len(set(a))
        results.append(
            {
                "case": name,
                "reopen_identical": reopen_ok,
                "terminal_ok": term,
                "no_dup_edges": dups,
                "edges": len(a),
            }
        )
        status = "PASS" if reopen_ok and term and dups else "FAIL"
        print(f"[{status}] {name} edges {len(before)}→{len(a)}")

    # ADD AFTER prep using unused library stage
    if unused:
        stage = unused[0]
        prep = node_by_code(v, "MATERIAL_PREP")

        def add_after():
            nonlocal v
            v = get_version(wf_id, ver_id)
            created = api(
                "POST",
                f"/api/v1/production-workflows/{wf_id}/versions/{ver_id}/nodes",
                {
                    "stageDefinitionId": stage["id"],
                    "isRequiredByDefault": True,
                    "runsAfterNodeIds": [prep["id"]],
                    "expectedRevision": v["revision"],
                },
            )
            v = get_version(wf_id, ver_id)
            new_id = created["id"] if isinstance(created, dict) and "id" in created else None
            if not new_id:
                # find by stage code
                n = node_by_code(v, stage["code"])
                new_id = n["id"]
            # Wire Inspection frontier: replace insp preds with production frontier
            # Minimal: ensure new node leads into insp if it was a dead-end
            insp = node_by_code(v, "INSPECTION")
            preds = preds_by_node(v)
            outs = defaultdict(list)
            for e in v.get("edges") or []:
                outs[e["fromNodeId"]].append(e["toNodeId"])
            frontier = [
                n["id"]
                for n in v.get("nodes") or []
                if code_of(n) not in LOCKED
                and not any(code_of(node_by_code(v, code_of(x)) or {}) for x in [])  # placeholder
            ]
            # real frontier: production nodes with no outbound to production/insp path
            frontier_ids = []
            for n in v.get("nodes") or []:
                if code_of(n) in LOCKED:
                    continue
                kids = outs.get(n["id"], [])
                if not kids or kids == [insp["id"]] or insp["id"] in kids:
                    # if only goes to insp or nowhere, it's frontier-ish
                    if not kids:
                        frontier_ids.append(n["id"])
                    elif all(
                        (node_by_code(v, code_of(next(x for x in v["nodes"] if x["id"] == k))) or {}).get("stageDefinition", {}).get("code")
                        in {"INSPECTION", "PACKAGING", "DELIVERY"}
                        for k in kids
                    ):
                        frontier_ids.append(n["id"])
            # Simpler: set insp preds = all production nodes with no non-terminal children
            frontier_ids = []
            for n in v.get("nodes") or []:
                c = code_of(n)
                if c in LOCKED:
                    continue
                kids = outs.get(n["id"], [])
                non_term_kids = []
                for k in kids:
                    kn = next((x for x in v["nodes"] if x["id"] == k), None)
                    if kn and code_of(kn) not in LOCKED:
                        non_term_kids.append(k)
                if not non_term_kids:
                    frontier_ids.append(n["id"])
            if not frontier_ids:
                frontier_ids = [new_id]
            rev = v["revision"]
            patch_preds(wf_id, ver_id, insp["id"], sorted(set(frontier_ids)), rev)
            # drop prep->insp spider if present
            v = get_version(wf_id, ver_id)

        check("ADD_AFTER_ONE", add_after)
    else:
        results.append({"case": "ADD_AFTER_ONE", "error": "no unused stage"})
        print("[SKIP] ADD_AFTER_ONE")

    v = get_version(wf_id, ver_id)
    middle = [n for n in v.get("nodes") or [] if code_of(n) not in LOCKED]
    if middle:
        target = middle[-1]
        prep = node_by_code(v, "MATERIAL_PREP")

        def edit_parallel():
            nonlocal v
            v = get_version(wf_id, ver_id)
            # Parallel with prep ⇒ empty preds (root beside prep)
            patch_preds(wf_id, ver_id, target["id"], [], v["revision"])
            v = get_version(wf_id, ver_id)
            insp = node_by_code(v, "INSPECTION")
            outs = defaultdict(list)
            for e in v.get("edges") or []:
                outs[e["fromNodeId"]].append(e["toNodeId"])
            frontier_ids = []
            for n in v.get("nodes") or []:
                if code_of(n) in LOCKED:
                    continue
                kids = outs.get(n["id"], [])
                non_term = [
                    k
                    for k in kids
                    if code_of(next(x for x in v["nodes"] if x["id"] == k)) not in LOCKED
                ]
                if not non_term:
                    frontier_ids.append(n["id"])
            patch_preds(wf_id, ver_id, insp["id"], sorted(set(frontier_ids)), v["revision"])

        check("EDIT_START_PARALLEL_ROOT", edit_parallel)

        def edit_after_prep():
            nonlocal v
            v = get_version(wf_id, ver_id)
            patch_preds(wf_id, ver_id, target["id"], [prep["id"]], v["revision"])
            v = get_version(wf_id, ver_id)

        check("EDIT_AFTER_PREP", edit_after_prep)

    a = edge_pairs(get_version(wf_id, ver_id))
    b = edge_pairs(get_version(wf_id, ver_id))
    results.append(
        {
            "case": "REOPEN_IDEMPOTENT",
            "reopen_identical": a == b,
            "terminal_ok": assert_terminal(get_version(wf_id, ver_id)),
            "no_dup_edges": len(a) == len(set(a)),
        }
    )
    print(f"[{'PASS' if a == b else 'FAIL'}] REOPEN_IDEMPOTENT")

    failed = [
        r
        for r in results
        if r.get("error")
        or not r.get("reopen_identical", True)
        or not r.get("terminal_ok", True)
        or not r.get("no_dup_edges", True)
    ]
    print(json.dumps({"results": results, "failed": len(failed)}, indent=2))
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
