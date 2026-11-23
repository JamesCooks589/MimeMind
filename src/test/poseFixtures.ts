import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { LM } from '../pose/landmarks'

type Point = { x: number; y: number; visibility?: number }

/** 33 landmarks, all invisible except the ones given. */
export function makeLandmarks(points: Partial<Record<keyof typeof LM, Point>>): NormalizedLandmark[] {
  const out: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
  for (const [name, p] of Object.entries(points)) {
    out[LM[name as keyof typeof LM]] = { x: p.x, y: p.y, z: 0, visibility: p.visibility ?? 1 }
  }
  return out
}

/** A typical seated player, chest-up, hands raised near the shoulders. */
export function seatedPlayer(offset = { x: 0, y: 0 }, size = 1): NormalizedLandmark[] {
  const p = (x: number, y: number): Point => ({ x: 0.5 + (x - 0.5) * size + offset.x, y: 0.5 + (y - 0.5) * size + offset.y })
  return makeLandmarks({
    nose: p(0.5, 0.3),
    leftEar: p(0.55, 0.28),
    rightEar: p(0.45, 0.28),
    leftShoulder: p(0.6, 0.55),
    rightShoulder: p(0.4, 0.55),
    leftElbow: p(0.68, 0.75),
    rightElbow: p(0.32, 0.75),
    leftWrist: p(0.66, 0.5),
    rightWrist: p(0.34, 0.5),
  })
}

/** A standing player, full body visible and small in frame. */
export function standingPlayer(): NormalizedLandmark[] {
  return makeLandmarks({
    nose: { x: 0.5, y: 0.15 },
    leftShoulder: { x: 0.54, y: 0.28 },
    rightShoulder: { x: 0.46, y: 0.28 },
    leftWrist: { x: 0.58, y: 0.5 },
    rightWrist: { x: 0.42, y: 0.5 },
    leftHip: { x: 0.53, y: 0.55 },
    rightHip: { x: 0.47, y: 0.55 },
    leftKnee: { x: 0.53, y: 0.75 },
    rightKnee: { x: 0.47, y: 0.75 },
  })
}
