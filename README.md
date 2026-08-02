# Cat Reminder

A Windows-first, local-first desktop reminder companion. When a reminder is due, a small pixel-art cat crosses the desktop with a readable message bubble.

## Current status

The repository contains the source foundation for the first runnable build. TypeScript, tests, Electron startup, native SQLite loading, and Windows packaging still require validation in the intended Node 22 + pnpm + Windows C++ environment:

- Electron + Vite + React + TypeScript shell.
- Secure context-isolated preload IPC.
- SQLite schema/migration and repository boundaries using `better-sqlite3`.
- Tested reminder validation, recurrence, state transitions, queue behavior, animation metadata, and calendar mapping.
- Tray/settings window boundary.
- Transparent overlay boundary using the supplied six-frame `Idle.png` and `Running.png` sheets.
- Read-only Google Calendar OAuth, encrypted local token storage, calendar selection, manual refresh, and scheduled sync boundaries. Calendar credentials still need to be supplied through the documented local environment during development/release configuration.

## Prerequisites

- Windows is the primary target.
- Node.js 22 LTS is the supported runtime.
- pnpm is the supported package manager (`corepack enable` then `pnpm install`).
- Native build tooling is required for `better-sqlite3` if a matching prebuilt binary is unavailable: Visual Studio Build Tools with Desktop development with C++.

The current development environment has Node 24 and no pnpm, so dependency installation/build verification must be repeated in the intended Node 22 + pnpm environment.

## Commands

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm dist:win
```

`pnpm dist:mac` is reserved for the later macOS packaging milestone.

## Architecture

- `src/main/`: Electron lifecycle, tray, windows, scheduler, SQLite, sync, logging.
- `src/preload/`: narrow APIs exposed through `contextBridge`.
- `src/renderer/`: reminder management and settings UI.
- `src/shared/`: types, validation, recurrence, state transitions, animation metadata.
- `tests/`: domain and integration-oriented tests.
- `public/assets/`: packaged cat and textbox assets.

V1 remains local-first. Google Calendar is read-only and imported events retain provider IDs; sync metadata and tokens are stored locally. Cloud accounts, remote storage, Steam-specific features, additional cats, and themes are intentionally deferred.
