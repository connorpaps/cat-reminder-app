import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OverlayReminder, OverlayTaskItem } from '../../shared/types/overlay'
import { DEFAULT_CAT_ANIMATIONS, TEXTBOX_LARGE_SPRITE, TEXTBOX_SPRITE, phaseAt, spriteOffset, totalShowDurationMs, traversalPositionAt, type TextboxSpriteManifest } from '../../shared/animation'

const intensityFps = { low: 6, medium: 10, high: 14 } as const
const CAT_HEIGHT = 192
const CAT_VISIBLE_TOP_OFFSET = 66
const BUBBLE_GAP = 10
const DEFAULT_WALK_BASELINE = 28
const TASK_LIST_MAX_ROWS = 6

type TextboxProps = {
  reminder: OverlayReminder['reminder']
  taskItems?: OverlayTaskItem[]
  rollup?: boolean
  sprite: TextboxSpriteManifest
  assetBaseUrl?: string
  onAction: (action: 'snooze' | 'dismiss' | 'complete') => void
}

function assetUrl(path: string, baseUrl?: string): string {
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${path}`
  return `${window.location.protocol === 'file:' ? './' : '/'}${path}`
}

function Textbox({ reminder, taskItems, rollup, sprite, assetBaseUrl, onAction }: TextboxProps) {
  const texture = assetUrl(sprite.src, assetBaseUrl)
  const scale = sprite.scale
  return <div
    className="compact-textbox"
    role="alertdialog"
    aria-label={`Reminder: ${reminder.title}`}
    onPointerEnter={() => window.catOverlay.setIgnoreMouseEvents(false)}
    onPointerLeave={() => window.catOverlay.setIgnoreMouseEvents(true)}
    style={{
      width: sprite.panelWidth * scale,
      height: sprite.panelHeight * scale,
      backgroundImage: `url(${texture})`,
      backgroundSize: `${sprite.sheetWidth * scale}px ${sprite.sheetHeight * scale}px`,
      backgroundPosition: `-${sprite.panelX * scale}px -${sprite.panelY * scale}px`
    }}
  >
    <div className="compact-textbox-content">
      <strong>{reminder.title}</strong>
      {taskItems ? (
        <ul className="task-rollup-list">
          {taskItems.slice(0, TASK_LIST_MAX_ROWS).map((item, index) => (
            <li className="task-rollup-item" key={index} title={item.description}>
              <span className="task-rollup-check" aria-hidden="true">▢</span>
              <span className="task-rollup-title">{item.title}</span>
            </li>
          ))}
          {taskItems.length > TASK_LIST_MAX_ROWS && (
            <li className="task-rollup-more">+{taskItems.length - TASK_LIST_MAX_ROWS} more</li>
          )}
        </ul>
      ) : (
        reminder.description && <span>{reminder.description}</span>
      )}
      <div className="overlay-actions">
        {rollup ? (
          <>
            <button aria-label="Snooze task reminder" onClick={() => onAction('snooze')}>Snooze</button>
            <button className="bubble-primary" aria-label="Dismiss task reminder for today" onClick={() => onAction('dismiss')}>Dismiss</button>
          </>
        ) : (
          <>
            <button aria-label="Dismiss reminder" onClick={() => onAction('dismiss')}>Dismiss</button>
            <button className="bubble-primary" aria-label="Complete reminder" onClick={() => onAction('complete')}>Done</button>
          </>
        )}
      </div>
    </div>
  </div>
}

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayReminder | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [reducedMotion, setReducedMotion] = useState(false)
  const completedPayloadId = useRef<string | null>(null)
  const interactedRef = useRef(false)
  const overlayWindow = window
  const intensity = payload?.animationIntensity ?? 'medium'

  useEffect(() => {
    const dispose = overlayWindow.catOverlay.onShow((nextPayload) => {
      completedPayloadId.current = null
      interactedRef.current = false
      setPayload({ ...nextPayload, animationStartedAt: nextPayload.animationStartedAt ?? Date.now() })
      setClock(Date.now())
      overlayWindow.catOverlay.setIgnoreMouseEvents(true)
    })
    overlayWindow.catOverlay.ready()
    return () => {
      overlayWindow.catOverlay.setIgnoreMouseEvents(true)
      dispose()
    }
  }, [overlayWindow.catOverlay])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!payload) return undefined
    let frameId = 0
    const startedAt = payload.animationStartedAt ?? Date.parse(payload.queuedAt)
    const totalMs = totalShowDurationMs()
    const tick = () => {
      const now = Date.now()
      const elapsed = now - startedAt
      setClock(now)
      if (elapsed < totalMs) frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    const completionTimer = window.setTimeout(() => setClock(Date.now()), Math.max(0, totalMs - (Date.now() - startedAt) + 16))
    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(completionTimer)
    }
  }, [payload, reducedMotion])

  const elapsed = payload ? clock - (payload.animationStartedAt ?? Date.parse(payload.queuedAt)) : 0
  const phase = phaseAt(elapsed)
  const catLeft = traversalPositionAt(elapsed)
  const sceneLeft = catLeft
  // The daily task roll-up uses the larger textbox panel so its list fits.
  const bubbleSprite = payload?.rollup ? TEXTBOX_LARGE_SPRITE : TEXTBOX_SPRITE
  const bubbleWidth = bubbleSprite.panelWidth * bubbleSprite.scale
  const bubbleHeight = bubbleSprite.panelHeight * bubbleSprite.scale
  // Idle in place at the end of the walk so the cat rests before walking off.
  const animation = phase === 'pausing' ? DEFAULT_CAT_ANIMATIONS.idle : DEFAULT_CAT_ANIMATIONS.running
  const fps = phase === 'pausing' ? animation.fps : intensityFps[intensity]
  const frame = Math.floor((Math.max(0, elapsed) / 1000) * fps)
  const spriteStyle = useMemo(() => ({
    backgroundImage: `url(${assetUrl(animation.src, payload?.assetBaseUrl)})`,
    backgroundPosition: spriteOffset(animation, frame),
    backgroundSize: `${animation.frameWidth * animation.frameCount * animation.scale}px ${animation.frameHeight * animation.scale}px`,
    width: animation.frameWidth * animation.scale,
    height: animation.frameHeight * animation.scale,
    imageRendering: animation.imageRendering,
    // Drop the sprite by the sheet's feet padding so the cat's feet (not the
    // frame's transparent bottom rows) rest exactly on the taskbar walk line.
    bottom: -(animation.feetPaddingPx * animation.scale),
    // The idle sheet is drawn facing left; mirror it so it faces the direction of travel.
    // Order matters: translateX(-50%) centers the sprite first, then scaleX(-1) mirrors
    // it around its own center. Reversing the order shifts the sprite a full sprite-width
    // off-center (the translate is applied inside the flipped coordinate space).
    transform: phase === 'pausing' ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)'
  }), [animation, frame, payload?.assetBaseUrl, phase])

  const dismissCurrent = useCallback(() => {
    if (!payload) return
    overlayWindow.catOverlay.action(payload.reminder.id, 'dismiss')
  }, [overlayWindow.catOverlay, payload])

  const handleAction = useCallback((action: 'snooze' | 'dismiss' | 'complete') => {
    interactedRef.current = true
    overlayWindow.catOverlay.action(payload!.reminder.id, action)
  }, [overlayWindow.catOverlay, payload])

  useEffect(() => {
    // Nothing lingers: once the cat has finished the idle pause and walked fully
    // off screen, close the show. Timed reminders auto-dismiss (the action makes
    // main hide the overlay and clean up previews). The daily roll-up only walks
    // off — main hides it without dismissing the day, so it stays 'shown'.
    if (!payload || elapsed < totalShowDurationMs() || completedPayloadId.current === payload.reminder.id) return
    completedPayloadId.current = payload.reminder.id
    if (interactedRef.current) return
    if (payload.rollup) {
      overlayWindow.catOverlay.animationComplete(payload.reminder.id)
    } else {
      dismissCurrent()
    }
  }, [overlayWindow.catOverlay, payload, elapsed, dismissCurrent])

  if (!payload) return null
  return <div className={`overlay-stage${reducedMotion ? ' reduced-motion' : ''}`}>
    <div
      className="cat-scene"
      style={{
        left: `${sceneLeft}%`,
        bottom: `${payload.walkBaselineFromBottom ?? DEFAULT_WALK_BASELINE}px`,
        width: bubbleWidth,
        height: CAT_HEIGHT + bubbleHeight + BUBBLE_GAP
      }}
    >
      <Textbox
        reminder={payload.reminder}
        taskItems={payload.taskItems}
        rollup={payload.rollup}
        sprite={bubbleSprite}
        assetBaseUrl={payload.assetBaseUrl}
        onAction={handleAction}
      />
      <div className="cat-sprite" aria-hidden="true" style={spriteStyle} />
    </div>
  </div>
}
