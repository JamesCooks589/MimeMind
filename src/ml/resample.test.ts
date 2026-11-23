import { describe, expect, it } from 'vitest'
import { LM } from '../pose/landmarks'
import { makeLandmarks } from '../test/poseFixtures'
import type { PoseSample } from './clip'
import { latestWindow, resample } from './resample'

const JOINTS = [LM.leftWrist]

/** A wrist moving right at a constant speed, captured at `fps`. */
function movingWrist(fps: number, durationMs: number, startT = 1000): PoseSample[] {
  const samples: PoseSample[] = []
  const count = Math.round((durationMs / 1000) * fps)
  for (let i = 0; i <= count; i++) {
    const t = (i * 1000) / fps
    samples.push({ t: startT + t, landmarks: makeLandmarks({ leftWrist: { x: t / 10000, y: 0.5 } }) })
  }
  return samples
}

describe('resample', () => {
  it('turns 15 fps and 30 fps captures of the same motion into the same 30 Hz clip', () => {
    const opts = { joints: JOINTS, aspect: 1, startT: 1000, frameCount: 60, hz: 30 }
    const from15 = resample(movingWrist(15, 2000), opts)
    const from30 = resample(movingWrist(30, 2000), opts)

    expect(from15.frameCount).toBe(60)
    expect(Array.from(from15.mask)).toEqual(Array(60).fill(1))
    for (let i = 0; i < from15.xy.length; i++) expect(from15.xy[i]).toBeCloseTo(from30.xy[i]!, 5)
  })

  it('interpolates linearly between frames', () => {
    const samples: PoseSample[] = [
      { t: 0, landmarks: makeLandmarks({ leftWrist: { x: 0.2, y: 0.4 } }) },
      { t: 100, landmarks: makeLandmarks({ leftWrist: { x: 0.4, y: 0.6 } }) },
    ]
    const clip = resample(samples, { joints: JOINTS, aspect: 1, startT: 50, frameCount: 1, hz: 30 })
    expect(clip.xy[0]).toBeCloseTo(0.3)
    expect(clip.xy[1]).toBeCloseTo(0.5)
  })

  it('multiplies x by the aspect ratio so both axes share units', () => {
    const samples: PoseSample[] = [{ t: 0, landmarks: makeLandmarks({ leftWrist: { x: 0.5, y: 0.5 } }) }]
    const clip = resample(samples, { joints: JOINTS, aspect: 16 / 9, startT: 0, frameCount: 1, hz: 30 })
    expect(clip.xy[0]).toBeCloseTo(0.5 * (16 / 9))
    expect(clip.xy[1]).toBeCloseTo(0.5)
  })

  it('marks frames missing across tracking gaps and outside the captured range', () => {
    const samples: PoseSample[] = [
      { t: 0, landmarks: makeLandmarks({ leftWrist: { x: 0.1, y: 0.1 } }) },
      { t: 1000, landmarks: makeLandmarks({ leftWrist: { x: 0.9, y: 0.9 } }) },
    ]
    // 10 Hz → output frames at t = -100, 0, 100, …, 1000
    const clip = resample(samples, { joints: JOINTS, aspect: 1, startT: -100, frameCount: 13, hz: 10 })
    expect(clip.mask[0]).toBe(0) // before the first sample
    expect(clip.mask[1]).toBe(1) // exactly on a real frame, even though a gap follows
    expect(clip.mask[5]).toBe(0) // inside the 1 s gap
    expect(clip.xy[5 * 2]).toBe(0)
    expect(clip.mask[11]).toBe(1) // exactly on the second real frame
    expect(clip.mask[12]).toBe(0) // after the last sample
  })

  it('marks a joint missing if either neighbouring frame could not see it', () => {
    const samples: PoseSample[] = [
      { t: 0, landmarks: makeLandmarks({ leftWrist: { x: 0.1, y: 0.1 } }) },
      { t: 33, landmarks: makeLandmarks({ leftWrist: { x: 0.2, y: 0.2, visibility: 0.1 } }) },
    ]
    const clip = resample(samples, { joints: JOINTS, aspect: 1, startT: 10, frameCount: 1, hz: 30 })
    expect(clip.mask[0]).toBe(0)
  })
})

describe('latestWindow', () => {
  it('ends exactly at endT', () => {
    const samples = movingWrist(30, 3000)
    const end = samples[samples.length - 1]!.t
    const clip = latestWindow(samples, { joints: JOINTS, aspect: 1, endT: end, frameCount: 60, hz: 30 })
    expect(clip.mask[59]).toBe(1)
    expect(clip.xy[59 * 2]).toBeCloseTo((end - 1000) / 10000, 5)
  })
})
