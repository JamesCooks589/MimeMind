import { useEffect, useRef, useState, type RefObject } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { loadPoseLandmarker, type Delegate } from './poseLandmarker'

export type PoseModelStatus =
  | { state: 'loading' }
  | { state: 'ready'; delegate: Delegate }
  | { state: 'error'; message: string }

export interface PoseFrame {
  /** Normalised [0, 1] image coordinates, or null if no person was found. */
  landmarks: NormalizedLandmark[] | null
  /** performance.now() timestamp of the video frame. */
  timestamp: number
}

export interface PoseStats {
  /** Pose detections per second (roughly the webcam frame rate). */
  fps: number
  /** Average time one detection takes, in ms. */
  inferenceMs: number
  personDetected: boolean
}

interface Options {
  /** Whether the video element is playing and ready to be read. */
  enabled: boolean
  /** Called once per processed video frame. Keep it cheap: it runs inside the render loop. */
  onFrame?: (frame: PoseFrame) => void
}

/**
 * Runs MediaPipe Pose on every new webcam frame in a requestAnimationFrame loop.
 * Per-frame results go to `onFrame` instead of React state, so the 30 fps
 * loop doesn't re-render the UI. Stats update twice a second.
 */
export function usePoseTracking(videoRef: RefObject<HTMLVideoElement | null>, { enabled, onFrame }: Options) {
  const [status, setStatus] = useState<PoseModelStatus>({ state: 'loading' })
  const [stats, setStats] = useState<PoseStats>({ fps: 0, inferenceMs: 0, personDetected: false })

  const onFrameRef = useRef(onFrame)
  useEffect(() => {
    onFrameRef.current = onFrame
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let rafId = 0
    let close: (() => void) | null = null

    void (async () => {
      let loaded
      try {
        loaded = await loadPoseLandmarker()
      } catch (err) {
        if (!cancelled) setStatus({ state: 'error', message: `Could not load the pose model: ${String(err)}` })
        return
      }
      const { landmarker, delegate } = loaded
      close = () => landmarker.close()
      if (cancelled) {
        close()
        return
      }
      setStatus({ state: 'ready', delegate })

      let lastVideoTime = -1
      let lastTimestamp = 0
      let frames = 0
      let inferenceTotal = 0
      let windowStart = performance.now()
      let personDetected = false

      const loop = () => {
        rafId = requestAnimationFrame(loop)
        const video = videoRef.current
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
        // rAF runs at display rate (often 60+ Hz); only process genuinely new camera frames.
        if (video.currentTime === lastVideoTime) return
        lastVideoTime = video.currentTime

        // MediaPipe requires strictly increasing timestamps.
        const timestamp = Math.max(performance.now(), lastTimestamp + 1)
        lastTimestamp = timestamp

        const t0 = performance.now()
        const result = landmarker.detectForVideo(video, timestamp)
        inferenceTotal += performance.now() - t0
        frames++

        const landmarks = result.landmarks[0] ?? null
        personDetected = landmarks !== null
        onFrameRef.current?.({ landmarks, timestamp })

        const elapsed = timestamp - windowStart
        if (elapsed >= 500) {
          setStats({ fps: (frames * 1000) / elapsed, inferenceMs: inferenceTotal / frames, personDetected })
          frames = 0
          inferenceTotal = 0
          windowStart = timestamp
        }
      }
      rafId = requestAnimationFrame(loop)
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      close?.()
    }
  }, [enabled, videoRef])

  return { status, stats }
}
