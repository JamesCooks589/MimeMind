# MimeMind

A charades game in the browser. You get a prompt (a sport), act it out in front of your webcam, and I try to guess it live from your body movement. We're on the same team: you score when I guess right.

Everything runs on your device. The webcam video never leaves the browser. Pose detection and my guesses run client-side.

> Status: **Milestone 0**: webcam with a live pose skeleton overlay. See [PLAN.md](PLAN.md) for the full roadmap.

## Running locally

Requires Node 20+.

```bash
npm install      # also copies MediaPipe's WASM runtime into public/mediapipe/
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run lint
```

The browser only allows camera access on `localhost` or over HTTPS.

## How it works

### Pose detection

Each webcam frame goes through [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), which returns 33 body landmarks (x, y, depth and a visibility score). The rest of the project works on **these landmarks, not raw pixels**. That makes the input tiny (about 30 numbers per frame for the upper body instead of ~1 million pixels), and it doesn't depend on lighting, clothing or background. It's also cheap enough to train a model in the browser.

Decisions so far:

- **Lite model.** MediaPipe ships lite, full and heavy pose models. The lite one (~5.5 MB) is the fastest and smallest download. Mime gestures are big, clear movements, so the extra precision of the larger models isn't worth the cost.
- **Self-hosted files.** The WASM runtime and model are served from this site (`public/`) rather than Google's CDN. That keeps versions locked to the installed npm package and avoids depending on a third-party host.
- **GPU first, CPU fallback.** MediaPipe runs on WebGL where available and falls back to CPU otherwise.
- **Only new frames are processed.** The render loop runs at the display's refresh rate (often 60–144 Hz), but the webcam delivers about 30 fps. The loop skips any tick where the video frame hasn't changed.
- **Upper-body focus.** The highlighted joints (head, shoulders, elbows, wrists, hands) will be the model's features, because they're readable when sitting. Joints below the visibility threshold are hidden, just as the model will treat them as missing.

### Guessing model

_Coming in milestones 3+._ The plan is staged: kNN + Dynamic Time Warping first, then a 1D CNN trained in the browser, then per-player personalisation, then a GRU comparison. Each stage will be explained here as it ships.

## Project structure

```
src/
  config/actions.ts   # single source of truth for actions (id, name, prompt, category)
  pose/               # MediaPipe setup, webcam, pose loop, skeleton drawing
  components/         # shared UI (CameraView)
  screens/            # app screens
scripts/              # build helpers (copy MediaPipe WASM)
public/models/        # pose model file
```

## Tech

Vite · React · TypeScript (strict) · MediaPipe Tasks Vision · hosted on Vercel
