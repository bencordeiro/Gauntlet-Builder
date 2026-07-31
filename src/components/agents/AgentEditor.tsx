/**
 * Agent roster editor.
 *
 * Each agent expands into its full configuration; collapsed cards show only
 * what distinguishes one agent from another. The permissions section is
 * deliberately prominent — overlapping write ownership is the single most
 * common way these workflows fail in practice.
 */

import { useState } from 'react';

import {
  isReviewRole,
  MODEL_PREFERENCES,
  roleById,
  ROLES,
} from '../../model/catalog';
import { createAgent } from '../../model/defaults';
import { agentId } from '../../model/ids';
import type { Agent, AgentRoleType, GauntletConfig, ModelPreference } from '../../model/types';
import {
  AdvancedSection,
  Badge,
  Button,
  Callout,
  Dialog,
  ListInput,
  NumberInput,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '../ui';
import { ChevronDown, ChevronRight, Duplicate, Plus, Trash } from '../ui/Icons';
import './AgentEditor.css';

interface Props {
  config: GauntletConfig;
  update: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  advanced: boolean;
  /** Restricts editing to review-specific settings, for step 8. */
  reviewersOnly?: boolean;
  selectedId?: string;
  onSelect?: (id: string | undefined) => void;
}

export function AgentEditor({
  config,
  update,
  advanced,
  reviewersOnly = false,
  selectedId,
  onSelect,
}: Props) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const agents = reviewersOnly
    ? config.agents.filter((a) => isReviewRole(a.roleType))
    : config.agents;

  const setAgents = (next: Agent[]) => update((c) => ({ ...c, agents: next }));

  const patchAgent = (id: string, patch: Partial<Agent>) =>
    setAgents(config.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const removeAgent = (id: string) => {
    update((c) => ({
      ...c,
      agents: c.agents.filter((a) => a.id !== id),
      // Clean up every reference so the config never points at a dead agent.
      approval: {
        ...c.approval,
        signoffOrder: c.approval.signoffOrder.filter((x) => x !== id),
        hybridGateIds: c.approval.hybridGateIds.filter((x) => x !== id),
        deciderId: c.approval.deciderId === id ? undefined : c.approval.deciderId,
        weights: Object.fromEntries(Object.entries(c.approval.weights).filter(([k]) => k !== id)),
      },
      communication: {
        ...c.communication,
        mediatorId: c.communication.mediatorId === id ? undefined : c.communication.mediatorId,
        overrides: Object.fromEntries(
          Object.entries(c.communication.overrides).filter(([k]) => k !== id),
        ),
        edges: c.communication.edges.filter((e) => e.from !== id && e.to !== id),
      },
    }));
  };

  const duplicateAgent = (agent: Agent) => {
    const copy: Agent = {
      ...agent,
      id: agentId(),
      name: `${agent.name} 2`,
      ownedCriteria: [...agent.ownedCriteria],
      permissions: {
        write: [...agent.permissions.write],
        readOnly: [...agent.permissions.readOnly],
        forbidden: [...agent.permissions.forbidden],
      },
    };
    const index = config.agents.findIndex((a) => a.id === agent.id);
    const next = [...config.agents];
    next.splice(index + 1, 0, copy);
    setAgents(next);
    setOpenIds((prev) => new Set(prev).add(copy.id));
  };

  const addAgent = (roleType: AgentRoleType) => {
    const agent = createAgent(roleType);
    // Disambiguate names when adding a second agent of the same role.
    const sameRole = config.agents.filter((a) => a.roleType === roleType).length;
    if (sameRole > 0) agent.name = `${agent.name} ${sameRole + 1}`;
    setAgents([...config.agents, agent]);
    setOpenIds((prev) => new Set(prev).add(agent.id));
    setAddOpen(false);
  };

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="stack">
      {agents.length === 0 ? (
        <Callout tone="danger" title={reviewersOnly ? 'No reviewers' : 'No agents'}>
          {reviewersOnly
            ? 'This Gauntlet has no reviewing agents, so nothing independently checks the work. Add one in step 4.'
            : 'Add at least one agent that builds and one that reviews.'}
        </Callout>
      ) : (
        <div className="agent-list">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              config={config}
              advanced={advanced}
              reviewersOnly={reviewersOnly}
              open={openIds.has(agent.id)}
              selected={selectedId === agent.id}
              onToggle={() => toggleOpen(agent.id)}
              onSelect={() => onSelect?.(selectedId === agent.id ? undefined : agent.id)}
              onChange={(patch) => patchAgent(agent.id, patch)}
              onRemove={() => removeAgent(agent.id)}
              onDuplicate={() => duplicateAgent(agent)}
            />
          ))}
        </div>
      )}

      {!reviewersOnly && (
        <div className="agent-toolbar">
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add an agent
          </Button>
          <span className="text-sm text-tertiary">
            {config.agents.filter((a) => a.enabled).length} active,{' '}
            {config.agents.filter((a) => a.mandatoryApproval && a.enabled).length} can block completion
          </span>
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add an agent"
        description="Pick a role. You can rename it and change everything about it afterwards."
        wide
      >
        <div className="agent-add-menu">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              className="agent-role-option"
              onClick={() => addAgent(role.id)}
            >
              <span className="agent-role-option-name">{role.label}</span>
              <span className="agent-role-option-blurb">{role.blurb}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Single agent card
 * ------------------------------------------------------------------ */

interface CardProps {
  agent: Agent;
  config: GauntletConfig;
  advanced: boolean;
  reviewersOnly: boolean;
  open: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onChange: (patch: Partial<Agent>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function AgentCard({
  agent,
  config,
  advanced,
  reviewersOnly,
  open,
  selected,
  onToggle,
  onChange,
  onRemove,
  onDuplicate,
}: CardProps) {
  const role = roleById(agent.roleType);
  const review = isReviewRole(agent.roleType);

  return (
    <div
      className="agent-card"
      data-selected={selected}
      data-disabled={!agent.enabled}
    >
      <div className="agent-card-head">
        <span className="agent-family-dot" data-family={role.family} aria-hidden="true" />
        <button
          type="button"
          className="agent-card-name"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="agent-card-title">{agent.name || 'Unnamed agent'}</span>
          <span className="agent-card-role">{role.label}</span>
        </button>

        {agent.mandatoryApproval && <Badge tone="accent">Must approve</Badge>}
        {!agent.enabled && <Badge>Off</Badge>}

        <div className="agent-card-actions">
          <Button variant="ghost" size="sm" iconOnly onClick={onToggle} aria-label={open ? `Collapse ${agent.name}` : `Expand ${agent.name}`}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Button>
          {!reviewersOnly && (
            <>
              <Button variant="ghost" size="sm" iconOnly onClick={onDuplicate} aria-label={`Duplicate ${agent.name}`}>
                <Duplicate size={14} />
              </Button>
              <Button variant="ghost" size="sm" iconOnly onClick={onRemove} aria-label={`Remove ${agent.name}`}>
                <Trash size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="agent-card-body">
          {!reviewersOnly && (
            <>
              <div className="agent-grid">
                <TextInput
                  label="Name"
                  value={agent.name}
                  onChange={(v) => onChange({ name: v })}
                  placeholder="Security Reviewer"
                />
                <Select<AgentRoleType>
                  label="Role"
                  value={agent.roleType}
                  onChange={(v) => {
                    const nextRole = roleById(v);
                    const nowReview = isReviewRole(v);
                    onChange({
                      roleType: v,
                      responsibility: nextRole.defaultResponsibility,
                      mandatoryApproval: nextRole.defaultMandatory,
                      authority: nextRole.defaultAuthority,
                      strictness: nowReview ? (agent.strictness ?? 'strict-professional') : undefined,
                      behaviors: nowReview
                        ? (agent.behaviors ?? ['require-evidence', 'largest-defect', 'score-rubric'])
                        : undefined,
                    });
                  }}
                  options={ROLES.map((r) => ({ value: r.id, label: r.label, blurb: r.blurb }))}
                  help={role.blurb}
                />
              </div>

              <TextArea
                label="What is it accountable for?"
                value={agent.responsibility}
                onChange={(v) => onChange({ responsibility: v })}
                rows={2}
              />

              <Toggle
                label="Include this agent"
                checked={agent.enabled}
                onChange={(v) => onChange({ enabled: v })}
                blurb="Turn off to keep the configuration but leave it out of this run."
              />
            </>
          )}

          <div>
            <p className="agent-subhead">Authority</p>
            <div className="agent-grid" style={{ paddingTop: 'var(--space-3)' }}>
              <Toggle
                label="Its approval is required"
                checked={agent.mandatoryApproval}
                onChange={(v) => onChange({ mandatoryApproval: v })}
                blurb={
                  agent.mandatoryApproval
                    ? 'The work cannot be declared finished while this agent has an open objection.'
                    : 'Its findings are recorded but cannot block completion on their own.'
                }
              />
              <NumberInput
                label="Maximum times it may run"
                value={agent.maxRounds}
                onChange={(v) => onChange({ maxRounds: Math.max(1, v) })}
                min={1}
                max={50}
                suffix="rounds"
              />
            </div>
          </div>

          {review && !reviewersOnly && (
            <Callout tone="info">
              Set how demanding this reviewer is in step 8.
            </Callout>
          )}

          {!reviewersOnly && (
            <AdvancedSection title="Ownership and permissions" defaultOpen={advanced}>
              <p className="field-help">
                Give each agent an explicit area. When two agents can write the same files, they
                overwrite each other and work disappears without anyone noticing.
              </p>
              <ListInput
                label="May create and modify"
                items={agent.permissions.write}
                onChange={(v) => onChange({ permissions: { ...agent.permissions, write: v } })}
                placeholder="src/components/billing/"
                emptyText={review ? 'Nothing — this agent only inspects.' : 'No area assigned yet.'}
                optional
              />
              <ListInput
                label="May read but not change"
                items={agent.permissions.readOnly}
                onChange={(v) => onChange({ permissions: { ...agent.permissions, readOnly: v } })}
                placeholder="src/api/"
                optional
              />
              <ListInput
                label="Must not open at all"
                items={agent.permissions.forbidden}
                onChange={(v) => onChange({ permissions: { ...agent.permissions, forbidden: v } })}
                placeholder=".env"
                optional
              />
              <ListInput
                label="Tools it may use"
                items={agent.tools}
                onChange={(v) => onChange({ tools: v })}
                placeholder="Shell commands"
                suggestions={config.intent.tools}
                compact
                optional
              />
            </AdvancedSection>
          )}

          {advanced && !reviewersOnly && (
            <AdvancedSection title="Context and model">
              <Toggle
                label="Sees other agents’ reasoning"
                checked={agent.seesPriorReasoning}
                onChange={(v) => onChange({ seesPriorReasoning: v })}
                blurb="Turn this off for reviewers you want judging the work rather than the explanation of it."
              />
              <Toggle
                label="Starts with fresh context"
                checked={agent.freshContext}
                onChange={(v) => onChange({ freshContext: v })}
                blurb="Begins from a clean slate rather than the running conversation."
              />
              <Toggle
                label="May message other agents directly"
                checked={agent.canMessagePeers}
                onChange={(v) => onChange({ canMessagePeers: v })}
                blurb="Otherwise everything routes through the lead agent."
              />
              <div className="agent-grid">
                <Select<ModelPreference>
                  label="Model preference"
                  value={agent.model}
                  onChange={(v) => onChange({ model: v })}
                  options={MODEL_PREFERENCES.map((m) => ({
                    value: m.id,
                    label: m.label,
                    blurb: m.blurb,
                  }))}
                />
                <NumberInput
                  label="Authority"
                  value={agent.authority}
                  onChange={(v) => onChange({ authority: Math.max(1, Math.min(10, v)) })}
                  min={1}
                  max={10}
                  help="1–10. Higher authority wins ties and carries more weight in weighted voting."
                />
              </div>
              {agent.model === 'custom' && (
                <TextInput
                  label="Which model?"
                  value={agent.customModel ?? ''}
                  onChange={(v) => onChange({ customModel: v })}
                  placeholder="claude-opus-5"
                />
              )}
              <TextArea
                label="Expertise it should bring"
                value={agent.expertise}
                onChange={(v) => onChange({ expertise: v })}
                rows={2}
                optional
              />
              <ListInput
                label="What it receives"
                items={agent.inputs}
                onChange={(v) => onChange({ inputs: v })}
                placeholder="The artifact itself"
                optional
              />
              <ListInput
                label="What it must produce"
                items={agent.outputs}
                onChange={(v) => onChange({ outputs: v })}
                placeholder="A structured verdict"
                optional
              />
              <TextArea
                label="Extra instructions"
                value={agent.notes ?? ''}
                onChange={(v) => onChange({ notes: v })}
                rows={2}
                help="Appended verbatim to this agent's prompt."
                optional
              />
            </AdvancedSection>
          )}

          {config.quality.criteria.length > 0 && advanced && (
            <AdvancedSection title="Criteria this agent owns">
              <p className="field-help">
                Leave everything unticked to have it judge the whole rubric. Assigning specific
                criteria stops several reviewers duplicating the same work.
              </p>
              <div className="stack-sm">
                {config.quality.criteria.map((criterion) => (
                  <label key={criterion.id} className="checkbox-row" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={agent.ownedCriteria.includes(criterion.id)}
                      onChange={(e) =>
                        onChange({
                          ownedCriteria: e.target.checked
                            ? [...agent.ownedCriteria, criterion.id]
                            : agent.ownedCriteria.filter((id) => id !== criterion.id),
                        })
                      }
                      style={{ marginTop: 3, accentColor: 'var(--accent)' }}
                    />
                    <span className="switch-text">
                      <span className="switch-label" style={{ fontWeight: 'var(--weight-normal)' }}>
                        {criterion.label || 'Unnamed criterion'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </AdvancedSection>
          )}
        </div>
      )}
    </div>
  );
}
