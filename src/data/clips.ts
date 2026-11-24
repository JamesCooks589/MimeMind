import type { ActionId } from '../config/actions'
import type { PoseSample } from '../ml/clip'
import type { FramingMode } from '../pose/framing'
import { packSamples, unpackSamples } from './clipCodec'
import { CLIP_SCHEMA_VERSION, db, type ClipSource, type StoredClip } from './db'
import { getDeviceId } from './device'

export interface NewClip {
  actionId: ActionId
  source: ClipSource
  framingMode: FramingMode
  aspect: number
  samples: readonly PoseSample[]
}

/** Builds a storable clip from raw samples (doesn't save it). */
export function buildClip({ actionId, source, framingMode, aspect, samples }: NewClip): StoredClip {
  const { times, landmarks } = packSamples(samples)
  const durationMs = times.length > 1 ? times[times.length - 1]! : 0
  return {
    id: crypto.randomUUID(),
    actionId,
    source,
    framingMode,
    createdAt: Date.now(),
    aspect,
    captureFps: durationMs > 0 ? ((times.length - 1) * 1000) / durationMs : 0,
    durationMs,
    frameCount: times.length,
    times,
    landmarks,
    deviceId: getDeviceId(),
    appVersion: __APP_VERSION__,
    schemaVersion: CLIP_SCHEMA_VERSION,
    synced: 0,
  }
}

export async function saveClip(clip: StoredClip): Promise<void> {
  await db.clips.put(clip)
}

export async function deleteClip(id: string): Promise<void> {
  await db.clips.delete(id)
}

export function clipSamples(clip: StoredClip): PoseSample[] {
  return unpackSamples(clip)
}

/** Number of stored clips per action. */
export async function countByAction(): Promise<Map<ActionId, number>> {
  const counts = new Map<ActionId, number>()
  await db.clips.each((c) => counts.set(c.actionId, (counts.get(c.actionId) ?? 0) + 1))
  return counts
}
