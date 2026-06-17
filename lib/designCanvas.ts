/**
 * Turn an Excalidraw scene JSON into a plain-text spec the LLM can read.
 *
 * Excalidraw stores a flat list of elements (rectangles, ellipses, diamonds,
 * arrows, text). We extract the structurally meaningful bits:
 *   - shape boxes with their text label (centroid + size)
 *   - arrows with from/to labels resolved by hit-testing endpoints to boxes
 *   - free-standing text notes
 *
 * The result is multi-line, max ~80 lines — designed to fit in the system
 * prompt without blowing tokens. If the canvas is empty or unreadable we
 * return "(empty canvas)" so the prompt template doesn't break.
 */

type ExcalidrawElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  containerId?: string | null;
  startBinding?: { elementId?: string } | null;
  endBinding?: { elementId?: string } | null;
  points?: number[][];
  isDeleted?: boolean;
};

const SHAPE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);
const ARROW_TYPES = new Set(["arrow", "line"]);
const TEXT_TYPES = new Set(["text"]);

function safeParse(scene: unknown): { elements: ExcalidrawElement[] } | null {
  if (!scene) return null;
  if (typeof scene === "string") {
    try {
      return JSON.parse(scene);
    } catch {
      return null;
    }
  }
  if (typeof scene === "object" && scene !== null) {
    return scene as { elements: ExcalidrawElement[] };
  }
  return null;
}

function labelOf(el: ExcalidrawElement, byContainer: Map<string, ExcalidrawElement[]>): string {
  if (el.text && el.text.trim()) return el.text.trim();
  const children = byContainer.get(el.id) ?? [];
  const fromChild = children
    .map((c) => c.text?.trim())
    .filter((t): t is string => !!t)
    .join(" ");
  return fromChild || "(unlabeled)";
}

function findBoxAt(
  x: number,
  y: number,
  boxes: ExcalidrawElement[]
): ExcalidrawElement | null {
  // Pick the smallest box whose bounding rect contains the point.
  let best: ExcalidrawElement | null = null;
  let bestArea = Infinity;
  for (const b of boxes) {
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      const area = b.width * b.height;
      if (area < bestArea) {
        best = b;
        bestArea = area;
      }
    }
  }
  return best;
}

export function describeCanvas(scene: unknown): string {
  const parsed = safeParse(scene);
  if (!parsed?.elements?.length) return "(empty canvas)";

  const elements = parsed.elements.filter((e) => !e.isDeleted);

  const byContainer = new Map<string, ExcalidrawElement[]>();
  for (const el of elements) {
    if (el.containerId) {
      const list = byContainer.get(el.containerId) ?? [];
      list.push(el);
      byContainer.set(el.containerId, list);
    }
  }

  const boxes = elements.filter((e) => SHAPE_TYPES.has(e.type));
  const arrows = elements.filter((e) => ARROW_TYPES.has(e.type));
  const freeText = elements.filter(
    (e) => TEXT_TYPES.has(e.type) && !e.containerId
  );

  const lines: string[] = [];

  if (boxes.length) {
    lines.push("COMPONENTS:");
    for (const b of boxes.slice(0, 40)) {
      const label = labelOf(b, byContainer);
      lines.push(`- ${label} [${b.type}]`);
    }
  }

  if (arrows.length) {
    lines.push("");
    lines.push("CONNECTIONS:");
    for (const a of arrows.slice(0, 40)) {
      let fromLabel = "?";
      let toLabel = "?";

      const startId = a.startBinding?.elementId;
      const endId = a.endBinding?.elementId;
      if (startId) {
        const b = boxes.find((x) => x.id === startId);
        if (b) fromLabel = labelOf(b, byContainer);
      }
      if (endId) {
        const b = boxes.find((x) => x.id === endId);
        if (b) toLabel = labelOf(b, byContainer);
      }

      // Fallback: hit-test endpoints against box bounds.
      if ((fromLabel === "?" || toLabel === "?") && a.points && a.points.length >= 2) {
        const first = a.points[0];
        const last = a.points[a.points.length - 1];
        if (first && fromLabel === "?") {
          const hit = findBoxAt(a.x + first[0], a.y + first[1], boxes);
          if (hit) fromLabel = labelOf(hit, byContainer);
        }
        if (last && toLabel === "?") {
          const hit = findBoxAt(a.x + last[0], a.y + last[1], boxes);
          if (hit) toLabel = labelOf(hit, byContainer);
        }
      }

      // Skip arrows where we couldn't identify either end — too lossy to keep.
      if (fromLabel === "?" && toLabel === "?") continue;
      lines.push(`- ${fromLabel} → ${toLabel}`);
    }
  }

  if (freeText.length) {
    lines.push("");
    lines.push("NOTES:");
    for (const t of freeText.slice(0, 20)) {
      const txt = (t.text ?? "").trim();
      if (txt) lines.push(`- ${txt}`);
    }
  }

  return lines.length ? lines.join("\n") : "(empty canvas)";
}
