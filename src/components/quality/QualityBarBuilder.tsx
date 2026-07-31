/**
 * Quality-bar builder: evidence selection, per-evidence configuration, and the
 * criteria editor.
 *
 * The design goal here is that a user cannot end up with a Gauntlet whose
 * definition of "done" is an adjective. Selecting an evidence type offers to
 * add a matching criterion, and subjective goals get an explicit conversion
 * affordance rather than being silently accepted.
 */

import { useState } from 'react';

import {
  EVIDENCE,
  EVIDENCE_FIELD_META,
  evidenceById,
  type EvidenceField,
} from '../../model/catalog';
import { createCriterion } from '../../model/defaults';
import type {
  EvidenceConfig,
  EvidenceKind,
  GauntletConfig,
  QualityCriterion,
} from '../../model/types';
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Field,
  ListInput,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from '../ui';
import { Check, Plus, Trash, Warning } from '../ui/Icons';
import './QualityBar.css';

interface Props {
  config: GauntletConfig;
  update: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  advanced: boolean;
}

export function QualityBarBuilder({ config, update, advanced }: Props) {
  const q = config.quality;

  const patchQuality = (patch: Partial<GauntletConfig['quality']>) =>
    update((c) => ({ ...c, quality: { ...c.quality, ...patch } }));

  const toggleEvidence = (kind: EvidenceKind) => {
    const selected = q.evidence.includes(kind);
    if (selected) {
      patchQuality({ evidence: q.evidence.filter((e) => e !== kind) });
      return;
    }

    // Preserve catalog order so the generated prompt is stable regardless of
    // the order the user clicked things in.
    const next = EVIDENCE.filter((e) => q.evidence.includes(e.id) || e.id === kind).map((e) => e.id);

    const entry = evidenceById(kind);
    const shouldSuggest =
      entry.suggestedCriterion && !q.criteria.some((c) => c.label === entry.suggestedCriterion?.label);

    patchQuality({
      evidence: next,
      criteria: shouldSuggest
        ? [
            ...q.criteria,
            createCriterion({
              label: entry.suggestedCriterion!.label,
              statement: entry.suggestedCriterion!.statement,
              verification: entry.suggestedCriterion!.verification,
              evidence: [kind],
              severity: 'mandatory',
              weight: 4,
            }),
          ]
        : q.criteria,
    });
  };

  const patchEvidenceConfig = (kind: EvidenceKind, patch: Partial<EvidenceConfig>) =>
    patchQuality({
      evidenceConfig: { ...q.evidenceConfig, [kind]: { ...(q.evidenceConfig[kind] ?? {}), ...patch } },
    });

  const updateCriterion = (id: string, patch: Partial<QualityCriterion>) =>
    patchQuality({ criteria: q.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const removeCriterion = (id: string) =>
    patchQuality({ criteria: q.criteria.filter((c) => c.id !== id) });

  const addCriterion = (seed?: Partial<QualityCriterion>) =>
    patchQuality({ criteria: [...q.criteria, createCriterion(seed)] });

  return (
    <div className="stack-lg">
      {/* --- Evidence ------------------------------------------------ */}
      <section className="wizard-section">
        <div>
          <h2 className="wizard-section-title">How will you know it actually worked?</h2>
          <p className="field-help">
            Choose the kinds of proof that must be collected. Each one you pick reveals its own
            settings, and adds a matching criterion you can edit.
          </p>
        </div>

        <div className="evidence-grid" role="group" aria-label="Evidence types">
          {EVIDENCE.map((entry) => {
            const selected = q.evidence.includes(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                className="evidence-option"
                aria-pressed={selected}
                onClick={() => toggleEvidence(entry.id)}
              >
                <span className="evidence-option-head">
                  <span className="evidence-check" aria-hidden="true">
                    <Check size={11} />
                  </span>
                  {entry.label}
                </span>
                <span className="evidence-option-blurb">{entry.blurb}</span>
              </button>
            );
          })}
        </div>

        {q.evidence.length === 0 && (
          <Callout tone="warn" title="Nothing is being checked yet">
            Without evidence, reviewers judge from descriptions rather than from the real thing —
            which is exactly how work gets approved that does not function. Pick at least one.
          </Callout>
        )}

        {q.evidence.map((kind) => {
          const entry = evidenceById(kind);
          if (entry.fields.length === 0) return null;
          return (
            <div className="evidence-config" key={kind}>
              <p className="evidence-config-title">
                {entry.label} <Badge>settings</Badge>
              </p>
              <div className="wizard-grid-2">
                {entry.fields.map((field) => (
                  <EvidenceFieldControl
                    key={field}
                    field={field}
                    value={q.evidenceConfig[kind] ?? {}}
                    onChange={(patch) => patchEvidenceConfig(kind, patch)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* --- Criteria ------------------------------------------------ */}
      <section className="wizard-section">
        <div>
          <h2 className="wizard-section-title">What has to be true for this to be finished?</h2>
          <p className="field-help">
            Each criterion is one thing a reviewer checks. The important part is the verification —
            what someone would physically do to confirm it. A criterion nobody can check will be
            treated as passing by default.
          </p>
        </div>

        {q.criteria.length === 0 ? (
          <Callout tone="danger" title="No criteria yet">
            Without criteria the reviewers have nothing to judge against, and the loop has no honest
            way to end. Add at least one, or pick an evidence type above to get a starting point.
          </Callout>
        ) : (
          <div className="criteria-list">
            {q.criteria.map((criterion, index) => (
              <CriterionEditor
                key={criterion.id}
                criterion={criterion}
                index={index}
                availableEvidence={q.evidence}
                advanced={advanced}
                onChange={(patch) => updateCriterion(criterion.id, patch)}
                onRemove={() => removeCriterion(criterion.id)}
              />
            ))}
          </div>
        )}

        <div>
          <Button onClick={() => addCriterion()}>
            <Plus size={14} /> Add a criterion
          </Button>
        </div>
      </section>

      {/* --- Subjective goals ---------------------------------------- */}
      <section className="wizard-section">
        <div>
          <h2 className="wizard-section-title">Anything that is a matter of taste?</h2>
          <p className="field-help">
            Goals like "it should feel trustworthy" are real, but an agent can satisfy them by simply
            asserting it did. Add them here, then turn each one into something checkable.
          </p>
        </div>

        <ListInput
          label="Subjective goals"
          items={q.subjectiveGoals}
          onChange={(v) => patchQuality({ subjectiveGoals: v })}
          placeholder="It should feel calm and trustworthy"
          emptyText="No subjective goals. That is fine — skip this if everything you need is measurable."
          optional
        />

        {q.subjectiveGoals.length > 0 && (
          <div className="stack-sm">
            {q.subjectiveGoals.map((goal) => {
              const converted = q.criteria.some((c) => c.derivedFromSubjective === goal);
              return (
                <div className="subjective-row" key={goal}>
                  <span className="subjective-text">{goal}</span>
                  {converted ? (
                    <Badge tone="ok">
                      <Check size={11} /> Has a check
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        addCriterion({
                          label: goal.length > 40 ? `${goal.slice(0, 38)}…` : goal,
                          statement: goal,
                          verification: '',
                          severity: 'important',
                          weight: 3,
                          derivedFromSubjective: goal,
                        })
                      }
                    >
                      Make it checkable
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --- Passing score ------------------------------------------- */}
      <section className="wizard-section">
        <Field
          label="How high does the overall score have to be?"
          help="Criteria are scored from 0 to 1 and averaged by weight. This is the bar the average must clear — on top of that, every mandatory criterion must pass on its own."
          htmlFor="passing-score"
        >
          <div className="passing-score">
            <span className="passing-score-value" aria-hidden="true">
              {Math.round(q.passingScore * 100)}%
            </span>
            <input
              id="passing-score"
              className="range-input"
              type="range"
              min={50}
              max={100}
              step={5}
              value={Math.round(q.passingScore * 100)}
              onChange={(e) => patchQuality({ passingScore: Number(e.target.value) / 100 })}
              aria-valuetext={`${Math.round(q.passingScore * 100)} percent`}
            />
          </div>
        </Field>
        {q.passingScore >= 0.95 && (
          <Callout tone="info">
            A bar this high means almost nothing can be left imperfect. Expect several rounds, and
            make sure your round limit in step 7 is generous enough to reach it.
          </Callout>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Evidence field control
 * ------------------------------------------------------------------ */

function EvidenceFieldControl({
  field,
  value,
  onChange,
}: {
  field: EvidenceField;
  value: EvidenceConfig;
  onChange: (patch: Partial<EvidenceConfig>) => void;
}) {
  const meta = EVIDENCE_FIELD_META[field];

  if (meta.kind === 'number') {
    return (
      <NumberInput
        label={meta.label}
        help={meta.help}
        value={(value[field] as number) ?? 0}
        onChange={(v) => onChange({ [field]: v } as Partial<EvidenceConfig>)}
        min={0}
        max={field.includes('Latency') || field === 'maxLatencyMs' ? undefined : 100}
        suffix={field === 'maxLatencyMs' ? 'ms' : '%'}
        zeroLabel="Not set"
      />
    );
  }

  if (meta.kind === 'numberList') {
    return (
      <ListInput
        label={meta.label}
        help={meta.help}
        items={((value[field] as number[]) ?? []).map(String)}
        onChange={(items) =>
          onChange({ [field]: items.map(Number).filter(Number.isFinite) } as Partial<EvidenceConfig>)
        }
        placeholder={meta.placeholder}
        numeric
        compact
        emptyText="No widths set."
      />
    );
  }

  if (meta.kind === 'list') {
    return (
      <ListInput
        label={meta.label}
        help={meta.help}
        items={(value[field] as string[]) ?? []}
        onChange={(items) => onChange({ [field]: items } as Partial<EvidenceConfig>)}
        placeholder={meta.placeholder}
      />
    );
  }

  return (
    <TextInput
      label={meta.label}
      help={meta.help}
      value={(value[field] as string) ?? ''}
      onChange={(v) => onChange({ [field]: v } as Partial<EvidenceConfig>)}
      placeholder={meta.placeholder}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Criterion editor
 * ------------------------------------------------------------------ */

function CriterionEditor({
  criterion,
  index,
  availableEvidence,
  advanced,
  onChange,
  onRemove,
}: {
  criterion: QualityCriterion;
  index: number;
  availableEvidence: EvidenceKind[];
  advanced: boolean;
  onChange: (patch: Partial<QualityCriterion>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(criterion.label.trim() === '');
  const missingVerification = criterion.verification.trim() === '';

  return (
    <div className="criterion" data-severity={criterion.severity}>
      <div className="criterion-head">
        <button
          type="button"
          className="criterion-title"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className={criterion.label ? '' : 'criterion-title-empty'}>
            {criterion.label || `Criterion ${index + 1} — needs a name`}
          </span>
        </button>
        {criterion.severity === 'mandatory' && <Badge tone="accent">Must pass</Badge>}
        {missingVerification && (
          <Badge tone="warn">
            <Warning size={10} /> No check
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onRemove}
          aria-label={`Remove criterion ${criterion.label || index + 1}`}
        >
          <Trash size={14} />
        </Button>
      </div>

      {open && (
        <div className="criterion-body">
          <TextInput
            label="Short name"
            value={criterion.label}
            onChange={(v) => onChange({ label: v })}
            placeholder="Primary flows work"
          />

          <TextArea
            label="This passes when…"
            value={criterion.statement}
            onChange={(v) => onChange({ statement: v })}
            rows={2}
            placeholder="Every required user journey completes without an error."
            help="State the condition, not the aspiration."
          />

          <TextArea
            label="A reviewer confirms it by…"
            value={criterion.verification}
            onChange={(v) => onChange({ verification: v })}
            rows={2}
            placeholder="Walking each flow in a running browser and recording the result of every step."
            help="Describe the physical action. This is what stops a reviewer from approving on impression."
            error={missingVerification ? 'Without this, the criterion cannot be failed.' : undefined}
          />

          <div className="criterion-meta">
            <Select
              label="How important is it?"
              value={criterion.severity}
              onChange={(v) => onChange({ severity: v as QualityCriterion['severity'] })}
              options={[
                { value: 'mandatory', label: 'Must pass', blurb: 'Blocks completion on its own' },
                { value: 'important', label: 'Important', blurb: 'Counts heavily toward the score' },
                { value: 'desirable', label: 'Nice to have', blurb: 'Counts, but never blocks' },
              ]}
            />

            {advanced && (
              <NumberInput
                label="Weight"
                value={criterion.weight}
                onChange={(v) => onChange({ weight: Math.max(1, Math.min(5, v)) })}
                min={1}
                max={5}
                help="1–5. Higher weights pull the overall score more."
              />
            )}
          </div>

          {availableEvidence.length > 0 && (
            <Field
              label="Which evidence proves this?"
              help="Links the criterion to the proof that supports it, and assigns it to the reviewer that owns that evidence."
            >
              <div className="stack-sm">
                {availableEvidence.map((kind) => (
                  <Checkbox
                    key={kind}
                    label={evidenceById(kind).label}
                    checked={criterion.evidence.includes(kind)}
                    onChange={(checked) =>
                      onChange({
                        evidence: checked
                          ? [...criterion.evidence, kind]
                          : criterion.evidence.filter((e) => e !== kind),
                      })
                    }
                  />
                ))}
              </div>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
