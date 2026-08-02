# Project knowledge

## Project
- Windows-first, local-first Electron desktop reminder app with a cat overlay.
- Stack fixed by the master spec: pnpm, Node.js 22 LTS, Electron, React, TypeScript, Vite, SQLite, Zustand, date-fns, electron-builder.
- `src/main/` owns lifecycle, tray, windows, SQLite, scheduler, sync, and logging.
- `src/renderer/` owns reminder management/settings UI; `src/preload/` exposes narrow context-isolated APIs.
- `src/shared/` owns domain types, validation, recurrence, state transitions, IPC contracts, and animation metadata.
- `tests/` contains unit tests for rule-heavy behavior; `public/assets/` contains packaged cat sprites and textbox art.

## Session protocol (AI memory system)

This repo uses git-tracked files as its cross-session AI memory. **Freebuff reads this file (`knowledge.md`) automatically at the start of every session**; Cursor reads `AGENTS.md` instead. Follow this ritual every session:

- **Bootstrap check (auto-setup on new machines):** At session start, run `git config core.hooksPath`. If it does **not** return `.githooks`, run `bash scripts/setup-memory-hooks.sh` before doing anything else. If memory files are missing but `MEMORY_SETUP.md` exists, replicate them from `MEMORY_SETUP.md`.
- **Machine sync check (auto-catch machine swaps):** At session start, run `bash scripts/machine-sync.sh`. It detects a machine change (via `docs/.last-machine`), re-enables hooks on this machine, fixes old `master` clones, and pulls the latest memory files from `origin` — but only when the working tree is clean (it never clobbers uncommitted work). This means you can start working immediately even after switching machines; no manual `git pull` needed.
- **Session start:** Read `handoff.md` first (last session's work + next steps), then this file, then check `git status --short`, `git log --oneline -10`, and the tail of `docs/activity-log.md` (auto-log of every commit).
- **During work:** Log non-obvious decisions, new commands, and gotchas into this file as they are discovered. **After completing a substantial change, append a brief "Work completed" note to `handoff.md` immediately — do not wait for session end.**
- **Session end:** Append a date-stamped "Work completed" section to `handoff.md` (what changed, why, validation run). Update this file with any new rules/commands/architecture facts. Keep both files lean (< ~200 lines); prune stale content.
- **Wrap-up signals:** If the user says the session is ending (e.g. "wrap up", "done for today", "that's all", "update the handoff"), update `handoff.md` + this file **even if not explicitly asked** — do not wait to be told.
- Update `AGENTS.md` only when a rule must also bind Cursor/other tools — this file stays the single source of truth.

**Automatic memory (no input needed):** a git `post-commit` hook (`.githooks/post-commit`) appends every commit to `docs/activity-log.md`; `node scripts/memory-watcher.mjs` (optional) logs every file save to `docs/activity-watch.log` (gitignored). These are mechanical records — the agent still owns writing the *why* into `handoff.md`/this file.

## Commands
- Install: `pnpm install` (Corepack can provide pnpm; the current environment does not have pnpm installed).
- Development: `pnpm dev`.
- Test: `pnpm test`.
- Typecheck/lint: `pnpm typecheck` / `pnpm lint`.
- Build: `pnpm build`.
- Windows packaging: `pnpm dist:win`.
- macOS packaging is reserved for a later milestone: `pnpm dist:mac`.

## Architecture and behavior
- SQLite is the local source of truth and is accessed only by the main process through repositories and versioned migrations.
- `better-sqlite3` is isolated behind storage modules; packaging unpacks native `.node` files and enables electron-builder native rebuilds.
- Reminder actions are occurrence-level: completing/dismissing an occurrence does not delete its recurring series.
- The scheduler uses persisted reminder state plus a FIFO queue so only one overlay reminder is active at a time.
- Google Calendar is read-only with loopback OAuth, encrypted local token storage, calendar selection, manual refresh, and scheduled sync. Calendar credentials remain release configuration rather than user data. Imported reminders retain calendar/event IDs; cloud storage and remote accounts are intentionally out of scope for v1.
- Overlay windows are transparent and always-on-top; they remain click-through while idle and become interactive only while presenting an alert. The renderer uses the supplied 384×64 six-frame sprite sheets at pixelated scaling.
- Renderer and overlay use separate context-isolated preload bridges; do not expose raw Electron or Node APIs to either window.

## Constraints and gotchas
- The target runtime is Node 22 LTS. The current machine has Node 24 and no pnpm; `npm install` was attempted but `better-sqlite3` could not compile because no Visual Studio C++ toolchain was available. Repeat installation in the intended Node 22 + pnpm + Windows C++ build environment.
- `better-sqlite3` is a native module and must match Electron’s ABI. Keep `@electron/rebuild`, `npmRebuild`, and `asarUnpack: ["**/*.node"]` configured.
- Keep v2 out of v1 paths: no multiple cats, themes, two-way sync, cloud accounts, Steam features, or non-Google providers yet.
- All stored timestamps should be ISO 8601 and recurrence calculations must respect the reminder timezone; test DST, sleep/wake, restart, monitor changes, and timezone changes before release.
- Google OAuth should use the system browser with a loopback callback and read-only calendar scope; credentials must remain local and never be committed.
