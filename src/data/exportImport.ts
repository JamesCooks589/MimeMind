import { ACTIONS, type ActionId } from '../config/actions'
import { db, type StoredClip } from './db'

/**
 * Clips as portable JSON, for:
 * - moving seed data between browsers (each browser and site has its own IndexedDB),
 * - backups,
 * - the fallback where a friend exports their clips and sends the file over.
 *
 * Numbers are rounded (positions to 4 decimals ≈ 0.1 px at 720p; times to 0.1 ms)
 * to keep files small without losing anything meaningful.
 */
export const EXPORT_FORMAT = 'mimemind-clips'
export const EXPORT_VERSION = 1

type ExportedClip = Omit<StoredClip, 'times' | 'landmarks'> & { times: number[]; landmarks: number[] }

export interface ClipExport {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  clips: ExportedClip[]
}

const round = (v: number, dp: number) => {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

export function toExport(clips: readonly StoredClip[]): ClipExport {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    clips: clips.map((c) => ({
      ...c,
      times: Array.from(c.times, (t) => round(t, 1)),
      landmarks: Array.from(c.landmarks, (v) => round(v, 4)),
    })),
  }
}

const KNOWN_ACTIONS: ReadonlySet<string> = new Set(ACTIONS.map((a) => a.id))

/** Parses and validates an export file. Throws with a readable message if it's not one. */
export function fromExport(json: unknown): StoredClip[] {
  const data = json as Partial<ClipExport>
  if (data?.format !== EXPORT_FORMAT || !Array.isArray(data.clips)) throw new Error('Not a MimeMind clips file.')
  if ((data.version ?? 0) > EXPORT_VERSION) throw new Error('This file is from a newer version of MimeMind.')

  return data.clips.map((c, i) => {
    if (typeof c.id !== 'string' || !KNOWN_ACTIONS.has(c.actionId)) throw new Error(`Clip ${i} has an unknown action.`)
    if (!Array.isArray(c.times) || !Array.isArray(c.landmarks) || c.landmarks.length !== c.times.length * 33 * 4) {
      throw new Error(`Clip ${i} has malformed landmark data.`)
    }
    return {
      ...c,
      actionId: c.actionId as ActionId,
      times: Float32Array.from(c.times),
      landmarks: Float32Array.from(c.landmarks),
    }
  })
}

export async function exportAllClips(): Promise<ClipExport> {
  return toExport(await db.clips.orderBy('createdAt').toArray())
}

/** Adds clips that aren't already stored (matched by id). Returns how many were added and skipped. */
export async function importClips(clips: StoredClip[]): Promise<{ added: number; skipped: number }> {
  const existing = new Set(await db.clips.toCollection().primaryKeys())
  const fresh = clips.filter((c) => !existing.has(c.id))
  await db.clips.bulkPut(fresh)
  return { added: fresh.length, skipped: clips.length - fresh.length }
}

/** Triggers a browser download of a JSON file. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
