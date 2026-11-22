import { useEffect, useState, type RefObject } from 'react'

export type WebcamStatus =
  | { state: 'starting' }
  | { state: 'ready'; width: number; height: number }
  | { state: 'error'; message: string }

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
        return 'Camera permission was denied. Allow camera access in your browser and reload.'
      case 'NotFoundError':
        return 'No camera found. Plug in a webcam and reload.'
      case 'NotReadableError':
        return 'Your camera is being used by another app. Close it and reload.'
    }
  }
  return `Could not start the camera: ${err instanceof Error ? err.message : String(err)}`
}

/** Starts the front camera and attaches it to the given <video> element. */
export function useWebcam(videoRef: RefObject<HTMLVideoElement | null>): WebcamStatus {
  const [status, setStatus] = useState<WebcamStatus>({ state: 'starting' })

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({ state: 'error', message: 'This browser does not support camera access (HTTPS is required).' })
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        })
        const video = videoRef.current
        if (cancelled || !video) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        video.srcObject = stream
        await video.play()
        if (!cancelled) setStatus({ state: 'ready', width: video.videoWidth, height: video.videoHeight })
      } catch (err) {
        if (!cancelled) setStatus({ state: 'error', message: describeError(err) })
      }
    }

    void start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [videoRef])

  return status
}
