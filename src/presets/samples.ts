/**
 * Sample Gauntlets seeded on first launch.
 *
 * These exist so the dashboard is useful before the user has built anything,
 * and so every view (saved list, editor, preview, diagram) has realistic data
 * to render immediately. They are marked `isSample` so they can be visually
 * distinguished and reset.
 */

import { createGauntlet } from '../model/defaults';
import type { GauntletConfig } from '../model/types';
import { presetById } from './projectPresets';

interface SampleSpec {
  presetId: string;
  projectName: string;
  goal: string;
  deliverable: string;
  audience: string;
  context?: string;
  references?: string;
  requirements?: string[];
  prohibitions?: string[];
  tools?: string[];
  environment?: GauntletConfig['intent']['environment'];
  subjectiveGoals?: string[];
}

const SAMPLES: SampleSpec[] = [
  {
    presetId: 'production-web-app',
    projectName: 'Customer billing dashboard',
    goal: 'Build a billing dashboard where customers can see their current plan, past invoices, and usage for the current period, and can download any invoice as a PDF.',
    deliverable: 'A working React application with the dashboard implemented, tests passing, and screenshots at mobile and desktop widths.',
    audience: 'Paying customers on our self-serve plans, most of whom check billing once a month on a phone.',
    context:
      'The existing app uses React with TypeScript. Billing data comes from an internal REST API at /api/billing. Invoices are already generated server-side; the dashboard only needs to list and link them.',
    references: 'Match the visual language of the existing settings pages.',
    requirements: [
      'Must work on a 390px-wide phone screen',
      'Invoice amounts must never be rounded or reformatted in a way that changes the value',
      'Loading and error states must be handled for every network call',
    ],
    prohibitions: [
      'Do not modify the billing API',
      'Do not store any card details in the front end',
      'Do not add a new dependency without saying why it is necessary',
    ],
    tools: ['File read/write', 'Shell commands', 'Sub-agents', 'Browser preview'],
    environment: 'claude-code',
    subjectiveGoals: ['It should feel calm and trustworthy, the way financial interfaces need to'],
  },
  {
    presetId: 'research-report',
    projectName: 'Competitor pricing analysis',
    goal: 'Research how our four main competitors price their mid-tier plans, what is included at each tier, and how their pricing has changed over the last two years.',
    deliverable: 'A written report with a comparison table, a summary of the trend, and a citation for every factual claim.',
    audience: 'Our product and finance leads, who will use it to decide whether to restructure our own tiers.',
    context: 'We currently have three tiers. The mid tier is where we lose the most deals.',
    requirements: [
      'Every price must cite the vendor page it came from, with the date it was checked',
      'Where a price could not be verified, say so rather than estimating',
    ],
    prohibitions: ['Do not infer pricing from third-party blog posts without confirming on the vendor site'],
    tools: ['Web search', 'Page fetching'],
    environment: 'research-agent',
  },
  {
    presetId: 'security-code-review',
    projectName: 'Authentication service review',
    goal: 'Review the authentication service for security defects before it goes live, focusing on session handling and access control.',
    deliverable: 'A list of findings with reproduction steps and severity, plus fixes applied for everything rated high or critical.',
    audience: 'The engineering team shipping this service, and the security lead who has to sign it off.',
    context: 'Node service using JWTs with a 24-hour expiry. Sessions are not currently revocable.',
    requirements: [
      'Every finding must include the exact request that demonstrates it',
      'Fixes must not break the existing test suite',
    ],
    prohibitions: ['Do not test against the production environment'],
    tools: ['File read/write', 'Shell commands', 'Test runner'],
    environment: 'claude-code',
  },
  {
    presetId: 'ui-design-review',
    projectName: 'Onboarding flow redesign',
    goal: 'Redesign the three-step onboarding flow so new users understand what to do first, and judge the result against our best existing screens.',
    deliverable: 'Updated screens with screenshots at four widths, and a blind comparison against the reference.',
    audience: 'New users in their first five minutes, who have not read anything about the product.',
    references: 'The current dashboard empty state, which is the strongest screen we have.',
    requirements: ['Text contrast must meet WCAG AA', 'Every control must be reachable by keyboard'],
    tools: ['File read/write', 'Browser preview'],
    environment: 'claude-code',
    subjectiveGoals: ['It should feel welcoming rather than like a form to be endured'],
  },
];

/** Builds the sample gauntlets. Called once, on first launch. */
export function createSampleGauntlets(): GauntletConfig[] {
  return SAMPLES.map((sample, index) => {
    const preset = presetById(sample.presetId);
    let config = createGauntlet();
    if (preset) config = preset.apply(config);

    // Stagger the timestamps so the "recently modified" ordering looks natural.
    const created = new Date(Date.now() - (index + 1) * 86_400_000).toISOString();

    return {
      ...config,
      meta: {
        ...config.meta,
        createdAt: created,
        updatedAt: created,
        basePresetId: sample.presetId,
        isSample: true,
        tags: [...config.meta.tags, 'sample'],
      },
      intent: {
        ...config.intent,
        projectName: sample.projectName,
        goal: sample.goal,
        deliverable: sample.deliverable,
        audience: sample.audience,
        context: sample.context ?? config.intent.context,
        references: sample.references ?? config.intent.references,
        requirements: sample.requirements ?? config.intent.requirements,
        prohibitions: sample.prohibitions ?? config.intent.prohibitions,
        tools: sample.tools ?? config.intent.tools,
        environment: sample.environment ?? config.intent.environment,
      },
      quality: {
        ...config.quality,
        subjectiveGoals: sample.subjectiveGoals ?? config.quality.subjectiveGoals,
      },
    };
  });
}
