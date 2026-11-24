import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CameraView } from '../components/CameraView'
import { ClipPreview } from '../components/ClipPreview'
import { FramingOverlay } from '../components/FramingOverlay'
import { ACTIONS, IDLE_ID, getAction, type ActionId } from '../config/actions'
import { buildClip, clipSamples, countByAction, deleteClip, saveClip } from '../data/clips'
import { db, type StoredClip } from '../data/db'
import { downloadJson, exportAllClips, fromExport, importClips } from '../data/exportImport'
import { missingFraction, type PoseSample } from '../ml/clip'
import { samplesToModelClip } from '../ml/pipeline'
import { useFraming } from '../pose/useFraming'
import type { PoseFrame } from '../pose/usePoseTracking'

/** Seed-data targets per action. Idle is varied (thinking, fidgeting, resting), so it needs more examples. */
const TARGET = 10
const IDLE_TARGET = 20
const targetFor = (id: ActionId) => (id === IDLE_ID ? IDLE_TARGET : TARGET)

const DURATIONS_S = [2, 3, 4, 5]
const COUNTDOWN_S = 3
/** Fewer real frames than this means I basically didn't see the player. */
const MIN_SAMPLES = 10
const MISSING_WARNING = 0.35

type Phase =
  | { kind: 'ready' }
  | { kind: 'countdown'; remaining: number }
  | { kind: 'recording' }
  | { kind: 'review'; clip: StoredClip }

interface Recording {
  startT: number | null
  samples: PoseSample[]
  aspect: number
}

/**
 * Dev-only screen at /record for building the seed dataset.
 * Space = record, Enter = keep, Backspace = discard, Esc = cancel countdown.
 */
export function RecordScreen() {
  const { framing, updateFraming } = useFraming()
  const [selected, setSelected] = useState<ActionId>(ACTIONS[0]!.id)
  const [durationS, setDurationS] = useState(3)
  const [phase, setPhaseState] = useState<Phase>({ kind: 'ready' })
  const [message, setMessage] = useState<string | null>(null)
  const [replay, setReplay] = useState<StoredClip | null>(null)

  // The pose loop reads these on every frame, so they live in refs as well as state.
  const phaseRef = useRef<Phase>(phase)
  const recording = useRef<Recording>({ startT: null, samples: [], aspect: 16 / 9 })
  const aspectRef = useRef(16 / 9)
  const settingsRef = useRef({ selected, durationS, mode: framing.mode })
  useEffect(() => {
    settingsRef.current = { selected, durationS, mode: framing.mode }
  }, [selected, durationS, framing.mode])

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }, [])

  const counts = useLiveQuery(countByAction, [], new Map<ActionId, number>())
  const clipsForAction = useLiveQuery(
    async () => (await db.clips.where('actionId').equals(selected).toArray()).sort((a, b) => b.createdAt - a.createdAt),
    [selected],
    [],
  )
  const total = useMemo(() => [...counts.values()].reduce((a, b) => a + b, 0), [counts])

  const finishRecording = useCallback(() => {
    const { samples, aspect } = recording.current
    const { selected, mode } = settingsRef.current
    if (samples.length < MIN_SAMPLES) {
      setMessage("I couldn't see you during that recording. Check the framing and try again.")
      setPhase({ kind: 'ready' })
      return
    }
    const clip = buildClip({ actionId: selected, source: 'seed', framingMode: mode, aspect, samples })
    setPhase({ kind: 'review', clip })
  }, [setPhase])

  const handleFrame = useCallback(
    ({ landmarks, timestamp, aspect }: PoseFrame) => {
      updateFraming(landmarks, aspect, timestamp)
      aspectRef.current = aspect
      if (phaseRef.current.kind !== 'recording') return

      const rec = recording.current
      rec.startT ??= timestamp
      rec.aspect = aspect
      if (landmarks) rec.samples.push({ t: timestamp, landmarks })
      if (timestamp - rec.startT >= settingsRef.current.durationS * 1000) finishRecording()
    },
    [updateFraming, finishRecording],
  )

  // Countdown ticks, then hands over to the frame loop.
  useEffect(() => {
    if (phase.kind !== 'countdown') return
    const id = setTimeout(() => {
      if (phase.remaining > 1) {
        setPhase({ kind: 'countdown', remaining: phase.remaining - 1 })
      } else {
        recording.current = { startT: null, samples: [], aspect: aspectRef.current }
        setPhase({ kind: 'recording' })
      }
    }, 1000)
    return () => clearTimeout(id)
  }, [phase, setPhase])

  const canStart = phase.kind === 'ready' && !framing.current.issues.includes('no_person')

  const start = useCallback(() => {
    if (phaseRef.current.kind !== 'ready') return
    setMessage(null)
    setReplay(null)
    setPhase({ kind: 'countdown', remaining: COUNTDOWN_S })
  }, [setPhase])

  const keep = useCallback(async () => {
    const p = phaseRef.current
    if (p.kind !== 'review') return
    await saveClip(p.clip)
    setPhase({ kind: 'ready' })
    setMessage(`Saved ${getAction(p.clip.actionId).prompt}.`)
  }, [setPhase])

  const discard = useCallback(() => {
    if (phaseRef.current.kind !== 'review') return
    setPhase({ kind: 'ready' })
    setMessage('Discarded.')
  }, [setPhase])

  const cancel = useCallback(() => {
    if (phaseRef.current.kind === 'countdown') setPhase({ kind: 'ready' })
  }, [setPhase])

  // Keyboard shortcuts, so a whole batch can be recorded without the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      if (e.key === ' ') {
        e.preventDefault()
        if (canStart) start()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        void keep()
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (phaseRef.current.kind === 'review') e.preventDefault()
        discard()
      } else if (e.key === 'Escape') {
        cancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canStart, start, keep, discard, cancel])

  // Whatever is in the preview: the clip under review, or a stored clip being replayed.
  const previewClip = phase.kind === 'review' ? phase.clip : replay
  const preview = useMemo(() => {
    if (!previewClip) return null
    const model = samplesToModelClip(clipSamples(previewClip), previewClip.aspect)
    const missing = model ? missingFraction(model.clip) : 1
    const label = `${(previewClip.durationMs / 1000).toFixed(1)} s · ${previewClip.frameCount} frames @ ${previewClip.captureFps.toFixed(0)} fps · ${previewClip.framingMode} · ${(missing * 100).toFixed(0)}% missing`
    return { model, missing, label, clip: previewClip }
  }, [previewClip])

  const action = getAction(selected)
  const busy = phase.kind === 'countdown' || phase.kind === 'recording'

  async function handleExport() {
    const data = await exportAllClips()
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
    downloadJson(data, `mimemind-clips-${stamp}.json`)
    setMessage(`Exported ${data.clips.length} clips.`)
  }

  async function handleImport(file: File) {
    try {
      const clips = fromExport(JSON.parse(await file.text()))
      const { added, skipped } = await importClips(clips)
      setMessage(`Imported ${added} clips${skipped ? ` (${skipped} already here)` : ''}.`)
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <main className="screen screen--wide">
      <header className="screen__header">
        <h1 className="logo logo--small">
          Mime<span>Mind</span> <small>record mode</small>
        </h1>
      </header>

      <div className="record">
        <section className="record__main">
          <CameraView onFrame={handleFrame}>
            {({ webcam, pose }) => {
              if (webcam.state === 'error') return <p className="notice notice--error">{webcam.message}</p>
              if (webcam.state === 'starting' || pose.state === 'loading') return <p className="notice">Starting up…</p>
              if (pose.state === 'error') return <p className="notice notice--error">{pose.message}</p>
              return (
                <>
                  {phase.kind === 'ready' && <FramingOverlay framing={framing} />}
                  {phase.kind === 'countdown' && <p className="countdown">{phase.remaining}</p>}
                  {phase.kind === 'recording' && (
                    <>
                      <span className="rec-badge">● REC</span>
                      <div className="rec-progress">
                        <div style={{ animationDuration: `${durationS}s` }} />
                      </div>
                    </>
                  )}
                </>
              )
            }}
          </CameraView>

          <div className="record__controls">
            <div className="record__prompt">
              <strong>{action.prompt}</strong>
              <span>{action.hint}</span>
            </div>
            <label className="record__duration">
              Length
              <select value={durationS} onChange={(e) => setDurationS(Number(e.target.value))} disabled={busy}>
                {DURATIONS_S.map((s) => (
                  <option key={s} value={s}>
                    {s} s
                  </option>
                ))}
              </select>
            </label>
            {phase.kind === 'review' ? (
              <>
                <button className="btn btn--primary" onClick={() => void keep()} disabled={!preview?.model}>
                  Keep <kbd>Enter</kbd>
                </button>
                <button className="btn" onClick={discard}>
                  Discard <kbd>⌫</kbd>
                </button>
              </>
            ) : (
              <button className="btn btn--primary" onClick={start} disabled={!canStart}>
                {busy ? 'Recording…' : 'Record'} <kbd>Space</kbd>
              </button>
            )}
          </div>
          {message && <p className="record__message">{message}</p>}

          {preview && (
            <div className="record__preview">
              <ClipPreview clip={preview.model?.clip ?? null} label={preview.label} />
              {!preview.model && <p className="warn">No shoulders seen in this clip, so it can't be used.</p>}
              {preview.model && preview.missing > MISSING_WARNING && (
                <p className="warn">Lots of joints were missing. Consider re-recording with better framing.</p>
              )}
              {phase.kind !== 'review' && (
                <button className="btn btn--small" onClick={() => setReplay(null)}>
                  Close replay
                </button>
              )}
            </div>
          )}
        </section>

        <aside className="record__side">
          <h2>
            Actions <span className="muted">{total} clips</span>
          </h2>
          <ul className="action-list">
            {ACTIONS.map((a) => {
              const n = counts.get(a.id) ?? 0
              const target = targetFor(a.id)
              return (
                <li key={a.id}>
                  <button
                    className={`action-item${a.id === selected ? ' action-item--selected' : ''}${n >= target ? ' action-item--done' : ''}`}
                    onClick={() => {
                      setSelected(a.id)
                      setReplay(null)
                    }}
                    disabled={busy || phase.kind === 'review'}
                  >
                    <span>{a.prompt}</span>
                    <span className="action-item__count">
                      {n}/{target}
                    </span>
                    <span className="action-item__bar" style={{ width: `${Math.min(1, n / target) * 100}%` }} />
                  </button>
                </li>
              )
            })}
          </ul>

          <h2>
            {action.prompt} <span className="muted">{clipsForAction.length} clips</span>
          </h2>
          <ul className="clip-list">
            {clipsForAction.map((c) => (
              <li key={c.id}>
                <span>
                  {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  <span className="muted">
                    {' '}
                    · {(c.durationMs / 1000).toFixed(1)} s · {c.captureFps.toFixed(0)} fps · {c.framingMode}
                  </span>
                </span>
                <span className="clip-list__actions">
                  <button className="btn btn--small" onClick={() => setReplay(c)} disabled={busy || phase.kind === 'review'}>
                    Replay
                  </button>
                  <button
                    className="btn btn--small btn--danger"
                    onClick={() => {
                      if (replay?.id === c.id) setReplay(null)
                      void deleteClip(c.id)
                    }}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <h2>Data</h2>
          <p className="muted small">
            Clips are stored in this browser only. Each site (localhost, the live site) has its own storage, so export a
            file to back up or move them.
          </p>
          <div className="data-actions">
            <button className="btn btn--small" onClick={() => void handleExport()} disabled={total === 0}>
              Export JSON
            </button>
            <label className="btn btn--small">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleImport(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </aside>
      </div>
    </main>
  )
}
