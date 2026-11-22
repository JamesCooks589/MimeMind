import { PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { UPPER_BODY, VISIBILITY_THRESHOLD } from './landmarks'

const UPPER_BODY_SET: ReadonlySet<number> = new Set(UPPER_BODY)

const COLORS = {
  feature: '#7cf3d0', // joints used as model features
  other: 'rgba(255, 255, 255, 0.55)',
  bone: 'rgba(124, 243, 208, 0.75)',
}

function isVisible(lm: NormalizedLandmark | undefined): lm is NormalizedLandmark {
  return lm !== undefined && (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD
}

/**
 * Draws one pose onto a canvas whose pixel size matches the video.
 * Joints below the visibility threshold are skipped, so legs disappear
 * when sitting, just as the model will treat them as missing.
 */
export function drawSkeleton(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmark[]): void {
  const { width, height } = ctx.canvas
  const scale = Math.max(width, height) / 720

  ctx.lineWidth = 4 * scale
  ctx.lineCap = 'round'
  ctx.strokeStyle = COLORS.bone
  ctx.beginPath()
  for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
    const a = landmarks[start]
    const b = landmarks[end]
    if (!isVisible(a) || !isVisible(b)) continue
    ctx.moveTo(a.x * width, a.y * height)
    ctx.lineTo(b.x * width, b.y * height)
  }
  ctx.stroke()

  landmarks.forEach((lm, i) => {
    if (!isVisible(lm)) return
    const feature = UPPER_BODY_SET.has(i)
    ctx.fillStyle = feature ? COLORS.feature : COLORS.other
    ctx.beginPath()
    ctx.arc(lm.x * width, lm.y * height, (feature ? 6 : 4) * scale, 0, Math.PI * 2)
    ctx.fill()
  })
}
