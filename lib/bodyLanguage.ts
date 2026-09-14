/**
 * In-browser body-language tracking for the face-to-face round.
 *
 * Runs MediaPipe Face Landmarker + Pose Landmarker (WASM) on the local camera
 * stream at ~10 fps. Raw per-frame features are kept in memory; nothing about
 * the video leaves the machine. Only aggregated ratios per answer window are
 * sent to the server.
 *
 * "Looking at the camera" is judged relative to a 2-second calibration taken
 * while the candidate looks at the lens, so camera placement doesn't bias it.
 */

type VisionModule = typeof import("@mediapipe/tasks-vision");
type FaceLandmarker = import("@mediapipe/tasks-vision").FaceLandmarker;
type PoseLandmarker = import("@mediapipe/tasks-vision").PoseLandmarker;
type NormalizedLandmark = import("@mediapipe/tasks-vision").NormalizedLandmark;

const MP_VERSION = "1.0.1";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const SAMPLE_MS = 100;
const MAX_FRAMES = 15_000;

// Face mesh indices: iris centres and the eye corners / lids that bound them.
const RIGHT_EYE = { iris: 468, inner: 133, outer: 33, top: 159, bottom: 145 };
const LEFT_EYE = { iris: 473, inner: 362, outer: 263, top: 386, bottom: 374 };
// Pose indices.
const POSE = { nose: 0, lShoulder: 11, rShoulder: 12, lWrist: 15, rWrist: 16 };

const THRESHOLDS = {
  yawDeg: 12,
  pitchDeg: 10,
  irisX: 0.12,
  irisY: 0.15,
  shoulderTiltDeg: 8,
  noseDrop: 0.15,
  moveSpeed: 0.08,
  handNearFace: 0.5,
  smile: 0.35,
  brow: 0.35,
  lookAwayMs: 700,
};

interface Frame {
  t: number;
  face: boolean;
  yaw?: number;
  pitch?: number;
  irisX?: number;
  irisY?: number;
  smile?: number;
  brow?: number;
  pose: boolean;
  shoulderTilt?: number;
  noseDrop?: number;
  moveSpeed?: number;
  handNearFace?: boolean;
}

export interface BodyCalibration {
  yaw: number;
  pitch: number;
  irisX: number;
  irisY: number;
  shoulderTilt: number;
  noseDrop: number;
}

export interface BodyMetrics {
  frames: number;
  face_visible_ratio: number;
  eye_contact_ratio: number;
  look_away_count: number;
  upright_ratio: number;
  restless_ratio: number;
  hand_near_face_ratio: number;
  smile_ratio: number;
  brow_furrow_ratio: number;
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function irisRatio(lm: NormalizedLandmark[], eye: typeof RIGHT_EYE): { x: number; y: number } | null {
  const iris = lm[eye.iris];
  const inner = lm[eye.inner];
  const outer = lm[eye.outer];
  const top = lm[eye.top];
  const bottom = lm[eye.bottom];
  if (!iris || !inner || !outer || !top || !bottom) return null;
  const w = outer.x - inner.x;
  const h = bottom.y - top.y;
  if (Math.abs(w) < 1e-4 || Math.abs(h) < 1e-4) return null;
  return { x: (iris.x - inner.x) / w, y: (iris.y - top.y) / h };
}

function headAngles(m: number[]): { yaw: number; pitch: number } {
  // Column-major 4x4; decompose as Ry(yaw)·Rx(pitch)·Rz(roll).
  const m02 = m[8]!;
  const m12 = m[9]!;
  const m22 = m[10]!;
  const yaw = (Math.atan2(m02, m22) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, -m12))) * 180) / Math.PI;
  return { yaw, pitch };
}

function blendshape(categories: { categoryName: string; score: number }[], name: string): number {
  return categories.find((c) => c.categoryName === name)?.score ?? 0;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export class BodyLanguageTracker {
  private face: FaceLandmarker;
  private pose: PoseLandmarker;
  private video: HTMLVideoElement | null = null;
  private timer: number | null = null;
  private frames: Frame[] = [];
  private prevCentre: { x: number; y: number; t: number } | null = null;
  private lastTimestamp = 0;
  private disposed = false;

  private constructor(face: FaceLandmarker, pose: PoseLandmarker) {
    this.face = face;
    this.pose = pose;
  }

  static async load(): Promise<BodyLanguageTracker> {
    const vision: VisionModule = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);

    const create = async (delegate: "GPU" | "CPU") => {
      const face = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      const pose = await vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      return new BodyLanguageTracker(face, pose);
    };

    try {
      return await create("GPU");
    } catch {
      return await create("CPU");
    }
  }

  attach(stream: MediaStream): void {
    if (this.disposed) return;
    this.detach();
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.play().catch(() => {});
    this.video = video;
    this.timer = window.setInterval(() => this.sample(), SAMPLE_MS);
  }

  private detach(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.prevCentre = null;
  }

  dispose(): void {
    this.disposed = true;
    this.detach();
    this.face.close();
    this.pose.close();
    this.frames = [];
  }

  private sample(): void {
    const video = this.video;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return;

    // Both landmarkers require strictly increasing timestamps.
    let ts = performance.now();
    if (ts <= this.lastTimestamp) ts = this.lastTimestamp + 1;
    this.lastTimestamp = ts;

    const frame: Frame = { t: Date.now(), face: false, pose: false };

    try {
      const f = this.face.detectForVideo(video, ts);
      const lm = f.faceLandmarks[0];
      if (lm) {
        frame.face = true;
        const matrix = f.facialTransformationMatrixes[0];
        if (matrix && matrix.data.length >= 12) {
          const { yaw, pitch } = headAngles(matrix.data);
          frame.yaw = yaw;
          frame.pitch = pitch;
        }
        const r = irisRatio(lm, RIGHT_EYE);
        const l = irisRatio(lm, LEFT_EYE);
        if (r && l) {
          frame.irisX = (r.x + l.x) / 2;
          frame.irisY = (r.y + l.y) / 2;
        }
        const cats = f.faceBlendshapes[0]?.categories;
        if (cats) {
          frame.smile = (blendshape(cats, "mouthSmileLeft") + blendshape(cats, "mouthSmileRight")) / 2;
          frame.brow = (blendshape(cats, "browDownLeft") + blendshape(cats, "browDownRight")) / 2;
        }
      }
    } catch {}

    try {
      const p = this.pose.detectForVideo(video, ts);
      const lm = p.landmarks[0];
      const ls = lm?.[POSE.lShoulder];
      const rs = lm?.[POSE.rShoulder];
      const nose = lm?.[POSE.nose];
      if (lm && ls && rs && nose && ls.visibility > 0.5 && rs.visibility > 0.5) {
        frame.pose = true;
        const width = dist(ls, rs);
        if (width > 1e-3) {
          frame.shoulderTilt = (Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180) / Math.PI;
          const midX = (ls.x + rs.x) / 2;
          const midY = (ls.y + rs.y) / 2;
          frame.noseDrop = (nose.y - midY) / width;

          const cx = (nose.x + midX) / 2;
          const cy = (nose.y + midY) / 2;
          if (this.prevCentre) {
            const dt = Math.max(1, frame.t - this.prevCentre.t);
            frame.moveSpeed =
              (Math.hypot(cx - this.prevCentre.x, cy - this.prevCentre.y) / width) * (SAMPLE_MS / dt);
          }
          this.prevCentre = { x: cx, y: cy, t: frame.t };

          const near = (w: NormalizedLandmark | undefined) =>
            !!w && w.visibility > 0.5 && dist(w, nose) < THRESHOLDS.handNearFace * width;
          frame.handNearFace = near(lm[POSE.lWrist]) || near(lm[POSE.rWrist]);
        }
      } else {
        this.prevCentre = null;
      }
    } catch {}

    this.frames.push(frame);
    if (this.frames.length > MAX_FRAMES) this.frames.splice(0, this.frames.length - MAX_FRAMES);
  }

  /**
   * Average at least `durationMs` of frames into a baseline. CPU-delegate
   * machines sample well under 10 fps, so the window stretches up to `maxMs`
   * until enough frames exist. Resolves null if the face/body wasn't seen.
   */
  async calibrate(durationMs = 2000, maxMs = 6000): Promise<BodyCalibration | null> {
    const start = Date.now();
    let faceFrames: Frame[] = [];
    let poseFrames: Frame[] = [];
    while (true) {
      await new Promise((r) => setTimeout(r, 100));
      const elapsed = Date.now() - start;
      const window = this.frames.filter((f) => f.t >= start);
      faceFrames = window.filter((f) => f.face && f.yaw !== undefined && f.irisX !== undefined);
      poseFrames = window.filter((f) => f.pose && f.shoulderTilt !== undefined);
      const enough = faceFrames.length >= 6 && poseFrames.length >= 4;
      if ((elapsed >= durationMs && enough) || elapsed >= maxMs) break;
    }
    if (faceFrames.length < 6 || poseFrames.length < 4) return null;
    return {
      yaw: mean(faceFrames.map((f) => f.yaw!)),
      pitch: mean(faceFrames.map((f) => f.pitch!)),
      irisX: mean(faceFrames.map((f) => f.irisX!)),
      irisY: mean(faceFrames.map((f) => f.irisY!)),
      shoulderTilt: mean(poseFrames.map((f) => f.shoulderTilt!)),
      noseDrop: mean(poseFrames.map((f) => f.noseDrop!)),
    };
  }

  /** Aggregate metrics for frames sampled between two wall-clock times. */
  window(startMs: number, endMs: number, cal: BodyCalibration): BodyMetrics | null {
    const frames = this.frames.filter((f) => f.t >= startMs && f.t <= endMs);
    return summarize(frames, cal);
  }
}

function summarize(frames: Frame[], cal: BodyCalibration): BodyMetrics | null {
  if (frames.length < 5) return null;

  let faceN = 0;
  let poseN = 0;
  let contact = 0;
  let upright = 0;
  let restless = 0;
  let hand = 0;
  let smile = 0;
  let brow = 0;
  let lookAways = 0;
  let awaySince: number | null = null;
  let awayCounted = false;

  for (const f of frames) {
    if (f.face) {
      faceN++;
      const eyes =
        f.yaw !== undefined &&
        f.pitch !== undefined &&
        Math.abs(f.yaw - cal.yaw) < THRESHOLDS.yawDeg &&
        Math.abs(f.pitch - cal.pitch) < THRESHOLDS.pitchDeg &&
        (f.irisX === undefined || Math.abs(f.irisX - cal.irisX) < THRESHOLDS.irisX) &&
        (f.irisY === undefined || Math.abs(f.irisY - cal.irisY) < THRESHOLDS.irisY);
      if (eyes) {
        contact++;
        awaySince = null;
        awayCounted = false;
      } else {
        if (awaySince === null) awaySince = f.t;
        if (!awayCounted && f.t - awaySince >= THRESHOLDS.lookAwayMs) {
          lookAways++;
          awayCounted = true;
        }
      }
      if ((f.smile ?? 0) > THRESHOLDS.smile) smile++;
      if ((f.brow ?? 0) > THRESHOLDS.brow) brow++;
    } else {
      awaySince = null;
      awayCounted = false;
    }

    if (f.pose && f.shoulderTilt !== undefined && f.noseDrop !== undefined) {
      poseN++;
      const isUpright =
        Math.abs(f.shoulderTilt - cal.shoulderTilt) < THRESHOLDS.shoulderTiltDeg &&
        f.noseDrop - cal.noseDrop < THRESHOLDS.noseDrop;
      if (isUpright) upright++;
      if ((f.moveSpeed ?? 0) > THRESHOLDS.moveSpeed) restless++;
      if (f.handNearFace) hand++;
    }
  }

  const ratio = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 1000 : 0);

  return {
    frames: frames.length,
    face_visible_ratio: ratio(faceN, frames.length),
    eye_contact_ratio: ratio(contact, faceN),
    look_away_count: lookAways,
    upright_ratio: ratio(upright, poseN),
    restless_ratio: ratio(restless, poseN),
    hand_near_face_ratio: ratio(hand, poseN),
    smile_ratio: ratio(smile, faceN),
    brow_furrow_ratio: ratio(brow, faceN),
  };
}
