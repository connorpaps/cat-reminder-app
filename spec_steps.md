# Cat Reminder — Remaining Spec Explanations and Steps

**Purpose:** Explain the numbered items from the v1 gap review that the user asked to understand, while preserving previously agreed exclusions.

## Scope decisions

### Explicitly excluded: item 1 from the previous gap review

The previous review's item 1 was the manual reminder management UI. The user has instructed that this item is to be ignored, consistent with the project's prior direction toward a pure tray + popup app and the existing memory notes.

This document therefore does **not** make manual reminder CRUD UI a required next step.

### Also excluded from v1

These remain outside the v1 work plan and are not action items here:

- Two-way provider sync.
- Cloud accounts or remote storage.
- Outlook, Apple Calendar, or CalDAV.
- Steam features, monetization, themes, and other v2 product work.
- macOS packaging.

The existing TickTick integration is display-only by design. The app reads tasks but does not write changes back.

---

## Item 2 — Recurring reminders and the current UI decision

### What this means

The recurrence engine already supports daily, weekly, and monthly recurrence. It also understands reminder time zones and has tests covering daylight-saving transitions.

The remaining concern from the gap review was that recurrence cannot be configured through a reminder editor because the manual reminder editor is intentionally excluded under the decision above.

In other words:

- The backend recurrence behavior exists.
- The scheduler can advance a recurring series after completion or dismissal.
- The current user-facing popup does not expose a recurrence editor.
- This is not an immediate action if manual reminder creation/editing remains intentionally out of scope.

### Existing implementation

- `src/shared/reminders/recurrence.ts` calculates the next occurrence.
- `src/main/storage/reminder-repository.ts` stores `seriesId` and `occurrenceKey`.
- `src/main/index.ts` creates the next occurrence after completion or dismissal.
- `tests/shared/recurrence.test.ts` covers daily, weekly, monthly, DST, and invalid time zones.

### If this is revisited later

A future reminder-management UI would need to expose:

- none/daily/weekly/monthly,
- recurrence interval,
- selected weekdays for weekly reminders,
- monthly day behavior,
- validation for invalid combinations.

### Completion criteria if reopened

- A user can configure a daily, weekly, or monthly series.
- Completing/dismissing one occurrence creates the next occurrence without deleting the series.
- Snoozing affects only the current occurrence.
- DST and timezone tests remain green.

**Current decision:** backend retained; no new UI work required under the current scope.

---

## Item 4 — Settings that are missing, hidden, or only partly wired

### What this means

The project has a number of preference fields and backend behaviors, but not every preference is currently exposed in the popup. Some were intentionally removed from the UI in an earlier session.

The issue is not that every setting must be restored. The issue is that each preference should have a deliberate v1 decision: visible, fixed by design, or removed from the data model.

### Current settings and implications

#### Fullscreen behavior

The backend supports:

- `respect`: suppress overlays while another application is fullscreen,
- `show`: show overlays regardless,
- `suppress`: never show overlays.

The popup does not currently expose this choice. Without a control, users cannot change the behavior without editing stored data.

**Possible v1 decision:** expose a small `Fullscreen behavior` selector, or intentionally keep `respect` as the fixed default and document it.

#### Animation intensity

The backend supports low, medium, and high intensity. The current UI intentionally removed the Motion setting and the app uses the medium/balanced behavior.

This matters because the master spec says users should be able to reduce or disable motion intensity. The project memory also records that Motion was removed from the UI intentionally.

**Possible v1 decision:** keep motion fixed at balanced, or restore a simple low/medium/reduced-motion control. Do not restore it automatically without deciding which behavior the product wants.

#### Bubble enabled

`bubbleEnabled` exists in preferences, but the overlay currently renders the reminder bubble without using this preference to hide it.

That creates a misleading setting if it is exposed later.

**Required decision:** either wire it into overlay rendering or remove the unused preference from v1.

#### Snooze duration

The backend supports snoozing and stores `snoozeMinutes`. The UI control was intentionally removed earlier, but daily task roll-ups still have a Snooze action.

If snooze remains available, users should either:

- have a visible snooze-duration setting, or
- receive a documented fixed duration.

**Possible v1 decision:** keep the current fixed default and document it, or restore the duration selector.

#### Sync enabled

The main process maintains the sync-enabled invariant across Google and TickTick connections, but the popup does not provide a general on/off switch.

A direct switch could be useful, but it must not disconnect accounts or delete imported reminders. It should only pause scheduled sync.

### Recommended completion approach

For each preference, choose one of:

1. expose it in the popup,
2. keep it fixed and document the reason,
3. remove it from the v1 model if it is no longer supported.

### Acceptance criteria

- No visible setting is a no-op.
- No important backend preference is silently impossible to change without a deliberate product decision.
- Fullscreen policy, motion behavior, bubble behavior, and snooze behavior are documented.

---

## Item 5 — Sleep and wake handling

### What this means

Windows can suspend the computer while reminders are approaching or become overdue. When the computer wakes, the app must decide what to do with reminders that would have triggered during sleep.

The spec does not require replaying every missed animation. It requires a predictable reconciliation policy.

### Current implementation

The app currently listens for `powerMonitor.resume` and:

- logs that the system resumed,
- reconciles recurring reminders,
- asks the reminder scheduler to reconcile due reminders.

This is a good foundation, but there is limited explicit coverage for missed reminders and the daily roll-up after wake.

### Decisions that need to be documented

For a timed reminder missed during sleep, the app should generally:

- show it once if it is still relevant and not completed/dismissed,
- avoid replaying a long backlog of stale reminders,
- preserve snooze and trigger suppression rules.

For a daily roll-up missed during sleep, the app should:

- show it after wake if today's roll-up has not already been shown or dismissed,
- show the current day's tasks rather than yesterday's stale list.

For recurring reminders, the app should:

- create the next valid future occurrence,
- avoid generating an unbounded chain of missed occurrences.

### Steps if implemented or strengthened

1. Define the missed-reminder policy.
2. Add scheduler tests for a clock jump across the due time.
3. Add roll-up tests for waking after the configured daily time.
4. Manually test suspend/wake with one timed reminder and one daily roll-up.
5. Confirm no duplicate overlays appear after resume.

### Acceptance criteria

- A wake event does not create duplicate triggers.
- A relevant missed reminder can still appear once.
- Stale reminders do not produce an animation storm.
- The daily roll-up reconciles correctly after a late wake.

---

## Item 6 — Timezone changes

### What this means

The app stores timestamps as ISO 8601 and stores a reminder timezone. Recurrence calculations use that timezone. However, the operating system's local timezone can change while the app is running, such as during travel or a system setting change.

The app needs a clear policy for how that affects:

- timed reminders,
- recurring reminders,
- all-day tasks,
- anytime tasks,
- the daily roll-up.

### Current implementation

- Reminder records store a `timezone` field.
- Recurrence calculations use the reminder timezone.
- Daily task roll-up day matching uses the current local calendar day.
- There is no explicit timezone-change listener and no dedicated timezone-change reconciliation test.

### Recommended policy

- Existing timed reminders keep their stored reminder timezone.
- New manual/imported reminders use the timezone supplied by their source or the current local timezone.
- Recurring reminders preserve their wall-clock time in their stored timezone.
- All-day tasks are interpreted according to the source date and local-day policy already used by the integration.
- The daily roll-up uses the current local calendar day.
- After a timezone change, the scheduler reconciles once rather than waiting for the next normal interval.

### Steps if implemented

1. Detect a system timezone change where Electron provides a reliable signal, or detect a changed timezone during periodic reconciliation.
2. Reconcile the scheduler and daily roll-up.
3. Confirm reminder timezone values are not silently overwritten.
4. Add tests around a timezone change between two reconciliations.
5. Manually test travel-like transitions using a controlled system timezone.

### Acceptance criteria

- Recurring reminders retain the intended wall-clock time in their stored timezone.
- The app does not duplicate or lose reminders after a timezone change.
- The daily roll-up uses the correct current local date.
- Stored timestamps remain valid ISO 8601 values.

---

## Item 7 — Monitor, DPI, and display-change behavior

### What this means

The overlay must behave correctly when the user has multiple monitors, changes display scaling, connects/disconnects a monitor, or uses a monitor positioned to the left of the primary display.

### Current implementation

The overlay currently:

- uses the display nearest the cursor when showing,
- spans that display's full bounds,
- calculates the taskbar-aware walking baseline,
- hides when displays are added, removed, or their metrics change,
- recalculates bounds for the next overlay.

The popup also clamps itself inside the active work area, including negative multi-monitor coordinates.

### What remains

The main gap is release validation rather than a missing basic architecture. The following cases need manual testing:

- primary monitor plus a secondary monitor,
- secondary monitor positioned left or above the primary,
- different DPI/scaling values,
- bottom/top/side taskbar placement,
- monitor removal while a cat is visible,
- display scaling change while the app is running.

### Acceptance criteria

- The cat and bubble remain visible on the chosen display.
- The walking baseline is correct relative to the taskbar.
- The popup never appears partly outside the work area.
- Display changes do not leave a stale overlay window or duplicate window.
- A later reminder uses the new display configuration.

---

## Item 8 — SQLite migration tests

### What this means

The application stores user reminders and settings in SQLite. When the schema changes between releases, existing users must upgrade without losing data.

The code already has a migration runner and a `schema_migrations` table. The missing piece is automated proof that upgrades work on realistic older databases.

### Current implementation

- Migrations are versioned.
- Migrations run transactionally.
- The app records applied versions in `schema_migrations`.
- Migration v3 adds `enabled`.
- Migration v4 adds reminder `kind` and daily roll-up state.

### Tests to add

1. Create a database using the earliest schema.
2. Insert representative reminders and preferences.
3. Run the current migration runner.
4. Verify all rows remain present and readable.
5. Verify new columns have safe defaults.
6. Verify migration records are written once.
7. Run startup a second time and verify no migration is repeated or corrupted.
8. Test a database that already contains the v3 `enabled` column, because the runner has compatibility logic for that case.

### Acceptance criteria

- Existing reminders survive every migration.
- Fresh databases initialize successfully.
- Reopening an upgraded database is idempotent.
- Migration failures occur transactionally rather than leaving a half-applied schema.

---

## Item 9 — Database recovery and failure behavior

### What this means

The spec asks the app to fail gracefully if the database is unavailable or damaged. Local reminders are the primary value of the app, so a startup failure must not silently destroy or replace them.

### Current situation

The app creates and opens its SQLite database during boot. The migration runner is transactional, but the project does not yet have a clearly documented recovery flow for:

- a locked database,
- a corrupted database,
- a failed migration,
- a missing or inaccessible user-data directory.

### Recommended behavior

- Log the exact technical failure for diagnostics.
- Show a short user-facing message explaining that local data could not be opened.
- Do not delete or overwrite the existing database automatically.
- Offer or document a safe backup/rename recovery path.
- If a backup is created, preserve the original before attempting repair.
- Keep provider tokens separate from the database recovery process.

### Possible release-level recovery flow

1. Catch database-open or migration errors during boot.
2. Log the detailed error through `electron-log`.
3. Show a small recovery window or system dialog.
4. Offer to open the data folder or create a backup copy.
5. Allow the user to retry after the issue is resolved.
6. Never silently create a new empty database while hiding the old one.

### Acceptance criteria

- A migration failure is visible and logged.
- Existing database files are never silently deleted.
- The user receives a clear recovery instruction.
- A recoverable failure does not corrupt the database further.

---

## Item 10 — Snooze history

### What this means

The current app stores the active snooze state (`snooze_until`) and trigger timestamp. The master spec also lists snooze history as a storage concern, meaning a historical record of snooze actions rather than only the current snooze deadline.

### Current implementation

- Snooze changes the reminder status to `snoozed`.
- `snooze_until` records when it may trigger again.
- Trigger state prevents repeated firing within the anti-spam window.
- There is no separate append-only snooze-history table.

### Why history could matter

History can help with:

- debugging repeated reminder behavior,
- understanding whether a reminder was repeatedly postponed,
- future analytics or user-facing activity views,
- auditing occurrence-level behavior.

It is not required for the basic snooze feature to work.

### Suggested minimal implementation if retained

Add a table such as:

```sql
snooze_history (
  id INTEGER PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  snoozed_at TEXT NOT NULL,
  snooze_until TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  occurrence_key TEXT
)
```

Insert one row whenever a reminder or roll-up is snoozed. Keep the current `snooze_until` on the reminder for fast scheduling queries.

### Acceptance criteria

- Snoozing still suppresses the reminder until the requested time.
- Each snooze action can be inspected in storage.
- History does not change the existing anti-spam or recurring-occurrence behavior.

**Priority:** lower than core reliability. The current snooze behavior works without history.

---

## Item 11 — Google OAuth token refresh validation

### What this means

Google access tokens expire. A long-running tray app must refresh them without requiring the user to reconnect every time.

The app uses the Google OAuth client with an access token and optional refresh token. The Google library can perform refreshes, but the app should verify and persist the resulting credentials correctly.

### Current implementation

- Google requests offline access.
- Tokens are stored locally through `SecureTokenStore`.
- Google API clients receive the access and refresh tokens.
- The `googleapis` OAuth client is responsible for making refresh requests when needed.

### Risk to verify

The app should confirm what happens when the library refreshes a token:

- Does sync retry successfully?
- Is a newly returned access token retained in memory for later calls?
- If Google rotates a refresh token, is the new refresh token persisted?
- Does a revoked or invalid refresh token produce a clear reconnect message?

### Steps

1. Use a test account or controlled expired access token.
2. Run a calendar and Tasks sync.
3. Confirm the OAuth client refreshes automatically.
4. Listen for updated credentials if necessary.
5. Persist updated credentials through `SecureTokenStore`.
6. Test an invalid/revoked refresh token.
7. Confirm the popup shows a concise reconnect instruction.

### Acceptance criteria

- A normal expired access token does not interrupt the user.
- Rotated credentials are persisted when returned.
- A revoked grant does not cause an endless retry loop.
- The user is told to reconnect when refresh is no longer possible.

---

## Item 12 — Provider items that disappear or become completed

### What this means

Sync currently upserts items that the provider returns. A separate decision is needed for items that were previously imported but are no longer returned.

Examples:

- A Google Calendar event is deleted.
- A Google Task is completed or removed.
- A task is moved to a project/list that is no longer selected.
- A provider temporarily returns an incomplete page or API response.

### Current behavior

- Google Calendar sync imports and updates returned events.
- Google Tasks requests active tasks with `showCompleted: false`.
- Google sync does not currently perform the same explicit disappearance pruning that TickTick does.
- Imported upserts intentionally do not overwrite local `status` or `enabled`, so local snooze/dismiss state is protected.
- TickTick already marks disappeared tasks completed within the selected projects.

### Why this is delicate

Blindly deleting every missing imported item is unsafe because:

- an API response may be partial,
- a selected list may temporarily fail,
- the user may have locally snoozed or dismissed the item,
- the provider may use different semantics for deleted versus completed.

### Recommended provider-specific policy

#### Google Calendar

Use event status or a reliable full sync strategy where possible. For an event confirmed deleted:

- mark the local imported reminder completed/dismissed, or remove it according to the chosen product policy,
- never delete a local manual reminder with the same title/time merely because it looks similar,
- scope the change to the exact provider event ID and calendar ID.

#### Google Tasks

Because active-only fetching hides completed tasks, the app should either:

- fetch completed tasks as well and explicitly synchronize completion, or
- track previously synced task IDs and mark confirmed missing tasks completed after a successful full response.

The second approach must distinguish a full successful list response from a failed or partial response.

#### Selected-list changes

If the user deselects a calendar or task list, do not automatically mark its old reminders completed unless that is an explicit product decision. A safer option is to leave them locally available but stop refreshing them.

### Steps

1. Define deleted, completed, deselected, and temporarily unavailable semantics separately.
2. Add source-scoped tracking of previously imported IDs if needed.
3. Only prune after a confirmed successful full provider response.
4. Preserve local manual reminders and local action overrides.
5. Add tests for deletion, completion, deselection, partial failure, and duplicate prevention.

### Acceptance criteria

- Deleted provider items do not remain active forever.
- Completed provider tasks leave the daily roll-up.
- A failed or partial sync does not mass-complete local items.
- Manual reminders are never pruned by provider cleanup.
- Duplicate source items update the existing local row.

---

## What two-way sync would do

Two-way sync means changes can travel in both directions between Cat Reminder and an external provider.

### Current v1 behavior: read-only/import-only

The current app does this:

```text
Google Calendar / Google Tasks / TickTick
                 ↓
        Cat Reminder local SQLite
                 ↓
          Cat overlay display
```

The provider is the source for imported items. Cat Reminder reads them but does not write changes back.

### Two-way behavior

With two-way sync, the flow would become:

```text
Provider ↔ Sync engine ↔ Cat Reminder local SQLite
```

Examples:

- Completing a reminder in Cat Reminder marks the Google Task or TickTick task completed.
- Editing a title or due date locally updates the provider.
- Dismissing or deleting locally may archive/delete the provider item, depending on policy.
- Completing an item in the provider updates the local reminder on the next sync.

### Extra complexity it introduces

Two-way sync requires decisions and code for:

- write OAuth scopes,
- provider write APIs,
- conflict resolution when both sides changed,
- last-write timestamps and revisions,
- deleted-item detection,
- retries and offline queues,
- partial write failures,
- undo behavior,
- user confirmation for destructive actions,
- provider-specific rules and rate limits.

Example conflict:

```text
10:00 — Cat Reminder changes title to " dentist"
10:01 — Google changes title to "Doctor appointment"
```

The app must decide whether to prefer:

- the provider,
- the local change,
- the latest timestamp,
- a merged value,
- or a conflict prompt.

### Why it remains excluded

The master spec explicitly places two-way sync outside v1. The current app's read-only behavior is safer and simpler:

- local reminders remain private,
- provider data is not accidentally modified,
- TickTick remains display-only,
- OAuth scopes stay limited to the intended integration behavior,
- sync failures cannot overwrite a user's external tasks.

Two-way sync should be treated as a separate future project, not mixed into the v1 completion steps in this file.

---

## Suggested order if work is later approved

1. Decide the settings policy in item 4.
2. Add sleep/wake reconciliation tests and manual QA.
3. Define timezone-change behavior and test it.
4. Complete multi-monitor/DPI QA.
5. Add SQLite migration tests.
6. Add database failure/recovery handling.
7. Decide whether snooze history is worth the schema change.
8. Validate and persist Google token refresh behavior.
9. Define and test provider disappearance/completion semantics.
10. Run the packaged Windows installer smoke test.

## Not included in this plan

- Manual reminder CRUD UI (explicitly ignored).
- Two-way sync.
- Other v2 or previously excluded product features.
