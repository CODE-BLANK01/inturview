"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import "@excalidraw/excalidraw/index.css";

// Excalidraw is a heavy client-only component — dynamic import with SSR off.
// We import the named `Excalidraw` export.
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false, loading: () => <CanvasSkeleton /> }
);

type ExcalidrawElement = unknown;
type AppState = Record<string, unknown>;
type Files = Record<string, unknown>;

interface DesignCanvasProps {
  /** Persisted scene from the DB. Null on fresh session. */
  initialScene?: { elements?: ExcalidrawElement[]; appState?: AppState; files?: Files } | null;
  /** Read-only mode — e.g. post-debrief or completed session. */
  readOnly?: boolean;
  /** Theme override; defaults to light to match Parchment. */
  theme?: "light" | "dark";
  /** Called whenever the scene changes. Caller is responsible for debouncing
   *  before hitting the network (we already debounce 1.2s internally). */
  onSceneChange?: (scene: {
    elements: readonly ExcalidrawElement[];
    appState: AppState;
    files: Files;
  }) => void;
}

function CanvasSkeleton() {
  return (
    <div className="h-full w-full grid place-items-center bg-bg-elevated/40 border border-border rounded-md">
      <p className="text-sm text-text-dim">Loading whiteboard…</p>
    </div>
  );
}

export function DesignCanvas({
  initialScene,
  readOnly,
  theme = "light",
  onSceneChange,
}: DesignCanvasProps) {
  // Debounce scene-change emits so we don't hammer the parent (and through it,
  // the network) on every cursor wiggle. 1.2s after the last edit.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<Parameters<NonNullable<DesignCanvasProps["onSceneChange"]>>[0] | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const initialData = useMemo(() => {
    if (!initialScene) return undefined;
    return {
      elements: (initialScene.elements ?? []) as never,
      appState: {
        ...(initialScene.appState ?? {}),
        // Force collaborators off / viewMode read-only is set via prop instead.
        collaborators: new Map(),
      } as never,
      files: (initialScene.files ?? {}) as never,
    };
  }, [initialScene]);

  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-border bg-bg">
      <Excalidraw
        initialData={initialData as never}
        viewModeEnabled={readOnly}
        theme={theme}
        onChange={(elements, appState, files) => {
          latestRef.current = {
            elements,
            appState: appState as unknown as AppState,
            files: files as unknown as Files,
          };
          if (!onSceneChange) return;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            if (latestRef.current) onSceneChange(latestRef.current);
          }, 1200);
        }}
        UIOptions={{
          canvasActions: {
            saveAsImage: false,
            saveToActiveFile: false,
            loadScene: false,
            export: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}
