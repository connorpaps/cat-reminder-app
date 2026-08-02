# Cat Reminder — Session Handoff

**Last updated:** August 2, 2026  
**Project:** Windows-first, local-first cat-themed desktop reminder app  
**Runtime target:** Node.js 22 LTS + pnpm 11  
**GitHub:** https://github.com/connorpaps/cat-reminder-app (remote: `origin`, branch: `main` — was `master`, renamed 2026-08-02)

## Read this first

The app is an Electron + React + TypeScript desktop reminder application. SQLite is the local source of truth. The main process owns scheduling, persistence, tray/background behavior, sync, and overlay windows. The renderer owns a compact popup UI and the overlay. The overlay uses the supplied pixel-art cat and textbox assets.

**The app is a pure tray app.** There is no main settings window — clicking the cat tray icon opens a small pixel-art popup near the taskbar. The popup auto-closes when clicking elsewhere. On first launch (no Google account connected), the popup auto-opens.

**Single-instance lock is active.** Running `pnpm dev` twice or double-clicking the executable will focus the existing instance instead of spawning a duplicate tray icon.

## Work completed this session (August 2, 2026) — GitHub setup

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
- `npx vitest run` — 7 test files, 20 tests, all passed
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
- **Pull latest from GitHub:** `git pull` (if on a different machine than last session)
- Check `git status --short` for uncommitted changes
- Confirm Node/pnpm versions with `node --version` and `corepack pnpm --version`
- Run `corepack pnpm typecheck` and `corepack pnpm test` before changing behavior
- Restart the dev app after source/build changes
- Prefer source changes under `src/`; do not hand-edit generated files under `out/`
- After significant code changes, run code review plus typecheck, tests, and build
- **Push when done:** `git add -A && git commit -m "..." && git push`
