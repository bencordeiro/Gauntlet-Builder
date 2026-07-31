/**
 * Step 9 — read the whole thing back and flag anything that would stop it
 * working.
 *
 * The summary is generated from the config rather than echoing the user's
 * inputs, so reading it is a genuine check: if the summary describes something
 * other than what they meant, the configuration is wrong.
 */

import {
  approvalById,
  communicationById,
  COMPLEXITY_LABELS,
  evidenceById,
  isReviewRole,
  revisionStrategyById,
  roleById,
  strictnessById,
  structurePresetByKind,
} from '../../../model/catalog';
import { completionSentence, derive } from '../../../engine/derive';
import { estimateComplexity } from '../../../validation/validate';
import type { GauntletConfig, ValidationWarning } from '../../../model/types';
import { WorkflowDiagram } from '../../diagram/WorkflowDiagram';
import { RiskPanel } from '../../validation/RiskPanel';
import { Badge, Callout } from '../../ui';
import './Step9Review.css';

interface Props {
  config: GauntletConfig;
  warnings: ValidationWarning[];
  onGoToStep: (step: number) => void;
}

export function Step9Review({ config, warnings, onGoToStep }: Props) {
  const ctx = derive(config);
  const complexity = estimateComplexity(config);
  const reviewers = ctx.integrator ? [...ctx.reviewers, ctx.integrator] : ctx.reviewers;

  return (
    <div className="stack-lg">
      <section className="wizard-section">
        <h2 className="wizard-section-title">Anything that needs attention</h2>
        <RiskPanel warnings={warnings} onGoToStep={onGoToStep} />
      </section>

      <section className="wizard-section">
        <h2 className="wizard-section-title">The workflow</h2>
        <WorkflowDiagram
          agents={config.agents}
          edges={config.communication.edges}
          caption="Final workflow topology"
        />
      </section>

      <section className="wizard-section">
        <h2 className="wizard-section-title">What you have configured</h2>

        <div className="review-grid">
          <ReviewCard title="The task" onEdit={() => onGoToStep(1)}>
            <ReviewRow k="Goal" v={config.intent.goal || 'Not described yet'} muted={!config.intent.goal} />
            <ReviewRow
              k="Deliverable"
              v={config.intent.deliverable || 'Not defined yet'}
              muted={!config.intent.deliverable}
            />
            <ReviewRow k="Environment" v={ctx.environmentLabel} />
            <ReviewRow
              k="Sub-agents"
              v={ctx.capability === 'real-subagents' ? 'Real, separate agents' : 'Simulated in sequence'}
            />
            {config.intent.requirements.length > 0 && (
              <ReviewRow k="Requirements" v={`${config.intent.requirements.length} fixed`} />
            )}
            {config.intent.prohibitions.length > 0 && (
              <ReviewRow k="Prohibited" v={`${config.intent.prohibitions.length} actions`} />
            )}
          </ReviewCard>

          <ReviewCard title="The quality bar" onEdit={() => onGoToStep(2)}>
            <ReviewRow
              k="Criteria"
              v={
                config.quality.criteria.length > 0
                  ? `${config.quality.criteria.length}, of which ${ctx.mandatoryCriteria.length} must pass`
                  : 'None defined'
              }
              muted={config.quality.criteria.length === 0}
            />
            <ReviewRow k="Passing score" v={`${Math.round(config.quality.passingScore * 100)}%`} />
            <ReviewRow
              k="Evidence"
              v={
                config.quality.evidence.length > 0
                  ? config.quality.evidence.map((e) => evidenceById(e).label).join(', ')
                  : 'No evidence selected'
              }
              muted={config.quality.evidence.length === 0}
            />
          </ReviewCard>

          <ReviewCard title="Structure and roster" onEdit={() => onGoToStep(4)}>
            <ReviewRow k="Structure" v={structurePresetByKind(config.topology).name} />
            <ReviewRow k="Active agents" v={String(ctx.active.length)} />
            <ReviewRow k="Builders" v={ctx.builders.map((b) => b.name).join(', ') || 'None'} muted={ctx.builders.length === 0} />
            <ReviewRow k="Reviewers" v={reviewers.map((r) => r.name).join(', ') || 'None'} muted={reviewers.length === 0} />
            <ReviewRow k="Integration owner" v={ctx.integrator?.name ?? 'None'} muted={!ctx.integrator} />
          </ReviewCard>

          <ReviewCard title="Communication" onEdit={() => onGoToStep(5)}>
            <ReviewRow k="Mode" v={communicationById(config.communication.globalMode).label} />
            <ReviewRow
              k="Author hidden"
              v={config.communication.anonymizeBuilder ? 'Yes' : 'No'}
            />
            <ReviewRow
              k="Structured findings"
              v={config.communication.structuredFindingsOnly ? 'Required' : 'Not required'}
            />
            <ReviewRow k="Pathways" v={`${config.communication.edges.length} defined`} />
          </ReviewCard>

          <ReviewCard title="Approval" onEdit={() => onGoToStep(6)}>
            <ReviewRow k="Policy" v={approvalById(config.approval.kind).label} />
            <ReviewRow
              k="Can block completion"
              v={
                ctx.blockingReviewers.length > 0
                  ? ctx.blockingReviewers.map((r) => r.name).join(', ')
                  : 'Nobody'
              }
              muted={ctx.blockingReviewers.length === 0}
            />
            <ReviewRow k="Single veto allowed" v={config.approval.allowVeto ? 'Yes' : 'No'} />
          </ReviewCard>

          <ReviewCard title="Revisions and stopping" onEdit={() => onGoToStep(7)}>
            <ReviewRow k="Fix order" v={revisionStrategyById(config.revision.strategy).label} />
            <ReviewRow
              k="Regression checks"
              v={config.revision.requireRegressionTests ? 'After every revision' : 'Not required'}
              muted={!config.revision.requireRegressionTests}
            />
            <ReviewRow
              k="Round limit"
              v={config.stop.maxTotalRounds > 0 ? `${config.stop.maxTotalRounds} rounds` : 'No limit'}
              muted={config.stop.maxTotalRounds === 0}
            />
            <ReviewRow
              k="Human checkpoints"
              v={config.checkpoints.length > 0 ? `${config.checkpoints.length}` : 'None'}
              muted={config.checkpoints.length === 0}
            />
            <ReviewRow
              k="Honest endings"
              v={`${config.stop.allowedFailureStatuses.length} statuses allowed`}
            />
          </ReviewCard>
        </div>
      </section>

      {reviewers.length > 0 && (
        <section className="wizard-section">
          <h2 className="wizard-section-title">Reviewer strictness</h2>
          <div className="reviewer-strip">
            {reviewers.map((r) => (
              <div className="reviewer-chip" key={r.id}>
                <span className="reviewer-chip-name">{r.name}</span>
                <span className="reviewer-chip-role">{roleById(r.roleType).label}</span>
                {isReviewRole(r.roleType) && (
                  <Badge>{strictnessById(r.strictness ?? 'strict-professional').label}</Badge>
                )}
                {r.mandatoryApproval && <Badge tone="accent">Must approve</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="wizard-section">
        <h2 className="wizard-section-title">Effort and cost</h2>
        <div className="complexity-row">
          <span className="complexity-band" data-band={complexity.band}>
            {COMPLEXITY_LABELS[complexity.band]}
          </span>
          <p className="text-sm text-secondary">
            {complexity.drivers.length > 0
              ? `Driven by ${complexity.drivers.join(', ')}.`
              : 'A small, focused Gauntlet.'}{' '}
            {complexity.band === 'very-heavy' &&
              'Expect this to take a while and consume a meaningful amount of tokens.'}
            {complexity.band === 'light' && 'This should run quickly and cheaply.'}
          </p>
        </div>
      </section>

      <Callout tone="ok" title="The finish line">
        This Gauntlet is complete when <strong>{completionSentence(ctx)}</strong>. If that is not
        reached before a limit, the generated prompt requires an honest unresolved status naming what
        is missing and which reviewer rejected it.
      </Callout>
    </div>
  );
}

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="review-card">
      <div className="review-card-head">
        <h3 className="review-card-title">{title}</h3>
        <button type="button" className="review-card-edit" onClick={onEdit}>
          Edit
        </button>
      </div>
      <dl className="review-card-body">{children}</dl>
    </div>
  );
}

function ReviewRow({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="review-row">
      <dt>{k}</dt>
      <dd className={muted ? 'review-muted' : ''}>{v}</dd>
    </div>
  );
}
