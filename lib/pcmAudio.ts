"use client";

/**
 * 24 kHz PCM16 helpers for the face-to-face voice relay.
 *
 * With the avatar on, the interviewer's voice arrives from OpenAI as base64
 * PCM16 deltas (24 kHz mono) rather than as a WebRTC call track, and the
 * candidate's mic is sent the same way. Reading audio out of a live WebRTC
 * track through Web Audio corrupted speech (heard as an echo), so nothing
 * here touches call tracks.
 */

export const PCM_RATE = 24000;

/** Float samples (-1..1) → little-endian PCM16, base64. */
export function pcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytesToBase64(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Streaming resampler (e.g. the mic's 48 kHz → 24 kHz) with a light low-pass
 * so the downsampled voice doesn't alias. Keeps its position across blocks,
 * so consecutive blocks join without clicks.
 */
export function makeResampler(inRate: number, outRate: number): (input: Float32Array) => Float32Array {
  if (inRate === outRate) return (input) => Float32Array.from(input);
  const step = inRate / outRate;
  let pos = 0; // read position into the current block; -1..0 means "use `last`"
  let last = 0;
  let prev = 0; // low-pass state
  return (input) => {
    // Two-tap average: enough to keep speech clean when halving the rate.
    const smooth = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      smooth[i] = (input[i]! + prev) / 2;
      prev = input[i]!;
    }
    const out: number[] = [];
    while (pos < smooth.length - 1) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = i < 0 ? last : smooth[i]!;
      const b = smooth[i + 1]!;
      out.push(a + (b - a) * frac);
      pos += step;
    }
    pos -= smooth.length;
    last = smooth[smooth.length - 1]!;
    return Float32Array.from(out);
  };
}

/**
 * Plays streamed PCM16 deltas back to back. Used for the interviewer's voice
 * when the avatar isn't (or is no longer) there to speak it.
 */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(private readonly onPlaying: (playing: boolean) => void) {}

  write(b64: string): void {
    if (!this.ctx) this.ctx = new AudioContext();
    const ctx = this.ctx;
    void ctx.resume();
    const bytes = base64ToBytes(b64);
    const count = bytes.length >> 1;
    if (!count) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const buffer = ctx.createBuffer(1, count, PCM_RATE);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) ch[i] = view.getInt16(i * 2, true) / 0x8000;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.05, this.nextTime);
    src.start(startAt);
    this.nextTime = startAt + buffer.duration;

    if (this.sources.size === 0) this.onPlaying(true);
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      if (this.sources.size === 0) this.onPlaying(false);
    };
  }

  /** Barge-in: stop everything queued. */
  clear(): void {
    const wasPlaying = this.sources.size > 0;
    this.sources.forEach((src) => {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* not started yet */
      }
    });
    this.sources.clear();
    this.nextTime = 0;
    if (wasPlaying) this.onPlaying(false);
  }

  close(): void {
    this.clear();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
