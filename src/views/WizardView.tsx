/**
 * Wizard view — orchestrates the ten steps.
 *
 * Step state lives here rather than in the store because it is navigation, not
 * data: reopening a Gauntlet later should start at the beginning rather than
 * wherever the user happened to stop.
 */

import { useEffect, useMemo, useState } from 'react';

import { AgentEditor } from '../components/agents/AgentEditor';
import { PromptPreview } from '../components/preview/PromptPreview';
import { QualityBarBuilder } from '../components/quality/QualityBarBuilder';
import { WizardShell } from '../components/wizard/WizardShell';
import { Step1Intent } from '../components/wizard/steps/Step1Intent';
import { Step3Structure } from '../components/wizard/steps/Step3Structure';
import { Step5Communication } from '../components/wizard/steps/Step5Communication';
import { Step6Approval } from '../components/wizard/steps/Step6Approval';
import { Step7Revision } from '../components/wizard/steps/Step7Revision';
import { Step8Strictness } from '../components/wizard/steps/Step8Strictness';
import { Step9Review } from '../components/wizard/steps/Step9Review';
import { Button, Callout, EmptyState } from '../components/ui';
import { useStore } from '../state/store';
import { validate } from '../validation/validate';
import type { ViewId } from '../components/shell/AppShell';

interface Props {
  onNavigate: (view: ViewId) => void;
}

export function WizardView({ onNavigate }: Props) {
  const { draft, updateDraft, state, createDraft } = useStore();
  const [step, setStep] = useState(1);
  const [advanced, setAdvanced] = useState(state.settings.advancedByDefault);

  // Follow the setting when it changes, but let a per-session toggle stick.
  useEffect(() => setAdvanced(state.settings.advancedByDefault), [state.settings.advancedByDefault]);

  // Reset to step 1 whenever a different Gauntlet is opened.
  useEffect(() => setStep(1), [draft?.meta.id]);

  const warnings = useMemo(() => (draft ? validate(draft) : []), [draft]);
  const blocking = warnings.filter((w) => w.severity === 'blocking');

  if (!draft) {
    return (
      <EmptyState
        title="No Gauntlet open"
        action={
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => createDraft()}>
              Start a new Gauntlet
            </Button>
            <Button onClick={() => onNavigate('presets')}>Browse presets</Button>
          </div>
        }
      >
        Start from scratch, or pick a preset that already has agents, evidence and stopping rules
        configured for your kind of work.
      </EmptyState>
    );
  }

  const stepProps = { config: draft, update: updateDraft, advanced };

  return (
    <WizardShell
      config={draft}
      step={step}
      onStepChange={setStep}
      advanced={advanced}
      onAdvancedChange={setAdvanced}
      warnings={warnings}
      onFinish={() => onNavigate('dashboard')}
    >
      {step === 1 && <Step1Intent {...stepProps} />}
      {step === 2 && <QualityBarBuilder {...stepProps} />}
      {step === 3 && <Step3Structure config={draft} update={updateDraft} />}
      {step === 4 && <AgentEditor {...stepProps} />}
      {step === 5 && <Step5Communication {...stepProps} />}
      {step === 6 && <Step6Approval {...stepProps} />}
      {step === 7 && <Step7Revision {...stepProps} />}
      {step === 8 && <Step8Strictness {...stepProps} />}
      {step === 9 && <Step9Review config={draft} warnings={warnings} onGoToStep={setStep} />}
      {step === 10 && (
        <PromptPreview
          config={draft}
          banner={
            blocking.length > 0 ? (
              <Callout tone="danger" title={`${blocking.length} problem${blocking.length > 1 ? 's' : ''} would stop this working`}>
                The prompt below is still generated so you can see it, but this configuration cannot
                finish honestly as it stands. {blocking[0].problem}{' '}
                <Button size="sm" onClick={() => setStep(9)} style={{ marginTop: 'var(--space-2)' }}>
                  Review the problems
                </Button>
              </Callout>
            ) : undefined
          }
        />
      )}
    </WizardShell>
  );
}
