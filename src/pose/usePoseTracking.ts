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
  /** Video width / height, needed to measure distances in true proportions. */
  aspect: number
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
 * Runs MediaPipe Pose once per new webcam frame (via requestVideoFrameCallback).
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
    let videoFrameId = 0
    let cancelLoop: (() => void) | null = null
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
      let lastErrorLog = -Infinity

      const process = (video: HTMLVideoElement) => {
        // MediaPipe requires strictly increasing timestamps.
        const timestamp = Math.max(performance.now(), lastTimestamp + 1)
        lastTimestamp = timestamp

        const t0 = performance.now()
        const result = landmarker.detectForVideo(video, timestamp)
        inferenceTotal += performance.now() - t0
        frames++

        const landmarks = result.landmarks[0] ?? null
        personDetected = landmarks !== null
        const aspect = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 16 / 9
        try {
          onFrameRef.current?.({ landmarks, timestamp, aspect })
        } catch (err) {
          // A bug in a frame consumer must never stop tracking. Log it (rate-limited) and carry on.
          if (timestamp - lastErrorLog > 2000) {
            console.error('[pose] onFrame handler threw', err)
            lastErrorLog = timestamp
          }
        }

        const elapsed = timestamp - windowStart
        if (elapsed >= 500) {
          setStats({ fps: (frames * 1000) / elapsed, inferenceMs: inferenceTotal / frames, personDetected })
          frames = 0
          inferenceTotal = 0
          windowStart = timestamp
        }
      }

      const video = videoRef.current
      if (!video || cancelled) return

      // TS's DOM types assume this API always exists; check at runtime for older browsers.
      const supportsVideoFrameCallback = typeof (video as Partial<HTMLVideoElement>).requestVideoFrameCallback === 'function'
      if (supportsVideoFrameCallback) {
        // Preferred: fires exactly once per new camera frame (~30 Hz), whatever the display refresh rate.
        const onVideoFrame = () => {
          if (cancelled) return
          // Schedule the next frame first, so an error in this one can't end the loop.
          videoFrameId = video.requestVideoFrameCallback(onVideoFrame)
          process(video)
        }
        videoFrameId = video.requestVideoFrameCallback(onVideoFrame)
        cancelLoop = () => video.cancelVideoFrameCallback(videoFrameId)
      } else {
        // Fallback: rAF runs at display rate (60–165 Hz), so skip ticks where the frame hasn't changed.
        // Some browsers advance currentTime continuously for live streams, so this can over-count.
        const onAnimationFrame = () => {
          if (cancelled) return
          rafId = requestAnimationFrame(onAnimationFrame)
          if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
          if (video.currentTime === lastVideoTime) return
          lastVideoTime = video.currentTime
          process(video)
        }
        rafId = requestAnimationFrame(onAnimationFrame)
        cancelLoop = () => cancelAnimationFrame(rafId)
      }
    })()

    return () => {
      cancelled = true
      cancelLoop?.()
      close?.()
    }
  }, [enabled, videoRef])

  return { status, stats }
}
