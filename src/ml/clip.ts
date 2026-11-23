import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/** One real camera frame from MediaPipe, as captured. */
export interface PoseSample {
  /** Capture time in ms (performance.now()). */
  t: number
  /** All 33 landmarks in normalised image coordinates [0, 1]. */
  landmarks: NormalizedLandmark[]
}

/**
 * A fixed-rate sequence of selected joints: the shape every model consumes.
 *
 * Stored as flat typed arrays so it maps directly onto a [frames, joints, 2]
 * tensor later:
 *   xy[(f * joints.length + j) * 2 + 0] = x of joint j in frame f
 *   xy[(f * joints.length + j) * 2 + 1] = y
 *   mask[f * joints.length + j]        = 1 if that joint was seen, else 0
 *
 * Missing joints have xy = 0 and mask = 0. Never trust xy without the mask.
 */
export interface Clip {
  hz: number
  frameCount: number
  /** MediaPipe landmark indices, in feature order. */
  joints: readonly number[]
  xy: Float32Array
  mask: Uint8Array
}

export function emptyClip(hz: number, frameCount: number, joints: readonly number[]): Clip {
  return {
    hz,
    frameCount,
    joints,
    xy: new Float32Array(frameCount * joints.length * 2),
    mask: new Uint8Array(frameCount * joints.length),
  }
}

/** Fraction of joint slots that are missing (0 = everything seen, 1 = nothing). */
export function missingFraction(clip: Clip): number {
  if (clip.mask.length === 0) return 1
  let seen = 0
  for (const m of clip.mask) seen += m
  return 1 - seen / clip.mask.length
}
