import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

/**
 * Both files are self-hosted from public/:
 * - WASM runtime: copied from node_modules on install (scripts/copy-mediapipe-wasm.mjs)
 * - Model: public/models/pose_landmarker_lite.task (committed). "Lite" is the
 *   smallest and fastest variant (~5.5 MB), which suits a browser game.
 */
const WASM_PATH = '/mediapipe/wasm'
const MODEL_PATH = '/models/pose_landmarker_lite.task'

export type Delegate = 'GPU' | 'CPU'

export interface LoadedPoseLandmarker {
  landmarker: PoseLandmarker
  delegate: Delegate
}

async function create(delegate: Delegate): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}

/** Tries the GPU delegate first, then falls back to CPU if WebGL isn't available. */
export async function loadPoseLandmarker(): Promise<LoadedPoseLandmarker> {
  try {
    return { landmarker: await create('GPU'), delegate: 'GPU' }
  } catch (err) {
    console.warn('[pose] GPU delegate failed, falling back to CPU', err)
    return { landmarker: await create('CPU'), delegate: 'CPU' }
  }
}
