import { useEffect, useRef } from 'react'
import type { Clip } from '../ml/clip'
import { drawNormalisedClip } from '../ml/drawClip'

/** Loops a normalised clip on a canvas at its own frame rate. */
export function ClipPreview({ clip, label }: { clip: Clip | null; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    if (!clip || clip.frameCount === 0) {
      drawNormalisedClip(ctx, null, label)
      return
    }
    let raf = 0
    const start = performance.now()
    const frameMs = 1000 / clip.hz
    const pauseFrames = Math.round(clip.hz * 0.5) // hold the last frame briefly before looping
    const draw = (now: number) => {
      const f = Math.floor((now - start) / frameMs) % (clip.frameCount + pauseFrames)
      drawNormalisedClip(ctx, clip, label, Math.min(f, clip.frameCount - 1))
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [clip, label])

  return <canvas ref={canvasRef} className="debug__canvas" width={480} height={360} />
}
