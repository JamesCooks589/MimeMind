import { useCallback, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { assessFraming, type FramingMode, type FramingResult } from './framing'

export interface FramingState {
  /** True once framing has been good continuously for `settleMs`. */
  ready: boolean
  /** Latest single-frame assessment (issues and warnings). */
  current: FramingResult
  /** Majority vote over recent frames, so one bad frame doesn't flip it. */
  mode: FramingMode
}

const SETTLE_MS = 500
const MODE_HISTORY = 30 // ~1 s of frames

const INITIAL: FramingState = {
  ready: false,
  current: { ok: false, issues: ['no_person'], warnings: [], mode: 'sitting', shoulderWidth: 0 },
  mode: 'sitting',
}

function sameState(a: FramingState, b: FramingState): boolean {
  return (
    a.ready === b.ready &&
    a.mode === b.mode &&
    a.current.ok === b.current.ok &&
    a.current.issues.join() === b.current.issues.join() &&
    a.current.warnings.join() === b.current.warnings.join()
  )
}

/**
 * Smooths per-frame framing checks over time so the UI doesn't flicker.
 * Call `update` on every pose frame. React state only changes when the visible result changes.
 */
export function useFraming() {
  const [state, setState] = useState<FramingState>(INITIAL)
  const okSince = useRef<number | null>(null)
  const modes = useRef<FramingMode[]>([])
  const last = useRef<FramingState>(INITIAL)

  const update = useCallback((landmarks: NormalizedLandmark[] | null, aspect: number, t: number) => {
    const current = assessFraming(landmarks, aspect)

    if (current.ok) okSince.current ??= t
    else okSince.current = null
    const ready = okSince.current !== null && t - okSince.current >= SETTLE_MS

    if (landmarks) {
      modes.current.push(current.mode)
      if (modes.current.length > MODE_HISTORY) modes.current.shift()
    }
    const standingVotes = modes.current.filter((m) => m === 'standing').length
    const mode: FramingMode = standingVotes > modes.current.length / 2 ? 'standing' : 'sitting'

    const next: FramingState = { ready, current, mode }
    if (!sameState(next, last.current)) {
      last.current = next
      setState(next)
    }
  }, [])

  return { framing: state, updateFraming: update }
}
