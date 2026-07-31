/**
 * Step 1 — what the user is trying to accomplish.
 *
 * Simple mode asks the four questions that genuinely change the generated
 * prompt; everything else sits behind an advanced disclosure so a first-time
 * user is not confronted with ten text areas.
 */

import { ENVIRONMENTS, environmentById } from '../../../model/catalog';
import type { GauntletConfig, TargetEnvironment } from '../../../model/types';
import {
  AdvancedSection,
  Callout,
  ListInput,
  Select,
  TextArea,
  TextInput,
} from '../../ui';

interface StepProps {
  config: GauntletConfig;
  update: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  advanced: boolean;
}

export function Step1Intent({ config, update, advanced }: StepProps) {
  const { intent } = config;
  const env = environmentById(intent.environment);

  const patch = (patchValue: Partial<GauntletConfig['intent']>) =>
    update((c) => ({ ...c, intent: { ...c.intent, ...patchValue } }));

  return (
    <div className="wizard-section">
      <TextInput
        label="What should this be called?"
        value={intent.projectName}
        onChange={(v) => patch({ projectName: v })}
        placeholder="Customer billing dashboard"
        help="Just a name so you can find it later."
      />

      <TextArea
        label="What do you want accomplished?"
        value={intent.goal}
        onChange={(v) => patch({ goal: v })}
        rows={3}
        placeholder="Build a billing dashboard where customers can see their plan, past invoices, and current usage."
        help="Write it the way you would explain it to a colleague. Be concrete about what the work is for."
      />

      <TextArea
        label="What has to exist when it is finished?"
        value={intent.deliverable}
        onChange={(v) => patch({ deliverable: v })}
        rows={2}
        placeholder="A working React page with tests passing and screenshots at phone and desktop widths."
        help="Name the actual artifact. Without this, agents can produce something plausible that is not what you wanted, and no reviewer can tell."
      />

      <TextInput
        label="Who is it for?"
        value={intent.audience}
        onChange={(v) => patch({ audience: v })}
        placeholder="Paying customers, mostly checking billing on a phone once a month"
        help="Reviewers use this to judge whether the result actually suits its reader or user."
        optional
      />

      <Select<TargetEnvironment>
        label="Where will you run this?"
        value={intent.environment}
        onChange={(v) => patch({ environment: v })}
        options={ENVIRONMENTS.map((e) => ({ value: e.id, label: e.label, blurb: e.blurb }))}
        help={env.blurb}
      />

      {intent.environment === 'custom' && (
        <TextInput
          label="Describe your environment"
          value={intent.customEnvironment}
          onChange={(v) => patch({ customEnvironment: v })}
          placeholder="An internal agent framework with file access and a test runner"
          help="The generated prompt will use this wording when addressing the agent."
        />
      )}

      {environmentById(intent.environment).capability === 'sequential-simulation' && (
        <Callout tone="info" title="This environment runs one agent at a time">
          {env.label} cannot start genuinely separate sub-agents, so the generated prompt will tell it
          to play each role in sequence with explicit context resets between them. That is weaker
          than true separation, and the prompt says so honestly rather than pretending otherwise.
        </Callout>
      )}

      {advanced && (
        <>
          <TextArea
            label="What context do the agents need?"
            value={intent.context}
            onChange={(v) => patch({ context: v })}
            rows={3}
            placeholder="The app uses React and TypeScript. Billing data comes from /api/billing. Invoices are already generated server-side."
            help="Anything they could not work out for themselves: existing systems, conventions, constraints, history."
            optional
          />

          <TextArea
            label="Any examples or reference material?"
            value={intent.references}
            onChange={(v) => patch({ references: v })}
            rows={2}
            placeholder="Match the visual language of the existing settings pages."
            help="Reviewers compare against this. Required if you plan to use reference comparison in the next step."
            optional
          />

          <ListInput
            label="Requirements that must hold"
            items={intent.requirements}
            onChange={(v) => patch({ requirements: v })}
            placeholder="Must work on a 390px-wide phone screen"
            help="Non-negotiable rules. The generated prompt states these cannot be reinterpreted to make the work easier."
            optional
          />

          <ListInput
            label="Things the agents must never do"
            items={intent.prohibitions}
            onChange={(v) => patch({ prohibitions: v })}
            placeholder="Do not modify the billing API"
            help="Boundaries the work must respect no matter how convenient crossing them would be."
            optional
          />

          <ListInput
            label="Tools available to the agents"
            items={intent.tools}
            onChange={(v) => patch({ tools: v })}
            placeholder="Shell commands"
            help="What the agents can actually use. Telling an agent to run tests when it cannot run commands just produces invented output."
            suggestions={env.suggestedTools}
            optional
            compact
          />
        </>
      )}

      {!advanced && (
        <AdvancedSection title="More detail (context, requirements, tools)">
          <TextArea
            label="What context do the agents need?"
            value={intent.context}
            onChange={(v) => patch({ context: v })}
            rows={3}
            placeholder="The app uses React and TypeScript. Billing data comes from /api/billing."
            help="Anything they could not work out for themselves."
            optional
          />
          <TextArea
            label="Any examples or reference material?"
            value={intent.references}
            onChange={(v) => patch({ references: v })}
            rows={2}
            placeholder="Match the visual language of the existing settings pages."
            optional
          />
          <ListInput
            label="Requirements that must hold"
            items={intent.requirements}
            onChange={(v) => patch({ requirements: v })}
            placeholder="Must work on a 390px-wide phone screen"
            optional
          />
          <ListInput
            label="Things the agents must never do"
            items={intent.prohibitions}
            onChange={(v) => patch({ prohibitions: v })}
            placeholder="Do not modify the billing API"
            optional
          />
          <ListInput
            label="Tools available to the agents"
            items={intent.tools}
            onChange={(v) => patch({ tools: v })}
            placeholder="Shell commands"
            suggestions={env.suggestedTools}
            optional
            compact
          />
        </AdvancedSection>
      )}
    </div>
  );
}
