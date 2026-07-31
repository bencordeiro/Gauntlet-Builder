/**
 * Step 7 — revision behaviour, budgets, and human checkpoints.
 *
 * The budgets section leads with the honest-stopping explanation, because the
 * single most valuable thing this tool does is stop an agent from declaring
 * victory when it merely ran out of rounds.
 */

import {
  CHECKPOINT_TRIGGERS,
  FAILURE_STATUSES,
  LEDGER_FIELDS,
  REVISION_OPTIONS,
  REVISION_STRATEGIES,
} from '../../../model/catalog';
import { createCheckpoint } from '../../../model/defaults';
import type {
  CheckpointTrigger,
  FailureStatus,
  GauntletConfig,
  LedgerField,
  RevisionStrategy,
} from '../../../model/types';
import {
  AdvancedSection,
  Button,
  Callout,
  Checkbox,
  NumberInput,
  Select,
  TextInput,
  Toggle,
} from '../../ui';
import { Check, Plus, Trash } from '../../ui/Icons';
import './Step7Revision.css';

interface Props {
  config: GauntletConfig;
  update: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  advanced: boolean;
}

export function Step7Revision({ config, update, advanced }: Props) {
  const patch = <K extends 'revision' | 'stop' | 'ledger'>(
    key: K,
    value: Partial<GauntletConfig[K]>,
  ) => update((c) => ({ ...c, [key]: { ...c[key], ...value } }));

  const { revision, stop, ledger, checkpoints } = config;

  const hasBudget =
    stop.maxTotalRounds > 0 || stop.maxTokens > 0 || stop.maxCostUsd > 0 || stop.maxWallClockMinutes > 0;

  return (
    <div className="stack-lg">
      {/* --- Fix order --------------------------------------------- */}
      <section className="wizard-section">
        <h2 className="wizard-section-title">When reviewers find problems, what happens?</h2>
        <div className="strategy-list" role="radiogroup" aria-label="Revision strategy">
          {REVISION_STRATEGIES.map((s) => {
            const selected = revision.strategy === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className="strategy-option"
                role="radio"
                aria-checked={selected}
                onClick={() => patch('revision', { strategy: s.id as RevisionStrategy })}
              >
                <span className="strategy-marker" aria-hidden="true">
                  {selected && <Check size={11} />}
                </span>
                <span>
                  <span className="strategy-name">{s.label}</span>
                  <span className="strategy-blurb">{s.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* --- Revision rules ---------------------------------------- */}
      <section className="wizard-section">
        <h2 className="wizard-section-title">Rules for every revision</h2>
        <div className="stack-sm">
          {REVISION_OPTIONS.map((opt) => (
            <Toggle
              key={opt.key}
              label={opt.label}
              blurb={opt.blurb}
              checked={config.revision[opt.key] === true}
              onChange={(v) => patch('revision', { [opt.key]: v } as Partial<GauntletConfig['revision']>)}
            />
          ))}
        </div>
      </section>

      {/* --- Budgets ------------------------------------------------ */}
      <section className="wizard-section">
        <h2 className="wizard-section-title">When should it stop?</h2>
        <Callout tone="info" title="What “keep going until everyone is happy” actually means here">
          The loop continues until every approval condition is met — or it stops honestly with an
          unresolved status when it hits a safety, budget, conflict, or feasibility boundary. It is
          never allowed to lower the quality bar to declare success.
        </Callout>

        <div className="budget-grid">
          <NumberInput
            label="Maximum rounds"
            value={stop.maxTotalRounds}
            onChange={(v) => patch('stop', { maxTotalRounds: Math.max(0, v) })}
            min={0}
            max={100}
            suffix="rounds"
            zeroLabel="No limit"
            help="One round is a build followed by a review."
          />
          <NumberInput
            label="Stop after failed rounds"
            value={stop.maxConsecutiveFailures}
            onChange={(v) => patch('stop', { maxConsecutiveFailures: Math.max(0, v) })}
            min={0}
            max={20}
            suffix="in a row"
            zeroLabel="No limit"
            help="Rounds in a row that fix nothing."
          />
          <NumberInput
            label="Give up on a defect after"
            value={stop.maxRepeatedDefects}
            onChange={(v) => patch('stop', { maxRepeatedDefects: Math.max(0, v) })}
            min={0}
            max={20}
            suffix="attempts"
            zeroLabel="No limit"
            help="The same problem reappearing this often means the approach is wrong. It escalates instead."
          />
          <NumberInput
            label="Stop when progress stalls after"
            value={stop.plateauRounds}
            onChange={(v) => patch('stop', { plateauRounds: Math.max(0, v) })}
            min={0}
            max={20}
            suffix="rounds"
            zeroLabel="Never"
            help="Rounds with barely any score improvement."
          />
        </div>

        {!hasBudget && (
          <Callout tone="warn" title="Nothing limits this loop">
            With no round, cost or time limit, an unreachable quality bar means the run never
            terminates on its own. Set at least a maximum number of rounds.
          </Callout>
        )}

        {advanced && (
          <AdvancedSection title="Cost, time, and per-agent limits">
            <div className="budget-grid">
              <NumberInput
                label="Per-agent round limit"
                value={stop.maxRoundsPerAgent}
                onChange={(v) => patch('stop', { maxRoundsPerAgent: Math.max(0, v) })}
                min={0}
                max={50}
                suffix="rounds"
                zeroLabel="No limit"
              />
              <NumberInput
                label="Token budget"
                value={stop.maxTokens}
                onChange={(v) => patch('stop', { maxTokens: Math.max(0, v) })}
                min={0}
                step={10000}
                suffix="tokens"
                zeroLabel="No limit"
              />
              <NumberInput
                label="Cost budget"
                value={stop.maxCostUsd}
                onChange={(v) => patch('stop', { maxCostUsd: Math.max(0, v) })}
                min={0}
                step={5}
                suffix="USD"
                zeroLabel="No limit"
              />
              <NumberInput
                label="Time budget"
                value={stop.maxWallClockMinutes}
                onChange={(v) => patch('stop', { maxWallClockMinutes: Math.max(0, v) })}
                min={0}
                step={15}
                suffix="minutes"
                zeroLabel="No limit"
              />
              <NumberInput
                label="Counts as progress"
                value={Math.round(stop.plateauDelta * 100)}
                onChange={(v) => patch('stop', { plateauDelta: Math.max(0, Math.min(50, v)) / 100 })}
                min={0}
                max={50}
                suffix="% score gain"
                help="Improvement below this does not count as progress."
              />
            </div>
          </AdvancedSection>
        )}
      </section>

      {/* --- Failure statuses --------------------------------------- */}
      <section className="wizard-section">
        <h2 className="wizard-section-title">If it cannot finish, how may it say so?</h2>
        <p className="field-help">
          These are the honest endings the agent is permitted to report. Removing all of them leaves
          it no way to admit failure, which pushes it toward claiming success.
        </p>
        <div className="stack-sm">
          {FAILURE_STATUSES.map((status) => (
            <Checkbox
              key={status.id}
              label={status.label}
              blurb={status.blurb}
              checked={stop.allowedFailureStatuses.includes(status.id)}
              onChange={(checked) =>
                patch('stop', {
                  allowedFailureStatuses: checked
                    ? [...stop.allowedFailureStatuses, status.id as FailureStatus]
                    : stop.allowedFailureStatuses.filter((s) => s !== status.id),
                })
              }
            />
          ))}
        </div>
        {stop.allowedFailureStatuses.length === 0 && (
          <Callout tone="danger" title="No honest ending is allowed">
            If the quality bar turns out to be unreachable, the agent has no permitted way to report
            that. Allow at least “incomplete”.
          </Callout>
        )}
      </section>

      {/* --- Checkpoints -------------------------------------------- */}
      <section className="wizard-section">
        <h2 className="wizard-section-title">Where should it stop and ask you?</h2>
        <p className="field-help">
          At a blocking checkpoint the run halts, shows you what it has, and waits. Nothing proceeds
          on the assumption you would have approved.
        </p>

        {checkpoints.length === 0 ? (
          <p className="taginput-empty">
            No checkpoints. The run will proceed without pausing for you.
          </p>
        ) : (
          <div className="stack-sm">
            {checkpoints.map((checkpoint) => (
              <div className="checkpoint-row" key={checkpoint.id}>
                <div className="checkpoint-fields">
                  <TextInput
                    label="Name"
                    value={checkpoint.label}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        checkpoints: c.checkpoints.map((x) =>
                          x.id === checkpoint.id ? { ...x, label: v } : x,
                        ),
                      }))
                    }
                  />
                  <Select<CheckpointTrigger>
                    label="When"
                    value={checkpoint.trigger}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        checkpoints: c.checkpoints.map((x) =>
                          x.id === checkpoint.id ? { ...x, trigger: v } : x,
                        ),
                      }))
                    }
                    options={CHECKPOINT_TRIGGERS.map((t) => ({
                      value: t.id,
                      label: t.label,
                      blurb: t.blurb,
                    }))}
                  />
                  <TextInput
                    label="What it should ask you"
                    value={checkpoint.question}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        checkpoints: c.checkpoints.map((x) =>
                          x.id === checkpoint.id ? { ...x, question: v } : x,
                        ),
                      }))
                    }
                    placeholder="Does this meet what you asked for?"
                  />
                </div>
                <div className="checkpoint-side">
                  <Toggle
                    label="Stop and wait"
                    checked={checkpoint.blocking}
                    onChange={(v) =>
                      update((c) => ({
                        ...c,
                        checkpoints: c.checkpoints.map((x) =>
                          x.id === checkpoint.id ? { ...x, blocking: v } : x,
                        ),
                      }))
                    }
                    blurb={checkpoint.blocking ? 'Halts until you answer' : 'Notifies and continues'}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Remove checkpoint ${checkpoint.label}`}
                    onClick={() =>
                      update((c) => ({
                        ...c,
                        checkpoints: c.checkpoints.filter((x) => x.id !== checkpoint.id),
                      }))
                    }
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <Button
            onClick={() =>
              update((c) => ({ ...c, checkpoints: [...c.checkpoints, createCheckpoint()] }))
            }
          >
            <Plus size={14} /> Add a checkpoint
          </Button>
        </div>
      </section>

      {/* --- Ledger -------------------------------------------------- */}
      {advanced && (
        <AdvancedSection title="Progress ledger" defaultOpen>
          <p className="field-help">
            A running record of every round, so you can reconstruct what happened afterwards rather
            than trusting a summary written at the end.
          </p>
          <Toggle
            label="Keep a progress ledger"
            checked={ledger.enabled}
            onChange={(v) => patch('ledger', { enabled: v })}
            blurb="Strongly recommended for anything running unattended."
          />
          {ledger.enabled && (
            <>
              <Select
                label="Format"
                value={ledger.format}
                onChange={(v) => patch('ledger', { format: v as GauntletConfig['ledger']['format'] })}
                options={[
                  { value: 'markdown-table', label: 'Markdown table', blurb: 'Easiest to read' },
                  { value: 'json-lines', label: 'JSON lines', blurb: 'Easiest to process' },
                  { value: 'yaml-blocks', label: 'YAML blocks', blurb: 'Good for long entries' },
                ]}
              />
              <div className="ledger-fields">
                {LEDGER_FIELDS.map((field) => (
                  <Checkbox
                    key={field.id}
                    label={field.label}
                    blurb={field.blurb}
                    checked={ledger.fields.includes(field.id)}
                    onChange={(checked) =>
                      patch('ledger', {
                        fields: checked
                          ? LEDGER_FIELDS.filter(
                              (f) => ledger.fields.includes(f.id) || f.id === field.id,
                            ).map((f) => f.id as LedgerField)
                          : ledger.fields.filter((f) => f !== field.id),
                      })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </AdvancedSection>
      )}
    </div>
  );
}
