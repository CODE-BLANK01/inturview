# Face-to-face interview mode

A live, spoken technical round over video. The candidate turns on camera + mic, an AI interviewer talks to them in real time (OpenAI Realtime, speech-to-speech), and at the end Claude scores the transcript plus measured delivery metrics (pace, filler words, pauses) and body-language metrics (eye contact, posture, restlessness, hands) tracked on-device with MediaPipe.

This document covers: how to run it locally, how it's built, what changed in the repo, and the errors you're most likely to hit.

---

## 1. Running it locally

You need everything from the main [README quick start](README.md#quick-start) (Node 20+, Postgres, Anthropic key), **plus**:

- **Python 3.11+**
- **An OpenAI API key with prepaid credits.** This is separate from a ChatGPT subscription. Realtime audio is billed per audio token; a 20-minute session on `gpt-realtime` costs roughly $1–2, `gpt-realtime-mini` a fraction of that. Add credits at platform.openai.com → Settings → Billing, and set a monthly usage limit while you're there.

There are two servers. Both must be running.

### 1a. Next.js app (port 3000)

```bash
npm install
```

Add these to `.env.local` (see `.env.local.example`):

```
REALTIME_SERVICE_SECRET=<32+ random chars — openssl rand -base64 32>
NEXT_PUBLIC_REALTIME_SERVICE_URL=http://localhost:8000
FACE_TO_FACE_MAX_MINUTES=20
FREE_FACE_TO_FACE_SESSIONS_PER_MONTH=2
```

Apply the schema changes (new enum value + two columns) and start:

```bash
npm run db:push
npm run dev
```

> If `db:push` or `prisma generate` fails with `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`, a running `next dev` is holding the Prisma engine file. Stop the dev server, run `npx prisma generate`, start it again.

### 1b. Realtime service — FastAPI (port 8000)

```bash
cd services/realtime
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env
```

Edit `services/realtime/.env`:

```
OPENAI_API_KEY=sk-...
REALTIME_SERVICE_SECRET=<the SAME value as in .env.local>
```

Start it **from `services/realtime`** (not from inside `app/` — the package uses relative imports and reads `.env` from the current directory):

```bash
uvicorn app.main:app --port 8000 --reload
```

You should see `Application startup complete.` and `curl http://localhost:8000/health` returns `{"status":"ok"}`.

### 1c. Try it

Sign in, open **Practice → Face-to-face** (or `/face-to-face`), enable camera & mic, wait for "Loading camera tracking…" to finish (first load downloads ~9 MB of MediaPipe models), click **Calibrate (2s)** while looking straight at the camera lens, pick a track and level, then **Start interview**. Within a few seconds the status pill should read *Listening* and the interviewer greets you out loud. Use headphones if you can, and keep your shoulders in frame.

Never commit `.env.local` or `services/realtime/.env` — both hold secrets and are git-ignored.

---

## 2. How it works

```
Browser ──WebRTC (audio in/out + data channel)──▶ OpenAI Realtime
   │
   ├─ POST /api/face-to-face/start ──────────────▶ Next.js   (plan cap, create session, pick questions, sign JWT)
   │
   ├─ POST /sessions/{id}/realtime  (Bearer JWT) ─▶ FastAPI ──GET /api/internal/face-to-face/{id}──▶ Next.js
   │        ◀── ephemeral OpenAI client secret ───┘        (instructions built server-side)
   │
   └─ WS  /sessions/{id}/events ─────────────────▶ FastAPI ──POST /api/internal/face-to-face/{id}/turns──▶ Next.js
            (transcript turns as they happen)             (junk filter → delivery metrics → persist)

Finish ─▶ POST /api/conversation/debrief ─▶ Next.js ─▶ Claude scores transcript + metrics
```

**Why two backends.** Next.js on Vercel can't hold long-lived WebSockets and has a ~4.5 MB body limit, and the OpenAI key must never reach the browser. So FastAPI mints a short-lived *ephemeral* key with the interviewer prompt baked in, and the browser talks to OpenAI directly over WebRTC (lowest latency; OpenAI handles echo cancellation and barge-in). Next.js keeps everything it already owns — auth, plan caps, Prisma, the Claude debrief.

**Trust boundary.** The browser gets a 15-minute HS256 JWT bound to one session id (`lib/faceToFaceToken.ts`, verified by `services/realtime/app/auth.py` with the shared `REALTIME_SERVICE_SECRET`). FastAPI → Next.js calls carry the same secret in an `x-service-secret` header. FastAPI, not the browser, is the writer of record for transcript turns.

### The noise problem, and the fix

The Realtime API's voice-activity detector is sensitive: breathing or a keyboard click can open a "turn", and the transcriber then hallucinates text for it — often in another language ("ご視聴ありがとうございました", "Thank you.") — and the model answers nonsense. Three layers stop that:

1. **Browser noise gate** (`lib/realtimeClient.ts`, `buildGatedAudio`). A Web Audio gain node sits in front of the outbound track and only opens when RMS exceeds ~3× the measured room floor. The floor is learned only while the gate is closed, so a long answer can't raise it and choke itself off. The threshold doubles while the interviewer is speaking so speaker bleed doesn't count as barge-in.
2. **Session config** (`services/realtime/app/realtime.py`). `noise_reduction: near_field`; `server_vad` with `threshold 0.8` and `silence_duration_ms 900`; transcription pinned to `language: "en"` (this alone removes the foreign-language hallucinations); and critically **`create_response: false`** and **`interrupt_response: false`** — the model never replies or gets cut off on its own.
3. **Transcript gate**. The browser only sends `response.create` after a transcript comes back *and* passes `isUsableTranscript()` (min two words unless it's "yes"/"no"-style, <30% non-Latin characters, not on a known-hallucination list), *and* 1.2 s passes with no new speech. Junk items are deleted from the conversation (`conversation.item.delete`). FastAPI applies the same filter (`app/metrics.py`) before persisting, so junk never reaches the DB either.

Barge-in is decided from speech duration: if the candidate talks for ≥ 700 ms while the interviewer is speaking, the client sends `response.cancel` + `output_audio_buffer.clear`. Short blips are ignored. A `response.create` is never sent while another response is in flight — it's queued and fired on `response.done`.

### Time cap and resilience

- `FACE_TO_FACE_MAX_MINUTES` is enforced server-side, not just by the browser timer: the start route abandons an expired in-progress session instead of resuming it, FastAPI refuses to mint a new OpenAI session for one (409), and the turns endpoint stops accepting turns three minutes past the cap. The browser's T-5 and time-up notes are the polite version of the same limit.
- The transcript WebSocket reconnects with exponential backoff (5 attempts) and queues turns while it's down; if it can't recover, a banner tells the candidate that further answers won't be saved. Finishing flushes the last answer and waits for acks before requesting the debrief; the debrief route refuses to score a face-to-face session with no saved answers.
- Calibration stretches its window up to 6 s on slow (CPU-only) machines, and the candidate can skip body-language scoring if it still can't see them.

All the knobs are env vars in `services/realtime/.env.example` (`RT_VAD_THRESHOLD`, `RT_VAD_SILENCE_MS`, …). If it still triggers on breathing in a noisy room, raise the threshold first.

### Questions and scoring

- **Question bank**: `lib/faceToFaceQuestions.ts` — 31 questions across Backend / Frontend / Full-stack / Data & ML / Mobile / DevOps / AI & LLM engineering (RAG, agent loops, MCP and tool design, prompt injection, evals, cost/latency, structured output) plus universal ones. Each has an opener, a *depth ladder* (follow-ups the interviewer climbs one rung at a time), and *signals* (grading reference, never shown live).
- **Plan**: at start, `buildFaceToFacePlan()` picks 2 track + 1 universal fundamentals and 1 scenario, seeded by the session id, and stores it on `ConversationSession.plan`.
- **Interviewer prompt**: `faceToFaceInterviewerInstructions()` in `lib/faceToFacePrompts.ts` — a five-segment arc (warm-up → project deep-dive → fundamentals → scenario → wrap), level calibration, and rules (candidate talks ~70%, no teaching, "I didn't catch that" on unintelligible audio). Timed notes are injected by the browser at T-5 min and at time-up.
- **Debrief**: same Claude pipeline as the other modes. `FaceToFaceDebriefSchema` scores `technical_depth`, `problem_solving`, `clarity`, `delivery`, `body_language` (5 × 5 = 25). The prompt receives a per-answer table for audio (words, seconds, WPM, fillers, longest pause) and for body language (eye contact %, upright %, restless %, hands-near-face %, look-aways), and is told to cite the numbers under *delivery* and *body_language*.

### Body language

`lib/bodyLanguage.ts` runs MediaPipe **Face Landmarker** (478 landmarks + iris + head-pose matrix + 52 expression blendshapes) and **Pose Landmarker** (33 body points) as WASM in the browser, sampling the camera at ~10 fps. Everything stays on the device: no frame, image, or raw landmark is ever sent anywhere. Per answer, the browser aggregates ratios and sends only those with the transcript turn:

| Metric | How it's measured |
| --- | --- |
| `eye_contact_ratio` | Head yaw/pitch from the face transform matrix + iris position within the eye, compared to the calibration baseline |
| `look_away_count` | Sustained (≥ 700 ms) departures from eye contact |
| `upright_ratio` | Shoulder line within 8° of baseline and head not dropped > 15% of shoulder width |
| `restless_ratio` | Head + shoulder centre moving faster than 8% of shoulder width per 100 ms |
| `hand_near_face_ratio` | Either wrist within half a shoulder-width of the nose |
| `smile_ratio`, `brow_furrow_ratio` | Blendshape scores above 0.35 |
| `face_visible_ratio` | Face detected at all |

**Calibration** is the part that makes this fair: the setup page asks for two seconds looking straight at the lens, and every "looking at camera" judgment is relative to that baseline, so an external webcam off to one side doesn't get the candidate marked down. Thresholds live in `THRESHOLDS` at the top of `lib/bodyLanguage.ts`.

Models load from Google's CDN on first use (`storage.googleapis.com/mediapipe-models/…`, ~9 MB, cached by the browser) and the WASM runtime from jsDelivr, pinned to the installed `@mediapipe/tasks-vision` version. To avoid third-party requests entirely, copy both into `public/` and point `FACE_MODEL`, `POSE_MODEL`, and `WASM_BASE` at them.

If the models fail to load (old GPU, blocked CDN), the session still runs; the debrief scores `body_language` 3 with the evidence "Not measured this session." — an explicitly labelled placeholder, never an invented number.

---

## 3. What changed, file by file

### New

| File | Purpose |
| --- | --- |
| `app/face-to-face/page.tsx` | Route. Same auth → verify-email → onboarding gate as the recruiter screen. |
| `components/FaceToFaceSession.tsx` | The whole UI: setup (camera check, mic meter, body-language calibration, track/level picker) → live (self-view, interviewer tile, mute/camera/end, live captions, timer) → debrief + follow-up chat. |
| `lib/realtimeClient.ts` | WebRTC connection to OpenAI, noise gate, manual response gating, barge-in, event forwarding. |
| `lib/bodyLanguage.ts` | On-device MediaPipe face + pose tracking, calibration, per-window body-language aggregation. |
| `lib/faceToFaceQuestions.ts` | Question bank, tracks/levels, seeded plan builder. |
| `lib/faceToFacePrompts.ts` | Interviewer instructions, debrief prompt + JSON schema text, follow-up prompt, metrics summariser. |
| `lib/faceToFaceToken.ts` | HS256 JWT signer for the browser → FastAPI hop; constant-time check for the service secret header. |
| `app/api/face-to-face/start/route.ts` | Creates/resumes the session, enforces the monthly cap, builds the plan, returns the JWT. |
| `app/api/internal/face-to-face/[id]/route.ts` | Server-to-server: returns plan + rendered instructions (+ prior transcript on resume). |
| `app/api/internal/face-to-face/[id]/turns/route.ts` | Server-to-server: persists one transcript turn with optional metrics. |
| `services/realtime/` | FastAPI service: `config.py` (settings), `auth.py` (JWT), `nextjs.py` (internal client), `realtime.py` (session config + client-secret minting), `metrics.py` (junk filter, WPM/fillers/pauses), `main.py` (routes + WebSocket). |
| `FACE_TO_FACE.md` | This file. |

### Modified

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | `ConversationKind.FACE_TO_FACE`; `ConversationSession.plan Json?`; `ConversationMessage.metrics Json?`. |
| `lib/plans.ts` | `faceToFaceSessionsPerMonth` per tier (Free = 2, env-overridable). |
| `lib/conversationTypes.ts` | `FaceToFaceDebriefSchema`; added to the `ConversationDebrief` union. |
| `app/api/conversation/debrief/route.ts` | `FACE_TO_FACE` branch: loads `plan` and per-message `metrics`, uses the new prompt + schema. |
| `app/api/conversation/message/route.ts` | Rejects `mode: "live"` for face-to-face (live turns go through the realtime service); follow-up prompt for the new kind. |
| `components/conversation/ConversationDebriefView.tsx` | Dimension labels for the new kind; `kind` prop widened. |
| `components/TopNav.tsx`, `components/dashboard/PracticeModes.tsx` | Nav entry and dashboard card (grid now 2 → 3 → 5 columns). |
| `app/history/page.tsx`, `app/history/conversation/[id]/page.tsx` | Kind labels, track/level subtitle. |
| `.env.local.example`, `.gitignore` | New env vars documented; `.venv` and `__pycache__` ignored. |

Reused unchanged: `ConversationSession` / `ConversationMessage` / `ConversationDebrief` tables, `EndConversationDialog`, `ChatPanel`, `Timer`, `useTypewriter`, `streamConversationMessage`, the abandon route, and the Claude debrief loop.

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `POST /api/face-to-face/start 500` and server log `REALTIME_SERVICE_SECRET is not set` | Var missing from `.env.local`, or `next dev` was started before it was added | Add it, restart `next dev` (env is read at startup). |
| `Invalid value for argument kind. Expected ConversationKind.` | Prisma client in memory predates the schema change | Stop `next dev`, `npx prisma generate`, start again. |
| `EPERM ... query_engine-windows.dll.node` during `db:push` / `generate` | Running dev server holds the engine file | Same as above. The schema push itself still succeeds. |
| Browser: `:8000/... ERR_CONNECTION_REFUSED` | FastAPI isn't running | Start uvicorn (section 1b). |
| `ImportError: attempted relative import with no known parent package` | uvicorn launched from inside `app/` | Run `uvicorn app.main:app` from `services/realtime`. |
| `pydantic ValidationError ... realtime_service_secret` on startup | Secret missing or under 32 chars in `services/realtime/.env` | Set it to the same 32+ char value as `.env.local`. |
| `api.openai.com/v1/realtime/calls 429` | `insufficient_quota` — the project has no prepaid credits. Minting the ephemeral key succeeds anyway because that endpoint doesn't check balance. | Add credits on the OpenAI billing page. The setup page banner shows OpenAI's exact message. |
| Interviewer replies to breathing / random noise | Room noisier than the defaults expect | Raise `RT_VAD_THRESHOLD` (try 0.85–0.9) and/or `RT_VAD_SILENCE_MS`; restart uvicorn. |
| Interviewer waits too long before answering | Grace window + silence window add up (~2.1 s by default) | Lower `RT_VAD_SILENCE_MS` or `responseGraceMs` in `lib/realtimeClient.ts`. |
| "Loading camera tracking…" never finishes | CDN blocked, or WASM/GPU init failed | Check the browser console; self-host the models (see Body language). The session can still start; body language is just not scored. |
| Calibration keeps failing | Face or shoulders not in frame | Sit centred, camera at eye level, shoulders visible; ensure decent light. Or click **Skip body language** — the session runs without that dimension. |
| Start says "Session time is up" | An old in-progress session outlived the cap | Click Start again — the stale session is abandoned and a fresh one created. |
| Eye contact scores look wrong | Calibrated while looking at the screen, not the lens | Click **Redo** and look at the camera itself for the two seconds. |
