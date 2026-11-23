# MimeMind

A charades game in the browser. You get a prompt (a sport), act it out in front of your webcam, and I try to guess it live from your body movement. We're on the same team: you score when I guess right.

Everything runs on your device. The webcam video never leaves the browser. Pose detection and my guesses run client-side.

> Status: **Milestone 1**: normalised model input, framing check and sitting/standing detection. See [PLAN.md](PLAN.md) for the full roadmap.

## Running locally

Requires Node 20+.

```bash
npm install      # also copies MediaPipe's WASM runtime into public/mediapipe/
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run lint
npm test         # unit tests (Vitest)
```

The browser only allows camera access on `localhost` or over HTTPS.

## How it works

### Pose detection

Each webcam frame goes through [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), which returns 33 body landmarks (x, y, depth and a visibility score). The rest of the project works on **these landmarks, not raw pixels**. That makes the input tiny (about 30 numbers per frame for the upper body instead of ~1 million pixels), and it doesn't depend on lighting, clothing or background. It's also cheap enough to train a model in the browser.

Decisions so far:

- **Lite model.** MediaPipe ships lite, full and heavy pose models. The lite one (~5.5 MB) is the fastest and smallest download. Mime gestures are big, clear movements, so the extra precision of the larger models isn't worth the cost.
- **Self-hosted files.** The WASM runtime and model are served from this site (`public/`) rather than Google's CDN. That keeps versions locked to the installed npm package and avoids depending on a third-party host.
- **GPU first, CPU fallback.** MediaPipe runs on WebGL where available and falls back to CPU otherwise.
- **Only new frames are processed.** The loop uses `requestVideoFrameCallback`, which fires once per new camera frame (~30 fps). An earlier version used `requestAnimationFrame` and checked `video.currentTime` for changes. That fires at the display's refresh rate (60–165 Hz), and some browsers advance `currentTime` continuously for live streams. The result was the same frame being processed about 5 times on a 165 Hz monitor, which would also have put duplicate frames into recordings. The old approach is kept only as a fallback for browsers without the API.
- **No finger or palm detail (tested).** The Pose model gives only 3 points per hand (thumb, index, pinky). I tested whether those 3 points could tell which way the palm faces, using the winding direction of the wrist → thumb → pinky triangle, which should flip when the hand turns round. It couldn't: palm-to-camera and back-to-camera gave almost the same value (+0.42 vs +0.37 on a −1…1 scale), and one hand flickered randomly between the two. The Pose model places these points roughly and doesn't track hand rotation. MediaPipe's separate 21-point Hand Landmarker could read palm orientation reliably, but it's left out for now: these actions are about arm movement over time, and it would double the per-frame work and lose hands during fast movement. It gets revisited if two actions turn out to differ only in hand shape.
- **Upper-body focus.** The highlighted joints (head, shoulders, elbows, wrists, hands) will be the model's features, because they're readable when sitting. Joints below the visibility threshold are hidden, just as the model will treat them as missing.

### Turning poses into model input

Raw landmarks aren't ready for a model. The same punch produces different numbers depending on your webcam, where you sit and how close you are. Every 2-second window goes through two steps to remove those differences, so the model only has to learn the movement itself.

**1. Resample to a fixed 30 Hz** ([src/ml/resample.ts](src/ml/resample.ts)).
Webcams don't deliver a steady frame rate. The same camera can run at 30 fps in daylight and drop to 15 fps in the evening, because it needs longer exposures in dim light. Without resampling, a 2-second action would be 60 frames on one camera and 30 on another. To a model that compares frame by frame, those look like two different speeds. Every real frame keeps its capture timestamp, and the window is rebuilt at exactly 30 Hz by linear interpolation: an output frame halfway between two real frames gets the halfway position. A window is then always 60 frames, whatever the camera did.

A joint is marked **missing** rather than guessed when:
- MediaPipe's visibility score is below 0.5 in either neighbouring real frame (e.g. your legs when sitting, or a hand that left the frame), or
- the two real frames are more than 250 ms apart, which means tracking was lost and anything in between would be invented.

Missing joints are stored as 0 with a separate mask (1 = seen, 0 = missing). The models will receive the mask too, so they can tell "joint at the centre" from "joint not seen".

The x coordinate is also multiplied by the video's aspect ratio. MediaPipe gives x as a fraction of the width and y as a fraction of the height, so on a 16:9 camera, 0.1 in x is a longer distance than 0.1 in y. After this correction both axes share the same units, and distances and angles come out right.

**2. Normalise by body size and position** ([src/ml/normalise.ts](src/ml/normalise.ts)).
Every point becomes `(point − centre) / scale`. The centre is the midpoint between your shoulders and the scale is your shoulder width. Afterwards your shoulders sit at about (±0.5, 0), and a hand at x = 2 means "two shoulder widths to the side", for any player at any distance.

Centre and scale use the **median over the whole window**, not a value per frame:
- Per-frame centring would pin your shoulders in place and erase torso movement, like leaning back while rowing or ducking while boxing. That's useful signal.
- Turning sideways (archery, a tennis serve) makes your shoulders look narrower on camera, because the 2D picture loses depth. A per-frame scale would then suddenly make your arms look huge. The median ignores those few frames, as long as you faced the camera for most of the window.

The median rather than the mean is deliberate: a handful of bad frames, such as a turn or a tracking glitch, barely moves the median but would drag the mean.

The debug view on the main screen ("Show what the model sees") draws the result. The grid squares are one shoulder width, and the skeleton should stay the same size as you lean towards or away from the camera.

### Framing check

Before a round, the guide box checks that I can read you ([src/pose/framing.ts](src/pose/framing.ts)): your head, both shoulders and both hands must be in frame, and you can't be too close or too far away. Distance is judged by shoulder width as a fraction of the frame height. A softer warning asks for more room above your head when overhead moves (swimming, tennis serve) would leave the frame. The box only turns green after the framing has been good for half a second, so it doesn't flicker.

**Sitting or standing** is detected from whether your hips and a knee are visible. It's decided by a majority vote over the last second of frames, so one glitchy frame can't flip it. It's stored with every recording, so later analysis can compare how well each framing works.

### Guessing model

_Coming in milestones 3+._ The plan is staged: kNN + Dynamic Time Warping first, then a 1D CNN trained in the browser, then per-player personalisation, then a GRU comparison. Each stage will be explained here as it ships.

## Project structure

```
src/
  config/actions.ts   # single source of truth for actions (id, name, prompt, category)
  config/pipeline.ts  # sample rate, window length and gap settings
  pose/               # MediaPipe setup, webcam, pose loop, framing check, skeleton drawing
  ml/                 # resampling, normalisation (model input pipeline)
  components/         # shared UI (CameraView, FramingOverlay)
  screens/            # app screens
scripts/              # build helpers (copy MediaPipe WASM)
public/models/        # pose model file
```

## Tech

Vite · React · TypeScript (strict) · MediaPipe Tasks Vision · hosted on Vercel
