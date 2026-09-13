#!/usr/bin/env python3
"""
Remove the wiring for components that have been deleted from src/components.

When a panel is cut, its file goes but `src/main.js` still imports it and
`index.html` still has its button and its container, which breaks the build and
leaves dead controls. This finds every component `src/main.js` imports whose file
no longer exists and strips it from both files.

Idempotent — safe to run repeatedly.

    python3 tools/prune_cut_components.py [--dry-run]
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAIN = ROOT / "src" / "main.js"
HTML = ROOT / "index.html"
COMPONENTS = ROOT / "src" / "components"


def missing_components(main_src: str) -> list[str]:
    """Class names imported from ./components/X.js where X.js no longer exists."""
    missing = []
    for cls, mod in re.findall(r"import \{\s*(\w+)\s*\} from '\./components/(\w+)\.js';", main_src):
        if not (COMPONENTS / f"{mod}.js").exists():
            missing.append(cls)
    return missing


def instance_name(cls: str) -> str:
    return cls[0].lower() + cls[1:]


def drop_balanced_statement(src: str, start: int) -> str:
    """
    Delete the whole statement beginning at `start`, tracking bracket depth so a
    multi-line constructor call with callbacks is removed in full rather than
    leaving an orphaned `});` behind.
    """
    depth = 0
    i = start
    in_str = None
    while i < len(src):
        ch = src[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
        elif ch in "\"'`":
            in_str = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == ";" and depth == 0:
            end = src.find("\n", i)
            end = len(src) if end == -1 else end + 1
            return src[:start] + src[end:]
        i += 1
    return src


def prune_main(src: str, classes: list[str]) -> str:
    for cls in classes:
        inst = instance_name(cls)

        # import line
        src = re.sub(rf"import \{{\s*{cls}\s*\}} from '\./components/\w+\.js';\n", "", src)

        # construction statement, however many lines it spans
        marker = f"    this.{inst} = new {cls}("
        while marker in src:
            src = drop_balanced_statement(src, src.index(marker))

        # any remaining single-line references: feature map entries, labels,
        # registry rows, switchView calls, container lookups
        kept = []
        for line in src.split("\n"):
            if re.search(rf"\bthis\.{inst}\b", line) and line.strip().endswith(","):
                continue                      # registry / feature-map row
            if re.search(rf"\bthis\.{inst}\b", line) and ("=>" in line or "?." in line):
                continue                      # feature-map arrow or guarded call
            if f"'{inst}'" in line and line.strip().startswith("["):
                continue                      # modal registry tuple
            kept.append(line)
        src = "\n".join(kept)

    # Collapse any run of blank lines left behind.
    return re.sub(r"\n{3,}", "\n\n", src)


def prune_html(src: str, feature_keys: list[str], container_ids: list[str]) -> str:
    for key in feature_keys:
        src = re.sub(rf'\s*<button class="feature-btn" data-feature="{key}">.*?</button>\n', "\n", src)
    for cid in container_ids:
        src = re.sub(rf'\s*<div id="{cid}"></div>\n', "\n", src)
    return re.sub(r"\n{3,}", "\n\n", src)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    main_src = MAIN.read_text()
    classes = missing_components(main_src)
    if not classes:
        print("nothing to prune — every imported component exists")
        return 0

    print("cut components found:", ", ".join(classes))

    pruned = prune_main(main_src, classes)

    # Containers and feature keys that no longer have any JS referencing them.
    html_src = HTML.read_text()
    orphan_containers = [
        cid for cid in re.findall(r'<div id="(\w+Container)"></div>', html_src)
        if cid not in pruned
    ]
    orphan_features = [
        key for key in re.findall(r'data-feature="(\w+)"', html_src)
        if f"      {key}:" not in pruned and f"{key}:" not in pruned
    ]
    pruned_html = prune_html(html_src, orphan_features, orphan_containers)

    print("  orphaned containers:", ", ".join(orphan_containers) or "none")
    print("  orphaned feature buttons:", ", ".join(orphan_features) or "none")

    if args.dry_run:
        print("(dry run — nothing written)")
        return 0

    MAIN.write_text(pruned)
    HTML.write_text(pruned_html)
    print("pruned src/main.js and index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
