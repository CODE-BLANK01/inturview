"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Buffers incoming text chunks and emits them character-by-character at ~cps rate
 * via requestAnimationFrame. Designed for streaming LLM output that arrives in
 * uneven token-sized bursts but should *render* smoothly.
 */
export function useTypewriter(charsPerSecond = 40) {
  const [visible, setVisible] = useState("");
  const bufferRef = useRef<string>("");
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const carryRef = useRef<number>(0);
  const drainCbRef = useRef<(() => void) | null>(null);

  const stopLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tick = useCallback(
    (now: number) => {
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const owed = carryRef.current + dt * charsPerSecond;
      const n = Math.floor(owed);
      carryRef.current = owed - n;

      if (n > 0 && bufferRef.current.length > 0) {
        const take = Math.min(n, bufferRef.current.length);
        const chunk = bufferRef.current.slice(0, take);
        bufferRef.current = bufferRef.current.slice(take);
        setVisible((v) => v + chunk);
      }

      if (bufferRef.current.length === 0) {
        const cb = drainCbRef.current;
        if (cb) {
          drainCbRef.current = null;
          stopLoop();
          cb();
          return;
        }
        // No buffered content and no drain pending — keep loop alive so future
        // appends pick up immediately. Actually, stop and restart on append.
        stopLoop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [charsPerSecond]
  );

  const ensureRunning = useCallback(() => {
    if (rafRef.current === null) {
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const append = useCallback(
    (chunk: string) => {
      if (!chunk) return;
      bufferRef.current += chunk;
      ensureRunning();
    },
    [ensureRunning]
  );

  /**
   * Resolves when the buffer is fully drained to the visible state.
   * If the buffer is already empty, resolves on the next microtask.
   */
  const drain = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (bufferRef.current.length === 0) {
        queueMicrotask(resolve);
        return;
      }
      drainCbRef.current = resolve;
      ensureRunning();
    });
  }, [ensureRunning]);

  const reset = useCallback(() => {
    stopLoop();
    bufferRef.current = "";
    carryRef.current = 0;
    drainCbRef.current = null;
    setVisible("");
  }, []);

  useEffect(() => () => stopLoop(), []);

  return { visible, append, drain, reset };
}
