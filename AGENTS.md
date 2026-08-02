# AGENTS.md

Instructions for AI coding agents working in this repository. Read by Cursor and other AGENTS.md-compatible tools (GitHub Copilot, Codex, Windsurf, etc.). Freebuff reads `knowledge.md` first — **keep `knowledge.md` as the single source of truth** and only mirror essentials here.

## Project

Windows-first, local-first Electron desktop reminder app with a pixel-art cat overlay. Pure tray + popup app (no main settings window; the overlay shows the cat for reminders). Stack: pnpm, Node 22 LTS, Electron, React, TypeScript, Vite, SQLite (`better-sqlite3`), Zustand, date-fns, electron-builder.

## Memory protocol — follow every session

This repo uses git-tracked files as its cross-session AI memory. The goal: no re-explaining the project, ever.

### Bootstrap check (auto-setup on new machines)

At session start, verify the memory system is active: run `git config core.hooksPath`. If it does **not** return `.githooks`, run `bash scripts/setup-memory-hooks.sh` before doing anything else. If memory files are missing but `MEMORY_SETUP.md` exists, replicate them from `MEMORY_SETUP.md`.

### Machine sync check (auto-catch machine swaps)

At session start, run `bash scripts/machine-sync.sh`. It detects a machine change (via `docs/.last-machine`), re-enables hooks on this machine, fixes old `master` clones, and pulls the latest memory files from `origin` — but only when the working tree is clean (it never clobbers uncommitted work). This means the user can start working immediately even after switching machines; no manual `git pull` needed.

### At session start

1. Read `handoff.md` — the last session's work and the prioritized next steps.
2. Read `knowledge.md` — commands, architecture, constraints, gotchas.
3. Check `git status --short`, `git log --oneline -10`, and the tail of `docs/activity-log.md` (auto-log of every commit) for recent context.
4. **After completing a substantial change, append a brief "Work completed" note to `handoff.md` immediately** — do not wait for session end.

### At session end (or when a task completes)

1. Append a date-stamped **"Work completed"** section to `handoff.md` — what changed, why, and what validation ran.
2. Update `knowledge.md` with any new commands, architecture facts, constraints, or gotchas learned.
3. Keep both files lean (< ~200 lines). Prune stale entries instead of accumulating.

### Wrap-up signals

If the user signals the session is ending (e.g. "wrap up", "done for today", "that's all", "update the handoff"), update `handoff.md` and `knowledge.md` **even if not explicitly asked** — do not wait to be told.

## Non-negotiable rules

- **Never commit `.env` or any secrets.** `.env` holds Google OAuth credentials.
- Use **pnpm** (`packageManager: pnpm@11.9.0`), never npm/yarn.
- Run `pnpm typecheck` and `pnpm test` before declaring work complete.
- **Keep v2 out of v1 code paths:** no multiple cats, themes, two-way sync, cloud accounts, Steam features, or non-Google providers.
- Never hand-edit generated files under `out/`.
- Ask before installing packages or changing the SQLite schema.
- `better-sqlite3` is native and must match Electron's ABI — keep `@electron/rebuild`, `npmRebuild`, and `asarUnpack: ["**/*.node"]` configured.

## Reference files

- `knowledge.md` — canonical project knowledge (commands, architecture, constraints)
- `handoff.md` — session log / prioritized next steps
- `docs/activity-log.md` — auto-generated commit log (written by `.githooks/post-commit`, no input needed)
- `docs/activity-watch.log` — raw per-save events (gitignored; only exists if `node scripts/memory-watcher.mjs` is running)
- `.githooks/post-commit` + `scripts/setup-memory-hooks.sh` — automatic memory plumbing
- `MEMORY_SETUP.md` — replication kit for setting up this memory system in brand-new projects (reference only)
- `cat_reminder_master_project_spec_v1_3.md` — master spec (v1 MVP + v2 roadmap)
- `memory_ideas.md` — research doc comparing AI memory options (reference only, not part of the memory system)
- `.cursor/rules/` — path-scoped rules that Cursor auto-attaches when editing matching files
