import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { PoseSample } from '../ml/clip'

/** Values stored per landmark: x, y, z, visibility. */
export const VALUES_PER_LANDMARK = 4
export const LANDMARK_COUNT = 33
const FRAME_STRIDE = LANDMARK_COUNT * VALUES_PER_LANDMARK

/**
 * Raw pose samples packed into flat typed arrays for storage.
 * `times` are ms relative to the first sample. `landmarks` holds
 * [frame][landmark][x, y, z, visibility].
 */
export interface PackedSamples {
  times: Float32Array
  landmarks: Float32Array
}

export function packSamples(samples: readonly PoseSample[]): PackedSamples {
  const t0 = samples[0]?.t ?? 0
  const times = new Float32Array(samples.length)
  const landmarks = new Float32Array(samples.length * FRAME_STRIDE)
  samples.forEach((s, f) => {
    times[f] = s.t - t0
    for (let j = 0; j < LANDMARK_COUNT; j++) {
      const lm = s.landmarks[j]
      const o = f * FRAME_STRIDE + j * VALUES_PER_LANDMARK
      landmarks[o] = lm?.x ?? 0
      landmarks[o + 1] = lm?.y ?? 0
      landmarks[o + 2] = lm?.z ?? 0
      landmarks[o + 3] = lm?.visibility ?? 0
    }
  })
  return { times, landmarks }
}

export function unpackSamples({ times, landmarks }: PackedSamples): PoseSample[] {
  const samples: PoseSample[] = []
  for (let f = 0; f < times.length; f++) {
    const lms: NormalizedLandmark[] = []
    for (let j = 0; j < LANDMARK_COUNT; j++) {
      const o = f * FRAME_STRIDE + j * VALUES_PER_LANDMARK
      lms.push({ x: landmarks[o]!, y: landmarks[o + 1]!, z: landmarks[o + 2]!, visibility: landmarks[o + 3]! })
    }
    samples.push({ t: times[f]!, landmarks: lms })
  }
  return samples
}
