/**
 * Deterministic tiered layout for the workflow diagram.
 *
 * Agents are placed into horizontal tiers by role family (orchestration →
 * production → review → integration → human), then spread evenly within each
 * tier. Edges are routed as cubic curves whose control points depend on whether
 * the edge runs down a tier, back up one, or sideways within one — that single
 * rule is what stops the graph from turning into a bowl of spaghetti.
 *
 * Pure and dependency-free so it can be unit tested and reused at any size.
 */

import { roleById } from '../../model/catalog';
import type { Agent, CommunicationEdge, EdgeKind } from '../../model/types';

export interface LayoutNode {
  id: string;
  label: string;
  /** Short role label shown under the name. */
  role: string;
  family: 'orchestration' | 'production' | 'review' | 'human';
  tier: number;
  x: number;
  y: number;
  width: number;
  height: number;
  mandatory: boolean;
  enabled: boolean;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  payload: string;
  path: string;
  /** Midpoint, for optional labelling and hit targets. */
  midX: number;
  midY: number;
  /** Feedback edges (going back up a tier) are drawn differently. */
  isFeedback: boolean;
  isSelfTier: boolean;
}

export interface DiagramLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  tierLabels: Array<{ tier: number; label: string; y: number }>;
}

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  hGap?: number;
  vGap?: number;
  padding?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  nodeWidth: 148,
  nodeHeight: 52,
  hGap: 24,
  vGap: 62,
  padding: 20,
};

const TIER_LABELS: Record<number, string> = {
  0: 'Direction',
  1: 'Production',
  2: 'Review',
  3: 'Integration',
  4: 'Human',
};

/**
 * Assigns a tier. Uses the role catalog's tier as the base, then compacts so
 * empty tiers do not leave gaps — a roster with no orchestrator should not
 * render with an empty band at the top.
 */
function assignTiers(agents: Agent[]): Map<string, number> {
  const raw = new Map<string, number>();
  agents.forEach((agent) => {
    const role = roleById(agent.roleType);
    // The mediator sits with integration rather than direction, because in the
    // diagram it receives escalations from below.
    const tier = agent.roleType === 'mediator' ? 3 : role.tier;
    raw.set(agent.id, tier);
  });

  const used = Array.from(new Set(raw.values())).sort((a, b) => a - b);
  const compacted = new Map<number, number>();
  used.forEach((tier, index) => compacted.set(tier, index));

  const result = new Map<string, number>();
  raw.forEach((tier, id) => result.set(id, compacted.get(tier) ?? 0));
  return result;
}

export function computeLayout(
  agents: Agent[],
  commEdges: CommunicationEdge[],
  options: LayoutOptions = {},
): DiagramLayout {
  const opt = { ...DEFAULTS, ...options };
  const active = agents.filter((a) => a.enabled);

  if (active.length === 0) {
    return { nodes: [], edges: [], width: 320, height: 120, tierLabels: [] };
  }

  const tiers = assignTiers(active);
  const byTier = new Map<number, Agent[]>();
  active.forEach((agent) => {
    const tier = tiers.get(agent.id) ?? 0;
    byTier.set(tier, [...(byTier.get(tier) ?? []), agent]);
  });

  const tierCount = Math.max(...byTier.keys()) + 1;
  const widest = Math.max(...Array.from(byTier.values(), (list) => list.length));
  const rowWidth = widest * opt.nodeWidth + (widest - 1) * opt.hGap;
  const width = rowWidth + opt.padding * 2;
  const height = tierCount * opt.nodeHeight + (tierCount - 1) * opt.vGap + opt.padding * 2;

  const nodes: LayoutNode[] = [];
  const tierLabels: DiagramLayout['tierLabels'] = [];

  for (let tier = 0; tier < tierCount; tier += 1) {
    const list = byTier.get(tier) ?? [];
    if (list.length === 0) continue;

    const tierWidth = list.length * opt.nodeWidth + (list.length - 1) * opt.hGap;
    const startX = opt.padding + (rowWidth - tierWidth) / 2;
    const y = opt.padding + tier * (opt.nodeHeight + opt.vGap);

    // Find the original tier key for the label, before compaction.
    const originalTier = roleById(list[0].roleType).tier;
    tierLabels.push({ tier, label: TIER_LABELS[originalTier] ?? '', y: y + opt.nodeHeight / 2 });

    list.forEach((agent, index) => {
      const role = roleById(agent.roleType);
      nodes.push({
        id: agent.id,
        label: agent.name,
        role: role.label,
        family: role.family,
        tier,
        x: startX + index * (opt.nodeWidth + opt.hGap),
        y,
        width: opt.nodeWidth,
        height: opt.nodeHeight,
        mandatory: agent.mandatoryApproval,
        enabled: agent.enabled,
      });
    });
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Deduplicate: two agents can have several logical edges between them, but
  // drawing them stacked adds noise without adding information.
  const seen = new Set<string>();
  const edges: LayoutEdge[] = [];

  commEdges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to || from.id === to.id) return;

    const key = `${edge.from}->${edge.to}`;
    if (seen.has(key)) return;
    seen.add(key);

    const isFeedback = to.tier < from.tier;
    const isSelfTier = to.tier === from.tier;

    edges.push({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      payload: edge.payload,
      isFeedback,
      isSelfTier,
      ...routeEdge(from, to, isFeedback, isSelfTier),
    });
  });

  return { nodes, edges, width, height, tierLabels };
}

interface Route {
  path: string;
  midX: number;
  midY: number;
}

/**
 * Routes one edge. Downward edges leave the bottom and enter the top;
 * feedback edges hug the side so they stay visually distinct from the main
 * flow; same-tier edges arc below their row.
 */
function routeEdge(from: LayoutNode, to: LayoutNode, isFeedback: boolean, isSelfTier: boolean): Route {
  if (isSelfTier) {
    // Arc beneath the row, bulging downward so it does not cross the nodes.
    const y = from.y + from.height;
    const x1 = from.x + from.width / 2;
    const x2 = to.x + to.width / 2;
    const bulge = 22;
    const midX = (x1 + x2) / 2;
    const midY = y + bulge;
    return {
      path: `M ${x1} ${y} C ${x1} ${y + bulge}, ${x2} ${y + bulge}, ${x2} ${y}`,
      midX,
      midY,
    };
  }

  if (isFeedback) {
    // Exit the side nearest the target, loop out and back up.
    const goingLeft = to.x + to.width / 2 <= from.x + from.width / 2;
    const x1 = goingLeft ? from.x : from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = goingLeft ? to.x : to.x + to.width;
    const y2 = to.y + to.height / 2;
    const swing = goingLeft ? -46 : 46;
    const midX = (x1 + x2) / 2 + swing * 0.75;
    const midY = (y1 + y2) / 2;
    return {
      path: `M ${x1} ${y1} C ${x1 + swing} ${y1}, ${x2 + swing} ${y2}, ${x2} ${y2}`,
      midX,
      midY,
    };
  }

  // Standard downward edge.
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const dy = (y2 - y1) * 0.55;
  return {
    path: `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`,
    midX: (x1 + x2) / 2,
    midY: (y1 + y2) / 2,
  };
}

/** Compact layout options used by the small diagrams on preset cards. */
export const MINI_LAYOUT: LayoutOptions = {
  nodeWidth: 62,
  nodeHeight: 20,
  hGap: 10,
  vGap: 22,
  padding: 8,
};
