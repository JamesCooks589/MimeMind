import { FRAMING_MESSAGES } from '../pose/framing'
import type { FramingState } from '../pose/useFraming'

/** Guide box, a first-person hint and a sitting/standing badge, drawn over the camera. */
export function FramingOverlay({ framing }: { framing: FramingState }) {
  const { ready, current, mode } = framing
  const issue = current.issues[0]
  const warning = current.warnings[0]

  let message: string
  if (issue) message = FRAMING_MESSAGES[issue]
  else if (!ready) message = 'Hold still a moment…'
  else if (warning) message = FRAMING_MESSAGES[warning]
  else message = "Perfect. I can see you clearly."

  const tone = issue ? 'bad' : ready ? 'good' : 'pending'

  return (
    <>
      <div className={`guide-box guide-box--${tone}`} aria-hidden />
      <p className={`notice notice--top notice--${tone}`} role="status">
        {message}
      </p>
      {current.issues[0] !== 'no_person' && <span className="badge">{mode === 'standing' ? 'Standing' : 'Sitting'}</span>}
    </>
  )
}
