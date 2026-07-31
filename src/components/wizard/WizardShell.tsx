/**
 * Wizard shell: step rail, progress, mode switch, persistent summary, and
 * back/next navigation.
 *
 * Steps are declared as data so the rail, the mobile select, the keyboard
 * shortcuts and the completion indicator all read from one list. Step
 * completion is computed from the config rather than tracked separately, so
 * going back and clearing a field correctly un-completes its step.
 */

import { useEffect, useMemo, type ReactNode } from 'react';

import { completionSentence, derive } from '../../engine/derive';
import { approvalById, communicationById, structurePresetByKind } from '../../model/catalog';
import type { GauntletConfig, ValidationWarning } from '../../model/types';
import { Button, SegmentedControl, Select } from '../ui';
import { ChevronLeft, ChevronRight, Check } from '../ui/Icons';
import './Wizard.css';

export interface StepDefinition {
  id: number;
  /** Short label for the rail. */
  label: string;
  /** Question-style heading shown at the top of the step. */
  title: string;
  intro: string;
  /** True when the user has given this step enough to move on. */
  isComplete: (config: GauntletConfig) => boolean;
  /** Only shown in advanced mode. */
  advancedOnly?: boolean;
}

export const WIZARD_STEPS: StepDefinition[] = [
  {
    id: 1,
    label: 'The task',
    title: 'What are you trying to accomplish?',
    intro:
      'Describe the work in your own words. Everything else in this builder is shaped by what you write here, so be specific about what has to exist at the end.',
    isComplete: (c) => c.intent.goal.trim().length > 0 && c.intent.deliverable.trim().length > 0,
  },
  {
    id: 2,
    label: 'Success',
    title: 'What does success look like?',
    intro:
      'This is the most important step. Agents will happily declare a job done, so we need checks that can actually be inspected — not adjectives.',
    isComplete: (c) => c.quality.criteria.length > 0,
  },
  {
    id: 3,
    label: 'Structure',
    title: 'How should the agents be arranged?',
    intro:
      'Pick the shape of the workflow. Each option changes how many agents run, how they talk to each other, and how much it costs.',
    isComplete: () => true,
  },
  {
    id: 4,
    label: 'Participants',
    title: 'Who is involved?',
    intro:
      'Adjust the roster. Each agent has a job, a boundary it must stay inside, and a say — or no say — in whether the work is finished.',
    isComplete: (c) => c.agents.filter((a) => a.enabled).length > 0,
  },
  {
    id: 5,
    label: 'Communication',
    title: 'How do the agents talk to each other?',
    intro:
      'This decides whether reviewers can be talked out of their findings, and whether they know whose work they are judging.',
    isComplete: () => true,
  },
  {
    id: 6,
    label: 'Approval',
    title: 'Who decides when it is finished?',
    intro:
      'Choose what has to be true before the work counts as done. This is the condition the generated prompt will refuse to fake.',
    isComplete: () => true,
  },
  {
    id: 7,
    label: 'Revisions',
    title: 'How should problems get fixed?',
    intro:
      'Set how the loop revises, protects against regressions, and — importantly — when it should stop and tell you it could not finish.',
    isComplete: () => true,
  },
  {
    id: 8,
    label: 'Strictness',
    title: 'How demanding should reviewers be?',
    intro:
      'Set how hard each reviewer pushes back. Stricter reviewers find more, but need more rounds to be satisfied.',
    isComplete: () => true,
  },
  {
    id: 9,
    label: 'Review',
    title: 'Does this all hold together?',
    intro:
      'A full read of what you have built, with anything that would stop it from working flagged before you generate.',
    isComplete: () => true,
  },
  {
    id: 10,
    label: 'Generate',
    title: 'Your Gauntlet is ready',
    intro: 'Copy the master prompt into your agent, or download the whole package.',
    isComplete: () => true,
  },
];

interface WizardShellProps {
  config: GauntletConfig;
  step: number;
  onStepChange: (step: number) => void;
  advanced: boolean;
  onAdvancedChange: (advanced: boolean) => void;
  warnings: ValidationWarning[];
  children: ReactNode;
  /** Called from the last step. */
  onFinish?: () => void;
}

export function WizardShell({
  config,
  step,
  onStepChange,
  advanced,
  onAdvancedChange,
  warnings,
  children,
  onFinish,
}: WizardShellProps) {
  const current = WIZARD_STEPS.find((s) => s.id === step) ?? WIZARD_STEPS[0];
  const completedCount = WIZARD_STEPS.filter((s) => s.isComplete(config)).length;
  const progress = Math.round((completedCount / WIZARD_STEPS.length) * 100);

  // Move focus to the step heading on change so screen readers announce it and
  // keyboard users do not have to tab from the top of the page again.
  useEffect(() => {
    const heading = document.getElementById('wizard-step-title');
    heading?.focus();
  }, [step]);

  const blockedSteps = useMemo(() => {
    const set = new Set<number>();
    warnings.forEach((w) => {
      if (w.severity === 'blocking' && w.step) set.add(w.step);
    });
    return set;
  }, [warnings]);

  const goPrev = () => onStepChange(Math.max(1, step - 1));
  const goNext = () => onStepChange(Math.min(WIZARD_STEPS.length, step + 1));

  return (
    <div className="wizard">
      <div className="wizard-nav">
        <div className="wizard-nav-progress">
          <div
            className="wizard-progress-bar"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Gauntlet completion"
          >
            <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="wizard-progress-label">
            {completedCount} of {WIZARD_STEPS.length} steps ready
          </span>
        </div>

        <nav className="wizard-step-list" aria-label="Wizard steps">
          {WIZARD_STEPS.map((s) => {
            const complete = s.isComplete(config);
            const blocked = blockedSteps.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                className="wizard-step-btn"
                // The number is decorative in the markup, so the status has to
                // reach assistive tech through the label instead.
                aria-label={`Step ${s.id}. ${s.label}${
                  blocked ? ' — needs attention' : complete ? ' — ready' : ''
                }`}
                aria-current={s.id === step ? 'step' : undefined}
                data-complete={complete && s.id !== step}
                data-blocked={blocked}
                onClick={() => onStepChange(s.id)}
              >
                <span className="wizard-step-num" aria-hidden="true">
                  {complete && s.id !== step ? <Check size={11} /> : s.id}
                </span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="wizard-step-select">
          <Select
            label="Step"
            value={String(step)}
            onChange={(v) => onStepChange(Number(v))}
            options={WIZARD_STEPS.map((s) => ({
              value: String(s.id),
              label: `${s.id}. ${s.label}`,
            }))}
          />
        </div>
      </div>

      <div className="wizard-content">
        <div className="wizard-mode">
          <header className="wizard-step-header">
            <span className="wizard-step-eyebrow">
              Step {current.id} of {WIZARD_STEPS.length}
            </span>
            <h1 className="wizard-step-title" id="wizard-step-title" tabIndex={-1}>
              {current.title}
            </h1>
          </header>
          <SegmentedControl
            label="Detail level"
            hideLabel
            value={advanced ? 'advanced' : 'simple'}
            onChange={(v) => onAdvancedChange(v === 'advanced')}
            options={[
              { value: 'simple', label: 'Simple' },
              { value: 'advanced', label: 'Advanced' },
            ]}
          />
        </div>

        <p className="wizard-step-intro">{current.intro}</p>

        {children}

        <div className="wizard-footer">
          <Button onClick={goPrev} disabled={step === 1}>
            <ChevronLeft size={14} /> Back
          </Button>
          {step < WIZARD_STEPS.length ? (
            <Button variant="primary" onClick={goNext}>
              Next <ChevronRight size={14} />
            </Button>
          ) : (
            onFinish && (
              <Button variant="primary" onClick={onFinish}>
                Done
              </Button>
            )
          )}
          <span className="spacer" />
          <span className="wizard-autosave">Saved automatically</span>
        </div>
      </div>

      <aside className="summary-rail" aria-label="Gauntlet summary">
        <SummaryRail config={config} warnings={warnings} />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Persistent summary
 * ------------------------------------------------------------------ */

function SummaryRail({ config, warnings }: { config: GauntletConfig; warnings: ValidationWarning[] }) {
  const ctx = derive(config);
  const blocking = warnings.filter((w) => w.severity === 'blocking').length;
  const cautions = warnings.filter((w) => w.severity === 'warning').length;

  const row = (key: string, value: string, muted = false) => (
    <div className="summary-row" key={key}>
      <span className="summary-key">{key}</span>
      <span className={`summary-value ${muted ? 'summary-value-muted' : ''}`}>{value}</span>
    </div>
  );

  return (
    <>
      <div className="summary-card">
        <p className="summary-card-title">This Gauntlet</p>
        {row('Project', config.intent.projectName || 'Untitled', !config.intent.projectName)}
        {row('Structure', structurePresetByKind(config.topology).name)}
        {row('Agents', String(ctx.active.length))}
        {row(
          'Must approve',
          ctx.blockingReviewers.length > 0
            ? ctx.blockingReviewers.map((r) => r.name).join(', ')
            : 'Nobody yet',
          ctx.blockingReviewers.length === 0,
        )}
        {row('Criteria', config.quality.criteria.length > 0 ? String(config.quality.criteria.length) : 'None yet', config.quality.criteria.length === 0)}
        {row('Approval', approvalById(config.approval.kind).label)}
        {row('Talks via', communicationById(config.communication.globalMode).label)}
        {row('Round limit', config.stop.maxTotalRounds > 0 ? String(config.stop.maxTotalRounds) : 'No limit', config.stop.maxTotalRounds === 0)}
      </div>

      <div className="summary-card">
        <p className="summary-card-title">Finishes when</p>
        <p className="text-sm text-secondary" style={{ lineHeight: 'var(--leading-normal)' }}>
          {completionSentence(ctx).charAt(0).toUpperCase() + completionSentence(ctx).slice(1)}.
        </p>
      </div>

      {(blocking > 0 || cautions > 0) && (
        <div className="summary-card">
          <p className="summary-card-title">Needs attention</p>
          <ul className="stack-sm text-sm">
            {blocking > 0 && (
              <li style={{ color: 'var(--danger)' }}>
                {blocking} thing{blocking > 1 ? 's' : ''} must be fixed
              </li>
            )}
            {cautions > 0 && (
              <li style={{ color: 'var(--warn)' }}>
                {cautions} thing{cautions > 1 ? 's' : ''} worth a look
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
