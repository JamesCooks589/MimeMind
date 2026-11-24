# MimeMind: Project Plan

## Concept
A charades game in the browser. MimeMind shows the player a prompt (a sport), the player acts it out in front of their webcam, and MimeMind guesses live from the player's body movement. The player and MimeMind are on the same team: the player scores when MimeMind guesses correctly.

Goals: a fun, polished, instantly playable portfolio piece that shows real-time in-browser ML, a self-trained model, and good frontend and game design.

## Core decisions
| Area | Decision |
|---|---|
| Platform | Web app; all inference client-side; assumes an internet connection (MediaPipe/model files self-hosted in `public/`; no service worker in v1) |
| Input | MediaPipe Pose landmarks (not raw pixels) |
| Model | Own model, built in stages: kNN/DTW → 1D CNN → CNN embeddings + kNN personalisation → GRU comparison (write-up) |
| Training | TensorFlow.js in the browser, on a hidden `/lab` page with live loss/accuracy charts |
| Data | Mainly our own recordings, collected through gameplay; public datasets (UCF101/Kinetics) are optional later |
| Mode | Solo for v1 |
| Hosting | Vercel → `mimemind.jamescooks.dev` (DNS on Cloudflare) |
| Data sharing | Opt-in automatic upload of landmark clips to Supabase. Never video |

## Actions (v1: Sports)
Chosen to be readable from the upper body (works when sitting).

1. Swimming (freestyle): alternating overhead arm circles
2. Boxing: quick forward punches, fists up
3. Basketball shot: both hands push up from the chest
4. Tennis serve: one arm reaches up and swings down
5. Archery: one arm out, the other draws back to the face
6. Rowing: both arms pull to the chest
7. Cricket bowling: straight arm windmills over
8. Golf swing: clasped hands swing across the body
9. Weightlifting: curl or overhead press
10. Fishing: cast forward, then small reeling circles
11. Table tennis: small, quick forearm swings
12. Skiing: both hands plant poles, alternating
13. Darts: small throw from beside the eye
14. Jump rope: small wrist circles at the hips
15. F1 driving: hands at 10 and 2, turning a wheel

Plus a hidden **`idle`** class (no action, fidgeting, thinking). This is required for live guessing.

Avoided on purpose because they look like an existing action: kayaking (≈ rowing), volleyball spike (≈ tennis serve), baseball (≈ golf/cricket), and leg-based sports.

**Expansion is expected.** Actions are defined in a single config file (id, display name, prompt text, category). Candidates for future packs: badminton, rugby pass, javelin, hockey, surfing, climbing, fencing, discus, shot put, cheerleading. Later categories could include animals, instruments and chores. New actions can work right away through kNN on a few recordings, before the CNN is retrained.

## Framing and normalisation
- Support both **sitting** (roughly chest-up in frame) and **standing** (full body).
- Normalise every frame: centre on the mid-shoulder point and scale by shoulder width.
- Use MediaPipe visibility scores to mask joints that are out of frame (for example, legs when sitting). The model must cope with missing lower-body joints.
- Use mainly upper-body joints (shoulders, elbows, wrists, hands, head) as features.
- **Resample by time, not frame count.** Webcams vary between ~15 and 30 fps (many drop to 15 fps in dim light). Store a timestamp per frame and resample every clip/window to a fixed rate (e.g. 30 Hz) so the model always sees the same timing.
- Hands are the Pose model's 3 points per hand (thumb, index, pinky), not the 21-point Hand Landmarker. Revisit only if the confusion matrix shows hand-shape-dependent mix-ups. Tested in milestone 1: the 3 pose hand points can't tell palm-forward from palm-back (the winding of the wrist → thumb → pinky triangle barely changed).

## Calibration (before a match)
1. **Framing check**: "get your shoulders and hands in the box", and detect whether the player is sitting or standing.
2. **Body measurement**: shoulder width and arm reach, used for normalisation.
3. **Warm-up round**: the player acts a few prompts until MimeMind guesses them. These clips are stored locally as personal examples (see personalisation). This doubles as a demo moment.

## Game design (v1)
- Solo. The player chooses the match length: **3–10 prompts**.
- Rounds of **30 seconds** (configurable).
- **Live guessing**: MimeMind makes guesses as the player acts ("I sense… archery!").
- Scoring: points when MimeMind guesses correctly, plus a **speed bonus** for faster correct guesses.
- **Skip** button with a small penalty.
- **Show only the prompt label during play** (e.g. "Weightlifting"), never the hint text describing how to act it. Interpreting the prompt is the game. Hints are for record mode only.
- As the action count grows, show the top 2–3 guesses.
- The AI has a mind-reader personality in its voice lines and UI. **It always speaks in the first person ("I think it's… archery!") and never refers to itself as "MimeMind".** MimeMind is only the name of the app.

## Live inference
- Sliding window of about 1.5–2 s (45–60 frames at ~30 fps).
- Run the classifier about 5 times per second on the latest window.
- Smooth predictions over the last few inferences; only announce a guess above a confidence threshold; `idle` suppresses guessing.

## Data collection (play-to-record)
- **The prompt is the label.** Every round's clip is labelled automatically with its prompt.
- After a round: "Did I get it?" If not, the player can mark the clip as bad acting (discard) or pick the action they actually did.
- **Clip trimming**: save the window around the correct guess, or the last few seconds before the end of the round. Non-acting segments (thinking, fidgeting) become `idle` data.
- **Cold start**: a dev-only "record mode" for seed data. James records about 10 clips per action plus idle before friends play.
- Storage: IndexedDB (Dexie) locally. Clips queue offline and sync when online.
- **Sharing (least effort for friends)**: the first time the app opens, a consent screen ("Help me get better at guessing? I save the movement dots of your rounds, never video") with a toggle, on by default and changeable at any time. Opted-in clips upload automatically in the background to Supabase.
  - Supabase table for landmark clips: anonymous inserts allowed, no public reads (row-level security).
  - Basic per-device rate limit and payload size checks.
  - Store a random anonymous device ID, the action label, framing mode, fps, the landmark sequence and the app/model version. Nothing that identifies the person.

## Models (staged)
1. **kNN + Dynamic Time Warping (DTW)**: stores clips and compares a new window against them, so different acting speeds still match. Needs no training and works from the seed data. Gets the game playable first.
   - Use a Sakoe-Chiba band (limit time shift to about ±10 frames) for speed and to rule out nonsense alignments.
   - Motion-energy check: near-zero movement means `idle` straight away, with no DTW.
   - Add a cheap pre-filter (compare clip summaries first, run DTW on the closest ~20) only if inference becomes slow.
2. **1D CNN (temporal convolutions)**: the main model. Input is roughly [frames × upper-body joints × (x, y)]. Trained in `/lab` in TF.js. Augmentation: left/right mirroring, ±20% speed, small rotations, joint noise.
3. **Personalisation**: use the CNN's second-to-last layer as an embedding, and run kNN over the player's calibration clips plus the global prediction. This lets the model adapt to each player instantly.
4. **GRU comparison**: train a GRU at the end and benchmark it against the CNN (accuracy, latency, size). Write up the results in the README.

**README requirement:** every modelling choice (DTW, the band, motion energy, CNN architecture, augmentations, embeddings, GRU) gets a plain-English explanation of what it is and why it was chosen. Record results as each stage ships.

Public datasets (optional, later): extract MediaPipe landmarks from relevant UCF101/Kinetics clips in Google Colab (keeping the videos off the local machine) and ship only the landmark JSON. Expect a domain gap, because those clips show real sports filmed at a distance rather than mime in front of a webcam.

## Tech stack
- Vite + React + TypeScript (strict)
- `@mediapipe/tasks-vision` Pose Landmarker (GPU delegate, VIDEO mode, `requestAnimationFrame` loop)
- `@tensorflow/tfjs` (WebGL/WebGPU backend)
- Dexie (IndexedDB)
- Supabase JS client (insert only)
- Vercel hosting; Cloudflare DNS (`mimemind.jamescooks.dev`)

Suggested structure:
```
src/
  config/actions.ts        # single source of truth for actions
  pose/                    # MediaPipe setup, landmark capture, overlay drawing
  ml/                      # normalisation, features, augmentation, knn-dtw, cnn, embeddings
  data/                    # Dexie DB, clip trimming, sync queue, Supabase client
  game/                    # match/round state, scoring, guess smoothing
  screens/                 # Consent, Calibration, Game, Results, Record (dev), Lab (dev)
  components/
```

## Milestones
| # | Milestone | Done when |
|---|---|---|
| 0 | Setup | Vite + React + TS repo, deployed to Vercel at the subdomain; webcam with a live pose skeleton overlay |
| 1 | Normalisation + framing | Normalised upper-body features; sitting/standing detection; "get in the box" framing check |
| 2 | Record mode + seed data | Dev record screen; clips saved to IndexedDB; seed dataset recorded (about 10 per action plus idle) |
| 3 | kNN/DTW + game loop | Playable: match length, prompts, 30 s timer, live guesses with smoothing, scoring, skip |
| 4 | Play-to-record + upload | Post-round feedback, clip trimming, consent screen, Supabase sync queue |
| 5 | Friends playtest | Link shared, data collected, failure cases noted |
| 6 | `/lab` + 1D CNN | In-browser training with live charts; trained model shipped and used in the game |
| 7 | Personalisation | CNN embeddings + kNN on calibration clips; full calibration warm-up flow |
| 8 | Polish | MimeMind personality and voice lines, speed bonus, UI polish, README with a demo GIF. Idea: optional 21-point Hand Landmarker overlay for looks only, not model input (tried in milestone 1: looks great, costs extra ms per frame and loses hands in fast movement) |
| 9 | GRU comparison | GRU trained and benchmarked against the CNN; write-up in the README |
| 10 | Expansion packs | More sports; possibly a second category |

Milestones 0–3 give a playable, demo-able game.

## Open items
- Exact round length and scoring numbers (tune during playtests).
- Confidence threshold and smoothing parameters (tune in milestone 3).
- Whether to use public datasets at all (decide after milestone 6 results).
- Turned clips: seed clips facing left or right the whole time have narrower-looking shoulders, so they normalise to a larger body. If turned clips are often misclassified, scale by something that doesn't shrink when turning (e.g. shoulder-to-nose height, or the calibration measurement).
- Jitter on occluded limbs (e.g. the far arm when standing sideways): leave for now and see if it hurts guessing in milestone 3. If it does, add a One Euro filter, visibility hysteresis (seen above 0.6, missing below 0.4) and short-gap filling to the shared pipeline, applied identically to recordings and live input.
- Seed clips are all 30 fps. Add a "simulate 15 fps" augmentation (drop every other frame) for CNN training.
