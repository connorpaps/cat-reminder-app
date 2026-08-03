# Cat Reminder — Session Handoff

**Last updated:** August 2, 2026  
**Project:** Windows-first, local-first cat-themed desktop reminder app  
**Runtime target:** Node.js 22 LTS + pnpm 11  
**GitHub:** https://github.com/connorpaps/cat-reminder-app (remote: `origin`, branch: `main` — was `master`, renamed 2026-08-02)

## Read this first

The app is an Electron + React + TypeScript desktop reminder application. SQLite is the local source of truth. The main process owns scheduling, persistence, tray/background behavior, sync, and overlay windows. The renderer owns a compact popup UI and the overlay. The overlay uses the supplied pixel-art cat and textbox assets.

**The app is a pure tray app.** There is no main settings window — clicking the cat tray icon opens a small pixel-art popup near the taskbar. The popup auto-closes when clicking elsewhere. On first launch (no Google account connected), the popup auto-opens.

**Single-instance lock is active.** Running `pnpm dev` twice or double-clicking the executable will focus the existing instance instead of spawning a duplicate tray icon.

## Work completed this session (August 2, 2026) — TickTick integration

### 22. TickTick Open API integration (display-only sidekick)

Approved plan: direct official TickTick Open API (NOT the Google Calendar bridge — research showed it only syncs tasks *with time attributes*, so date-less tasks would never reach the app and the daily roll-up would starve). Display-only: the app never writes to TickTick; scope is `tasks:read` only. Research sources: developer.ticktick.com OpenAPI spec (mirrored at mrzmyr/ticktick-openapi), TickTick help article on the Google Calendar integration, ticktick-py/openclaw/openapi-cli community docs.

- **OAuth** (`src/main/sync/ticktick/oauth.ts`): authorization-code flow at `ticktick.com/oauth/authorize` + `/oauth/token`, scopes `tasks:read tasks:write` (BOTH requested — the app stays display-only and never writes, but every working community implementation requests both; a bare `tasks:read` was suspected of triggering TickTick's `unknown_exception` at the consent step), **fixed redirect URI `http://127.0.0.1:14565/callback`** (pathless `:14565` was suspected of breaking authorize — openapi-cli always uses `/callback`). Token POST uses **HTTP Basic auth** (client_id:client_secret) + a `scope` parameter in the body (verified against ticktick-py + ticktick-openapi-cli). Self-serve app registration at `developer.ticktick.com/manage` (no approval; the app's **App Service URL must be set to `http://127.0.0.1:14565/callback`** on the exact record whose Client ID is in `.env` — multiple app records can exist). Tokens: access ~2h + refresh ~6 months; proactive refresh before expiry + one 401 retry in `runTickTickSync()`. Callback listener closes on every path (success/error/timeout) and closes a leftover listener before rebinding, so retries never EADDRINUSE on port 14565.
- **Token store** (`src/main/storage/secure-token-store.ts`): provider-aware — `load/save/clear(provider)` with `google` keeping the existing `google-calendar.tokens` file (no token loss) and `ticktick.tokens` for the new provider.
- **Sync service** (`src/main/sync/ticktick/ticktick-sync.ts`): plain `fetch` (no new deps). `GET /project` + `GET /project/{id}/data` (404 → skip). `taskToReminder()`: no `dueDate` → `anytime`; `isAllDay`/date-only → `all-day` at local midnight; else `timed`; `status 2` → completed; priorities 0/1/3/5 → normal/low/normal/high. Timed tasks imported inside a 60-day window. Upsert with `source: 'ticktick'` (sourceEventId = task id, sourceCalendarId = project id); status-2 tasks explicitly completed locally after upsert; tasks that disappear from the synced projects get marked completed (pruning scoped to synced project ids so deselected projects are untouched).
- **Wiring** (`src/main/index.ts`): `ticktick:status/connect/select-projects/refresh/disconnect` IPC; `runConfiguredSync` runs TickTick **independently of Google** (moved before the Google gate); `syncEnabled` invariant maintained across disconnects (only cleared when the *other* provider is also disconnected); read-only guard (`isExternalSource`) extended to `'ticktick'` for reminder edit/remove paths; boot restores ticktick metadata from `syncRepository.get('ticktick')`.
- **UI** (`src/renderer/popup/PopupApp.tsx`): "✅ TickTick Account" section — Connect button, project checkboxes (default all), sync status + age, Sync now, Disconnect, plus a display-only note. Popup height 274×416 → 274×500 with scrollable content.
- **Env**: `TICKTICK_CLIENT_ID` / `TICKTICK_CLIENT_SECRET` added to `.env.example` (redirect URI must be `http://127.0.0.1:14565/callback`).
- **Bug caught in review**: upsert didn't sync `kind` → removing a due date in TickTick would leave a permanently-overdue `timed` reminder (sentinel startAt). Fixed by adding `kind=excluded.kind` to the upsert (also fixes the same latent bug for Google Tasks) + explicit local completion for status-2 tasks.
- **Tests**: `tests/shared/ticktick-sync.test.ts` (7 tests: timed/anytime/all-day×2/completed/priorities/description). 43/43 pass, `tsc --noEmit` clean, review approved (kind-drift bug fixed), app restarted 21:39 with changes live.

**Pending live test**: ~~BLOCKED~~ → **RESOLVED in §24**.

### 24. TickTick OAuth UNBLOCKED + live-verified end-to-end (August 2, 2026, 22:41)

**Root cause of the whole saga — a field-name mixup in the TickTick developer console.** The console's app edit form has TWO separate URL fields: **"OAuth redirect URL"** (used by the OAuth flow) and **"App Service URL"** (NOT used for OAuth). Previous sessions filled only App Service URL → TickTick's OAuth server saw zero registered redirect URIs → `error="invalid_request", "At least one redirect_uri must be registered with the client."` (and the pathless-port `unknown_exception`s were red herrings from the same misconfiguration).

Fix (user action): on app **"cat-reminder-2"** (Client ID `Vds69F85a3DdvC4fGI` — matches `.env`), fill **"OAuth redirect URL"** with `http://127.0.0.1:14565/callback` and Save. App-side code needed no changes.

Live verification, all green:
- Standalone harness (`scripts/ticktick-live-test.mjs` — mirrors `oauth.ts` + `ticktick-sync.ts` exactly, no Electron needed): authorize → code → token (`expires_in` 15,551,999s ≈ 180 days) → `GET /project` (4 projects) → `GET /project/{id}/data` (tasks).
- Real app via popup "Connect TickTick": callback received → token exchange succeeded → projects fetched (4) → `ticktick.tokens` created → **24 reminders imported** (anytime + all-day mapping correct, sentinel start for no-due tasks) → 4 projects persisted in `sync_metadata`.
- Diagnostics still healthy: authorize 302 → `/signin`; fake-code exchange → `invalid_grant` 400.

Small fix made: `runTickTickSync()` now persists `lastSuccessAt` to `sync_metadata` (provider `ticktick`) after each successful sync so "Synced Xm ago" survives restarts (previously only the in-memory value was updated).

Known gotchas recorded:
- **The token exchange returns NO `refresh_token`** (only `access_token` + `expires_in` ≈ 180 days). The app's proactive-refresh + 401-retry paths require `refreshToken` and therefore never fire; when the token finally expires the user reconnects. Accepted for v1. (`refresh_token` grant probes with fake tokens also return `invalid_client` on every auth variant — TickTick may not support refresh grants at all.)
- The Google account on this machine still throws "Request had insufficient authentication scopes" (old consent predates the tasks scope) — reconnect Google to fix; unrelated to TickTick.

### 25. Full codebase audit + cleanup (August 2, 2026) — validated: typecheck ✅, 42/42 tests ✅, build ✅

Health/security audit of the whole app; fixed everything found and removed dead code.

**Security hardening**
- Production renderer builds now get a strict CSP via `electron.vite.config.ts` (transformIndexHtml, `apply: 'build'` — dev untouched so react-refresh works): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:; object-src 'none'; base-uri 'none'; form-action 'none'`. `img-src file:` is required for packaged overlay sprites loaded from `process.resourcesPath`. Verified in the built HTML; browser console shows zero CSP violations.
- Popup + overlay windows now `setWindowOpenHandler(deny)` and `preventDefault()` on `will-navigate` (no in-app windows ever open or navigate; OAuth still uses the system browser).
- `google/oauth.ts` now closes the callback server + clears the timeout + rejects on state-mismatch/no-code paths (previously the promise hung and the port lingered until the 5-min timeout; ticktick already had this fix).
- Already good (re-verified): sandbox+contextIsolation+no-nodeIntegration preloads, all IPC inputs validated, no XSS sinks, safeStorage token files with 0600 perms.

**Bug fixes**
- `PopupApp` Google disconnect no longer force-disables `syncEnabled` — it clobbered main's invariant (auto-sync must stay on while TickTick is still connected).
- `preferences-repository.get()` now guards `JSON.parse` per key (a corrupt value falls back to the default instead of crashing boot).

**Cleanup (dead code / files / deps)**
- Deleted: `src/main/sync/google/refresh.ts` (whole file unused), `src/preload/overlay.d.ts` (duplicate of the `shared/ipc.ts` global), `reference_reminder_app.png`, root `assets/` (Idle/Running/textbox duplicates of `public/assets`), `temp-ticktick-ss.png`.
- Removed unused exports: `createUnconfiguredCalendarClient`, `makeCalendarReminderId`, `traversalProgress`, `traversalPositionPercent` (+ their tests), `DisplayBounds`, `hidePopupWindow`, `pendingCount`, `activeId`, and the vestigial `app:open-settings` IPC (handler + preload + type).
- Removed unused dependencies: `zustand` (never imported) and `playwright` (skills use their own tooling); `pnpm install` pruned the lockfile without touching better-sqlite3's Electron ABI build.
- Fixed formatting in `reminder-repository.ts` (toValues/insert indentation).

**Performance**
- The three sync services (google calendar / google tasks / ticktick) hoisted their per-item `repository.list()` lookup into a single `Map` (O(n²) → O(n)); tasks-sync and ticktick-sync Maps are scoped to their source (review nit).
- `fullscreen-policy` probe cache 1s → 3s + comment explaining why the PowerShell Win32 probe is kept (Electron has no API to inspect other apps' windows).

**Docs** — README rewritten to match the working app (TickTick + daily roll-up + correct console field name + current commands).

### 23. TickTick OAuth debugging saga — RESOLVED (see §24)

Goal: connect a TickTick developer app through the popup (authorize → token → projects → tasks). All app-side code is complete, reviewed, typechecked, and tested; the blocker is TickTick's OAuth authorize step, not our code.

**Error progression (in order):**
1. `redirect_uri_mismatch` — app #1 ("cat-reminder-app", Client ID `G31d7Want36HMCBxOw`) had no App Service URL saved. User set it → retried.
2. App-side `EADDRINUSE` on port 14565 — a failed first attempt left the loopback listener alive. FIXED in `oauth.ts` (close on every path + close leftover before bind).
3. `{"errorCode":"unknown_exception", ...}` JSON — persisted across many variants (single scope, both scopes, no scope, pathless redirect, `/callback` redirect, fresh tabs, and the internal `api.ticktick.com/oauth/custom_authorize` endpoint the user was redirected to).
4. With fresh app #2 (Client ID `Vds69F85a3DdvC4fGI`, secret `bDIKgfW7y6qfXLchfrP7PBeH94nZ8Q3y` — CURRENT `.env` values): `error="invalid_request", error_description="At least one redirect_uri must be registered with the client."` — a standard OAuth error meaning TickTick has NO registered redirect URI for this client. The user says the App Service URL field already shows `http://127.0.0.1:14565/callback` on the app they're editing.

**What's been verified from the app side (all healthy):**
- Authorize URL is well-formed: browser probe of `https://ticktick.com/oauth/authorize?client_id=<ID>&redirect_uri=http%3A%2F%2F127.0.0.1%3A14565%2Fcallback&response_type=code&scope=tasks%3Aread%20tasks%3Awrite&state=...` redirects to the normal TickTick sign-in page (client recognized, no immediate error) for BOTH app #1 and app #2.
- Token endpoint is healthy: POST `https://ticktick.com/oauth/token` with Basic auth (current ID:secret) + `grant_type=authorization_code&code=fake_code_123&scope=tasks:read tasks:write&redirect_uri=http://127.0.0.1:14565/callback` → `invalid_grant` 400 (correct) — proves credentials + request format are accepted.
- Typecheck clean, 43/43 tests pass, review approved (kind-drift fix). App restarted 22:17:39 with app #2 credentials.

**Leads for the next agent (priority order):**
1. **Two app records exist in developer.ticktick.com/manage.** The `.env` Client ID belongs to app #2; the user may be editing app #1's App Service URL. Have the user open app #2 specifically, confirm the field, and SAVE. Most likely cause of the `invalid_request` error.
2. If editing doesn't persist: delete app #2 and recreate it WITH the App Service URL filled in at creation time.
3. TickTick's flow internally routes through `https://api.ticktick.com/oauth/custom_authorize` — if a properly-configured app still errors, the validated redirect field may be named differently than "App Service URL".
4. GitHub issue `liadgez/ticktick-mcp-server#1` documents the SAME `unknown_exception` envelope (`errorId …@erver-14/15`) as ongoing TickTick server-side Open API breakage (since 2025). If a clean, correctly-configured app still throws it, TickTick's OAuth is down upstream → fallback: TickTick's Google Calendar bridge (NOTE: only syncs tasks *with time attributes*, so date-less tasks won't reach the app — the Open API remains the primary path for the daily roll-up).
5. Reference implementations that WORK with real accounts (byte-level comparison): `lazeroffmichael/ticktick-py` (`oauth2.py`) and `niujingjingbfsu/ticktick-openapi-cli` (`ticktick_api_cli/auth.py` + their troubleshooting docs — both use `/callback`, both scopes, Basic auth).

**Security note:** `.env` is gitignored — credentials never enter the repo. Do NOT paste the secret into docs.

## Work completed this session (August 2, 2026) — daily task roll-up

### 21. Daily task roll-up: time-less reminders shown as one cat overlay at a configurable daily time

Approved plan implemented (unified Reminder kind model; NO task-list UI in the app — the checklist lives in TickTick/elsewhere; the cat just presents the day's tasks).

- **Data model** (`src/shared/types/reminder.ts`): `Reminder.kind` = `'timed' | 'all-day' | 'anytime'`; `ANYTIME_SENTINEL_START` placeholder keeps `start_at` NOT NULL. Migration v4 (`src/main/storage/database.ts`) adds `kind TEXT NOT NULL DEFAULT 'timed'` + `daily_task_reminder_state` table. `'ticktick'` not yet added to `ReminderSource` (reserved for the future integration).
- **Scheduler** (`src/main/scheduler/task-rollup.ts` + `src/main/storage/task-rollup-repository.ts`): pure `rollupDecision(now, time, state, hasTasks)` (pending/shown/snoozed/dismissed), `dayKey()`, `buildRollupOverlay()`; `TaskRollupScheduler` checks every 30s + once at boot (late launches still show the day's list). `dueCandidates` is now timed-only; `statusAt` rejects non-timed kinds; `ReminderScheduler.isIdle()` added. `todayTasks()` = uncompleted anytime + all-day items due on the local calendar day.
- **Sync** (`src/main/sync/google/tasks-sync.ts`): due-less Google Tasks now import as `anytime` (previously silently dropped); `00:00:00 UTC` due → `all-day` at local midnight; others `timed`. `calendar-sync.ts` stamps `kind: 'timed'`.
- **Overlay** (`src/renderer/overlay/OverlayApp.tsx`, `src/shared/animation.ts`, `src/renderer/styles.css`): `TEXTBOX_LARGE_SPRITE` (62×46 source panel at scale 4) renders the task list bubble (title + up to 6 rows + "+N more" + Snooze/Dismiss). Rollup walks off WITHOUT auto-dismissing (stays 'shown' for the day); timed reminders still auto-dismiss at walk end. `TextboxSpriteManifest` shared type for both textbox sprites.
- **Main wiring** (`src/main/index.ts`): rollup timer, rollup action routing (snooze→`markSnoozed`, dismiss→`markDismissed`), `rollupShowing` guard defers timed reminders while the rollup owns the overlay (30s retry) so the two never fight.
- **Popup** (`src/renderer/popup/PopupApp.tsx`): "Daily task reminder" enable toggle + time input (default 09:00) under settings.
- **Validation** (`src/shared/validation/reminder.ts`, `runtime.ts`): kind-aware create rules (`anytime` may omit startAt; repeatRule rejected for non-timed), new preference keys guarded (`dailyTaskReminderTime` regex `HH:mm`).
- **Tests**: `tests/shared/task-rollup.test.ts` (dayKey, decision matrix, malformed time) + `tests/shared/tasks-sync.test.ts` (kind mapping: due-less→anytime, midnight→all-day, timed) + validation/runtime updates + fixtures. 36/36 pass, `tsc --noEmit` clean, review approved.

Known intentional gap: all-day *recurrence* (repeatRule on non-timed kinds) is rejected by validation — recurring tasks will come from the future TickTick integration; anytime tasks already re-appear every day until completed.

## Work completed this session (August 2, 2026) — GitHub setup

### 20. Fixed broken idle mirror (sprite displaced one full width during the pause)

- The idle flip used `scaleX(-1) translateX(-50%)`, which mirrors around the wrong pivot — per the CSS transform spec the list is sandwiched between `translate(-origin)`/`translate(origin)`, so the translateX percentage ends up applied in the flipped coordinate space and the sprite shifts exactly one sprite-width (192px) right of the bubble.
- `src/renderer/overlay/OverlayApp.tsx` — order corrected to `translateX(-50%) scaleX(-1)` (center first, then mirror around the center), with a comment documenting why the order matters. Direction re-verified via pixel color analysis (idle's white-tipped tail is on the right → faces left; running's is on the left with the head right → faces right).

Validation: `tsc --noEmit` passes, `vitest run` 24/24 pass, code review confirmed the matrix math, dev app restarted with the fix live.

### 19. Cat feet now touch the taskbar; idle faces the direction of travel

- Measured the actual sprite pixels with a Node PNG decoder: `running.png` has 5–7px of transparent padding below the feet (feet end at row 58 of 63 in contact frames), `idle.png` is a sitting pose flush at row 63 and drawn facing left (tail on the right).
- `src/shared/animation.ts` — `SpriteAnimationManifest` gains `feetPaddingPx` (idle: 0, running: 5).
- `src/renderer/overlay/OverlayApp.tsx` — sprite inline `bottom: -(feetPaddingPx * scale)` (running −15px) so the cat's feet, not the frame's padding, rest on the taskbar walk line; inline `transform: 'scaleX(-1) translateX(-50%)'` during the idle pause mirrors the left-facing idle sprite toward travel direction. No visual jump at phase boundaries (both poses touch the same line).
- `tests/shared/animation.test.ts` — new test documents the measured padding values; `public/assets/cats/default/manifest.json` updated with `feetPaddingPx` + `facing` metadata.

Validation: `tsc --noEmit` passes, `vitest run` 24/24 pass, code review approved, dev app restarted with changes live.

### 18. Overlay show is now walk → 5s idle pause → exit; traversal slowed 10%

- `src/shared/animation.ts` — `CAT_TRAVEL_DURATION_MS` 12_375 → 13_613 (+10%). Added the phase model: `CAT_PAUSE_DURATION_MS = 5_000`, `CAT_PAUSE_POSITION_PERCENT = 90`, plus `walkDurationMs()`, `exitDurationMs()`, `totalShowDurationMs()`, `phaseAt()`, `traversalPositionAt()` (walk -12%→90%, hold 90% during the idle pause, then 90%→112% off screen). Walk+exit still sum to the full traversal time.
- `src/renderer/overlay/OverlayApp.tsx` — renderer now drives the show from `phaseAt()`/`traversalPositionAt()`; swaps to `DEFAULT_CAT_ANIMATIONS.idle` (idle.png) during the pause; rAF loop and walk-end auto-dismiss keyed off `totalShowDurationMs()`.
- `tests/shared/animation.test.ts` — 3 new tests for the 10% slowdown and the walk/pause/exit phase boundaries and positions.
- Verified idle was already set up: `public/assets/cats/default/idle.png` (384×64, 6 frames), `manifest.json`, and `DEFAULT_CAT_ANIMATIONS.idle` all agree — no new art needed.

Validation: `tsc --noEmit` passes, `vitest run` 23/23 pass, code review approved (minor nits only), dev app restarted with changes live.

### 17. Overlay fixes: taskbar-aware walking + no lingering textbox

Updated:

- `src/main/windows/overlay-window.ts` — overlay window now spans the full display `bounds` instead of the work area; added `catWalkBaseline()` = `bounds.bottom - workArea.bottom` (the taskbar height for a bottom-docked taskbar, `0` otherwise). Baseline is sent to the renderer as `walkBaselineFromBottom` so the cat's feet rest exactly on the taskbar's top edge on any machine.
- `src/shared/types/overlay.ts` — added optional `walkBaselineFromBottom` to `OverlayReminder`.
- `src/renderer/overlay/OverlayApp.tsx` — removed the 60s auto-dismiss linger and the post-walk snap to `left: 86%`. The bubble now rides with the cat for the whole traversal and both exit off-screen at 112%; at walk end the reminder auto-dismisses (`dismiss` action) unless the user already clicked Dismiss/Done mid-walk (`interactedRef` guard).

Validation: `tsc --noEmit` passes, `vitest run` 20/20 pass, code review approved. Dev app restarted with changes live.

### 16. Session wrap-up — final validation of the memory system

- Ran the full health check: all 10 memory files present, all scripts pass syntax checks (`post-commit`, `machine-sync.sh`, `setup-memory-hooks.sh`, `memory-watcher.mjs`), `machine-sync.sh` reports up-to-date, `setup-memory-hooks.sh` verifies everything.
- **Re-tested `MEMORY_SETUP.md` end-to-end in a brand-new empty repo** (the portability test): an AI-agent simulation extracted all embedded file blocks (now 11 files including `machine-sync.sh`), all syntax checks passed, setup ran clean, the machine-sync marker was created, a test commit fired the post-commit hook, and `.gitattributes`/`.gitignore` extracted correctly. **`MEMORY_SETUP.md` is verified port-ready — it replicates the full memory system standalone in a fresh project.**
- Everything committed and pushed to `main`; working tree clean, 0 ahead / 0 behind.

### 15. Added machine-swap auto-sync (zero-input cross-machine work)

- Added `scripts/machine-sync.sh` — a session-start check that: (1) fixes old `master` clones to `main`, (2) detects a machine change via `docs/.last-machine` (hostname marker) and re-enables memory hooks on the new machine, (3) fetches origin and pulls the latest memory files — but only when the working tree is clean, so it never clobbers uncommitted work.
- Added the **machine sync check** to the session protocol in `knowledge.md` + `AGENTS.md`, so it runs automatically at the start of every session.
- Added `docs/.last-machine` to `.gitignore` (machine-local state).
- Added the script to `MEMORY_SETUP.md` (new §6.8, 11-file inventory, checklist) and to the setup script's verified-file list.
- Result: switching machines requires **zero manual steps** — the agent detects the swap, syncs memory, and you can start working immediately.

### 14. Consolidated branches onto `main`

- GitHub had auto-created a stub `main` branch (single README commit `c0adf00`, set as the default branch) alongside the real `master` branch.
- Renamed local `master` → `main`, force-pushed it over the stub (`c0adf00...4457bf4`), deleted remote `master`, and set `main` to track `origin/main`.
- Result: a single `main` branch holds the full project; clones now get the real code.

## Work completed this session (August 2, 2026)

### 9. Initialized Git and pushed to GitHub

- Initialized a Git repository in the project root.
- Created initial commit `9d822ff` with all 172 source files (23,080 lines).
- Added remote `origin` → `https://github.com/connorpaps/cat-reminder-app.git`.
- Pushed `master` branch and set upstream tracking to `origin/master`. (Renamed to `main` and remote `master` deleted on 2026-08-02 — GitHub's auto-created stub `main` was replaced with the real project.)
- `.gitignore` covers: `node_modules/`, `out/`, `release/`, `.vite/`, `coverage/`, `*.db`, `*.db-shm`, `*.db-wal`, `.env`, `.env.*` (except `.env.example`), `.playwright-cli/`.

**Cross-machine workflow:**
```bash
# On Mac: clone and install
git clone https://github.com/connorpaps/cat-reminder-app.git
cd cat-reminder-app
pnpm install

# Work, then push when done
git add -A
git commit -m "Describe changes"
git push

# Back on PC: pull latest
git pull
```

> **If a machine has an old clone on `master`** (created before the branch rename): the repo now uses a single `main` branch. On that machine run:
> ```bash
> git branch -m master main && git fetch origin && git branch --set-upstream-to=origin/main main
> ```
> Or just `git clone` fresh — `main` is the only branch and is what clones get by default.

### 10. Set up project memory system (Option A)

- Created `AGENTS.md` — cross-tool agent instructions (session protocol + non-negotiable rules). Read automatically by Cursor and other AGENTS.md-compatible tools.
- Added a **Session protocol** section to `knowledge.md` — Freebuff auto-reads this file every session, so the ritual (read `handoff.md` + this file at start, update both at end) now runs without prompting.
- Added `.cursor/rules/main-process.mdc` and `.cursor/rules/renderer.mdc` — path-scoped rules Cursor auto-attaches when editing `src/main/**` / `src/renderer/**`.
- Updated `memory_ideas.md` status; global `~/.AGENTS.md` intentionally skipped (project-local only for now).

### 11. Added automatic memory (zero-input)

New files:

- `.githooks/post-commit` — git hook that auto-appends date, commit message, and changed files to `docs/activity-log.md` after **every commit** (works for commits made by Freebuff, Cursor, or manually).
- `scripts/setup-memory-hooks.sh` — one-time `git config core.hooksPath .githooks` to enable the hook (must be run on each machine, e.g. after `git pull` on the Mac).
- `scripts/memory-watcher.mjs` — optional dependency-free Node watcher that logs every file save to `docs/activity-watch.log` (gitignored). Start with `node scripts/memory-watcher.mjs`.

Updated:

- `knowledge.md` + `AGENTS.md` — protocol now says to read the tail of `docs/activity-log.md` at session start and to log substantial changes to `handoff.md` immediately, not just at session end.
- `.gitignore` — added `docs/activity-watch.log`.

This gives a mechanical, zero-input safety net (every commit is recorded automatically) underneath the agent-written handoff memory.

### 12. Added MEMORY_SETUP.md + auto-bootstrap on new machines

- Created `MEMORY_SETUP.md` — a fully self-contained replication kit. An AI agent given only this file can set up the entire memory system (all files, rules, hooks, processes) in a brand-new project with zero prior setup. Includes templates for `AGENTS.md`, `knowledge.md`, `handoff.md`, the git hook, setup script, watcher, `.cursor/rules`, `.gitignore`, and a verification checklist.
- Made `scripts/setup-memory-hooks.sh` **idempotent and self-verifying** — it now checks that all memory files exist and exits with a warning listing any missing ones (so agents can auto-replicate from `MEMORY_SETUP.md`).
- Added a **bootstrap check** to the session protocol in both `knowledge.md` and `AGENTS.md`: at session start, if `git config core.hooksPath` is not `.githooks`, run `bash scripts/setup-memory-hooks.sh` automatically. This makes the memory system **self-install on a new machine** — after `git pull` on the Mac (or any fresh clone), the first session auto-detects and enables the hook with zero user input.

**To use in a brand-new project:** copy `MEMORY_SETUP.md` in and tell the AI "set up the memory system from MEMORY_SETUP.md".

### 13. Finalized MEMORY_SETUP.md and pushed to GitHub

- Added a **"Full inventory"** section to `MEMORY_SETUP.md` (§1): every file created, every process enabled, every behavior installed, and the automatic verification — for both the user's reference and the executing AI's understanding.
- Made all embedded file blocks use consistent 4-backtick fences so any reader (LLM or script) extracts them identically.
- Verified end-to-end: simulated a brand-new empty git repo with ONLY `MEMORY_SETUP.md` — the AI flow created all 10 files, enabled hooks, made a test commit, and the hook fired correctly.
- Committed the full memory system (AGENTS.md, knowledge.md, MEMORY_SETUP.md, .githooks/, scripts/, .cursor/rules/, .gitattributes, docs/) and pushed to GitHub.

## Work completed this session (August 2, 2026)

### 1. Fixed invisible tray icon

Updated:

- `src/main/tray/tray.ts`

Root cause:

- The tray icon was generated as an inline SVG data URL which did not render on Windows. The icon appeared as a blank space in the taskbar.

Fix:

- Replaced the inline SVG with a proper PNG: loads `public/assets/cats/default/idle.png` (384×64 sprite sheet), crops the first 64×64 frame, and resizes to 32×32 for the tray. Uses `app.getAppPath()` in dev mode and `process.resourcesPath` in packaged mode.

### 2. Added Google Tasks / Reminders integration

New files:

- `src/main/sync/google/tasks-sync.ts` — Google Tasks API client and sync service, mirrors the calendar-sync pattern. Converts Google Tasks (with due dates) to reminders with `source: 'google-tasks'`. Skips tasks without due dates.

Updated:

- `src/main/sync/google/oauth.ts` — added `https://www.googleapis.com/auth/tasks.readonly` scope alongside the existing calendar scope (`GOOGLE_COMBINED_SCOPE`). One OAuth consent screen covers both.
- `src/main/index.ts` — wired Google Tasks into connect, refresh, auto-sync, and disconnect flows. `sync:connect` now fetches both calendars and task lists, then runs an immediate sync. `sync:refresh` syncs both calendars and tasks. `runConfiguredSync` syncs both on the auto-sync timer.
- `src/shared/types/reminder.ts` — added `'google-tasks'` to `ReminderSource` union.
- `src/renderer/popup/PopupApp.tsx` — changed "📅 Google Calendar" to "🔗 Google Account" to reflect unified calendar+tasks connection.

### 3. Enhanced auto-sync

Updated:

- `src/shared/types/preferences.ts` — default `syncIntervalMinutes` reduced from 30 to 5.
- `src/main/index.ts` — runs an immediate sync after Google account connection (both calendars and tasks). Auto-sync timer checks every 60s and syncs when the configured interval has elapsed. On first boot, migrates old 30-min default to 5 min.
- `src/renderer/popup/PopupApp.tsx` — added "Synced Xm ago" live countdown (refreshes every 15s). Added "Sync calendar every:" setting dropdown (2/5/10/30 min) replacing the old auto-sync label.

### 4. Added single-instance lock to prevent duplicate tray icons

Updated:

- `src/main/index.ts`

Root cause:

- Running `pnpm dev` multiple times (or the user double-clicking the executable) spawned duplicate Electron instances, each with its own tray icon. This left multiple "Cat Reminder" icons in the taskbar.

Fix:

- Added `app.requestSingleInstanceLock()` before `app.whenReady()`. If the lock fails, the new instance quits immediately. If a second instance is launched while one is running, the existing popup is shown via `second-instance` event.

### 5. Persisted Google Tasks list selections across restarts

Updated:

- `src/main/storage/sync-repository.ts` — extended the cursor JSON payload to store `selectedTaskListIds` alongside `selectedCalendarIds`. The `get()` method now returns both arrays with proper validation.
- `src/main/index.ts` — restores `selectedTaskListIds` from sync metadata on boot; includes them in all `syncRepository.save()` calls.

### 6. Removed Snooze from UI (code preserved)

Updated:

- `src/renderer/overlay/OverlayApp.tsx` — removed Snooze button from textbox actions. Overlay now shows only Dismiss and Done.
- `src/renderer/popup/PopupApp.tsx` — removed Snooze dropdown from settings. All backend logic (`snooze()` function, IPC handler, `snoozeMinutes` preference, `'snoozed'` status) remains intact for easy re-enabling.

### 7. Removed Motion from UI (code preserved), cat slowed 10% more

Updated:

- `src/renderer/popup/PopupApp.tsx` — removed Motion dropdown from settings. App hardcoded to "Balanced" (medium intensity). All backend logic (`animationIntensity` preference, overlay payload, intensity rendering) preserved.
- `src/shared/animation.ts` — `CAT_TRAVEL_DURATION_MS` increased from 11,250 to 12,375 (+10%, now ~12.4s traversal).

### 8. Updated UI labels for clarity

Updated:

- `src/renderer/popup/PopupApp.tsx` — "Lead" → "Send reminder:", option values from "X min" to "X min before", "Auto-sync" → "Sync calendar every:".

## Work completed this session

### 1. Fixed dev-mode launch-at-login spawning raw Electron welcome screen

Updated:

- `src/main/index.ts`

Root cause:

- `app.setLoginItemSettings({ openAtLogin: true })` was called unconditionally regardless of whether the app was packaged. In dev mode this registered the raw `electron.exe` from `node_modules` as a Windows startup item, showing the default Electron welcome screen on boot.

Fix:

- Guarded `openAtLogin` behind `app.isPackaged` in both call sites so the startup entry is only registered for real packaged installs.

### 2. Converted app from main-window to pure tray + popup architecture

New files:

- `src/main/windows/popup-window.ts` — 274×416 frameless `BrowserWindow` positioned near the taskbar, auto-closes on blur, toggles on tray click
- `src/renderer/popup/PopupApp.tsx` — compact popup UI styled with pixel-art panel: Preview Cat button, Google Calendar connect/sync/settings section, snooze/lead/motion settings dropdowns, Quit button

Updated:

- `src/main/tray/tray.ts` — click opens popup instead of settings window; right-click → Quit only
- `src/renderer/main.tsx` — routes to PopupApp by default, OverlayApp when `?overlay=1`
- `src/main/index.ts` — replaced settings window wiring with popup; auto-opens popup on first launch when no calendar connected; removed onboarding boot logic
- `src/renderer/styles.css` — pixel-art popup panel styles using box-shadow borders matching textbox.png brown/tan aesthetic

Deleted:

- `src/main/windows/settings-window.ts` — no more 1040×760 settings window
- `src/renderer/app/App.tsx` — no more full settings/reminder list UI

### 3. Slowed cat traversal by 25%

Updated:

- `src/shared/animation.ts`

Change:

- `CAT_TRAVEL_DURATION_MS` increased from 9,000 to 11,250 ms so the cat walks 25% slower across the screen.

### 4. Fixed fullscreen policy probe suppressing all scheduled reminders

Updated:

- `src/main/windows/fullscreen-policy.ts`

Root cause:

- `shouldShowOverlay` was fail-closed — when the PowerShell fullscreen probe failed (`detectFullscreen` returned `null`), `fullscreen === false` evaluated to `false`, silently suppressing all scheduled reminders. Preview Cat bypassed this check with policy `'show'`, which is why Preview Cat worked but calendar triggers did not.

Fix:

- Changed `return fullscreen === false` to `return fullscreen !== true`. When the probe cannot determine fullscreen state (`null`), the overlay now shows instead of being suppressed.

### 5. Added overlay textbox auto-dismiss timeout

Updated:

- `src/renderer/overlay/OverlayApp.tsx`

Root cause:

- After the cat animation completed, the textbox (Snooze/Dismiss/Done) remained visible forever with no auto-dismiss. For non-preview reminders, `overlay:animation-complete` did not call `hideOverlay()`, so the textbox sat on screen indefinitely unless the user manually clicked an action button.

Fix:

- Added `AUTO_DISMISS_MS = 60_000` constant and a `dismissCurrent` callback with `useCallback`. After animation completes, a 60-second timeout auto-dismisses the textbox. If the user manually clicks an action button, the timeout is cleared via a `useRef` to prevent redundant firing.

### 6. Installed community skill

- Installed `sickn33/antigravity-awesome-skills@google-calendar-automation` (570 installs) for Google Calendar integration patterns.

## Current repository state

Important files and responsibilities:

- `src/main/index.ts` — Electron boot, IPC registration, scheduler wiring, sync, tray, popup auto-open, app lifecycle
- `src/main/windows/popup-window.ts` — **NEW** frameless taskbar popup window, blur-to-close, toggle on tray click
- `src/main/windows/overlay-window.ts` — transparent overlay window lifecycle and overlay IPC-facing operations
- `src/main/windows/fullscreen-policy.ts` — fullscreen detection probe (now fail-open)
- `src/main/tray/tray.ts` — system tray icon, click opens popup
- `src/main/scheduler/` — reminder trigger and queue behavior
- `src/main/storage/` — SQLite database and repositories
- `src/main/sync/google/` — read-only Google Calendar + Tasks integration and OAuth
- `src/main/sync/google/tasks-sync.ts` — **NEW** Google Tasks API client and sync service
- `src/renderer/popup/PopupApp.tsx` — compact popup UI: Preview Cat, Google Account connect/sync (calendar + tasks), settings (send reminder lead time, sync interval)
- `src/renderer/overlay/OverlayApp.tsx` — animated desktop cat scene and reminder bubble (60s auto-dismiss, Dismiss + Done buttons)
- `src/renderer/styles.css` — popup + overlay pixel-art styling
- `src/preload/` — context-isolated renderer and overlay APIs
- `src/shared/` — shared types, IPC contracts, validation, recurrence, state, and animation metadata
- `tests/` — unit tests for recurrence, queueing, validation, animation, state transitions, and calendar sync
- `public/assets/` — cat sprites and textbox art
- `knowledge.md` — project conventions, commands, architecture, constraints, and known setup gotchas (auto-read by Freebuff each session)
- `AGENTS.md` — cross-tool agent instructions + session protocol (auto-read by Cursor and other tools)
- `.cursor/rules/` — path-scoped Cursor rules for `src/main/**` and `src/renderer/**`
- `handoff.md` — this file
- `package.json` — scripts, dependencies, Electron Builder configuration, and Node engine range
- `.env` — created from `.env.example`; fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable calendar sync
- `.gitignore` — excludes node_modules, build output, databases, env files, and generated artifacts

## Validation completed this session

All of the following passed after every change:

- `npx tsc --noEmit` — typecheck passes
- `npx vitest run` — 9 test files, 36 tests, all passed (incl. new `task-rollup.test.ts` + `tasks-sync.test.ts`)
- Code reviews — all changes reviewed and approved

## How to run

Recommended environment:

- Windows
- Node.js 22 LTS
- Corepack-enabled pnpm 11
- Visual Studio C++ build tools for `better-sqlite3`

Commands:

```bash
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm dev
```

## Current known caveats

1. **Google API credentials must be configured manually.** Copy `.env.example` to `.env` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from a Google Cloud Desktop OAuth client. The app requests both `calendar.readonly` and `tasks.readonly` scopes.
2. **Google OAuth requires adding your email as a test user.** In Google Cloud Console → APIs & Services → OAuth consent screen → Audience → add your Gmail as a test user.
3. **The fullscreen probe uses PowerShell.** It's now fail-open (shows overlay on probe failure), but is not as reliable as a native Electron display API approach.
4. **The app is a pure tray app.** No main window opens on startup — click the cat tray icon to open the popup. On first launch (no Google account), the popup auto-opens.
5. **The cat triggers at lead time before the event, not at the exact event time.** Default lead time is 5 minutes (configurable in popup as "Send reminder: X min before").
6. **Native SQLite setup is environment-sensitive.** `better-sqlite3` must match Electron's ABI.
7. **Snooze and Motion settings are hidden from UI but kept in code.** Snooze defaults to 10 min, animation intensity defaults to "Balanced" (medium). Restore by adding back the UI elements in PopupApp.tsx and OverlayApp.tsx.
8. **Task list syncing has no UI for selection.** On first connect, all Google Task Lists are auto-selected. The popup only shows calendar checkboxes. Task list IDs are persisted in sync metadata.
9. **The current app is still an MVP.** Multiple cats, themes, Steam support, cloud accounts, remote storage, two-way calendar sync, and other v2 ideas remain intentionally out of scope.

## Prioritized next steps

### 1. Replace PowerShell fullscreen probe with native Electron API

The current `detectFullscreen` spawns a PowerShell process with a 750ms timeout. This is fragile. Replace with Electron's native `screen` and `BrowserWindow` APIs or a child-process-free approach.

### 2. Verify scheduled reminders end-to-end

- Create a Google Calendar event ~7 minutes in the future
- Sync and wait for the cat at the 5-minute mark
- Confirm Snooze, Dismiss, and Done update state correctly
- Confirm auto-dismiss after 60 seconds of inactivity
- Test recurring reminders
- Test behavior after app restart and Windows sleep/resume

### 3. Audit popup interaction

- Confirm popup opens on tray click and closes on blur
- Confirm popup toggles correctly on rapid clicks
- Confirm Google Calendar connect flow works (browser OAuth → token storage)
- Confirm calendar selection checkboxes work
- Confirm Sync now imports events
- Confirm settings dropdowns persist across restarts

### 4. Expand test coverage

Prioritize tests for:

- Scheduler lead time and queue ordering
- Fullscreen policy edge cases (probe success, probe failure, null state)
- Overlay auto-dismiss behavior
- Restart recovery for missed reminders
- Sleep/wake reconciliation
- Recurrence end conditions

### 5. Prepare release validation

- Run `corepack pnpm rebuild` for target Electron environment
- Build a Windows package with `corepack pnpm dist:win`
- Test installation, desktop shortcut, Start Menu shortcut, tray startup, auto-launch, clean uninstall

## Session handoff checklist

Before making new changes next session:

- Read `knowledge.md` and this file
- **Pull latest is automatic now** — `scripts/machine-sync.sh` runs at session start and fetches/pulls `main` when the working tree is clean (no manual `git pull` needed)
- Check `git status --short` for uncommitted changes
- Confirm Node/pnpm versions with `node --version` and `corepack pnpm --version`
- Run `corepack pnpm typecheck` and `corepack pnpm test` before changing behavior
- Restart the dev app after source/build changes
- Prefer source changes under `src/`; do not hand-edit generated files under `out/`
- After significant code changes, run code review plus typecheck, tests, and build
- **Push when done:** `git add -A && git commit -m "..." && git push`
