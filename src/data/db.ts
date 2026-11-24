import Dexie, { type EntityTable } from 'dexie'
import type { ActionId } from '../config/actions'
import type { FramingMode } from '../pose/framing'

/** Bump when the stored clip format changes in a way old readers can't handle. */
export const CLIP_SCHEMA_VERSION = 1

export type ClipSource = 'seed' | 'play'

/** One recorded clip, stored locally in IndexedDB. */
export interface StoredClip {
  id: string
  actionId: ActionId
  /** 'seed' = recorded in record mode; 'play' = captured during a game round (milestone 4). */
  source: ClipSource
  framingMode: FramingMode
  /** Date.now() when recorded. */
  createdAt: number
  /** Video width / height at recording time (needed to undo MediaPipe's per-axis scaling). */
  aspect: number
  /** Average real camera frame rate during the clip. */
  captureFps: number
  durationMs: number
  frameCount: number
  /** Raw landmarks: see PackedSamples in clipCodec.ts. */
  times: Float32Array
  landmarks: Float32Array
  deviceId: string
  appVersion: string
  schemaVersion: number
  /** 0 = not uploaded yet, 1 = uploaded (milestone 4). Numbers, because IndexedDB can't index booleans. */
  synced: 0 | 1
}

export const db = new Dexie('mimemind') as Dexie & {
  clips: EntityTable<StoredClip, 'id'>
}

db.version(1).stores({
  // Primary key first, then indexed fields.
  clips: 'id, actionId, source, createdAt, synced',
})
