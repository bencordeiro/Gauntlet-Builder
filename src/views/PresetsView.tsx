/**
 * Preset library.
 *
 * Each preset is instantiated on demand so the card can show what it actually
 * configures — agent count, evidence, approval policy — rather than a
 * hand-maintained description that could drift from the preset itself.
 */

import { useMemo, useState } from 'react';

import { PageHeader, type ViewId } from '../components/shell/AppShell';
import { MiniDiagram } from '../components/diagram/WorkflowDiagram';
import { Badge, Button, Dialog, Select } from '../components/ui';
import { ArrowRight, Search } from '../components/ui/Icons';
import { derive } from '../engine/derive';
import {
  approvalById,
  communicationById,
  evidenceById,
  structurePresetByKind,
} from '../model/catalog';
import { createGauntlet } from '../model/defaults';
import type { GauntletConfig } from '../model/types';
import { PRESET_CATEGORIES, PROJECT_PRESETS } from '../presets/projectPresets';
import { useStore } from '../state/store';
import './PresetsView.css';

interface Props {
  onNavigate: (view: ViewId) => void;
}

export function PresetsView({ onNavigate }: Props) {
  const { createDraft } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [detail, setDetail] = useState<string | null>(null);

  // Build each preset once so cards can describe what it really produces.
  const instances = useMemo(() => {
    const map = new Map<string, GauntletConfig>();
    PROJECT_PRESETS.forEach((preset) => {
      map.set(preset.id, preset.apply(createGauntlet({ agents: [] })));
    });
    return map;
  }, []);

  const filtered = PROJECT_PRESETS.filter((preset) => {
    if (category !== 'all' && preset.category !== category) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      preset.name.toLowerCase().includes(q) ||
      preset.summary.toLowerCase().includes(q) ||
      preset.category.toLowerCase().includes(q)
    );
  });

  const use = (presetId: string) => {
    createDraft(presetId);
    onNavigate('wizard');
  };

  const detailPreset = detail ? PROJECT_PRESETS.find((p) => p.id === detail) : undefined;
  const detailConfig = detail ? instances.get(detail) : undefined;

  return (
    <>
      <PageHeader
        title="Preset library"
        subtitle="Complete starting points for common kinds of work. Each arrives with agents, evidence requirements, an approval policy and stopping rules already set — and you can change every part of it."
      />

      <div className="preset-filters">
        <div className="saved-search">
          <Search size={15} className="saved-search-icon" />
          <input
            type="search"
            className="input"
            value={query}
            placeholder="Search presets"
            aria-label="Search presets"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          label="Category"
          bare
          ariaLabel="Filter by category"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'All categories' },
            ...PRESET_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
        />
      </div>

      <div className="preset-grid">
        {filtered.map((preset) => {
          const config = instances.get(preset.id);
          if (!config) return null;
          const ctx = derive(config);
          return (
            <article className="preset-card" key={preset.id}>
              <div className="preset-card-head">
                <h2 className="preset-card-title">{preset.name}</h2>
                <Badge>{preset.category}</Badge>
              </div>

              <p className="preset-card-summary">{preset.summary}</p>

              <div className="preset-card-diagram">
                <MiniDiagram agents={config.agents} edges={config.communication.edges} />
              </div>

              <dl className="preset-card-facts">
                <div>
                  <dt>Structure</dt>
                  <dd>{structurePresetByKind(config.topology).name}</dd>
                </div>
                <div>
                  <dt>Agents</dt>
                  <dd>{ctx.active.length}</dd>
                </div>
                <div>
                  <dt>Must approve</dt>
                  <dd>{ctx.blockingReviewers.length}</dd>
                </div>
                <div>
                  <dt>Criteria</dt>
                  <dd>{config.quality.criteria.length}</dd>
                </div>
              </dl>

              <div className="preset-card-actions">
                <Button variant="primary" size="sm" onClick={() => use(preset.id)}>
                  Use this <ArrowRight size={13} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDetail(preset.id)}>
                  What's inside
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detailPreset?.name ?? ''}
        description={detailPreset?.summary}
        wide
        footer={
          <>
            <Button onClick={() => setDetail(null)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (detail) use(detail);
                setDetail(null);
              }}
            >
              Use this preset
            </Button>
          </>
        }
      >
        {detailConfig && <PresetDetail config={detailConfig} />}
      </Dialog>
    </>
  );
}

function PresetDetail({ config }: { config: GauntletConfig }) {
  const ctx = derive(config);
  return (
    <div className="stack">
      <section>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
          Agents
        </p>
        <ul className="preset-detail-list">
          {config.agents.map((agent) => (
            <li key={agent.id}>
              <strong>{agent.name}</strong>
              {agent.mandatoryApproval && <Badge tone="accent">Must approve</Badge>}
              <span className="text-sm text-secondary">{agent.responsibility}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
          Criteria it checks
        </p>
        <ul className="preset-detail-list">
          {config.quality.criteria.map((criterion) => (
            <li key={criterion.id}>
              <strong>{criterion.label}</strong>
              <span className="text-sm text-secondary">{criterion.verification}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
          How it runs
        </p>
        <dl className="preset-detail-facts">
          <dt>Evidence</dt>
          <dd>{config.quality.evidence.map((e) => evidenceById(e).label).join(', ') || 'None'}</dd>
          <dt>Communication</dt>
          <dd>{communicationById(config.communication.globalMode).label}</dd>
          <dt>Approval</dt>
          <dd>{approvalById(config.approval.kind).label}</dd>
          <dt>Round limit</dt>
          <dd>{config.stop.maxTotalRounds > 0 ? `${config.stop.maxTotalRounds} rounds` : 'No limit'}</dd>
          <dt>Checkpoints</dt>
          <dd>
            {config.checkpoints.length > 0
              ? config.checkpoints.map((c) => c.label).join(', ')
              : 'None'}
          </dd>
          <dt>Finishes when</dt>
          <dd>{completionText(ctx)}</dd>
        </dl>
      </section>
    </div>
  );
}

function completionText(ctx: ReturnType<typeof derive>): string {
  const sentence = ctx.blockingReviewers.length
    ? `${ctx.blockingReviewers.map((r) => r.name).join(', ')} approve`
    : 'the approval policy is satisfied';
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
