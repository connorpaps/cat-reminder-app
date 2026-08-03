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
- SQLite is the local source of truth and is accessed only by the main process through repositories and versioned migrations. Migrations are tracked in the `schema_migrations` table (NOT `PRAGMA user_version`); each migration is a version + SQL block, applied transactionally, idempotent on fresh installs.
- `better-sqlite3` is isolated behind storage modules; packaging unpacks native `.node` files and enables electron-builder native rebuilds.
- Reminder actions are occurrence-level: completing/dismissing an occurrence does not delete its recurring series.
- Reminders are **kinded**: `timed` (has a time → cat overlay at `startAt − leadMinutes`), `all-day` (a due *date*, stored as local midnight → only appears in that day's task roll-up, never the timed cat), `anytime` (no date at all; `start_at` holds the `ANYTIME_SENTINEL_START` placeholder so the column stays NOT NULL). `dueCandidates` (the timed scheduler) filters `kind = 'timed'`; `statusAt` rejects non-timed kinds; `repeatRule` is rejected for non-timed kinds by validation.
- **Daily task roll-up**: at the configured `dailyTaskReminderTime` (default 09:00) each day, `TaskRollupScheduler` (pure `rollupDecision()` + `dayKey()` + `buildRollupOverlay()`) shows ALL of the day's time-less tasks (`todayTasks()` = uncompleted anytime + all-day due on the *local* calendar day) as ONE cat overlay with a task-list bubble (large textbox panel). Checks every 30s + once at boot (late launches still fire). Per-day state (`daily_task_reminder_state` table) is pending/shown/snoozed/dismissed; Snooze reappears after `snoozeMinutes`, Dismiss hides it until the next day. A `rollupShowing` flag in `index.ts` makes timed reminders defer (30s retry) while the roll-up owns the overlay.
- The scheduler uses persisted reminder state plus a FIFO queue so only one overlay reminder is active at a time.
- Google Calendar + Google Tasks + **TickTick** are read-only integrations with loopback OAuth, encrypted provider-scoped local token storage (`google-calendar.tokens` / `ticktick.tokens` — `SecureTokenStore` takes a provider arg), list/project selection, manual refresh, and scheduled sync. Credentials remain release configuration. Google Tasks with a `00:00:00 UTC` due become `all-day`; due-less tasks import as `anytime`. **TickTick** (display-only, never writes back): app registered at `developer.ticktick.com/manage`, OAuth at `ticktick.com/oauth/authorize` + `/oauth/token`, **fixed redirect URI `http://127.0.0.1:14565/callback`** (pathless `:14565` suspected of breaking authorize; openapi-cli always uses `/callback`), scopes `tasks:read tasks:write` (BOTH requested — every working community implementation does this; the app still never writes), token POST uses **HTTP Basic auth + `scope` body param** (form-field credentials + no scope → `unknown_exception`), base `https://api.ticktick.com/open/v1`; `taskToReminder` maps no-dueDate → `anytime`, isAllDay/date-only → `all-day` local midnight, else `timed`, status 2 → completed; sync prunes disappeared tasks to completed (scoped to synced projects); 401 → refresh-and-retry once; `oauth.ts` closes its callback listener on every path + before rebinding (no EADDRINUSE on retries). Cloud storage and remote accounts are out of scope for v1. NOTE: TickTick's Google Calendar integration only syncs tasks *with time attributes*, so the Google bridge can't feed the daily roll-up — the Open API is the primary path.
- Overlay windows are transparent, borderless, always-on-top, span the full display, and remain click-through while idle. The cat walks on `walkBaselineFromBottom` = `display.bounds.bottom − workArea.bottom` (taskbar height for a bottom-docked taskbar, 0 otherwise). The show is a three-phase walk: running across (−12% → 90%), a 5s idle pause at 90% (idle sprite mirrored with `translateX(-50%) scaleX(-1)` — order matters!), then running off-screen to 112%; walk end auto-dismisses timed reminders but the roll-up only walks off (stays 'shown').
- Sprite sheets: `running.png` has 5px of transparent padding below the feet (`feetPaddingPx: 5` on the manifest; renderer drops the sprite by `feetPaddingPx × scale` so feet, not frame bottom, touch the walk line); `idle.png` is a sitting pose flush at the bottom (`feetPaddingPx: 0`) drawn facing LEFT (mirrored during the pause). `textbox.png` panels: compact x=16..47,y=0..15 (scale 8) and large x=1..62,y=17..62 (scale 4) for the task list.
- Renderer and overlay use separate context-isolated preload bridges; do not expose raw Electron or Node APIs to either window.

## Constraints and gotchas
- The target runtime is Node 22 LTS. The current machine has Node 24 and no pnpm; `npm install` was attempted but `better-sqlite3` could not compile because no Visual Studio C++ toolchain was available. Repeat installation in the intended Node 22 + pnpm + Windows C++ build environment.
- `better-sqlite3` is a native module and must match Electron’s ABI. Keep `@electron/rebuild`, `npmRebuild`, and `asarUnpack: ["**/*.node"]` configured.
- Keep v2 out of v1 paths: no multiple cats, themes, two-way sync, cloud accounts, Steam features, or non-Google providers yet.
- All stored timestamps should be ISO 8601 and recurrence calculations must respect the reminder timezone; test DST, sleep/wake, restart, monitor changes, and timezone changes before release.
- **The import upsert (`reminder-repository.upsertImported`) now syncs `kind` on conflict** (plus title/desc/start/end/timezone/updated_at) but deliberately NOT `status`/`enabled` (so a locally snoozed/dismissed reminder isn't reset by the next sync). Provider sync services that need status changes (e.g. TickTick status-2 tasks) must update status explicitly after upsert.
- Google OAuth should use the system browser with a loopback callback and read-only calendar scope; credentials must remain local and never be committed.
- **TickTick OAuth (verified against ticktick-py + ticktick-openapi-cli):** token exchange needs HTTP Basic auth (client_id:client_secret) plus a `scope` param in the body — form-field credentials with no scope → TickTick's vague `{"errorCode":"unknown_exception"}`. A healthy token endpoint answers `invalid_grant` for a fake code (the "credentials + format OK" probe). `unknown_exception` at the authorize/consent step has been documented as TickTick server-side breakage (liadgez/ticktick-mcp-server#1) and also appeared for a misconfigured app; `error="invalid_request", "At least one redirect_uri must be registered with the client."` means the app record has no saved App Service URL — set `http://127.0.0.1:14565/callback` on the EXACT app whose Client ID is in `.env` (multiple records can exist; the user may edit the wrong one).
- **The dev server's file watcher is unreliable in this environment** — HMR rarely picks up changes (`grep 'hmr update' /tmp/catlendar-dev.log` comes up empty). After source changes, fully restart: `taskkill //F //IM electron.exe` then relaunch `nohup ./node_modules/.bin/electron-vite dev > /tmp/catlendar-dev.log 2>&1 &` and verify `Cat Reminder started` appears in the log.
- **CSS transform order gotcha (sprite mirroring):** the transform list is sandwiched between `translate(-origin)`/`translate(origin)`, so `scaleX(-1) translateX(-50%)` shifts the sprite a full sprite-width off-center; the correct center-and-mirror order is `translateX(-50%) scaleX(-1)`.
- Overlay walk timing constants live in `src/shared/animation.ts`: `CAT_TRAVEL_DURATION_MS = 13_613` (12_375 + 10%), `CAT_PAUSE_DURATION_MS = 5_000`, `CAT_PAUSE_POSITION_PERCENT = 90`, with `phaseAt()`/`traversalPositionAt()`/`totalShowDurationMs()` as the single source of timing truth.
