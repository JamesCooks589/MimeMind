import { CameraView } from '../components/CameraView'

/**
 * Milestone 0 screen: proves the camera → MediaPipe → overlay pipeline works.
 * It will become the framing check in milestone 1.
 */
export function PoseCheckScreen() {
  return (
    <main className="screen">
      <header className="screen__header">
        <h1 className="logo">
          Mime<span>Mind</span>
        </h1>
        <p className="tagline">Act it out. I'll read your mind.</p>
      </header>

      <CameraView>
        {({ webcam, pose, stats }) => {
          if (webcam.state === 'error') return <p className="notice notice--error">{webcam.message}</p>
          if (webcam.state === 'starting') return <p className="notice">Waking up your camera…</p>
          if (pose.state === 'error') return <p className="notice notice--error">{pose.message}</p>
          if (pose.state === 'loading') return <p className="notice">Tuning in to your movements…</p>
          return (
            <>
              {!stats.personDetected && <p className="notice">I can't see you. Step into the frame.</p>}
              <dl className="stats" aria-label="Pose tracking stats">
                <div>
                  <dt>FPS</dt>
                  <dd>{stats.fps.toFixed(0)}</dd>
                </div>
                <div>
                  <dt>Pose</dt>
                  <dd>{stats.inferenceMs.toFixed(1)} ms</dd>
                </div>
                <div>
                  <dt>Backend</dt>
                  <dd>{pose.delegate}</dd>
                </div>
              </dl>
            </>
          )
        }}
      </CameraView>
    </main>
  )
}
