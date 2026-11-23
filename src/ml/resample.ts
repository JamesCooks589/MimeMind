import { VISIBILITY_THRESHOLD } from '../pose/landmarks'
import { MAX_GAP_MS } from '../config/pipeline'
import { emptyClip, type Clip, type PoseSample } from './clip'

/** Times this close count as the same moment (absorbs floating-point drift). */
const EPSILON_MS = 1e-6

export interface ResampleOptions {
  /** MediaPipe landmark indices to keep, in feature order. */
  joints: readonly number[]
  /** Video width / height. MediaPipe's x is a fraction of width and y of height, so x is multiplied by this to give both axes the same units. */
  aspect: number
  /** Time of the first output frame (ms). */
  startT: number
  frameCount: number
  hz: number
  maxGapMs?: number
}

/**
 * Rebuilds pose samples at a fixed rate by linear interpolation.
 *
 * Why: webcams deliver anywhere from ~15 to 30 fps (and it changes with
 * lighting). Without this, a 2 s action is 30 frames on one camera and 60 on
 * another, so the model would see the same move at two different "speeds".
 *
 * A joint in an output frame is marked missing if it's outside the captured
 * time range, if either neighbouring real frame didn't see it, or if the
 * neighbours are more than `maxGapMs` apart (tracking was lost).
 *
 * `samples` must be sorted by time.
 */
export function resample(samples: readonly PoseSample[], opts: ResampleOptions): Clip {
  const { joints, aspect, startT, frameCount, hz, maxGapMs = MAX_GAP_MS } = opts
  const clip = emptyClip(hz, frameCount, joints)
  const J = joints.length
  const stepMs = 1000 / hz

  let k = 0 // index of the sample at or before the current output time
  for (let f = 0; f < frameCount; f++) {
    const T = startT + f * stepMs
    while (k + 1 < samples.length && samples[k + 1]!.t <= T + EPSILON_MS) k++

    const a = samples[k]
    if (!a || T < a.t - EPSILON_MS) continue // before the first sample
    // An output frame that lands on a real frame uses it directly, even next to a gap.
    const exact = Math.abs(T - a.t) <= EPSILON_MS
    const b = exact ? a : samples[k + 1]
    if (!b) continue // after the last sample
    if (b.t - a.t > maxGapMs) continue // tracking gap

    const alpha = b.t === a.t ? 0 : (T - a.t) / (b.t - a.t)
    for (let j = 0; j < J; j++) {
      const lmIndex = joints[j]!
      const la = a.landmarks[lmIndex]
      const lb = b.landmarks[lmIndex]
      if (!la || !lb) continue
      if ((la.visibility ?? 1) < VISIBILITY_THRESHOLD || (lb.visibility ?? 1) < VISIBILITY_THRESHOLD) continue

      const i = f * J + j
      clip.xy[i * 2] = (la.x + (lb.x - la.x) * alpha) * aspect
      clip.xy[i * 2 + 1] = la.y + (lb.y - la.y) * alpha
      clip.mask[i] = 1
    }
  }
  return clip
}

/** Resamples the `frameCount` frames ending at `endT` (usually the newest sample's time). */
export function latestWindow(
  samples: readonly PoseSample[],
  opts: Omit<ResampleOptions, 'startT'> & { endT: number },
): Clip {
  const startT = opts.endT - ((opts.frameCount - 1) * 1000) / opts.hz
  return resample(samples, { ...opts, startT })
}
