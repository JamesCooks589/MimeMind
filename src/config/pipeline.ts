/**
 * Settings for turning raw pose frames into model input.
 * Changing these changes what the model sees, so bump the model/data
 * version when you do.
 */

/** Every clip and live window is resampled to this rate, whatever the webcam delivers. */
export const SAMPLE_HZ = 30

/** Length of the live guessing window. */
export const WINDOW_MS = 2000

/** Frames per window at SAMPLE_HZ (2 s × 30 Hz = 60). */
export const WINDOW_FRAMES = Math.round((WINDOW_MS / 1000) * SAMPLE_HZ)

/**
 * If two real camera frames are further apart than this, don't interpolate
 * between them. The person was probably lost, so those frames are marked missing.
 */
export const MAX_GAP_MS = 250

/** How much pose history to keep in memory (a little more than one window). */
export const BUFFER_MS = 4000
