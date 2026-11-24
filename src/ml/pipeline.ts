import { SAMPLE_HZ } from '../config/pipeline'
import { UPPER_BODY } from '../pose/landmarks'
import type { Clip, PoseSample } from './clip'
import { normaliseClip, type NormaliseInfo } from './normalise'
import { resample } from './resample'

/**
 * Raw samples → model input: resample the whole recording to SAMPLE_HZ,
 * then normalise it by body position and size.
 * Returns null if the shoulders were never visible.
 */
export function samplesToModelClip(
  samples: readonly PoseSample[],
  aspect: number,
): { clip: Clip; info: NormaliseInfo } | null {
  const first = samples[0]
  const last = samples[samples.length - 1]
  if (!first || !last) return null
  const frameCount = Math.floor(((last.t - first.t) * SAMPLE_HZ) / 1000) + 1
  const raw = resample(samples, { joints: UPPER_BODY, aspect, startT: first.t, frameCount, hz: SAMPLE_HZ })
  return normaliseClip(raw)
}
