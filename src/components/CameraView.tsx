import { useCallback, useRef, type ReactNode } from 'react'
import { useWebcam } from '../pose/useWebcam'
import { usePoseTracking, type PoseFrame, type PoseModelStatus, type PoseStats } from '../pose/usePoseTracking'
import { drawSkeleton } from '../pose/drawSkeleton'
import type { WebcamStatus } from '../pose/useWebcam'

interface Props {
  /** Extra per-frame consumer (e.g. a recorder or classifier later on). */
  onFrame?: (frame: PoseFrame) => void
  /** Rendered as an overlay (status, prompts, etc.). Receives the current camera and pose state. */
  children?: (state: { webcam: WebcamStatus; pose: PoseModelStatus; stats: PoseStats }) => ReactNode
}

/**
 * Mirrored webcam feed with the live pose skeleton drawn on top.
 * Video and canvas share one mirrored container, so landmarks can be drawn
 * in raw camera coordinates and still line up with the picture.
 */
export function CameraView({ onFrame, children }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const webcam = useWebcam(videoRef)

  const handleFrame = useCallback(
    (frame: PoseFrame) => {
      const canvas = canvasRef.current
      const video = videoRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && video && ctx) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (frame.landmarks) drawSkeleton(ctx, frame.landmarks)
      }
      onFrame?.(frame)
    },
    [onFrame],
  )

  const { status: pose, stats } = usePoseTracking(videoRef, {
    enabled: webcam.state === 'ready',
    onFrame: handleFrame,
  })

  return (
    <div className="camera">
      <div className="camera__mirror">
        <video ref={videoRef} className="camera__video" playsInline muted />
        <canvas ref={canvasRef} className="camera__overlay" />
      </div>
      {children && <div className="camera__ui">{children({ webcam, pose, stats })}</div>}
    </div>
  )
}
