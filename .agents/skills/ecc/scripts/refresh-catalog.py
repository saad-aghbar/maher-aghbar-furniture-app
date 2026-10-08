#!/usr/bin/env python3
"""Regenerate catalog.md and agents.md from ~/.cursor/ecc-src."""
from __future__ import annotations

import re
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SRC = Path.home() / ".cursor/ecc-src"


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


def write_index(kind: str, glob: str, path_fn, out_name: str) -> int:
    root = SRC / kind
    rows = []
    for p in sorted(root.glob(glob)):
        text = p.read_text(encoding="utf-8", errors="replace")
        fm = parse_frontmatter(text)
        name = fm.get("name") or (p.parent.name if p.name == "SKILL.md" else p.stem)
        desc = re.sub(r"\s+", " ", fm.get("description") or "").strip()
        rows.append((name, desc, p))
    lines = [
        f"# ECC {kind}",
        "",
        f"Source: `~/.cursor/ecc-src/{kind}` ({len(rows)} {kind}).",
        "Read the matching file before following a workflow.",
        "",
        "| Name | Description |",
        "|---|---|",
    ]
    for name, desc, _p in rows:
        lines.append(f"| `{name}` | {desc.replace('|', '\\|')} |")
    lines += ["", "## Paths", ""]
    for name, _desc, p in rows:
        lines.append(f"- `{name}` → `{path_fn(name, p)}`")
    (HERE / out_name).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(rows)


def main() -> None:
    n_skills = write_index(
        "skills",
        "*/SKILL.md",
        lambda name, p: f"~/.cursor/ecc-src/skills/{name}/SKILL.md",
        "catalog.md",
    )
    n_agents = write_index(
        "agents",
        "*.md",
        lambda name, p: f"~/.cursor/ecc-src/agents/{name}.md",
        "agents.md",
    )
    print(f"wrote {n_skills} skills, {n_agents} agents -> {HERE}")


if __name__ == "__main__":
    main()
