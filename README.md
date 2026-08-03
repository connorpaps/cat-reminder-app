# Cat Reminder

A Windows-first, local-first desktop reminder companion. When a reminder is due, a small pixel-art cat crosses the desktop with a readable message bubble.

## Features

- **Pure tray app** — no main window; click the cat tray icon for a compact pixel-art popup near the taskbar. Single-instance lock prevents duplicate tray icons.
- **Timed reminders** — the cat walks across the screen at the configured lead time (default 5 min before), pauses with a textbox (Dismiss / Done), then walks off.
- **Daily task roll-up** — at a configurable time (default 09:00) the cat presents ALL of the day's time-less tasks (anytime + all-day) as one list bubble (Snooze / Dismiss).
- **Read-only Google Calendar + Google Tasks** — loopback OAuth, encrypted local token storage, calendar/task-list selection, manual refresh, and scheduled auto-sync.
- **Read-only TickTick** — display-only Open API integration: tasks (with or without due dates) import as cat reminders; changes happen in TickTick, never written back.
- **Local-first** — SQLite is the single source of truth; all timestamps ISO 8601 with timezone-aware recurrence.

## Prerequisites

- Windows is the primary target.
- Node.js 22 LTS is the supported runtime.
- pnpm is the supported package manager (`corepack enable` then `pnpm install`).
- Native build tooling for `better-sqlite3` if a matching prebuilt binary is unavailable: Visual Studio Build Tools with Desktop development with C++.

## Setup

```bash
corepack pnpm install
cp .env.example .env   # fill in credentials (app is fully usable without them)
corepack pnpm dev
```

### Provider credentials

- **Google**: create a Desktop OAuth client in Google Cloud Console; add your email as a test user. Scopes: `calendar.readonly` + `tasks.readonly`.
- **TickTick**: create an app at `developer.ticktick.com/manage`. The redirect URI must be registered in the app's **"OAuth redirect URL"** field (NOT "App Service URL" — a separate field): `http://127.0.0.1:14565/callback`.

## Commands

```bash
corepack pnpm dev          # run the app
corepack pnpm typecheck    # tsc --noEmit
corepack pnpm test         # vitest run
corepack pnpm build        # electron-vite build
corepack pnpm dist:win     # Windows installer (electron-builder)
```

`pnpm dist:mac` is reserved for the later macOS packaging milestone.

### Dev tools

- `node scripts/ticktick-live-test.mjs` — end-to-end TickTick OAuth live test without launching Electron (opens the real browser login).

## Architecture

- `src/main/`: Electron lifecycle, tray, windows, scheduler, SQLite, sync, logging.
- `src/preload/`: narrow context-isolated APIs exposed through `contextBridge` (sandboxed, no node integration).
- `src/renderer/`: popup UI (`PopupApp`) and the desktop cat overlay (`OverlayApp`).
- `src/shared/`: types, validation, recurrence, state transitions, animation metadata, IPC contracts.
- `tests/`: domain and integration-oriented unit tests (vitest).
- `public/assets/`: packaged cat and textbox pixel-art assets.

V1 remains local-first. Cloud accounts, remote storage, Steam-specific features, additional cats, themes, and two-way sync are intentionally deferred.
