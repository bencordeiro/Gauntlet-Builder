/**
 * Step 5 — how agents report to and respond to each other.
 *
 * The live diagram sits directly beneath the mode picker so the consequence of
 * a choice is visible immediately rather than described. Per-agent overrides
 * live behind a disclosure since most Gauntlets never need them.
 */

import { useState } from 'react';

import { COMMUNICATION_MODES, communicationById, roleById } from '../../../model/catalog';
import type { CommunicationMode, GauntletConfig } from '../../../model/types';
import { WorkflowDiagram } from '../../diagram/WorkflowDiagram';
import { AdvancedSection, Badge, Callout, Select, Toggle } from '../../ui';
import { Check } from '../../ui/Icons';
import './Step5Communication.css';

interface Props {
  config: GauntletConfig;
  update: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  advanced: boolean;
}

export function Step5Communication({ config, update, advanced }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | undefined>();
  const comm = config.communication;
  const active = config.agents.filter((a) => a.enabled);

  const patchComm = (patch: Partial<GauntletConfig['communication']>) =>
    update((c) => ({ ...c, communication: { ...c.communication, ...patch } }));

  const setMode = (mode: CommunicationMode) => {
    const entry = communicationById(mode);
    patchComm({
      globalMode: mode,
      // Blind review is meaningless without anonymity, so select it together.
      anonymizeBuilder: entry.requiresAnonymity ? true : comm.anonymizeBuilder,
    });
  };

  const needsMediator = communicationById(comm.globalMode).requiresMediator;
  const hasMediator = active.some((a) => a.roleType === 'mediator');

  return (
    <div className="stack-lg">
      <section className="wizard-section">
        <div className="comm-grid" role="radiogroup" aria-label="Communication mode">
          {COMMUNICATION_MODES.map((mode) => {
            const selected = comm.globalMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                className="comm-option"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(mode.id)}
              >
                <span className="comm-option-head">
                  <span className="comm-option-name">{mode.label}</span>
                  {selected && (
                    <span className="comm-option-check">
                      <Check size={12} />
                      <span className="visually-hidden">Selected</span>
                    </span>
                  )}
                </span>
                <span className="comm-option-blurb">{mode.blurb}</span>
                <span className="comm-option-consequence">{mode.consequence}</span>
              </button>
            );
          })}
        </div>
      </section>

      {needsMediator && !hasMediator && (
        <Callout tone="danger" title="This mode needs a mediator">
          Mediated disagreement escalates disputes to a separate mediator agent, but there isn't one.
          Go back to step 4 and add a mediator, or pick a different mode.
        </Callout>
      )}

      <section className="wizard-section">
        <h2 className="wizard-section-title">Who reports to whom</h2>
        <p className="field-help">
          Select any agent to see exactly what it sends and receives. Dashed lines are findings
          travelling back up to whoever has to act on them.
        </p>
        <WorkflowDiagram
          agents={config.agents}
          edges={comm.edges}
          selectedId={selectedNode}
          onSelect={setSelectedNode}
          caption="Communication pathways between agents"
        />
      </section>

      <section className="wizard-section">
        <h2 className="wizard-section-title">Review conditions</h2>
        <Toggle
          label="Hide who produced the work"
          checked={comm.anonymizeBuilder}
          onChange={(v) => patchComm({ anonymizeBuilder: v })}
          blurb="Reviewers get the artifact and the evidence, but never the author's name or their explanation of it. Harder to argue a reviewer out of a finding."
        />
        <Toggle
          label="Require structured findings"
          checked={comm.structuredFindingsOnly}
          onChange={(v) => patchComm({ structuredFindingsOnly: v })}
          blurb="Reviewers must return a defined JSON structure rather than prose. Stops 'this needs more work' from counting as a review."
        />
        <Toggle
          label="Allow clarifying questions"
          checked={comm.allowClarifyingQuestions}
          onChange={(v) => patchComm({ allowClarifyingQuestions: v })}
          blurb="Agents may ask one question before acting on an assumption. Turn off for stricter independence."
        />
      </section>

      {advanced && (
        <AdvancedSection
          title="Per-agent exceptions"
          count={
            Object.keys(comm.overrides).length > 0
              ? `${Object.keys(comm.overrides).length} set`
              : undefined
          }
        >
          <p className="field-help">
            Override the default for individual agents — for example, keeping one reviewer blind
            while the rest talk freely.
          </p>
          <div className="stack">
            {active.map((agent) => (
              <div className="comm-override-row" key={agent.id}>
                <div className="comm-override-name">
                  <span>{agent.name}</span>
                  <Badge>{roleById(agent.roleType).label}</Badge>
                </div>
                <Select
                  label={`Communication mode for ${agent.name}`}
                  ariaLabel={`Communication mode for ${agent.name}`}
                  bare
                  value={comm.overrides[agent.id] ?? 'inherit'}
                  onChange={(v) => {
                    const next = { ...comm.overrides };
                    if (v === 'inherit') delete next[agent.id];
                    else next[agent.id] = v as CommunicationMode;
                    patchComm({ overrides: next });
                  }}
                  options={[
                    { value: 'inherit', label: `Same as default (${communicationById(comm.globalMode).label})` },
                    ...COMMUNICATION_MODES.map((m) => ({ value: m.id, label: m.label })),
                  ]}
                />
              </div>
            ))}
          </div>
        </AdvancedSection>
      )}
    </div>
  );
}
