import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface CanvasSummaryElement {
  id: string;
  type: string;
  text?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface CanvasSummaryConnection {
  from: string;
  to: string;
  label?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClusterSummary {
  id: string;
  elementIds: string[];
  labels: string[];
  bbox: BoundingBox;
}

export interface CanvasSummary {
  elements: CanvasSummaryElement[];
  connections: CanvasSummaryConnection[];
  /** Bounding box of everything on the canvas, or null if it's empty. */
  extent: BoundingBox | null;
  /** Groups of elements connected via arrows — computed, not left for the model to infer. */
  clusters: ClusterSummary[];
  /** An empty region recommended for new, unrelated content. */
  suggestedFreeRegion: BoundingBox;
  /** One-line natural-language read of the layout, so the model orients before placing. */
  spatialNote: string;
}

const DEFAULT_FREE_REGION: BoundingBox = { x: 0, y: 0, width: 800, height: 600 };
const FREE_REGION_MARGIN = 200;
const FREE_REGION_SIZE = { width: 600, height: 400 };

function elementBbox(el: CanvasSummaryElement): BoundingBox {
  return { x: el.x, y: el.y, width: el.width ?? 0, height: el.height ?? 0 };
}

function unionBbox(a: BoundingBox, b: BoundingBox): BoundingBox {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function computeExtent(elements: CanvasSummaryElement[]): BoundingBox | null {
  if (elements.length === 0) return null;
  return elements.map(elementBbox).reduce(unionBbox);
}

function computeClusters(
  elements: CanvasSummaryElement[],
  connections: CanvasSummaryConnection[],
): ClusterSummary[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const adjacency = new Map<string, Set<string>>();
  for (const { from, to } of connections) {
    if (!byId.has(from) || !byId.has(to)) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from)!.add(to);
    adjacency.get(to)!.add(from);
  }

  const visited = new Set<string>();
  const clusters: ClusterSummary[] = [];

  for (const id of adjacency.keys()) {
    if (visited.has(id)) continue;
    const componentIds: string[] = [];
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      componentIds.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    const members = componentIds.map((cid) => byId.get(cid)!).filter(Boolean);
    if (members.length === 0) continue;
    clusters.push({
      id: `cluster-${clusters.length}`,
      elementIds: componentIds,
      labels: members.map((m) => m.text).filter((t): t is string => !!t),
      bbox: members.map(elementBbox).reduce(unionBbox),
    });
  }

  return clusters;
}

function computeSuggestedFreeRegion(extent: BoundingBox | null): BoundingBox {
  if (!extent) return DEFAULT_FREE_REGION;
  return {
    x: extent.x + extent.width + FREE_REGION_MARGIN,
    y: extent.y,
    ...FREE_REGION_SIZE,
  };
}

/** A short, plain-language description of the scene so the model can orient
 *  itself before placing content, instead of parsing raw coordinates. */
function computeSpatialNote(
  elements: CanvasSummaryElement[],
  clusters: ClusterSummary[],
  freeRegion: BoundingBox,
): string {
  if (elements.length === 0) {
    return "Canvas is empty — build freely; automatic layout centers new content.";
  }

  const parts: string[] = [];
  const clusterCount = clusters.length;
  const looseCount = elements.length - clusters.reduce((n, c) => n + c.elementIds.length, 0);

  if (clusterCount > 0) {
    const labelled = clusters
      .map((c) => c.labels[0])
      .filter((l): l is string => !!l)
      .slice(0, 4);
    parts.push(
      `${clusterCount} connected ${clusterCount === 1 ? "cluster" : "clusters"}` +
        (labelled.length ? ` (e.g. ${labelled.join(", ")})` : ""),
    );
  }
  if (looseCount > 0) {
    parts.push(`${looseCount} unconnected element${looseCount === 1 ? "" : "s"}`);
  }

  const where =
    `Open space for new, unrelated content is to the right, around ` +
    `(${Math.round(freeRegion.x)}, ${Math.round(freeRegion.y)}).`;

  return `${parts.join(" and ")} on the canvas. ${where} Reuse existing elements before adding duplicates.`;
}

/**
 * Compact scene summary sent to the model each turn instead of raw
 * Excalidraw JSON — strips stroke widths, roughness seeds, version numbers,
 * and binding internals the model doesn't need to reason about. This is the
 * single biggest lever for keeping small/cheap models reliable.
 *
 * Also computes spatial facts (extent, connected-component clusters, a
 * suggested empty region) so the model doesn't have to infer them itself
 * from a flat coordinate list — spatial reasoning is done by code, not
 * left to the LLM.
 */
export function buildCanvasSummary(elements: readonly ExcalidrawElement[]): CanvasSummary {
  const live = elements.filter((el) => !el.isDeleted);
  const summaryElements: CanvasSummaryElement[] = [];
  const connections: CanvasSummaryConnection[] = [];

  for (const el of live) {
    if (el.type === "arrow") {
      const start = el.startBinding?.elementId;
      const end = el.endBinding?.elementId;
      if (start && end) {
        const boundText = live.find(
          (t) => t.type === "text" && "containerId" in t && t.containerId === el.id,
        );
        connections.push({
          from: start,
          to: end,
          ...(boundText && "text" in boundText ? { label: boundText.text as string } : {}),
        });
        continue;
      }
    }
    if (el.type === "text" && "containerId" in el && el.containerId) {
      // bound label text, already represented via the container/connection
      continue;
    }

    const text =
      "text" in el
        ? (el.text as string)
        : (() => {
            const bound = live.find(
              (t) => t.type === "text" && "containerId" in t && t.containerId === el.id,
            );
            return bound && "text" in bound ? (bound.text as string) : undefined;
          })();

    summaryElements.push({
      id: el.id,
      type: el.type,
      x: Math.round(el.x),
      y: Math.round(el.y),
      ...(el.width ? { width: Math.round(el.width) } : {}),
      ...(el.height ? { height: Math.round(el.height) } : {}),
      ...(text ? { text } : {}),
    });
  }

  const extent = computeExtent(summaryElements);
  const clusters = computeClusters(summaryElements, connections);
  const suggestedFreeRegion = computeSuggestedFreeRegion(extent);

  return {
    elements: summaryElements,
    connections,
    extent,
    clusters,
    suggestedFreeRegion,
    spatialNote: computeSpatialNote(summaryElements, clusters, suggestedFreeRegion),
  };
}
