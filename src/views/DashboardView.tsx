/**
 * Dashboard — the landing view.
 *
 * Opens directly into work: continue what you were doing, start something new,
 * or pick up a recent Gauntlet. No marketing, no fabricated statistics; the only
 * numbers shown are ones actually derived from the user's own configurations.
 */

import { useMemo } from 'react';

import { PageHeader, type ViewId } from '../components/shell/AppShell';
import { Button, Callout } from '../components/ui';
import { ArrowRight, Plus, Sparkle } from '../components/ui/Icons';
import { derive } from '../engine/derive';
import { structurePresetByKind } from '../model/catalog';
import { PROJECT_PRESETS } from '../presets/projectPresets';
import { useStore } from '../state/store';
import { validate } from '../validation/validate';
import { GauntletCard } from './SavedView';
import './DashboardView.css';

interface Props {
  onNavigate: (view: ViewId) => void;
  onNewGauntlet: () => void;
}

export function DashboardView({ onNavigate, onNewGauntlet }: Props) {
  const { state, draft, setDraft, createDraft, dismissNotes } = useStore();

  const recent = useMemo(
    () =>
      [...state.gauntlets]
        .sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt))
        .slice(0, 6),
    [state.gauntlets],
  );

  const draftWarnings = useMemo(() => (draft ? validate(draft) : []), [draft]);
  const draftBlocking = draftWarnings.filter((w) => w.severity === 'blocking').length;

  const quickStart = PROJECT_PRESETS.filter((p) =>
    ['production-web-app', 'research-report', 'security-code-review', 'debugging-rca'].includes(p.id),
  );

  const open = (id: string) => {
    setDraft(id);
    onNavigate('editor');
  };

  return (
    <>
      <PageHeader
        title="Gauntlet Builder"
        subtitle="Build a multi-agent review loop that keeps working until the quality bar is genuinely met — and tells you honestly when it cannot be."
        actions={
          <Button variant="primary" onClick={onNewGauntlet}>
            <Plus size={15} /> New Gauntlet
          </Button>
        }
      />

      {state.notes.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Callout tone="info" title="A note about your saved data">
            <ul className="stack-sm">
              {state.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <Button size="sm" onClick={dismissNotes} style={{ marginTop: 'var(--space-2)' }}>
              Got it
            </Button>
          </Callout>
        </div>
      )}

      {draft && (
        <section className="dash-section">
          <h2 className="dash-section-title">Pick up where you left off</h2>
          <div className="dash-continue">
            <div className="dash-continue-text">
              <p className="dash-continue-name">
                {draft.intent.projectName || 'Untitled Gauntlet'}
              </p>
              <p className="text-sm text-secondary">
                {structurePresetByKind(draft.topology).name} ·{' '}
                {derive(draft).active.length} agents ·{' '}
                {draft.quality.criteria.length} criteria
                {draftBlocking > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--danger)' }}>
                      {draftBlocking} problem{draftBlocking > 1 ? 's' : ''} to fix
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="row-wrap">
              <Button onClick={() => onNavigate('preview')}>See the prompt</Button>
              <Button variant="primary" onClick={() => onNavigate('wizard')}>
                Continue <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="dash-section">
        <h2 className="dash-section-title">Start from a preset</h2>
        <p className="dash-section-sub">
          Each one arrives with agents, evidence requirements, an approval policy and stopping rules
          already set for that kind of work. Change anything you like afterwards.
        </p>
        <div className="dash-quickstart">
          {quickStart.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="dash-preset"
              onClick={() => {
                createDraft(preset.id);
                onNavigate('wizard');
              }}
            >
              <span className="dash-preset-head">
                <Sparkle size={14} />
                <span className="dash-preset-name">{preset.name}</span>
              </span>
              <span className="dash-preset-summary">{preset.summary}</span>
            </button>
          ))}
          <button type="button" className="dash-preset dash-preset-more" onClick={() => onNavigate('presets')}>
            <span className="dash-preset-head">
              <span className="dash-preset-name">All {PROJECT_PRESETS.length} presets</span>
            </span>
            <span className="dash-preset-summary">
              Security reviews, accessibility audits, refactors, data analysis, and more.
            </span>
          </button>
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section-head">
          <h2 className="dash-section-title">Your Gauntlets</h2>
          {state.gauntlets.length > 6 && (
            <Button size="sm" onClick={() => onNavigate('saved')}>
              See all {state.gauntlets.length}
            </Button>
          )}
        </div>

        {recent.length === 0 ? (
          <Callout tone="neutral" title="Nothing saved yet">
            Start a new Gauntlet above, or pick a preset. Everything you build is stored in this
            browser — there is no account and nothing is sent anywhere.
          </Callout>
        ) : (
          <div className="dash-grid">
            {recent.map((gauntlet) => (
              <GauntletCard
                key={gauntlet.meta.id}
                config={gauntlet}
                onOpen={() => open(gauntlet.meta.id)}
                compact
              />
            ))}
          </div>
        )}
      </section>

      <section className="dash-section">
        <h2 className="dash-section-title">What a Gauntlet actually does</h2>
        <div className="dash-explain">
          <ExplainStep n={1} title="You describe the work">
            The goal, what must exist at the end, and what would count as proof it worked.
          </ExplainStep>
          <ExplainStep n={2} title="One agent builds">
            It produces the deliverable inside a boundary you set, and collects real evidence rather
            than describing what the output would probably be.
          </ExplainStep>
          <ExplainStep n={3} title="Separate agents review">
            They inspect the actual artifact against your criteria and return structured findings —
            not “this needs more work”.
          </ExplainStep>
          <ExplainStep n={4} title="It repeats, then reports honestly">
            The loop continues until your approval condition is genuinely met. If it runs out of
            rounds first, it says so and names what is missing.
          </ExplainStep>
        </div>
      </section>
    </>
  );
}

function ExplainStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="dash-explain-step">
      <span className="dash-explain-num" aria-hidden="true">
        {n}
      </span>
      <div>
        <p className="dash-explain-title">{title}</p>
        <p className="text-sm text-secondary">{children}</p>
      </div>
    </div>
  );
}
