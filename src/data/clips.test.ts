import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { seatedPlayer } from '../test/poseFixtures'
import type { PoseSample } from '../ml/clip'
import { samplesToModelClip } from '../ml/pipeline'
import { packSamples, unpackSamples } from './clipCodec'
import { buildClip, saveClip } from './clips'
import { db } from './db'
import { fromExport, importClips, toExport } from './exportImport'

/** 2 s at 15 fps, starting at an arbitrary performance.now() time. */
function samples15fps(): PoseSample[] {
  return Array.from({ length: 31 }, (_, i) => ({ t: 50_000 + (i * 1000) / 15, landmarks: seatedPlayer() }))
}

describe('packSamples / unpackSamples', () => {
  it('round-trips landmarks, with times relative to the first sample', () => {
    const original = samples15fps()
    const restored = unpackSamples(packSamples(original))
    expect(restored).toHaveLength(original.length)
    expect(restored[0]!.t).toBe(0)
    expect(restored[30]!.t).toBeCloseTo(2000, 2)
    const a = original[5]!.landmarks[11]!
    const b = restored[5]!.landmarks[11]!
    expect(b.x).toBeCloseTo(a.x, 5)
    expect(b.y).toBeCloseTo(a.y, 5)
    expect(b.visibility).toBeCloseTo(a.visibility ?? 0, 5)
  })
})

describe('buildClip', () => {
  it('records duration, frame count and the real capture rate', () => {
    const clip = buildClip({ actionId: 'boxing', source: 'seed', framingMode: 'sitting', aspect: 16 / 9, samples: samples15fps() })
    expect(clip.frameCount).toBe(31)
    expect(clip.durationMs).toBeCloseTo(2000, 2)
    expect(clip.captureFps).toBeCloseTo(15, 3)
    expect(clip.synced).toBe(0)
  })

  it('turns into a 30 Hz model clip whatever the capture rate', () => {
    const clip = buildClip({ actionId: 'boxing', source: 'seed', framingMode: 'sitting', aspect: 16 / 9, samples: samples15fps() })
    const model = samplesToModelClip(unpackSamples(clip), clip.aspect)!
    expect(model.clip.hz).toBe(30)
    expect(model.clip.frameCount).toBe(61) // 0, 33.3, …, 2000 ms
  })
})

describe('export / import', () => {
  beforeEach(async () => {
    await db.clips.clear()
  })

  it('round-trips through JSON', () => {
    const clip = buildClip({ actionId: 'archery', source: 'seed', framingMode: 'standing', aspect: 4 / 3, samples: samples15fps() })
    const restored = fromExport(JSON.parse(JSON.stringify(toExport([clip]))))
    expect(restored).toHaveLength(1)
    const r = restored[0]!
    expect(r.id).toBe(clip.id)
    expect(r.actionId).toBe('archery')
    expect(r.landmarks).toBeInstanceOf(Float32Array)
    expect(r.landmarks.length).toBe(clip.landmarks.length)
    expect(r.landmarks[100]).toBeCloseTo(clip.landmarks[100]!, 4)
  })

  it('rejects files that are not clip exports, or have unknown actions', () => {
    expect(() => fromExport({ hello: 'world' })).toThrow('Not a MimeMind clips file.')
    const clip = buildClip({ actionId: 'archery', source: 'seed', framingMode: 'sitting', aspect: 1, samples: samples15fps() })
    const bad = toExport([clip])
    ;(bad.clips[0] as { actionId: string }).actionId = 'underwater_basket_weaving'
    expect(() => fromExport(bad)).toThrow('unknown action')
  })

  it('skips clips that are already stored', async () => {
    const a = buildClip({ actionId: 'rowing', source: 'seed', framingMode: 'sitting', aspect: 1, samples: samples15fps() })
    const b = buildClip({ actionId: 'rowing', source: 'seed', framingMode: 'sitting', aspect: 1, samples: samples15fps() })
    await saveClip(a)
    const result = await importClips(fromExport(JSON.parse(JSON.stringify(toExport([a, b])))))
    expect(result).toEqual({ added: 1, skipped: 1 })
    expect(await db.clips.count()).toBe(2)
  })
})
