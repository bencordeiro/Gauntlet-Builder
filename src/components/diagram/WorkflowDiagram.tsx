/**
 * Workflow topology diagram.
 *
 * Renders the agent roster and communication edges as an SVG. Nodes are
 * focusable buttons so the whole diagram is keyboard-navigable, and selecting
 * one highlights its edges and opens an inspector describing what it sends and
 * receives — which is the actual question users have when they look at this.
 */

import { useMemo, useState } from 'react';

import { humanize } from '../../engine/text';
import type { Agent, CommunicationEdge } from '../../model/types';
import { Badge } from '../ui';
import { computeLayout, MINI_LAYOUT, type LayoutOptions } from './layout';
import './WorkflowDiagram.css';

interface WorkflowDiagramProps {
  agents: Agent[];
  edges: CommunicationEdge[];
  /** Hides the legend and inspector, for embedding in tight spaces. */
  compact?: boolean;
  /** Externally-controlled selection, e.g. from the agent list. */
  selectedId?: string;
  onSelect?: (id: string | undefined) => void;
  options?: LayoutOptions;
  /** Accessible caption describing the diagram. */
  caption?: string;
}

export function WorkflowDiagram({
  agents,
  edges,
  compact = false,
  selectedId: controlledId,
  onSelect,
  options,
  caption,
}: WorkflowDiagramProps) {
  const [internalId, setInternalId] = useState<string | undefined>();
  const selectedId = controlledId !== undefined ? controlledId : internalId;

  const layout = useMemo(() => computeLayout(agents, edges, options), [agents, edges, options]);

  const select = (id: string | undefined) => {
    if (onSelect) onSelect(id);
    else setInternalId(id);
  };

  const selectedAgent = agents.find((a) => a.id === selectedId);
  const nodeById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout.nodes]);

  if (layout.nodes.length === 0) {
    return (
      <div className="diagram-wrap">
        <p className="diagram-empty">
          No agents yet. Add agents and the workflow will appear here.
        </p>
      </div>
    );
  }

  const connectedIds = new Set<string>();
  if (selectedId) {
    connectedIds.add(selectedId);
    layout.edges.forEach((e) => {
      if (e.from === selectedId) connectedIds.add(e.to);
      if (e.to === selectedId) connectedIds.add(e.from);
    });
  }

  const outgoing = layout.edges.filter((e) => e.from === selectedId);
  const incoming = layout.edges.filter((e) => e.to === selectedId);

  const textSummary = layout.nodes
    .map((n) => {
      const sends = layout.edges.filter((e) => e.from === n.id).map((e) => nodeById.get(e.to)?.label);
      return sends.length > 0 ? `${n.label} sends to ${sends.join(', ')}` : `${n.label} sends to nobody`;
    })
    .join('. ');

  return (
    <div className="diagram-wrap">
      <div className="diagram-scroll scroll-x">
        <svg
          className="diagram-svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="group"
          aria-label={caption ?? 'Workflow topology'}
        >
          <desc>{textSummary}</desc>
          <defs>
            <marker
              id="gb-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 1 L7 4 L0 7 z" fill="var(--edge-line)" />
            </marker>
            <marker
              id="gb-arrow-strong"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 1 L7 4 L0 7 z" fill="var(--edge-line-strong)" />
            </marker>
          </defs>

          <g className="diagram-edges">
            {layout.edges.map((edge) => {
              const highlight = selectedId
                ? edge.from === selectedId || edge.to === selectedId
                : false;
              const dim = Boolean(selectedId) && !highlight;
              return (
                <path
                  key={edge.id}
                  className="diagram-edge"
                  d={edge.path}
                  data-feedback={edge.isFeedback}
                  data-self-tier={edge.isSelfTier}
                  data-highlight={highlight}
                  data-dim={dim}
                  markerEnd={highlight ? 'url(#gb-arrow-strong)' : 'url(#gb-arrow)'}
                >
                  <title>{`${nodeById.get(edge.from)?.label} → ${nodeById.get(edge.to)?.label}: ${edge.payload}`}</title>
                </path>
              );
            })}
          </g>

          <g className="diagram-nodes">
            {layout.nodes.map((node) => {
              const dim = Boolean(selectedId) && !connectedIds.has(node.id);
              const isSelected = node.id === selectedId;
              return (
                <g
                  key={node.id}
                  className="diagram-node"
                  data-family={node.family}
                  data-selected={isSelected}
                  data-dim={dim}
                  transform={`translate(${node.x}, ${node.y})`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${node.label}, ${node.role}${node.mandatory ? ', approval required' : ''}`}
                  onClick={() => select(isSelected ? undefined : node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      select(isSelected ? undefined : node.id);
                    }
                    if (e.key === 'Escape') select(undefined);
                  }}
                >
                  <rect className="diagram-node-box" width={node.width} height={node.height} />
                  {node.mandatory && (
                    <circle className="diagram-node-gate" cx={node.width - 9} cy={9} r={3}>
                      <title>Approval required</title>
                    </circle>
                  )}
                  <text
                    className="diagram-node-label"
                    x={node.width / 2}
                    y={node.height / 2 - 3}
                    textAnchor="middle"
                  >
                    {truncate(node.label, Math.floor(node.width / 6.2))}
                  </text>
                  <text
                    className="diagram-node-role"
                    x={node.width / 2}
                    y={node.height / 2 + 11}
                    textAnchor="middle"
                  >
                    {truncate(node.role, Math.floor(node.width / 5.4))}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {!compact && (
        <div className="diagram-legend">
          <span className="diagram-legend-item">
            <span
              className="diagram-legend-swatch"
              style={{ background: 'var(--node-orchestrate)', borderColor: 'var(--node-orchestrate-border)' }}
            />
            Direction
          </span>
          <span className="diagram-legend-item">
            <span
              className="diagram-legend-swatch"
              style={{ background: 'var(--node-build)', borderColor: 'var(--node-build-border)' }}
            />
            Builds
          </span>
          <span className="diagram-legend-item">
            <span
              className="diagram-legend-swatch"
              style={{ background: 'var(--node-review)', borderColor: 'var(--node-review-border)' }}
            />
            Reviews
          </span>
          <span className="diagram-legend-item">
            <span
              className="diagram-legend-swatch"
              style={{ background: 'var(--node-human)', borderColor: 'var(--node-human-border)' }}
            />
            Human
          </span>
          <span className="diagram-legend-item">
            <span className="diagram-legend-line" /> Work flows down
          </span>
          <span className="diagram-legend-item">
            <span className="diagram-legend-line" data-style="dashed" /> Findings flow back
          </span>
          <span className="diagram-legend-item">
            <svg width="10" height="10" aria-hidden="true">
              <circle cx="5" cy="5" r="3" fill="var(--accent)" />
            </svg>
            Approval required
          </span>
        </div>
      )}

      {!compact && selectedAgent && (
        <div className="diagram-inspector">
          <div className="diagram-inspector-head">
            <span className="diagram-inspector-name">{selectedAgent.name}</span>
            <Badge>{humanize(selectedAgent.roleType)}</Badge>
            {selectedAgent.mandatoryApproval && <Badge tone="accent">Approval required</Badge>}
            {selectedAgent.freshContext && <Badge>Fresh context</Badge>}
            {!selectedAgent.seesPriorReasoning && <Badge>Blind to reasoning</Badge>}
          </div>
          <p className="text-sm text-secondary">{selectedAgent.responsibility}</p>
          <div className="diagram-inspector-flows">
            <div>
              <p className="diagram-inspector-flow-title">Receives</p>
              <ul className="diagram-inspector-flow">
                {incoming.length > 0 ? (
                  incoming.map((e) => (
                    <li key={e.id}>
                      {e.payload} — from {nodeById.get(e.from)?.label}
                    </li>
                  ))
                ) : (
                  <li>Nothing. This agent has no inbound path.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="diagram-inspector-flow-title">Sends</p>
              <ul className="diagram-inspector-flow">
                {outgoing.length > 0 ? (
                  outgoing.map((e) => (
                    <li key={e.id}>
                      {e.payload} — to {nodeById.get(e.to)?.label}
                    </li>
                  ))
                ) : (
                  <li>Nothing. This agent’s output goes nowhere.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function truncate(text: string, max: number): string {
  if (max < 4) return text.slice(0, Math.max(1, max));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ------------------------------------------------------------------ *
 * Mini diagram for preset cards
 * ------------------------------------------------------------------ */

export function MiniDiagram({ agents, edges }: { agents: Agent[]; edges: CommunicationEdge[] }) {
  const layout = useMemo(() => computeLayout(agents, edges, MINI_LAYOUT), [agents, edges]);
  if (layout.nodes.length === 0) return null;

  return (
    <svg
      className="diagram-mini"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      style={{ maxHeight: layout.height }}
    >
      {layout.edges.map((edge) => (
        <path
          key={edge.id}
          className="diagram-mini-edge"
          d={edge.path}
          data-feedback={edge.isFeedback}
        />
      ))}
      {layout.nodes.map((node) => (
        <g key={node.id} className="diagram-node" data-family={node.family}>
          <rect
            className="diagram-node-box diagram-mini-node"
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
          />
          <text
            x={node.x + node.width / 2}
            y={node.y + node.height / 2 + 3}
            textAnchor="middle"
            style={{ fontSize: 7.5, fill: 'var(--text-secondary)', fontWeight: 600 }}
          >
            {truncate(node.label, 10)}
          </text>
        </g>
      ))}
    </svg>
  );
}
