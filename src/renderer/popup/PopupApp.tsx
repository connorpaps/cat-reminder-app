import { useEffect, useState } from 'react'
import { CAT_IDS, CATS } from '../../shared/animation'
import { assetUrl } from '../../shared/assets'
import type { SyncStatus, TickTickSyncStatus } from '../../shared/types/sync'
import type { Preferences } from '../../shared/types/preferences'

function timeAgo(iso: string | undefined): string {
  if (!iso) return ''
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function PopupApp() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [ticktick, setTicktick] = useState<TickTickSyncStatus | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [tickticking, setTickticking] = useState(false)
  const [assetBase, setAssetBase] = useState<string | undefined>(undefined)

  const refresh = async () => {
    const [nextPreferences, nextSync, nextTicktick, baseUrl] = await Promise.all([
      window.catReminder.preferences.get(),
      window.catReminder.sync.status(),
      window.catReminder.ticktick.status(),
      window.catReminder.app.assetBaseUrl()
    ])
    setPreferences(nextPreferences)
    setSync(nextSync)
    setTicktick(nextTicktick)
    setAssetBase(baseUrl)
  }

  useEffect(() => {
    void refresh()
    // Refresh sync status every 15s so the "last synced" time stays current
    const timer = setInterval(() => void refresh(), 15_000)
    return () => clearInterval(timer)
  }, [])

  async function updatePreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const next = await window.catReminder.preferences.update({ [key]: value })
    setPreferences(next)
  }

  async function connectAccount() {
    setError('')
    try {
      const result = await window.catReminder.sync.connect()
      await updatePreference('syncEnabled', true)
      setSync({ connected: result.connected, calendars: result.calendars, selectedCalendarIds: result.calendars.filter((c) => c.primary).map((c) => c.id) })
      setNotice('Account connected. Syncing now…')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connection failed.')
    }
  }

  async function syncNow() {
    setSyncing(true)
    setError('')
    try {
      const result = await window.catReminder.sync.refresh()
      setSync((prev) => prev ? { ...prev, calendars: result.calendars, lastSyncAt: result.syncedAt } : prev)
      setNotice(`Synced ${result.imported + result.updated} items.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function disconnectAccount() {
    // The main process decides whether auto-sync stays on (it stays on while
    // TickTick is still connected), so the UI must not force it off here.
    const status = await window.catReminder.sync.disconnect()
    setSync(status)
  }

  async function selectCalendars(calendarIds: string[]) {
    const status = await window.catReminder.sync.selectCalendars(calendarIds)
    setSync(status)
  }

  async function connectTickTick() {
    setError('')
    try {
      const status = await window.catReminder.ticktick.connect()
      setTicktick(status)
      setNotice('TickTick connected. Syncing now…')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TickTick connection failed.')
    }
  }

  async function syncTickTickNow() {
    setTickticking(true)
    setError('')
    try {
      const result = await window.catReminder.ticktick.refresh()
      setTicktick((prev) => prev ? { ...prev, lastSyncAt: result.syncedAt } : prev)
      setNotice(`TickTick synced ${result.imported + result.updated} items.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'TickTick sync failed.')
    } finally {
      setTickticking(false)
    }
  }

  async function disconnectTickTick() {
    const status = await window.catReminder.ticktick.disconnect()
    setTicktick(status)
  }

  async function selectProjects(projectIds: string[]) {
    const status = await window.catReminder.ticktick.selectProjects(projectIds)
    setTicktick(status)
  }

  return (
    <main className="popup-shell">
      <div className="popup-panel">
        {/* Preview Cat */}
        <button
          className="popup-btn popup-btn-cat"
          onClick={() => void window.catReminder.app.showTestOverlay().then(() => setNotice('Cat preview triggered!')).catch((e) => setError(e instanceof Error ? e.message : 'Preview failed.'))}
        >
          🐱 Preview Cat
        </button>

        <hr className="popup-divider" />

        {/* Google Account (Calendar + Tasks) */}
        <div className="popup-section">
          <span className="popup-label">🔗 Google Account</span>
          {!sync?.connected ? (
            <button className="popup-btn popup-btn-primary" onClick={() => void connectAccount()}>
              Connect Account
            </button>
          ) : (
            <>
              <div className="popup-status">
                <span className="popup-dot on" />
                Connected
                {sync.lastSyncAt && (
                  <small className="popup-sync-age"> · Synced {timeAgo(sync.lastSyncAt)}</small>
                )}
              </div>
              {sync.calendars.length > 0 && (
                <div className="popup-calendar-list">
                  {sync.calendars.map((cal) => (
                    <label className="popup-calendar-item" key={cal.id}>
                      <input
                        type="checkbox"
                        checked={sync.selectedCalendarIds.includes(cal.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...sync.selectedCalendarIds, cal.id]
                            : sync.selectedCalendarIds.filter((id) => id !== cal.id)
                          void selectCalendars(next)
                        }}
                      />
                      <span>{cal.summary}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="popup-row">
                <button className="popup-btn popup-btn-ghost" onClick={() => void syncNow()} disabled={syncing}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="popup-btn popup-btn-text" onClick={() => void disconnectAccount()}>
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>

        <hr className="popup-divider" />

        {/* TickTick Account (display-only) */}
        <div className="popup-section">
          <span className="popup-label">✅ TickTick Account</span>
          {!ticktick?.connected ? (
            <button className="popup-btn popup-btn-primary" onClick={() => void connectTickTick()}>
              Connect TickTick
            </button>
          ) : (
            <>
              <div className="popup-status">
                <span className="popup-dot on" />
                Connected
                {ticktick.lastSyncAt && (
                  <small className="popup-sync-age"> · Synced {timeAgo(ticktick.lastSyncAt)}</small>
                )}
              </div>
              <small className="popup-note">Display-only: tasks show as cat reminders; changes happen in TickTick.</small>
              {ticktick.projects.length > 0 && (
                <div className="popup-calendar-list">
                  {ticktick.projects.map((project) => (
                    <label className="popup-calendar-item" key={project.id}>
                      <input
                        type="checkbox"
                        checked={ticktick.selectedProjectIds.includes(project.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...ticktick.selectedProjectIds, project.id]
                            : ticktick.selectedProjectIds.filter((id) => id !== project.id)
                          void selectProjects(next)
                        }}
                      />
                      <span>{project.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="popup-row">
                <button className="popup-btn popup-btn-ghost" onClick={() => void syncTickTickNow()} disabled={tickticking}>
                  {tickticking ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="popup-btn popup-btn-text" onClick={() => void disconnectTickTick()}>
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>

        <hr className="popup-divider" />

        {/* Cat picker */}
        {preferences && (
          <div className="popup-section">
            <span className="popup-label">🐈 Cat</span>
            <div className="cat-picker" role="radiogroup" aria-label="Choose your cat">
              {CAT_IDS.map((catId) => {
                const selected = preferences.selectedCatId === catId
                return (
                  <button
                    key={catId}
                    type="button"
                    className={`cat-picker-btn${selected ? ' selected' : ''}`}
                    aria-pressed={selected}
                    title={CATS[catId].displayName}
                    onClick={() => void updatePreference('selectedCatId', catId)}
                  >
                    <img src={assetUrl(`assets/cats/${catId}/idle.png`, assetBase)} alt={CATS[catId].displayName} draggable={false} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <hr className="popup-divider" />

        {/* Settings */}
        {preferences && (
          <div className="popup-section">
            <span className="popup-label">⚙ Settings</span>
            <div className="popup-settings-grid">
              <label className="popup-setting">
                <span>Send reminder:</span>
                <select value={preferences.reminderLeadTimeMinutes} onChange={(e) => void updatePreference('reminderLeadTimeMinutes', Number(e.target.value))}>
                  <option value={5}>5 min before</option>
                  <option value={10}>10 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                </select>
              </label>
              <label className="popup-setting">
                <span>Sync calendar every:</span>
                <select value={preferences.syncIntervalMinutes} onChange={(e) => void updatePreference('syncIntervalMinutes', Number(e.target.value))}>
                  <option value={2}>2 min</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={30}>30 min</option>
                </select>
              </label>
              <label className="popup-setting">
                <span>Daily task reminder:</span>
                <input
                  type="time"
                  value={preferences.dailyTaskReminderTime}
                  onChange={(e) => void updatePreference('dailyTaskReminderTime', e.target.value)}
                />
              </label>
              <label className="popup-setting">
                <span>Daily tasks enabled:</span>
                <input
                  type="checkbox"
                  checked={preferences.dailyTaskReminderEnabled}
                  onChange={(e) => void updatePreference('dailyTaskReminderEnabled', e.target.checked)}
                />
              </label>
              <label className="popup-setting">
                <span>Launch at login:</span>
                <input
                  type="checkbox"
                  checked={preferences.launchAtLogin}
                  onChange={(e) => void updatePreference('launchAtLogin', e.target.checked)}
                />
              </label>
              <label className="popup-setting">
                <span>Start in tray:</span>
                <input
                  type="checkbox"
                  checked={preferences.openInTray}
                  onChange={(e) => void updatePreference('openInTray', e.target.checked)}
                />
              </label>
              <label className="popup-setting">
                <span>Sound:</span>
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={(e) => void updatePreference('soundEnabled', e.target.checked)}
                />
              </label>
            </div>
          </div>
        )}

        {notice && <p className="popup-notice" role="status">{notice}</p>}
        {error && <p className="popup-error" role="alert">{error}</p>}

        <hr className="popup-divider" />

        {/* Quit */}
        <button className="popup-btn popup-btn-quit" onClick={() => void window.catReminder.app.quit()}>
          🚪 Quit
        </button>
      </div>
    </main>
  )
}
