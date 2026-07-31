/**
 * Step 8 — how demanding each reviewer should be.
 *
 * Strictness is per-reviewer because a security gate and a copy editor should
 * not be tuned together. Conflicting behaviour combinations are surfaced
 * inline, since the two that conflict read as complementary until you think
 * about them.
 */

import { CRITIC_BEHAVIORS, behaviorById, roleById, STRICTNESS_LEVELS } from '../../../model/catalog';
import { isReviewRole } from '../../../model/catalog';
import type { Agent, CriticBehavior, CriticStrictness, GauntletConfig } from '../../../model/types';
import { Badge, Callout, Checkbox, Toggle } from '../../ui';
import '../../agents/AgentEditor.css';
import './Step8Strictness.css';

interface Props {
  config: GauntletConfig;
  update: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  advanced: boolean;
}

export function Step8Strictness({ config, update, advanced }: Props) {
  const reviewers = config.agents.filter((a) => isReviewRole(a.roleType) && a.enabled);

  const patchAgent = (id: string, patch: Partial<Agent>) =>
    update((c) => ({ ...c, agents: c.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));

  const applyToAll = (strictness: CriticStrictness) =>
    update((c) => ({
      ...c,
      agents: c.agents.map((a) => (isReviewRole(a.roleType) ? { ...a, strictness } : a)),
    }));

  if (reviewers.length === 0) {
    return (
      <Callout tone="danger" title="No reviewers to configure">
        This Gauntlet has no reviewing agents, so nothing checks the work independently. Add a critic
        or another reviewing role in step 4.
      </Callout>
    );
  }

  return (
    <div className="stack-lg">
      <Callout tone="info" title="Stricter is not automatically better">
        A very demanding reviewer finds more, but needs more rounds to be satisfied — and a reviewer
        that never approves stalls the loop just as effectively as one that approves everything. Use
        high strictness where the cost of being wrong is high.
      </Callout>

      <div className="row-wrap">
        <span className="text-sm text-secondary">Set all reviewers to:</span>
        {STRICTNESS_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            className="chip"
            style={{ cursor: 'pointer' }}
            onClick={() => applyToAll(level.id)}
          >
            {level.label}
          </button>
        ))}
      </div>

      {reviewers.map((reviewer) => {
        const strictness = reviewer.strictness ?? 'strict-professional';
        const level = STRICTNESS_LEVELS.find((l) => l.id === strictness)!;
        const behaviors = reviewer.behaviors ?? [];

        const conflicts = behaviors.filter((b) =>
          (behaviorById(b).conflictsWith ?? []).some((c) => behaviors.includes(c)),
        );

        return (
          <section className="strictness-card" key={reviewer.id}>
            <header className="strictness-card-head">
              <span className="agent-family-dot" data-family="review" aria-hidden="true" />
              <span className="strictness-card-name">{reviewer.name}</span>
              <span className="text-sm text-tertiary">{roleById(reviewer.roleType).label}</span>
              {reviewer.mandatoryApproval && <Badge tone="accent">Must approve</Badge>}
            </header>

            <div className="strictness-scale">
              <div
                className="strictness-track"
                role="radiogroup"
                aria-label={`Strictness for ${reviewer.name}`}
              >
                {STRICTNESS_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="strictness-step"
                    aria-pressed={strictness === l.id}
                    onClick={() => patchAgent(reviewer.id, { strictness: l.id })}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="strictness-desc">{level.blurb}</p>
            </div>

            {advanced && (
              <div className="strictness-behaviors">
                <p className="agent-subhead">How this reviewer works</p>
                <div className="behavior-grid">
                  {CRITIC_BEHAVIORS.map((behavior) => {
                    const checked = behaviors.includes(behavior.id);
                    const conflicting =
                      checked && conflicts.includes(behavior.id);
                    return (
                      <Checkbox
                        key={behavior.id}
                        label={
                          <>
                            {behavior.label}
                            {conflicting && (
                              <span style={{ color: 'var(--warn)' }}> — conflicts</span>
                            )}
                          </>
                        }
                        blurb={behavior.blurb}
                        checked={checked}
                        onChange={(next) =>
                          patchAgent(reviewer.id, {
                            behaviors: next
                              ? [...behaviors, behavior.id as CriticBehavior]
                              : behaviors.filter((b) => b !== behavior.id),
                          })
                        }
                      />
                    );
                  })}
                </div>

                {conflicts.length > 0 && (
                  <Callout tone="warn" title="Contradictory instructions">
                    {reviewer.name} is told both to withhold implementation advice and to recommend
                    implementation changes. Pick one — withholding suits an independent reviewer,
                    recommending suits a collaborative one.
                  </Callout>
                )}
              </div>
            )}

            <Toggle
              label="Judge only the artifact, never the explanation"
              checked={!reviewer.seesPriorReasoning}
              onChange={(v) => patchAgent(reviewer.id, { seesPriorReasoning: !v })}
              blurb="The strongest protection against a reviewer being persuaded rather than convinced."
            />
          </section>
        );
      })}
    </div>
  );
}
