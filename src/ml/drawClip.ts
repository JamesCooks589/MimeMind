import { PoseLandmarker } from '@mediapipe/tasks-vision'
import { LM } from '../pose/landmarks'
import type { Clip } from './clip'

const TRAIL_JOINTS = [LM.leftWrist, LM.rightWrist]

/**
 * Debug view of a normalised clip: what the model will actually "see".
 * Draws the last frame's skeleton plus wrist trails across the whole window,
 * in shoulder-width units, mirrored to match the selfie camera view.
 */
export function drawNormalisedClip(ctx: CanvasRenderingContext2D, clip: Clip | null, label: string): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  // Shoulder widths visible across the canvas: ±3 horizontally.
  const unit = width / 6
  const toX = (x: number) => width / 2 - x * unit // minus = mirrored
  const toY = (y: number) => height * 0.4 + y * unit

  // Grid: one line per shoulder width.
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let g = -6; g <= 6; g++) {
    ctx.moveTo(toX(g), 0)
    ctx.lineTo(toX(g), height)
    ctx.moveTo(0, toY(g))
    ctx.lineTo(width, toY(g))
  }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.moveTo(toX(0), 0)
  ctx.lineTo(toX(0), height)
  ctx.moveTo(0, toY(0))
  ctx.lineTo(width, toY(0))
  ctx.stroke()

  ctx.fillStyle = 'rgba(236,233,255,0.7)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(label, 10, height - 10)

  if (!clip) return

  const J = clip.joints.length
  const slot = new Map(clip.joints.map((lm, j) => [lm, j]))
  const point = (f: number, lm: number): [number, number] | null => {
    const j = slot.get(lm)
    if (j === undefined) return null
    const i = f * J + j
    if (!clip.mask[i]) return null
    return [toX(clip.xy[i * 2]!), toY(clip.xy[i * 2 + 1]!)]
  }

  // Wrist trails: older = fainter.
  for (const lm of TRAIL_JOINTS) {
    for (let f = 1; f < clip.frameCount; f++) {
      const a = point(f - 1, lm)
      const b = point(f, lm)
      if (!a || !b) continue
      ctx.strokeStyle = `rgba(180,140,255,${(0.1 + 0.8 * (f / clip.frameCount)).toFixed(2)})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
    }
  }

  // Latest frame skeleton.
  const last = clip.frameCount - 1
  ctx.strokeStyle = 'rgba(124,243,208,0.8)'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
    const a = point(last, start)
    const b = point(last, end)
    if (!a || !b) continue
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
  }
  ctx.stroke()
  ctx.fillStyle = '#7cf3d0'
  for (const lm of clip.joints) {
    const p = point(last, lm)
    if (!p) continue
    ctx.beginPath()
    ctx.arc(p[0], p[1], 4, 0, Math.PI * 2)
    ctx.fill()
  }
}
