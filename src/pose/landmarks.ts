/**
 * MediaPipe Pose landmark indices (33 points).
 * https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 *
 * "Left" and "right" are the person's own left and right, not the screen's.
 */
export const LM = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const

/**
 * Joints used as model features. These are readable when sitting (chest-up),
 * which is the main framing the game supports.
 */
export const UPPER_BODY = [
  LM.nose,
  LM.leftEar,
  LM.rightEar,
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftElbow,
  LM.rightElbow,
  LM.leftWrist,
  LM.rightWrist,
  LM.leftPinky,
  LM.rightPinky,
  LM.leftIndex,
  LM.rightIndex,
  LM.leftThumb,
  LM.rightThumb,
] as const

/** Below this, a landmark is treated as out of frame or not seen. */
export const VISIBILITY_THRESHOLD = 0.5
