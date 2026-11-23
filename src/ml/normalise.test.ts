import { describe, expect, it } from 'vitest'
import { LM, UPPER_BODY } from '../pose/landmarks'
import { makeLandmarks, seatedPlayer } from '../test/poseFixtures'
import type { Clip, PoseSample } from './clip'
import { normaliseClip } from './normalise'
import { resample } from './resample'

function clipOf(frames: PoseSample['landmarks'][], aspect = 1): Clip {
  const samples = frames.map((landmarks, i) => ({ t: i * 33.33, landmarks }))
  return resample(samples, { joints: UPPER_BODY, aspect, startT: 0, frameCount: frames.length, hz: 30 })
}

function point(clip: Clip, lm: number, f = 0): [number, number] {
  const i = f * clip.joints.length + clip.joints.indexOf(lm)
  return [clip.xy[i * 2]!, clip.xy[i * 2 + 1]!]
}

describe('normaliseClip', () => {
  it('puts the shoulders at (±0.5, 0)', () => {
    const result = normaliseClip(clipOf([seatedPlayer()]))!
    const [lx, ly] = point(result.clip, LM.leftShoulder)
    const [rx, ry] = point(result.clip, LM.rightShoulder)
    expect(lx).toBeCloseTo(0.5)
    expect(rx).toBeCloseTo(-0.5)
    expect(ly).toBeCloseTo(0)
    expect(ry).toBeCloseTo(0)
  })

  it('gives the same output wherever the player sits and however close they are', () => {
    const base = normaliseClip(clipOf([seatedPlayer()]))!.clip
    const movedAndSmaller = normaliseClip(clipOf([seatedPlayer({ x: 0.15, y: -0.05 }, 0.6)]))!.clip
    for (let i = 0; i < base.xy.length; i++) expect(movedAndSmaller.xy[i]).toBeCloseTo(base.xy[i]!, 5)
    expect(Array.from(movedAndSmaller.mask)).toEqual(Array.from(base.mask))
  })

  it('uses the median shoulder width, so a sideways turn does not inflate the arms', () => {
    const facing = seatedPlayer()
    const turned = seatedPlayer()
    // Shoulders look half as wide when turned sideways.
    turned[LM.leftShoulder] = { ...turned[LM.leftShoulder]!, x: 0.55 }
    turned[LM.rightShoulder] = { ...turned[LM.rightShoulder]!, x: 0.45 }
    const result = normaliseClip(clipOf([facing, facing, facing, turned, turned]))!
    expect(result.info.scale).toBeCloseTo(0.2)
  })

  it('keeps missing joints missing', () => {
    const result = normaliseClip(clipOf([seatedPlayer()]))!
    const j = result.clip.joints.indexOf(LM.leftPinky) // not in the fixture
    expect(result.clip.mask[j]).toBe(0)
    expect(result.clip.xy[j * 2]).toBe(0)
  })

  it('returns null when the shoulders are never visible', () => {
    expect(normaliseClip(clipOf([makeLandmarks({ nose: { x: 0.5, y: 0.5 } })]))).toBeNull()
  })
})
