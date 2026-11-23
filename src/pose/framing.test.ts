import { describe, expect, it } from 'vitest'
import { makeLandmarks, seatedPlayer, standingPlayer } from '../test/poseFixtures'
import { assessFraming, detectMode } from './framing'
import { LM } from './landmarks'

describe('detectMode', () => {
  it('detects sitting when hips and knees are out of frame', () => {
    expect(detectMode(seatedPlayer())).toBe('sitting')
  })

  it('detects standing when hips and a knee are visible', () => {
    expect(detectMode(standingPlayer())).toBe('standing')
  })
})

describe('assessFraming', () => {
  it('accepts a well-framed seated player', () => {
    const result = assessFraming(seatedPlayer(), 1)
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('reports no person', () => {
    expect(assessFraming(null, 1).issues).toEqual(['no_person'])
  })

  it('asks for hands when both are missing, or names the missing one', () => {
    const noHands = seatedPlayer()
    noHands[LM.leftWrist] = { ...noHands[LM.leftWrist]!, visibility: 0 }
    noHands[LM.rightWrist] = { ...noHands[LM.rightWrist]!, y: 1.05 } // below the frame
    expect(assessFraming(noHands, 1).issues).toContain('no_hands')

    const noLeft = seatedPlayer()
    noLeft[LM.leftWrist] = { ...noLeft[LM.leftWrist]!, visibility: 0 }
    expect(assessFraming(noLeft, 1).issues).toEqual(['no_left_hand'])
  })

  it('flags too close and too far using true proportions', () => {
    expect(assessFraming(seatedPlayer({ x: 0, y: 0 }, 3), 1).issues).toContain('too_close')
    expect(assessFraming(seatedPlayer({ x: 0, y: 0 }, 0.4), 1).issues).toContain('too_far')
    // Shoulders 0.2 of the width apart on a 16:9 camera = 0.36 of the height: fine.
    expect(assessFraming(seatedPlayer(), 16 / 9).issues).toEqual([])
  })

  it('warns, without blocking, when there is no room to reach overhead', () => {
    // Shoulders at y = 0.2 with width 0.2: reaching up needs 1.2 × 0.2 = 0.24 of headroom.
    const high = seatedPlayer({ x: 0, y: -0.35 })
    high[LM.nose] = { x: 0.5, y: 0.05, z: 0, visibility: 1 }
    high[LM.leftWrist] = { x: 0.66, y: 0.3, z: 0, visibility: 1 }
    high[LM.rightWrist] = { x: 0.34, y: 0.3, z: 0, visibility: 1 }
    const result = assessFraming(high, 1)
    expect(result.warnings).toContain('low_headroom')
    expect(result.ok).toBe(true)
  })

  it('needs both shoulders', () => {
    const lm = makeLandmarks({ nose: { x: 0.5, y: 0.3 }, leftShoulder: { x: 0.6, y: 0.55 } })
    expect(assessFraming(lm, 1).issues).toContain('no_shoulders')
  })
})
