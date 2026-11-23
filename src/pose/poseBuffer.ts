import { BUFFER_MS } from '../config/pipeline'
import type { PoseSample } from '../ml/clip'

/**
 * Rolling history of recent pose samples (the last few seconds).
 * Frames with no person detected aren't stored. The gap shows up as missing
 * frames when the history is resampled.
 */
export class PoseBuffer {
  private samples: PoseSample[] = []
  private readonly maxAgeMs: number

  constructor(maxAgeMs = BUFFER_MS) {
    this.maxAgeMs = maxAgeMs
  }

  push(sample: PoseSample): void {
    this.samples.push(sample)
    const cutoff = sample.t - this.maxAgeMs
    let drop = 0
    while (drop < this.samples.length && this.samples[drop]!.t < cutoff) drop++
    if (drop) this.samples.splice(0, drop)
  }

  get all(): readonly PoseSample[] {
    return this.samples
  }

  get latest(): PoseSample | undefined {
    return this.samples[this.samples.length - 1]
  }

  /** Number of real samples captured since `t`. */
  countSince(t: number): number {
    let n = 0
    for (let i = this.samples.length - 1; i >= 0 && this.samples[i]!.t >= t; i--) n++
    return n
  }

  clear(): void {
    this.samples = []
  }
}
