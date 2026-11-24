const KEY = 'mimemind.deviceId'

let cached: string | null = null

/**
 * A random, anonymous ID for this browser. It groups a player's clips together
 * (useful for per-player evaluation later) without identifying the person.
 */
export function getDeviceId(): string {
  if (cached) return cached
  try {
    cached = localStorage.getItem(KEY)
    if (!cached) {
      cached = crypto.randomUUID()
      localStorage.setItem(KEY, cached)
    }
  } catch {
    // Storage blocked (private mode etc.): use a per-session ID.
    cached ??= crypto.randomUUID()
  }
  return cached
}
