import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { LM, VISIBILITY_THRESHOLD } from './landmarks'

export type FramingMode = 'sitting' | 'standing'

/** Problems that stop a round from starting. */
export type FramingIssue =
  | 'no_person'
  | 'no_head'
  | 'no_shoulders'
  | 'no_hands'
  | 'no_left_hand'
  | 'no_right_hand'
  | 'too_close'
  | 'too_far'

/** Worth fixing, but not blocking. */
export type FramingWarning = 'low_headroom'

export interface FramingResult {
  ok: boolean
  issues: FramingIssue[]
  warnings: FramingWarning[]
  mode: FramingMode
  /** Shoulder width as a fraction of frame height (0 if shoulders not seen). */
  shoulderWidth: number
}

/** Tuning knobs. Values are fractions of the frame (0–1). */
export const FRAMING = {
  /** A joint this close to the edge counts as out of frame. */
  edgeMargin: 0.02,
  /** Shoulder width (fraction of frame height) above this is too close. */
  maxShoulderWidth: 0.55,
  /** …and below this is too far. */
  minShoulderWidth: 0.1,
  /** Room needed above the shoulders for overhead moves, in shoulder widths. */
  headroomShoulderWidths: 1.2,
}

/**
 * The messages are spoken by the AI: always first person, never "MimeMind".
 * Left/right are the player's own. The view is mirrored, so they match what the player sees.
 */
export const FRAMING_MESSAGES: Record<FramingIssue | FramingWarning, string> = {
  no_person: "I can't see you. Step into the frame.",
  no_head: "I can't see your face. Move so your head is in the box.",
  no_shoulders: 'I need to see both shoulders. Centre yourself in the box.',
  no_hands: 'Show me your hands! Hold them up near your shoulders.',
  no_left_hand: "I can't see your left hand.",
  no_right_hand: "I can't see your right hand.",
  too_close: "You're a bit close. Lean back for me.",
  too_far: "You're quite far away. Come a little closer.",
  low_headroom: "Lower your camera or move back a little. I'll lose your hands if you reach up.",
}

function inFrame(lm: NormalizedLandmark | undefined, margin = FRAMING.edgeMargin): lm is NormalizedLandmark {
  return (
    lm !== undefined &&
    (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD &&
    lm.x >= margin &&
    lm.x <= 1 - margin &&
    lm.y >= margin &&
    lm.y <= 1 - margin
  )
}

/** Standing if both hips and at least one knee are in frame; otherwise sitting (chest-up framing). */
export function detectMode(landmarks: NormalizedLandmark[]): FramingMode {
  const hips = inFrame(landmarks[LM.leftHip]) && inFrame(landmarks[LM.rightHip])
  const knee = inFrame(landmarks[LM.leftKnee]) || inFrame(landmarks[LM.rightKnee])
  return hips && knee ? 'standing' : 'sitting'
}

/**
 * Checks one frame: is the player positioned so I can read their movements?
 * `aspect` is video width / height, so shoulder width is measured in true proportions.
 */
export function assessFraming(landmarks: NormalizedLandmark[] | null, aspect: number): FramingResult {
  if (!landmarks) return { ok: false, issues: ['no_person'], warnings: [], mode: 'sitting', shoulderWidth: 0 }

  const issues: FramingIssue[] = []
  const warnings: FramingWarning[] = []
  const mode = detectMode(landmarks)

  if (!inFrame(landmarks[LM.nose])) issues.push('no_head')

  const ls = landmarks[LM.leftShoulder]
  const rs = landmarks[LM.rightShoulder]
  let shoulderWidth = 0
  if (inFrame(ls) && inFrame(rs)) {
    shoulderWidth = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y)
    if (shoulderWidth > FRAMING.maxShoulderWidth) issues.push('too_close')
    else if (shoulderWidth < FRAMING.minShoulderWidth) issues.push('too_far')

    const shoulderY = (ls.y + rs.y) / 2
    if (shoulderY - FRAMING.headroomShoulderWidths * shoulderWidth < 0) warnings.push('low_headroom')
  } else {
    issues.push('no_shoulders')
  }

  const left = inFrame(landmarks[LM.leftWrist])
  const right = inFrame(landmarks[LM.rightWrist])
  if (!left && !right) issues.push('no_hands')
  else if (!left) issues.push('no_left_hand')
  else if (!right) issues.push('no_right_hand')

  return { ok: issues.length === 0, issues, warnings, mode, shoulderWidth }
}
