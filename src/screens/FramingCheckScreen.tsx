import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraView } from '../components/CameraView'
import { FramingOverlay } from '../components/FramingOverlay'
import { SAMPLE_HZ, WINDOW_FRAMES, WINDOW_MS } from '../config/pipeline'
import { missingFraction } from '../ml/clip'
import { drawNormalisedClip } from '../ml/drawClip'
import { normaliseClip } from '../ml/normalise'
import { latestWindow } from '../ml/resample'
import { UPPER_BODY } from '../pose/landmarks'
import { PoseBuffer } from '../pose/poseBuffer'
import { useFraming } from '../pose/useFraming'
import type { PoseFrame } from '../pose/usePoseTracking'

/**
 * Milestone 1 screen: framing check plus a debug view of the model input.
 * The framing part becomes step 1 of calibration later.
 */
export function FramingCheckScreen() {
  const { framing, updateFraming } = useFraming()
  const bufferRef = useRef(new PoseBuffer())
  const debugCanvasRef = useRef<HTMLCanvasElement>(null)
  const [showDebug, setShowDebug] = useState(false)
  const showDebugRef = useRef(showDebug)
  useEffect(() => {
    showDebugRef.current = showDebug
  }, [showDebug])

  const handleFrame = useCallback(
    ({ landmarks, timestamp, aspect }: PoseFrame) => {
      updateFraming(landmarks, aspect, timestamp)
      const buffer = bufferRef.current
      if (landmarks) buffer.push({ t: timestamp, landmarks })

      const ctx = showDebugRef.current ? debugCanvasRef.current?.getContext('2d') : null
      if (!ctx) return

      try {
        const raw = latestWindow(buffer.all, {
          joints: UPPER_BODY,
          aspect,
          endT: timestamp,
          frameCount: WINDOW_FRAMES,
          hz: SAMPLE_HZ,
        })
        const normalised = normaliseClip(raw)
        const realFrames = buffer.countSince(timestamp - WINDOW_MS)
        const label = normalised
          ? `${realFrames} camera frames → ${WINDOW_FRAMES} @ ${SAMPLE_HZ} Hz · ${(missingFraction(normalised.clip) * 100).toFixed(0)}% missing`
          : 'No shoulders in the last 2 s'
        drawNormalisedClip(ctx, normalised?.clip ?? null, label)
      } catch (err) {
        // Show the error on the debug canvas itself so it's visible without devtools.
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.fillStyle = '#ff7a8a'
        ctx.font = '12px ui-monospace, Consolas, monospace'
        const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        text.match(/.{1,60}/g)?.forEach((line, i) => ctx.fillText(line, 10, 24 + i * 16))
        throw err
      }
    },
    [updateFraming],
  )

  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="logo">
          Mime<span>Mind</span>
        </h1>
        <p className="tagline">Act it out. I'll read your mind.</p>
      </header>

      <CameraView onFrame={handleFrame}>
        {({ webcam, pose, stats }) => {
          if (webcam.state === 'error') return <p className="notice notice--error">{webcam.message}</p>
          if (webcam.state === 'starting') return <p className="notice">Waking up your camera…</p>
          if (pose.state === 'error') return <p className="notice notice--error">{pose.message}</p>
          if (pose.state === 'loading') return <p className="notice">Tuning in to your movements…</p>
          return (
            <>
              <FramingOverlay framing={framing} />
              <dl className="stats" aria-label="Pose tracking stats">
                <div>
                  <dt>FPS</dt>
                  <dd>{stats.fps.toFixed(0)}</dd>
                </div>
                <div>
                  <dt>Pose</dt>
                  <dd>{stats.inferenceMs.toFixed(1)} ms</dd>
                </div>
                <div>
                  <dt>Backend</dt>
                  <dd>{pose.delegate}</dd>
                </div>
              </dl>
            </>
          )
        }}
      </CameraView>

      <section className="debug">
        <label className="debug__toggle">
          <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
          Show what the model sees (normalised, last 2 s)
        </label>
        {showDebug && (
          <>
            <canvas ref={debugCanvasRef} className="debug__canvas" width={480} height={360} />
            <p className="debug__help">
              Grid squares are one shoulder width. Lean towards and away from the camera and the skeleton should stay
              the same size. Purple lines are your wrists over the last 2 seconds.
            </p>
          </>
        )}
      </section>
    </main>
  )
}
