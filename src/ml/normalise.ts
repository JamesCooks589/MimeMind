import { LM } from '../pose/landmarks'
import { emptyClip, type Clip } from './clip'

export interface NormaliseInfo {
  /** Median mid-shoulder point of the window, in input units. */
  centre: { x: number; y: number }
  /** Median shoulder width of the window, in input units. */
  scale: number
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Makes a clip independent of where the player is in the frame and how far
 * from the camera they are.
 *
 * Every point becomes (point − centre) / scale, where centre is the
 * mid-shoulder point and scale is the shoulder width. Afterwards the shoulders
 * sit near (±0.5, 0), and a hand at x = 2 is "two shoulder-widths to the side",
 * whoever is playing and however close they sit.
 *
 * Centre and scale are medians over the whole window, not per frame:
 * - Per-frame centring would erase torso movement (leaning back in rowing,
 *   ducking in boxing), which is useful signal.
 * - Turning sideways (archery, tennis) makes shoulders look narrower in 2D.
 *   A per-frame scale would then blow the arms up. The median ignores those frames.
 *
 * y points down (image convention). x is in the camera's view, not mirrored.
 *
 * Returns null if no frame in the window has both shoulders visible.
 */
export function normaliseClip(clip: Clip): { clip: Clip; info: NormaliseInfo } | null {
  const J = clip.joints.length
  const li = clip.joints.indexOf(LM.leftShoulder)
  const ri = clip.joints.indexOf(LM.rightShoulder)
  if (li < 0 || ri < 0) throw new Error('normaliseClip needs both shoulders in the joint list')

  const midX: number[] = []
  const midY: number[] = []
  const widths: number[] = []
  for (let f = 0; f < clip.frameCount; f++) {
    const l = f * J + li
    const r = f * J + ri
    if (!clip.mask[l] || !clip.mask[r]) continue
    const lx = clip.xy[l * 2]!
    const ly = clip.xy[l * 2 + 1]!
    const rx = clip.xy[r * 2]!
    const ry = clip.xy[r * 2 + 1]!
    midX.push((lx + rx) / 2)
    midY.push((ly + ry) / 2)
    widths.push(Math.hypot(lx - rx, ly - ry))
  }
  if (widths.length === 0) return null

  const centre = { x: median(midX), y: median(midY) }
  const scale = median(widths)
  if (!(scale > 1e-6)) return null

  const out = emptyClip(clip.hz, clip.frameCount, clip.joints)
  out.mask.set(clip.mask)
  for (let i = 0; i < clip.mask.length; i++) {
    if (!clip.mask[i]) continue
    out.xy[i * 2] = (clip.xy[i * 2]! - centre.x) / scale
    out.xy[i * 2 + 1] = (clip.xy[i * 2 + 1]! - centre.y) / scale
  }
  return { clip: out, info: { centre, scale } }
}
