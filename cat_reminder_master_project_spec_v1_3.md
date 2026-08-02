# Cat Reminder Desktop App — Master Project Spec

## Document Purpose

This document defines the full project vision for the cat-themed desktop reminder app, with a **v1 MVP spec** followed by an expanded **v2 roadmap/spec**. The goal is to provide one master reference for planning, implementation, and future expansion.

---

# V1 MVP Spec

## Overview

Build a Windows-first desktop reminder app with a cute cat theme. The app should also be architected so macOS support can be added cleanly from the same codebase later.

The core user experience is simple: when a reminder is due soon, a cat walks across the screen with a reminder message displayed above its head. The app should feel charming and useful rather than noisy or intrusive.

The first version should include:
- manual reminders,
- recurring reminders,
- Google Calendar sync,
- tray/menu-bar style background operation,
- a normal settings window,
- one cat character,
- one walking animation.

The architecture must remain flexible so additional cat characters and animation styles can be added later without major refactoring.

---

## V1 Goals

- Help users notice reminders in a playful way.
- Support both manual entry and Google Calendar sync.
- Work reliably on Windows first.
- Preserve a clean path to macOS support.
- Keep the first release focused and shippable.
- Establish a modular architecture for future expansion.

---

## V1 Target Platforms

### Primary
- Windows desktop.

### Secondary foundation
- macOS support built into the architecture, but not necessarily the initial release focus.

---

## V1 Core Experience

The app runs quietly in the background. When a reminder approaches, a cat appears from the edge of the screen and walks across the desktop. A speech bubble or floating label above the cat shows the reminder text.

The notification should be:
- readable,
- lightweight,
- cute,
- easy to dismiss or snooze.

The initial version should only have one cat and one walk animation, but the implementation should allow future asset packs and motion types to be dropped in later.

---

## V1 Recommended Stack

- Electron
- React
- TypeScript
- Vite
- SQLite
- electron-builder
- date-fns or Luxon
- Zustand or Redux Toolkit

### Why this stack
Electron is a good fit for a Windows-first desktop app because it supports cross-platform desktop behavior, tray integration, transparent windows, background operation, and packaging for macOS later. Electron-builder is a practical distribution tool for installers and packaged builds. Google Calendar desktop auth should use a “Desktop app” OAuth client. [web:20][web:30][web:32]

---

## V1 App Modes

### Tray/menu mode
- App runs in the background.
- User can access reminders and settings from a tray/menu icon.
- Good for passive use.

### Full window mode
- Used for settings, reminder management, and sync setup.
- Opens from tray/menu or system launcher.

The app should support both modes so the user can choose how it behaves.

---

## V1 Functional Requirements

### Manual reminders
Users can create reminders manually with:
- title,
- description,
- date/time,
- optional end time,
- priority,
- snooze duration,
- enabled/disabled state.

### Recurring reminders
Support recurring reminders in v1.
At minimum:
- daily,
- weekly,
- monthly,
- custom recurrence if practical.

### Google Calendar sync
Google Calendar sync must be included in the first MVP.
Recommended approach:
- read-only first,
- import upcoming events into local reminders,
- store source metadata,
- keep local reminders and synced events in one unified list.

### Notifications
When a reminder approaches:
- show a cat overlay,
- show a text bubble,
- allow snooze,
- allow dismiss,
- optionally mark complete.

### Background behavior
- launch at startup optionally,
- run in the background,
- keep scheduling active when minimized,
- provide tray/menu access.

### Settings
Users can configure:
- startup behavior,
- tray/menu vs full-window preference,
- reminder lead time,
- snooze duration,
- sound on/off,
- sync on/off,
- sync interval,
- animation intensity.

---

## V1 Reminder Logic

Reminder states:
- upcoming,
- soon,
- due,
- overdue,
- snoozed,
- completed,
- dismissed.

Suggested trigger thresholds:
- 60 minutes out: no interruption.
- 30 minutes out: quiet background state.
- 10 minutes out: pre-alert state.
- 5 minutes out: cat animation appears.
- due now: prominent reminder.
- overdue: repeat with stronger urgency.

Anti-spam rules:
- do not repeatedly fire the same reminder in a loop,
- snooze suppresses the reminder until the snooze period ends,
- completed and dismissed reminders must not reappear unless recurrence creates a new instance.

---

## V1 Cat Animation

### Initial scope
Only one cat version and one walking animation.

### Required behavior
- load sprite sheet,
- animate smoothly,
- support scaling,
- support positioning above or near the bubble,
- work on high-DPI displays.

### Future-proofing
The animation system must support:
- more cats,
- more animations,
- alternate directions,
- alternate behaviors,
- custom themes later.

---

## V1 Overlay Behavior

The reminder should appear in a transparent always-on-top overlay window.

Desired behavior:
- visible without fully stealing focus,
- interactive when needed,
- easy to dismiss or snooze,
- compatible with multiple monitors if possible,
- avoids interrupting fullscreen apps unless configured otherwise.

A separate settings window should be used for configuration and management.

---

## V1 Data Model

### Reminder
```ts
type Reminder = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  repeatRule?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'upcoming' | 'soon' | 'due' | 'overdue' | 'snoozed' | 'completed' | 'dismissed';
  source: 'manual' | 'google-calendar' | 'imported';
  sourceEventId?: string;
  sourceCalendarId?: string;
  snoozeUntil?: string;
  createdAt: string;
  updatedAt: string;
};
```

### Preferences
```ts
type Preferences = {
  launchAtLogin: boolean;
  openInTray: boolean;
  openInWindow: boolean;
  soundEnabled: boolean;
  bubbleEnabled: boolean;
  animationIntensity: 'low' | 'medium' | 'high';
  reminderLeadTimeMinutes: number;
  snoozeMinutes: number;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
};
```

---

## V1 Storage

Use SQLite for:
- reminders,
- recurrence instances,
- preferences,
- sync metadata,
- snooze history,
- last trigger timestamps.

---

## V1 Architecture

### Main process
Handles:
- app lifecycle,
- tray/menu,
- reminders scheduler,
- sync,
- storage,
- window management.

### Renderer
Handles:
- UI,
- reminder editor,
- settings,
- sync setup,
- debug views.

### Overlay module
Handles:
- cat animation,
- reminder bubble,
- screen placement,
- interaction controls.

### Shared layer
Handles:
- types,
- validation,
- date utilities,
- state transitions.

---

## V1 Packaging

Use electron-builder to package:
- Windows installer first,
- macOS build later or in parallel as foundation.

Expected deliverables:
- Windows installer,
- macOS `.dmg` or equivalent build when ready.

---

## V1 Testing

### Unit tests
- recurrence logic,
- reminder transitions,
- snooze logic,
- sync mapping,
- trigger timing.

### Integration tests
- SQLite persistence,
- app startup,
- tray behavior,
- reminder scheduling,
- sync import flow.

### Manual QA
- Windows overlay behavior,
- multi-monitor support,
- sleep/wake behavior,
- timezone edge cases,
- recurrence edge cases.

---

## V1 Acceptance Criteria

The v1 MVP is done when:
- the app runs on Windows,
- users can create manual reminders,
- recurring reminders work,
- Google Calendar sync imports events,
- the cat appears for upcoming reminders,
- the bubble shows correct text,
- snooze and dismiss work,
- tray/menu mode works,
- macOS support remains structurally possible.

---

# V2 Expansion Spec

## V2 Overview

V2 expands the app from a focused reminder companion into a more feature-rich cat desktop ecosystem. The emphasis shifts from “working MVP” to “delight, customization, and product depth.”

V2 should build on the same architecture without forcing a rewrite.

---

## V2 Goals

- Add more cat personalities and motion styles.
- Expand customization options.
- Improve desktop presence and polish.
- Support more sync sources and richer calendar behavior.
- Add Steam-ready presentation and productization features.
- Make the app feel more like a polished companion app than a simple reminder utility.

---

## V2 Feature Areas

### 1. More cats
Add multiple cat characters, such as:
- classic cat,
- sleepy cat,
- frantic cat,
- fancy cat,
- seasonal/event cat.

Each cat can have a unique style or personality.

### 2. More animations
Add multiple motion states:
- walking,
- running,
- flying,
- popping out of boxes,
- jumping,
- sleeping,
- celebrating,
- panicking.

### 3. Theming
Allow users to customize:
- bubble color,
- UI palette,
- cat skin or palette variants,
- sound packs,
- seasonal themes.

### 4. Better reminder presentation
Improve the alert system with:
- richer bubble layouts,
- priority badges,
- compact and expanded modes,
- progress or countdown indicators,
- reminder groups or stacks.

### 5. Better sync support
Extend calendar integration to possibly include:
- Apple Calendar,
- Outlook,
- CalDAV,
- optional two-way sync for some providers.

### 6. Steam polish
Prepare the app for Steam with:
- polished store assets,
- screenshots,
- trailer/gif material,
- achievement or collectible ideas if appropriate,
- app identity that works both as utility and as a cozy desktop companion.

### 7. User customization
Add user controls for:
- which cat appears for which reminder type,
- animation speed,
- interruptiveness,
- reminder sound themes,
- cat size,
- screen path behavior.

---

## V2 Product Vision

In V2, the app becomes a more lovable and expressive desktop companion. Users should be able to make it feel like their own, whether they want a quiet minimal reminder helper or a more animated pet-like utility.

The product should still remain practical. The core reminder function must stay strong, and all expansion should support that rather than distract from it.

---

## V2 Technical Expansion

Possible technical additions:
- more advanced sprite management,
- asset metadata system,
- theme and skin packs,
- cloud sync for settings,
- optional analytics or crash reporting,
- improved installer/updater flow,
- richer test automation.

---

## V2 Out of Scope for v1

These are not required in the first release:
- multiple cat characters,
- advanced theming,
- two-way sync,
- Apple/Outlook support,
- Steam store polish,
- collectible systems,
- premium content,
- custom user-uploaded sprites.

---

## Master Development Order

### Phase 1
Build v1 MVP:
- Windows-first shell,
- reminder system,
- manual reminders,
- recurring reminders,
- Google sync,
- one cat overlay.

### Phase 2
Stabilize and polish:
- testing,
- packaging,
- macOS foundation,
- installer flow,
- UX cleanup.

### Phase 3
Begin v2 expansion:
- more cat states,
- more themes,
- richer sync,
- customization,
- Steam polish.

---

## Cursor / GPT-5.6 Luna Guidance

Implement the app in a way that keeps v1 simple but reserves extension points for v2. The best structure is a modular reminder engine with a pluggable overlay/animation system.

Focus on:
- clear TypeScript types,
- small services,
- isolated state transitions,
- testable scheduler logic,
- clean boundaries between sync, storage, UI, and animation.

Do not overbuild v2 features into the v1 UI. Instead, leave hooks, interfaces, and asset metadata structures so the app can grow cleanly later.


---

# Repo Setup and Build

## Stack Decisions

- Package manager: pnpm.
- Runtime: Node.js 22 LTS.
- UI framework: React.
- Language: TypeScript.
- Desktop shell: Electron.
- Build tool: Vite.
- Local database: SQLite.
- Packaging: electron-builder.
- State management: Zustand.
- Date handling: date-fns.
- Styling: plain CSS or CSS Modules unless a stronger need appears later.

## Repo Principles

- Keep the project local-first.
- Keep the main process, renderer, and shared logic separated.
- Prefer small modules with explicit boundaries.
- Do not introduce v2 features into v1 implementation paths.
- Make all reminder behavior testable without the UI.

## Suggested Folder Structure

```txt
src/
  main/
    app.ts
    windows/
    tray/
    scheduler/
    sync/
    storage/
    logging/
  renderer/
    components/
    pages/
    hooks/
    styles/
  overlay/
    animation/
    bubble/
    positioning/
  shared/
    types/
    constants/
    utils/
    validation/
assets/
  cats/
  icons/
  sounds/
tests/
docs/
```

## Build and Run Targets

- Development: `pnpm dev`.
- Windows packaging: `pnpm dist:win`.
- macOS packaging: `pnpm dist:mac`.
- Lint/test scripts should exist before feature work begins.

---

# MVP Definition of Done

The v1 MVP is complete only when all of the following are true:

- The app launches on Windows.
- Users can create, edit, delete, and complete manual reminders.
- Recurring reminders work for daily, weekly, and monthly patterns.
- Google Calendar sync imports future events into local reminders.
- Reminder triggers display the cat overlay and bubble correctly.
- Snooze and dismiss work reliably.
- The app can run from tray/menu mode.
- The settings window works.
- Local reminders persist across restarts.
- The project can be packaged into a Windows installer.
- The app remains structured so macOS support can be added without a rewrite.

---

# Desktop Behavior Rules

## Startup Behavior

- The app should optionally start with Windows.
- On first launch, it should open the main window or onboarding flow.
- After setup, it should default to tray behavior if the user selects it.

## Overlay Behavior

- The reminder overlay should be transparent and always-on-top.
- The overlay should not steal focus unless the user clicks an interactive control.
- The overlay should support click-through behavior while idle.
- If the user is in fullscreen mode, the app should follow a configurable policy rather than forcing a single behavior.

## Multi-Monitor Behavior

- The overlay should appear on the active monitor when possible.
- If a reminder is triggered while no monitor context is available, default to the primary display.
- Screen scaling and high-DPI displays must be handled cleanly.

## Window Modes

- Tray/menu mode is the default background mode.
- Full window mode is used for management and settings.
- Both modes must be accessible from the same codebase.

---

# Data and Sync Rules

## Reminder Editing Rules

- Manual reminders may be created, edited, completed, snoozed, or dismissed.
- Editing a reminder should preserve its ID unless the item is cloned intentionally.
- Recurring reminders should generate future instances consistently.
- Time zones must be stored explicitly.

## Google Sync Rules

- Google Calendar sync is read-only in v1.
- Sync should import upcoming events into local storage.
- Imported calendar records must retain source identifiers.
- If sync fails, local reminders must continue to function.
- Sync should run on a defined interval and also support manual refresh.
- The app should remember the last successful sync timestamp.

## Time Handling Rules

- All stored timestamps should use ISO 8601.
- Recurring calculations should be based on the reminder time zone.
- Daylight saving time changes must not corrupt reminder times.

## Duplicate Handling

- Imported events with the same source ID should update the existing local record instead of creating duplicates.
- Dismissed or completed local overrides should not be lost silently.
- Sync conflicts should prefer source metadata plus explicit local state rules.

---

# Logging and Error Handling

## Logging Goals

- Make scheduler issues visible.
- Make sync failures visible.
- Make reminder trigger bugs easy to debug.
- Keep logs useful but not noisy.

## Required Logs

- App startup and shutdown.
- Sync start, success, and failure.
- Reminder trigger and snooze events.
- Overlay show/hide events.
- Database migration status.
- Packaging/build failures where relevant.

## Error Handling Rules

- The app should fail gracefully if Google sync is unavailable.
- A database error should not destroy local reminders if recovery is possible.
- A reminder trigger failure should be logged and retried if safe.
- User-facing errors should be short, clear, and non-technical.

---

# Security and Privacy

## Data Safety

- Store calendar tokens and app settings locally and securely.
- Do not send reminder contents to external services unless explicitly required for Google sync.
- Keep local reminder data private by default.

## OAuth Handling

- Use a Google Desktop app OAuth client for login.
- Keep token refresh handling inside the app.
- Provide a clear disconnect/logout flow.

## Privacy Expectations

- No analytics in v1 unless explicitly added later.
- No hidden network calls beyond sync and required authentication.
- Clearly separate local reminder data from synced calendar data.

---

# v1 Release Scope Limits

These are explicitly out of scope for v1:

- Multiple cat characters.
- Theme marketplace.
- User-uploaded sprite support.
- Two-way calendar sync.
- Outlook, Apple Calendar, or CalDAV support.
- Steam achievements.
- Monetization or premium tiers.
- Cloud sync for user settings.
- Advanced seasonal event systems.

---


---

# Database Migrations

## Policy

- All schema changes must be versioned.
- Migrations must be idempotent when possible.
- The app should record the current schema version in the local database.
- Migration failures should stop startup only if recovery is not possible.
- Any migration that changes reminder state must preserve existing records.

## Requirements

- Include a migration runner in the main process.
- Add tests for migration up/down or upgrade behavior.
- Never require the user to manually edit database files.

---

# First-Run Flow

## Goals

- Keep first launch simple.
- Explain the app briefly.
- Let the user choose background behavior immediately.
- Make Google Calendar setup optional but easy to find.

## First-Run Steps

1. Show a welcome screen or lightweight onboarding panel.
2. Ask whether the app should start in tray mode or open a window.
3. Ask whether Windows startup is enabled.
4. Offer Google Calendar connection.
5. Offer a quick reminder creation example.
6. Save preferences and enter normal app mode.

## Requirements

- First-run flow should be skippable.
- The app should remember if onboarding has already completed.
- If sync is not configured, the app must still be fully usable.

---

# Accessibility Basics

## Requirements

- Reminder text must be readable against the bubble background.
- Keyboard navigation should work in settings and reminder forms.
- Buttons must have clear labels.
- Overlay animation should not be so fast or distracting that it becomes hard to dismiss.
- Users should be able to reduce or disable motion intensity.

## Helpful Considerations

- Use sufficient contrast for bubble text.
- Keep important actions reachable by keyboard.
- Avoid tiny click targets.
- Support readable font sizing in settings and reminder content.

---

# Update Policy

## v1 Recommendation

- Auto-update is optional for v1 and can be deferred if it adds too much setup friction.
- If auto-update is added in v1, it must not block core reminder behavior.
- Windows and macOS update flows should be separated if platform packaging requires it.

## Requirements

- Document the chosen update strategy before release.
- Keep the packaging pipeline simple enough for local testing.
- Do not let update infrastructure delay the first playable build.

---

# System Event Handling

## Required Cases

The app should handle these system events gracefully:

- app restart,
- sleep and wake,
- timezone changes,
- daylight saving time changes,
- monitor connection and disconnection,
- system shutdown or logout,
- tray icon recreation after explorer restart on Windows.

## Behavior Rules

- Reminder scheduling should resume after wake or restart.
- Overlay positioning should be recalculated when displays change.
- Sync should not duplicate work after a system pause.
- Any missed reminder should be reconciled on resume according to reminder state rules.

---


---

# Skills Usage

## Installed Skills

The project is expected to use the following installed skills when they are relevant:

- `pixel-art-sprites` for cat sprite sheets, frame-based animation, pixel-art scaling, sprite organization, and animation direction choices.
- `webapp-testing` for renderer UI testing, local app interaction, browser-style verification, and Playwright-based checks.
- `playwright-cli` for live UI interaction, screenshots, and debugging when the agent needs to drive the app directly.
- `test-driven-development` for reminder scheduler logic, recurrence rules, state transitions, and other core behavior that should be written test-first.
- `vercel-react-best-practices` for React renderer structure, component performance, and maintainable UI code.
- `verification-before-completion` for forcing a final validation pass before any task is declared complete.

## When To Use Them

Use a skill only when it materially improves the current task:

- Use `pixel-art-sprites` when designing, reviewing, or implementing sprite-sheet based animation.
- Use `test-driven-development` when building reminder logic, sync logic, recurrence behavior, or any rule-heavy code.
- Use `vercel-react-best-practices` when building or refactoring React UI components, settings screens, or renderer logic.
- Use `webapp-testing` when verifying forms, settings, UI flows, or renderer behavior with automated tests.
- Use `playwright-cli` when the agent needs to inspect the app interactively, capture screenshots, or reproduce UI issues.
- Use `verification-before-completion` at the end of every substantial implementation task.

## Additional Skills

If a task would benefit from a specialized skill that is not already installed, the agent should ask for permission or recommend installing a relevant skill from [skills.sh](https://www.skills.sh/) or another credible skill source before proceeding.

Examples of when to request additional skills:
- advanced animation or motion design,
- packaging and release automation,
- accessibility auditing,
- design system work,
- deeper debugging workflows,
- platform-specific desktop integrations,
- further testing or visual regression tooling.

---
