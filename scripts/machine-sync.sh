#!/usr/bin/env bash
# Machine-switch sync check — run at session start by the memory protocol.
#
# What it does (all safe, all idempotent):
#   1. Fixes old clones still on `master` (repo now uses `main`).
#   2. Detects a machine change via docs/.last-machine (hostname marker) and,
#      when changed, re-runs the memory bootstrap so hooks are enabled here.
#   3. Fetches origin and fast-forwards to the latest memory files — but ONLY
#      when the working tree is clean, so it never clobbers uncommitted work.
#
# Exits 0 always — this is a session-start convenience, never a failure gate.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MARKER="$ROOT/docs/.last-machine"
HOSTNAME="$(hostname 2>/dev/null || echo unknown)"
BRANCH="$(git branch --show-current 2>/dev/null || echo '')"

echo "=== Machine sync check ==="

# 1. Old-clone fix: local branch still named master, remote has main
if [ "$BRANCH" = "master" ] && git ls-remote --heads origin main >/dev/null 2>&1; then
  echo "→ Detected old 'master' clone — repo now uses 'main'. Renaming..."
  git branch -m master main 2>/dev/null
  git branch --set-upstream-to=origin/main main 2>/dev/null || true
  BRANCH="main"
fi
[ -z "$BRANCH" ] && BRANCH="main"

# 2. Machine change detection → re-enable memory hooks on this machine
PREV=""
[ -f "$MARKER" ] && PREV="$(cat "$MARKER" 2>/dev/null || true)"
if [ -n "$PREV" ] && [ "$PREV" != "$HOSTNAME" ]; then
  echo "→ Machine change detected: '$PREV' → '$HOSTNAME'"
  echo "→ Re-running memory bootstrap to enable hooks here..."
  bash "$ROOT/scripts/setup-memory-hooks.sh" >/dev/null 2>&1 || echo "  (bootstrap skipped — check scripts exist)"
fi
mkdir -p "$(dirname "$MARKER")"
echo "$HOSTNAME" > "$MARKER"

# 3. Fetch + pull latest when safe
git fetch origin --quiet 2>/dev/null || echo "→ Warning: could not fetch from origin (offline?)."
BEHIND="$(git rev-list --count HEAD..origin/"$BRANCH" 2>/dev/null || echo 0)"
DIRTY="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"

if [ "${BEHIND:-0}" -gt 0 ] 2>/dev/null; then
  if [ "$DIRTY" = "0" ]; then
    echo "→ Local is $BEHIND commit(s) behind origin/$BRANCH. Pulling latest..."
    git pull --ff-only origin "$BRANCH" 2>&1 || echo "→ Pull failed — resolve manually."
  else
    echo "→ Local is $BEHIND commit(s) behind, but working tree is dirty — NOT auto-pulling."
    echo "  Commit or stash first, then run: git pull"
  fi
else
  echo "→ Up to date with origin/$BRANCH."
fi

echo "=== Machine sync check done ==="
