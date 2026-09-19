#!/usr/bin/env python3
"""Find ECC skills/agents by keyword. Usage: find-skill.py [query...]"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SRC = Path.home() / ".cursor/ecc-src"
SKILLS_ROOT = SRC / "skills"
AGENTS_ROOT = SRC / "agents"


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    fm = text[3:end]
    data = {}
    key = None
    buf = []
    for line in fm.splitlines():
        if key and (line.startswith("  ") or line.startswith("\t")):
            buf.append(line.strip())
            continue
        if key is not None:
            data[key] = " ".join(x for x in buf if x).strip("\"'")
            key = None
            buf = []
        m = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not m:
            continue
        k, v = m.group(1), m.group(2)
        if v in (">", ">-", "|", "|-"):
            key = k
            buf = []
            continue
        data[k] = v.strip().strip("\"'")
    if key is not None:
        data[key] = " ".join(x for x in buf if x).strip("\"'")
    return data


def load_skills() -> list[tuple[str, str, Path]]:
    rows = []
    for p in sorted(SKILLS_ROOT.glob("*/SKILL.md")):
        fm = parse_frontmatter(p.read_text(encoding="utf-8", errors="replace")[:4000])
        name = fm.get("name") or p.parent.name
        desc = re.sub(r"\s+", " ", fm.get("description") or "").strip()
        rows.append((name, desc, p))
    return rows


def load_agents() -> list[tuple[str, str, Path]]:
    rows = []
    for p in sorted(AGENTS_ROOT.glob("*.md")):
        fm = parse_frontmatter(p.read_text(encoding="utf-8", errors="replace")[:4000])
        name = fm.get("name") or p.stem
        desc = re.sub(r"\s+", " ", fm.get("description") or "").strip()
        rows.append((name, desc, p))
    return rows


def main() -> int:
    needles = [a.lower() for a in sys.argv[1:] if a.strip()]
    if not needles:
        print("Usage: find-skill.py <keyword> [keyword...]")
        print(f"Skills:  {SKILLS_ROOT}")
        print(f"Agents:  {AGENTS_ROOT}")
        return 1
    print("## Skills")
    skill_hits = []
    for name, desc, p in load_skills():
        hay = f"{name} {desc}".lower()
        if all(n in hay for n in needles):
            skill_hits.append((name, desc, p))
            print(f"| `{name}` | {desc} |")
    if not skill_hits:
        print("(none)")
    print("\n## Agents")
    agent_hits = []
    for name, desc, p in load_agents():
        hay = f"{name} {desc}".lower()
        if all(n in hay for n in needles):
            agent_hits.append((name, desc, p))
            print(f"| `{name}` | {desc} |")
    if not agent_hits:
        print("(none)")
    print("\n## Paths")
    for name, _d, p in skill_hits + agent_hits:
        print(f"{name} -> {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
