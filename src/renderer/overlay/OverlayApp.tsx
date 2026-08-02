import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OverlayReminder } from '../../shared/types/overlay'
import { CAT_TRAVEL_DURATION_MS, DEFAULT_CAT_ANIMATIONS, TEXTBOX_SPRITE, spriteOffset, traversalPositionPercent, traversalProgress } from '../../shared/animation'

const intensityFps = { low: 6, medium: 10, high: 14 } as const
const CAT_HEIGHT = 192
const CAT_VISIBLE_TOP_OFFSET = 66
const BUBBLE_GAP = 10
const BUBBLE_WIDTH = TEXTBOX_SPRITE.panelWidth * TEXTBOX_SPRITE.scale
const BUBBLE_HEIGHT = TEXTBOX_SPRITE.panelHeight * TEXTBOX_SPRITE.scale
const AUTO_DISMISS_MS = 60_000

type TextboxProps = {
  reminder: OverlayReminder['reminder']
  assetBaseUrl?: string
  onAction: (action: 'snooze' | 'dismiss' | 'complete') => void
}

function assetUrl(path: string, baseUrl?: string): string {
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${path}`
  return `${window.location.protocol === 'file:' ? './' : '/'}${path}`
}

function Textbox({ reminder, assetBaseUrl, onAction }: TextboxProps) {
  const texture = assetUrl(TEXTBOX_SPRITE.src, assetBaseUrl)
  const scale = TEXTBOX_SPRITE.scale
  return <div
    className="compact-textbox"
    role="alertdialog"
    aria-label={`Reminder: ${reminder.title}`}
    onPointerEnter={() => window.catOverlay.setIgnoreMouseEvents(false)}
    onPointerLeave={() => window.catOverlay.setIgnoreMouseEvents(true)}
    style={{
      width: BUBBLE_WIDTH,
      height: BUBBLE_HEIGHT,
      backgroundImage: `url(${texture})`,
      backgroundSize: `${TEXTBOX_SPRITE.sheetWidth * scale}px ${TEXTBOX_SPRITE.sheetHeight * scale}px`,
      backgroundPosition: `-${TEXTBOX_SPRITE.panelX * scale}px -${TEXTBOX_SPRITE.panelY * scale}px`
    }}
  >
    <div className="compact-textbox-content">
      <strong>{reminder.title}</strong>
      {reminder.description && <span>{reminder.description}</span>}
      <div className="overlay-actions">
<button aria-label="Dismiss reminder" onClick={() => onAction('dismiss')}>Dismiss</button>
        <button className="bubble-primary" aria-label="Complete reminder" onClick={() => onAction('complete')}>Done</button>
      </div>
    </div>
  </div>
}

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayReminder | null>(null)
  const [clock, setClock] = useState(() => Date.now())
  const [reducedMotion, setReducedMotion] = useState(false)
  const [animationFinished, setAnimationFinished] = useState(false)
  const completedPayloadId = useRef<string | null>(null)
  const autoDismissTimer = useRef<number>(0)
  const overlayWindow = window
  const animation = DEFAULT_CAT_ANIMATIONS.running
  const intensity = payload?.animationIntensity ?? 'medium'
  const fps = intensityFps[intensity]

  useEffect(() => {
    const dispose = overlayWindow.catOverlay.onShow((nextPayload) => {
      completedPayloadId.current = null
      setAnimationFinished(false)
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
    const tick = () => {
      const now = Date.now()
      const elapsed = now - startedAt
      setClock(now)
      if (elapsed < CAT_TRAVEL_DURATION_MS) frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    const completionTimer = window.setTimeout(() => setClock(Date.now()), Math.max(0, CAT_TRAVEL_DURATION_MS - (Date.now() - startedAt) + 16))
    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(completionTimer)
    }
  }, [payload, reducedMotion])

  const elapsed = payload ? clock - (payload.animationStartedAt ?? Date.parse(payload.queuedAt)) : 0
  const progress = traversalProgress(elapsed)
  const catLeft = traversalPositionPercent(progress)
  const sceneLeft = animationFinished ? 86 : catLeft
  const frame = Math.floor((Math.max(0, elapsed) / 1000) * fps)
  const spriteStyle = useMemo(() => ({
    backgroundImage: `url(${assetUrl(animation.src, payload?.assetBaseUrl)})`,
    backgroundPosition: spriteOffset(animation, frame),
    backgroundSize: `${animation.frameWidth * animation.frameCount * animation.scale}px ${animation.frameHeight * animation.scale}px`,
    width: animation.frameWidth * animation.scale,
    height: animation.frameHeight * animation.scale,
    imageRendering: animation.imageRendering
  }), [animation, frame, payload?.assetBaseUrl])

  const dismissCurrent = useCallback(() => {
    if (!payload) return
    window.clearTimeout(autoDismissTimer.current)
    overlayWindow.catOverlay.action(payload.reminder.id, 'dismiss')
  }, [overlayWindow.catOverlay, payload])

  const handleAction = useCallback((action: 'snooze' | 'dismiss' | 'complete') => {
    window.clearTimeout(autoDismissTimer.current)
    overlayWindow.catOverlay.action(payload!.reminder.id, action)
  }, [overlayWindow.catOverlay, payload])

  useEffect(() => {
    if (!payload || progress < 1 || completedPayloadId.current === payload.reminder.id) return
    completedPayloadId.current = payload.reminder.id
    setAnimationFinished(true)
    overlayWindow.catOverlay.animationComplete(payload.reminder.id)
    const timer = window.setTimeout(() => dismissCurrent(), AUTO_DISMISS_MS)
    autoDismissTimer.current = timer
    return () => window.clearTimeout(timer)
  }, [overlayWindow.catOverlay, payload, progress, dismissCurrent])

  if (!payload) return null
  return <div className={`overlay-stage${reducedMotion ? ' reduced-motion' : ''}`}>
    <div
      className="cat-scene"
      style={{ left: `${sceneLeft}%`, width: BUBBLE_WIDTH, height: CAT_HEIGHT + BUBBLE_HEIGHT + BUBBLE_GAP }}
    >
      <Textbox
        reminder={payload.reminder}
        assetBaseUrl={payload.assetBaseUrl}
        onAction={handleAction}
      />
      {!animationFinished && <div className="cat-sprite" aria-hidden="true" style={spriteStyle} />}
    </div>
  </div>
}
