import dagre from "@dagrejs/dagre";

export interface GraphLayoutNode {
  id: string;
  label?: string;
  width: number;
  height: number;
  group?: string;
}

export interface GraphLayoutEdge {
  from: string;
  to: string;
  label?: string;
}

export interface LayoutOptions {
  rankdir?: "TB" | "LR";
  nodeSep?: number;
  rankSep?: number;
  edgeSep?: number;
  /** Translation applied to every computed position — used to anchor a new
   *  subgraph near an existing element instead of dagre's default origin. */
  anchorX?: number;
  anchorY?: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  /** Top-left positions, keyed by node id (dagre's own center-based x/y are
   *  converted here so nothing downstream has to know about that convention). */
  positions: Map<string, LayoutRect>;
  bbox: LayoutRect;
  /** Edges that referenced a node id not present in `nodes` — skipped rather
   *  than thrown, since dagre.setEdge throws on unregistered endpoints. */
  skippedEdges: GraphLayoutEdge[];
}

const CLUSTER_PREFIX = "__cluster_";

/**
 * Computes non-overlapping positions for a set of graph nodes using dagre —
 * the model describes structure (nodes + edges + optional group), this
 * computes geometry deterministically. Disconnected nodes/components are
 * laid out and packed by dagre same as any DAG layout engine.
 */
export function layoutGraph(
  nodes: GraphLayoutNode[],
  edges: GraphLayoutEdge[],
  options: LayoutOptions = {},
): LayoutResult {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({
    rankdir: options.rankdir ?? "TB",
    nodesep: options.nodeSep ?? 60,
    ranksep: options.rankSep ?? 100,
    edgesep: options.edgeSep ?? 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const clusterIds = new Set<string>();
  for (const node of nodes) {
    if (node.group) clusterIds.add(`${CLUSTER_PREFIX}${node.group}`);
  }
  for (const clusterId of clusterIds) {
    g.setNode(clusterId, {});
  }

  for (const node of nodes) {
    g.setNode(node.id, { width: node.width, height: node.height, label: node.label });
    if (node.group) g.setParent(node.id, `${CLUSTER_PREFIX}${node.group}`);
  }

  const skippedEdges: GraphLayoutEdge[] = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      skippedEdges.push(edge);
      continue;
    }
    g.setEdge(edge.from, edge.to, edge.label ? { label: edge.label } : {});
  }

  dagre.layout(g);

  const anchorX = options.anchorX ?? 0;
  const anchorY = options.anchorY ?? 0;
  const positions = new Map<string, LayoutRect>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const n = g.node(node.id);
    const x = n.x - n.width / 2 + anchorX;
    const y = n.y - n.height / 2 + anchorY;
    positions.set(node.id, { x, y, width: n.width, height: n.height });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + n.width);
    maxY = Math.max(maxY, y + n.height);
  }

  const bbox: LayoutRect =
    nodes.length === 0
      ? { x: anchorX, y: anchorY, width: 0, height: 0 }
      : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

  return { positions, bbox, skippedEdges };
}
