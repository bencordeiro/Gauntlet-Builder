/**
 * Plain-language catalog.
 *
 * Every option the user can pick is described here once: label, one-line
 * explanation, and any consequence text. The UI renders from this and the
 * prompt engine quotes from it, so the wording a user selected is the wording
 * that reaches the target AI. Nothing here imports React.
 */

import type {
  AgentRoleType,
  ApprovalPolicyKind,
  CheckpointTrigger,
  CommunicationMode,
  CriticBehavior,
  CriticStrictness,
  EvidenceKind,
  FailureStatus,
  LedgerField,
  ModelPreference,
  RevisionStrategy,
  RoleFamily,
  StructurePreset,
  TargetEnvironment,
  EnvironmentCapability,
} from './types';

export interface CatalogEntry<T extends string> {
  id: T;
  label: string;
  /** One sentence a non-expert can act on. */
  blurb: string;
}

/* ------------------------------------------------------------------ *
 * Environments
 * ------------------------------------------------------------------ */

export interface EnvironmentEntry extends CatalogEntry<TargetEnvironment> {
  capability: EnvironmentCapability;
  /** How the generated prompt should address the target. */
  addressAs: string;
  /** Tools typically available, offered as suggestions in step 1. */
  suggestedTools: string[];
}

export const ENVIRONMENTS: EnvironmentEntry[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    blurb: 'A terminal coding agent that can read and write files, run commands, and start real sub-agents.',
    capability: 'real-subagents',
    addressAs: 'Claude Code',
    suggestedTools: ['File read/write', 'Shell commands', 'Sub-agents', 'Web search', 'Git'],
  },
  {
    id: 'openai-codex',
    label: 'OpenAI Codex',
    blurb: 'A coding agent that edits files and runs commands in a sandbox, working through roles one at a time.',
    capability: 'sequential-simulation',
    addressAs: 'Codex',
    suggestedTools: ['File read/write', 'Shell commands', 'Test runner'],
  },
  {
    id: 'general-coding-agent',
    label: 'General coding agent',
    blurb: 'Any other agent that can edit code and run commands, such as an IDE assistant.',
    capability: 'sequential-simulation',
    addressAs: 'the coding agent',
    suggestedTools: ['File read/write', 'Shell commands', 'Test runner', 'Browser preview'],
  },
  {
    id: 'research-agent',
    label: 'Research agent',
    blurb: 'An agent that searches, reads sources, and writes findings rather than code.',
    capability: 'sequential-simulation',
    addressAs: 'the research agent',
    suggestedTools: ['Web search', 'Page fetching', 'Document reading', 'Citation tracking'],
  },
  {
    id: 'general-llm',
    label: 'General-purpose LLM',
    blurb: 'A plain chat model with no tools. It can still play every role in sequence inside one conversation.',
    capability: 'sequential-simulation',
    addressAs: 'the assistant',
    suggestedTools: [],
  },
  {
    id: 'custom',
    label: 'Custom environment',
    blurb: 'Something else. Describe it and the generated prompt will adapt its wording.',
    capability: 'sequential-simulation',
    addressAs: 'the agent',
    suggestedTools: [],
  },
];

export const environmentById = (id: TargetEnvironment): EnvironmentEntry =>
  ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0];

/* ------------------------------------------------------------------ *
 * Evidence
 * ------------------------------------------------------------------ */

/** Field keys an evidence kind reveals in step 2. */
export type EvidenceField =
  | 'minPassRate'
  | 'testCommand'
  | 'minCoverage'
  | 'viewports'
  | 'requiredFlows'
  | 'referenceDescription'
  | 'visualSimilarityThreshold'
  | 'citationCoverage'
  | 'requiredChecks'
  | 'maxLatencyMs'
  | 'performanceBudgets'
  | 'accessibilityStandard'
  | 'analysisCommands'
  | 'humanReviewFocus'
  | 'notes';

export interface EvidenceEntry extends CatalogEntry<EvidenceKind> {
  /** Which config fields to reveal when this kind is selected. */
  fields: EvidenceField[];
  /** Sentence inserted into the generated prompt describing the proof. */
  promptClause: string;
  /** Criterion the app offers to add automatically alongside this evidence. */
  suggestedCriterion?: { label: string; statement: string; verification: string };
}

export const EVIDENCE: EvidenceEntry[] = [
  {
    id: 'automated-tests',
    label: 'Automated tests',
    blurb: 'A test suite runs and its results are pasted in as proof.',
    fields: ['testCommand', 'minPassRate', 'minCoverage'],
    promptClause: 'run the automated test suite and quote the real command output',
    suggestedCriterion: {
      label: 'Automated tests pass',
      statement: 'The test suite runs clean at or above the required pass rate.',
      verification: 'Run the test command and paste the summary line showing counts.',
    },
  },
  {
    id: 'visual-screenshots',
    label: 'Visual screenshots',
    blurb: 'The interface is captured as images so a reviewer can look at it, not just read about it.',
    fields: ['viewports', 'notes'],
    promptClause: 'capture screenshots of the running interface at every required viewport',
    suggestedCriterion: {
      label: 'Visual result verified',
      statement: 'The rendered interface matches the described intent at every required width.',
      verification: 'Capture a screenshot per viewport and describe what is visible in each.',
    },
  },
  {
    id: 'reference-comparison',
    label: 'Reference comparison',
    blurb: 'The result is compared side by side against an example you supply.',
    fields: ['referenceDescription', 'visualSimilarityThreshold', 'notes'],
    promptClause: 'compare the artifact against the supplied reference and report concrete differences',
    suggestedCriterion: {
      label: 'Matches reference',
      statement: 'The artifact reaches the required similarity to the reference.',
      verification: 'List each difference from the reference and rate its significance.',
    },
  },
  {
    id: 'human-review',
    label: 'Human review',
    blurb: 'A person looks at the result and signs off before it counts as done.',
    fields: ['humanReviewFocus'],
    promptClause: 'pause and present the result for human review',
  },
  {
    id: 'source-verification',
    label: 'Source and citation verification',
    blurb: 'Every claim is traced back to a source that actually says it.',
    fields: ['citationCoverage', 'notes'],
    promptClause: 'verify that each claim is supported by a real, retrievable source',
    suggestedCriterion: {
      label: 'Claims are sourced',
      statement: 'Claims carry citations that genuinely support them.',
      verification: 'Sample claims, open the cited source, and confirm it states the claim.',
    },
  },
  {
    id: 'security-review',
    label: 'Security review',
    blurb: 'Someone deliberately looks for ways the result could be abused or broken into.',
    fields: ['requiredChecks', 'notes'],
    promptClause: 'perform the required security checks and report findings with reproduction steps',
    suggestedCriterion: {
      label: 'No exploitable security defects',
      statement: 'No security issue of high or critical severity remains open.',
      verification: 'Attempt each required check and record the request/response or command output.',
    },
  },
  {
    id: 'performance',
    label: 'Performance measurements',
    blurb: 'Speed and resource use are measured, not estimated.',
    fields: ['maxLatencyMs', 'performanceBudgets'],
    promptClause: 'measure performance against the stated budgets and quote the numbers',
    suggestedCriterion: {
      label: 'Meets performance budget',
      statement: 'Measured performance is within the stated ceilings.',
      verification: 'Run the measurement and record the observed values next to the budget.',
    },
  },
  {
    id: 'accessibility',
    label: 'Accessibility testing',
    blurb: 'The result is checked against accessibility standards and keyboard use.',
    fields: ['accessibilityStandard', 'requiredChecks'],
    promptClause: 'test accessibility against the stated standard, including keyboard-only operation',
    suggestedCriterion: {
      label: 'Accessible',
      statement: 'The deliverable meets the stated accessibility standard.',
      verification: 'Run an automated audit and manually operate the result with the keyboard alone.',
    },
  },
  {
    id: 'browser-testing',
    label: 'Functional browser testing',
    blurb: 'Someone actually clicks through the running application.',
    fields: ['requiredFlows', 'viewports'],
    promptClause: 'exercise every required user flow in a real running browser',
    suggestedCriterion: {
      label: 'User flows work end to end',
      statement: 'Every required flow completes without an error.',
      verification: 'Walk each flow in the running app and record the observed result per step.',
    },
  },
  {
    id: 'log-inspection',
    label: 'Log inspection',
    blurb: 'Console and server logs are read to catch errors that never surface in the interface.',
    fields: ['notes'],
    promptClause: 'inspect console and server logs and report any errors or warnings found',
    suggestedCriterion: {
      label: 'Clean logs',
      statement: 'No unexplained errors appear in the logs during normal use.',
      verification: 'Exercise the deliverable, then paste the relevant log output.',
    },
  },
  {
    id: 'static-analysis',
    label: 'Static analysis',
    blurb: 'Linters and type checkers run over the code without executing it.',
    fields: ['analysisCommands'],
    promptClause: 'run the static analysis commands and quote their output',
    suggestedCriterion: {
      label: 'Static analysis clean',
      statement: 'Type checking and linting report no errors.',
      verification: 'Run each analysis command and paste the result.',
    },
  },
  {
    id: 'factual-accuracy',
    label: 'Factual accuracy review',
    blurb: 'A reviewer checks whether the statements are actually true.',
    fields: ['notes'],
    promptClause: 'check each factual statement independently and flag anything unsupported',
    suggestedCriterion: {
      label: 'Factually accurate',
      statement: 'No statement is false, overstated, or unsupported.',
      verification: 'Check each material claim independently and note the outcome.',
    },
  },
  {
    id: 'custom-evidence',
    label: 'Custom evidence',
    blurb: 'Describe your own way of proving the work is done.',
    fields: ['notes'],
    promptClause: 'collect the custom evidence described below',
  },
];

export const evidenceById = (id: EvidenceKind): EvidenceEntry =>
  EVIDENCE.find((e) => e.id === id) ?? EVIDENCE[EVIDENCE.length - 1];

/** Human labels for the revealed config fields. */
export const EVIDENCE_FIELD_META: Record<
  EvidenceField,
  { label: string; help: string; placeholder?: string; kind: 'number' | 'text' | 'list' | 'numberList' }
> = {
  minPassRate: { label: 'Minimum tests passing', help: 'Percentage of tests that must pass. 100 means no failures allowed.', kind: 'number' },
  testCommand: { label: 'Test command', help: 'The exact command the agent should run.', placeholder: 'npm test', kind: 'text' },
  minCoverage: { label: 'Minimum coverage', help: 'Percentage of code the tests must cover. Leave at 0 to skip.', kind: 'number' },
  viewports: { label: 'Required screen widths', help: 'Widths in pixels that must be checked.', placeholder: '390', kind: 'numberList' },
  requiredFlows: { label: 'Flows that must work', help: 'Each journey a person must be able to complete.', placeholder: 'Sign in and reach the dashboard', kind: 'list' },
  referenceDescription: { label: 'What to compare against', help: 'Describe or link the example the result should match.', placeholder: 'The Stripe billing page layout', kind: 'text' },
  visualSimilarityThreshold: { label: 'Required closeness to reference', help: 'How close the result must be, as a percentage.', kind: 'number' },
  citationCoverage: { label: 'Claims needing a citation', help: 'Percentage of claims that must carry a source.', kind: 'number' },
  requiredChecks: { label: 'Checks that must be performed', help: 'Each named check the reviewer must actually attempt.', placeholder: 'Authorization on every admin route', kind: 'list' },
  maxLatencyMs: { label: 'Maximum response time', help: 'In milliseconds. The slowest acceptable response.', kind: 'number' },
  performanceBudgets: { label: 'Other performance limits', help: 'Any other ceiling that must hold.', placeholder: 'JS bundle under 250 KB', kind: 'list' },
  accessibilityStandard: { label: 'Standard to meet', help: 'The accessibility standard the result is judged against.', placeholder: 'WCAG 2.2 AA', kind: 'text' },
  analysisCommands: { label: 'Analysis commands', help: 'Commands that must complete without errors.', placeholder: 'npm run typecheck', kind: 'list' },
  humanReviewFocus: { label: 'What the person should check', help: 'Tell the agent exactly what to put in front of you.', placeholder: 'The visual design of the dashboard', kind: 'text' },
  notes: { label: 'Additional detail', help: 'Anything else the reviewer needs to know.', kind: 'text' },
};

/* ------------------------------------------------------------------ *
 * Structure presets
 * ------------------------------------------------------------------ */

export const STRUCTURE_PRESETS: StructurePreset[] = [
  {
    kind: 'builder-critic',
    name: 'Builder and Critic',
    tagline: 'One agent builds, a separate agent reviews.',
    description:
      'One agent produces the work. A second, separate agent reviews it against your quality bar and sends back findings. The builder revises until the critic approves.',
    bestFor: ['Documents', 'Small coding tasks', 'Research answers', 'Focused design work'],
    advantages: [
      'Simple to run and easy to follow',
      'The reviewer is genuinely separate from the author',
      'Low cost compared with larger structures',
    ],
    risks: [
      'A single reviewer can miss whole categories of problems',
      'Not enough structure for large multi-part projects',
    ],
    agentCountLabel: '2 agents',
    complexity: 'light',
    costLabel: 'Low',
    approvalSummary: 'The critic must approve.',
    flowSummary: 'Builder → Critic → Builder, repeating until approval.',
  },
  {
    kind: 'specialist-team',
    name: 'Specialist Team',
    tagline: 'Several agents build separate parts, one integrates.',
    description:
      'Work is split into independent parts, each owned by one agent. A lead integrator combines the results and checks that the assembled whole actually works.',
    bestFor: ['Larger applications', 'Reports with several research areas', 'Projects with clearly separable parts'],
    advantages: [
      'Independent parts progress at the same time',
      'Each agent stays focused on one area',
      'A named owner is responsible for the assembled result',
    ],
    risks: [
      'Parts can be individually fine but wrong together',
      'Splitting tightly coupled work causes conflicts',
    ],
    agentCountLabel: '4–6 agents',
    complexity: 'moderate',
    costLabel: 'Medium',
    approvalSummary: 'The integrator must approve the combined result.',
    flowSummary: 'Lead → specialists in parallel → integrator → review.',
  },
  {
    kind: 'sequential-gates',
    name: 'Sequential Quality Gates',
    tagline: 'Ordered stages, each one must pass before the next.',
    description:
      'The work moves through review stages in a fixed order and cannot advance until the current gate passes. For example: build, then functional testing, then security, then accessibility, then final review.',
    bestFor: ['Production software', 'Compliance work', 'Structured business processes'],
    advantages: [
      'Nothing skips a required check',
      'Failures are caught at a predictable point',
      'Easy to audit after the fact',
    ],
    risks: [
      'Slower, because stages cannot overlap',
      'A late gate can force rework of earlier stages',
    ],
    agentCountLabel: '4–6 agents',
    complexity: 'moderate',
    costLabel: 'Medium',
    approvalSummary: 'Every gate must pass, in order.',
    flowSummary: 'Build → Gate 1 → Gate 2 → Gate 3 → Final approval.',
  },
  {
    kind: 'red-team',
    name: 'Adversarial Red Team',
    tagline: 'Agents actively try to break the result.',
    description:
      'One or more agents are told to disprove the claims: break the application, find security holes, or show that a conclusion is not supported. The work only passes if the attacks fail.',
    bestFor: ['Cybersecurity', 'Research', 'Architecture review', 'High-stakes decisions'],
    advantages: [
      'Finds problems that agreeable reviewers miss',
      'Claims must survive a genuine attempt to knock them down',
      'Strong fit for anything where being wrong is expensive',
    ],
    risks: [
      'Can generate noise if findings do not require evidence',
      'May stall on issues that do not matter for your goal',
    ],
    agentCountLabel: '3–5 agents',
    complexity: 'heavy',
    costLabel: 'Medium–High',
    approvalSummary: 'The red team must fail to break it.',
    flowSummary: 'Builder → red team attacks → builder fixes → re-attack.',
  },
  {
    kind: 'consensus-council',
    name: 'Consensus Council',
    tagline: 'Several independent reviewers vote.',
    description:
      'Multiple reviewers evaluate the same result independently. Whether the work is finished depends on the voting rule you choose, such as a majority or a unanimous decision.',
    bestFor: ['Subjective quality assessment', 'Strategy', 'Design review', 'Important recommendations'],
    advantages: [
      'Reduces the effect of one reviewer having an off day',
      'Works where quality is genuinely a matter of judgement',
      'Disagreement itself is a useful signal',
    ],
    risks: [
      'More expensive, since every reviewer reads everything',
      'Can deadlock without a tie-breaking rule',
    ],
    agentCountLabel: '4–6 agents',
    complexity: 'heavy',
    costLabel: 'High',
    approvalSummary: 'Enough reviewers must vote to approve.',
    flowSummary: 'Builder → several reviewers vote independently → tally.',
  },
  {
    kind: 'hybrid',
    name: 'Hybrid Gauntlet',
    tagline: 'Specialists, independent critics, gates, and final integration.',
    description:
      'Combines the other structures: specialist builders own separate parts, independent critics review them, ordered gates must pass, and an integration owner checks the assembled result at the end.',
    bestFor: ['Complex projects', 'Long-running coding tasks', 'High-quality autonomous work'],
    advantages: [
      'The most thorough option available',
      'Catches part-level and whole-system problems',
      'Suited to work running unattended for a long time',
    ],
    risks: [
      'The most expensive and slowest structure',
      'Overkill for small tasks',
      'Needs careful ownership boundaries to avoid conflicts',
    ],
    agentCountLabel: '6–9 agents',
    complexity: 'very-heavy',
    costLabel: 'High',
    approvalSummary: 'Gates pass, critics approve, then integration signs off.',
    flowSummary: 'Lead → specialists → critics → gates → integration → final.',
  },
  {
    kind: 'custom',
    name: 'Custom',
    tagline: 'Build the workflow yourself.',
    description:
      'Start from a minimal setup and add exactly the agents, communication rules, and approval policy you want.',
    bestFor: ['Unusual workflows', 'Reproducing a process you already use'],
    advantages: ['Complete control', 'No assumptions made for you'],
    risks: ['Nothing is set up for you', 'Easier to build something that cannot finish'],
    agentCountLabel: 'Your choice',
    complexity: 'moderate',
    costLabel: 'Varies',
    approvalSummary: 'Whatever you configure.',
    flowSummary: 'You define it.',
  },
];

export const structurePresetByKind = (kind: string): StructurePreset =>
  STRUCTURE_PRESETS.find((p) => p.kind === kind) ?? STRUCTURE_PRESETS[0];

/* ------------------------------------------------------------------ *
 * Agent roles
 * ------------------------------------------------------------------ */

export interface RoleEntry extends CatalogEntry<AgentRoleType> {
  family: RoleFamily;
  /** Default responsibility text when an agent of this type is created. */
  defaultResponsibility: string;
  defaultExpertise: string;
  defaultInputs: string[];
  defaultOutputs: string[];
  /** Reviewers default to mandatory unless the role says otherwise. */
  defaultMandatory: boolean;
  defaultAuthority: number;
  /** Layout tier used by the workflow diagram. */
  tier: number;
}

export const ROLES: RoleEntry[] = [
  {
    id: 'lead-orchestrator',
    label: 'Lead orchestrator',
    blurb: 'Runs the whole loop: assigns work, collects reviews, and decides what happens next.',
    family: 'orchestration',
    defaultResponsibility: 'Plan the work, assign it, collect review results, and decide each next action.',
    defaultExpertise: 'Breaking down work, spotting coupling between parts, and judging evidence.',
    defaultInputs: ['The goal and quality bar', 'All reviewer findings', 'The progress ledger'],
    defaultOutputs: ['Work assignments', 'Round decisions', 'The progress ledger', 'The final report'],
    defaultMandatory: false,
    defaultAuthority: 9,
    tier: 0,
  },
  {
    id: 'planner',
    label: 'Planner',
    blurb: 'Turns the goal into an ordered plan before anyone starts building.',
    family: 'orchestration',
    defaultResponsibility: 'Inspect the problem and produce an ordered plan with clear ownership boundaries.',
    defaultExpertise: 'Decomposition, sequencing, and identifying which parts are genuinely independent.',
    defaultInputs: ['The goal and quality bar', 'Existing material or codebase'],
    defaultOutputs: ['A written plan', 'Ownership boundaries', 'Identified risks'],
    defaultMandatory: false,
    defaultAuthority: 6,
    tier: 0,
  },
  {
    id: 'builder',
    label: 'Builder',
    blurb: 'Produces the actual deliverable and revises it when reviewers find problems.',
    family: 'production',
    defaultResponsibility: 'Produce the deliverable and revise it in response to evidence-backed findings.',
    defaultExpertise: 'Doing the core work to a professional standard.',
    defaultInputs: ['The goal and quality bar', 'The current artifact', 'Review findings'],
    defaultOutputs: ['The artifact', 'A change summary', 'Evidence that the change works'],
    defaultMandatory: false,
    defaultAuthority: 5,
    tier: 1,
  },
  {
    id: 'specialist-builder',
    label: 'Specialist builder',
    blurb: 'Owns one specific part of the work and nothing else.',
    family: 'production',
    defaultResponsibility: 'Build and maintain one assigned part of the deliverable within its ownership boundary.',
    defaultExpertise: 'Deep knowledge of one specific area.',
    defaultInputs: ['Its assignment', 'The interface contract with other parts', 'Findings about its part'],
    defaultOutputs: ['Its part of the artifact', 'Notes for the integrator', 'Evidence for its part'],
    defaultMandatory: false,
    defaultAuthority: 5,
    tier: 1,
  },
  {
    id: 'critic',
    label: 'Critic',
    blurb: 'Reviews the work against your quality bar and returns structured findings.',
    family: 'review',
    defaultResponsibility: 'Inspect the real artifact and report evidence-backed findings against the rubric.',
    defaultExpertise: 'Careful review and distinguishing real defects from preferences.',
    defaultInputs: ['The artifact itself', 'The quality bar and rubric', 'Collected evidence'],
    defaultOutputs: ['A structured verdict', 'Scored criteria', 'The largest verified gap'],
    defaultMandatory: true,
    defaultAuthority: 7,
    tier: 2,
  },
  {
    id: 'visual-critic',
    label: 'Visual critic',
    blurb: 'Judges how the result actually looks, working from screenshots rather than descriptions.',
    family: 'review',
    defaultResponsibility: 'Judge the rendered result visually and report concrete visual defects.',
    defaultExpertise: 'Layout, typography, spacing, hierarchy, and visual consistency.',
    defaultInputs: ['Screenshots at every required width', 'The reference, if one exists'],
    defaultOutputs: ['Visual findings tied to specific screenshots', 'Scored visual criteria'],
    defaultMandatory: true,
    defaultAuthority: 6,
    tier: 2,
  },
  {
    id: 'functional-tester',
    label: 'Functional tester',
    blurb: 'Actually operates the deliverable to see whether it works.',
    family: 'review',
    defaultResponsibility: 'Exercise every required flow against the running deliverable and report what happened.',
    defaultExpertise: 'Test design, edge cases, and reproducing failures precisely.',
    defaultInputs: ['The running deliverable', 'The list of required flows'],
    defaultOutputs: ['Per-flow results', 'Reproduction steps for failures', 'Test output'],
    defaultMandatory: true,
    defaultAuthority: 7,
    tier: 2,
  },
  {
    id: 'security-reviewer',
    label: 'Security reviewer',
    blurb: 'Looks for ways the result could be abused, broken into, or leak data.',
    family: 'review',
    defaultResponsibility: 'Attempt the required security checks and report exploitable defects with proof.',
    defaultExpertise: 'Authentication, authorization, input handling, secrets, and dependency risk.',
    defaultInputs: ['The artifact and its configuration', 'The required security checks'],
    defaultOutputs: ['Findings with reproduction steps', 'Severity ratings', 'Retest requirements'],
    defaultMandatory: true,
    defaultAuthority: 8,
    tier: 2,
  },
  {
    id: 'research-verifier',
    label: 'Research verifier',
    blurb: 'Checks whether the claims are actually true and properly supported.',
    family: 'review',
    defaultResponsibility: 'Independently verify each material claim and flag anything unsupported.',
    defaultExpertise: 'Source evaluation and separating evidence from inference.',
    defaultInputs: ['The written output', 'Its cited sources'],
    defaultOutputs: ['Per-claim verification results', 'A list of unsupported claims'],
    defaultMandatory: true,
    defaultAuthority: 7,
    tier: 2,
  },
  {
    id: 'citation-auditor',
    label: 'Citation auditor',
    blurb: 'Opens each cited source and confirms it says what it was cited for.',
    family: 'review',
    defaultResponsibility: 'Check that every citation exists, is retrievable, and supports its claim.',
    defaultExpertise: 'Citation practice and detecting fabricated or misused references.',
    defaultInputs: ['The written output', 'The full citation list'],
    defaultOutputs: ['Per-citation status', 'Citation coverage percentage'],
    defaultMandatory: true,
    defaultAuthority: 6,
    tier: 2,
  },
  {
    id: 'adversarial-reviewer',
    label: 'Adversarial reviewer',
    blurb: 'Deliberately tries to prove the work is wrong or broken.',
    family: 'review',
    defaultResponsibility: 'Actively attempt to disprove the claims or break the deliverable, and report what worked.',
    defaultExpertise: 'Finding the weakest assumption and attacking it.',
    defaultInputs: ['The artifact', 'The claims being made about it'],
    defaultOutputs: ['Successful attacks with reproduction steps', 'Unsupported claims identified'],
    defaultMandatory: true,
    defaultAuthority: 8,
    tier: 2,
  },
  {
    id: 'integration-owner',
    label: 'Integration owner',
    blurb: 'Combines the separate parts and checks that the whole thing works together.',
    family: 'review',
    defaultResponsibility: 'Assemble the parts, resolve conflicts between them, and verify the complete result.',
    defaultExpertise: 'Interfaces between components and whole-system behaviour.',
    defaultInputs: ['Every specialist output', 'Interface contracts', 'Review findings'],
    defaultOutputs: ['The integrated artifact', 'Integration findings', 'Whole-system evidence'],
    defaultMandatory: true,
    defaultAuthority: 8,
    tier: 3,
  },
  {
    id: 'mediator',
    label: 'Mediator',
    blurb: 'Steps in when two agents disagree and decides what happens next.',
    family: 'orchestration',
    defaultResponsibility: 'Review both positions and the evidence, then decide the next action and record why.',
    defaultExpertise: 'Weighing conflicting evidence impartially.',
    defaultInputs: ['Both positions', 'The evidence each side offered', 'The quality bar'],
    defaultOutputs: ['A written decision', 'The reasoning behind it', 'The next action'],
    defaultMandatory: false,
    defaultAuthority: 8,
    tier: 3,
  },
  {
    id: 'human-approver',
    label: 'Human approver',
    blurb: 'You. The run pauses and waits for your decision.',
    family: 'human',
    defaultResponsibility: 'Review what the agents present and decide whether the work may proceed or finish.',
    defaultExpertise: 'Knowing what you actually wanted.',
    defaultInputs: ['A summary of the state', 'The evidence collected', 'The open questions'],
    defaultOutputs: ['Approve, reject, or redirect'],
    defaultMandatory: true,
    defaultAuthority: 10,
    tier: 4,
  },
  {
    id: 'custom-role',
    label: 'Custom role',
    blurb: 'Define your own role with its own responsibility and permissions.',
    family: 'production',
    defaultResponsibility: 'Describe what this agent is accountable for.',
    defaultExpertise: '',
    defaultInputs: [],
    defaultOutputs: [],
    defaultMandatory: false,
    defaultAuthority: 5,
    tier: 1,
  },
];

export const roleById = (id: AgentRoleType): RoleEntry =>
  ROLES.find((r) => r.id === id) ?? ROLES[ROLES.length - 1];

export const isReviewRole = (id: AgentRoleType): boolean => roleById(id).family === 'review';
export const isBuildRole = (id: AgentRoleType): boolean => roleById(id).family === 'production';

/* ------------------------------------------------------------------ *
 * Communication
 * ------------------------------------------------------------------ */

export interface CommunicationEntry extends CatalogEntry<CommunicationMode> {
  /** Consequence line shown under the selected option. */
  consequence: string;
  /** Rule text inserted into the generated prompt. */
  promptRule: string;
  /** Warn if the config contradicts this mode. */
  requiresAnonymity?: boolean;
  requiresMediator?: boolean;
}

export const COMMUNICATION_MODES: CommunicationEntry[] = [
  {
    id: 'direct-feedback',
    label: 'Direct feedback',
    blurb: 'The reviewer sends its findings straight to whoever built the work.',
    consequence: 'Fastest loop. The orchestrator sees the exchange but does not filter it.',
    promptRule:
      'Reviewers deliver findings directly to the responsible builder. The orchestrator observes and records, but does not rewrite or filter findings.',
  },
  {
    id: 'orchestrator-controlled',
    label: 'Orchestrator controlled',
    blurb: 'All findings go to the lead agent, which decides what the builder is told.',
    consequence: 'Reduces noise and conflicting instructions, but the lead becomes a bottleneck.',
    promptRule:
      'All reviewer findings are returned to the lead orchestrator. The orchestrator consolidates them, resolves contradictions, and issues a single prioritised instruction set to each builder. Findings must not be dropped silently — anything deferred is recorded in the ledger as deferred, with a reason.',
  },
  {
    id: 'bidirectional',
    label: 'Bidirectional review',
    blurb: 'Builders and reviewers can talk back and forth to clear up misunderstandings.',
    consequence: 'Fewer wasted rounds on misread findings, but reviewers can be talked out of valid concerns.',
    promptRule:
      'Builders may respond to findings to correct factual misunderstandings, and reviewers may revise a finding when shown it was based on a misreading. A reviewer may only withdraw a finding by citing the specific evidence that changed its assessment.',
  },
  {
    id: 'blind-independent',
    label: 'Blind independent review',
    blurb: 'Reviewers see the work and the requirements, but never the builder’s explanation of it.',
    consequence: 'The strongest protection against being persuaded rather than convinced. Costs extra context setup.',
    promptRule:
      'Reviewers receive only the artifact, the requirements, and the collected evidence. They must not receive the builder’s reasoning, self-assessment, changelog narrative, or identity. If a reviewer cannot determine something from the artifact alone, it records that as an inspection gap rather than asking the builder.',
    requiresAnonymity: true,
  },
  {
    id: 'cross-review',
    label: 'Cross review',
    blurb: 'Specialists check each other’s work before it gets combined.',
    consequence: 'Catches interface mismatches early. Adds a round before integration.',
    promptRule:
      'Before integration, each specialist reviews at least one other specialist’s output, focusing on interface contracts, duplicated logic, and inconsistent assumptions. Cross-review findings are reported to the integration owner.',
  },
  {
    id: 'mediated-disagreement',
    label: 'Mediated disagreement',
    blurb: 'When two agents disagree, a separate mediator looks at the evidence and decides.',
    consequence: 'Prevents deadlock. Requires a mediator agent to exist.',
    promptRule:
      'When a builder and a reviewer disagree twice on the same finding, escalate to the mediator. The mediator reviews both positions and the underlying evidence, issues a binding decision, and records the reasoning in the ledger. Neither party may re-open a mediated decision without new evidence.',
    requiresMediator: true,
  },
  {
    id: 'council-discussion',
    label: 'Council discussion',
    blurb: 'Reviewers compare notes before casting their final votes.',
    consequence: 'Produces a more considered joint view, but reviewers can converge on a shared blind spot.',
    promptRule:
      'Reviewers first publish their independent initial assessments, then read one another’s findings and may revise before submitting a final vote. Both the initial and final positions are recorded so that changes of position remain visible.',
  },
  {
    id: 'isolated-voting',
    label: 'Isolated voting',
    blurb: 'No reviewer sees another’s opinion until every vote is in.',
    consequence: 'Keeps votes genuinely independent. Disagreements surface late, all at once.',
    promptRule:
      'Each reviewer forms and submits its verdict without access to any other reviewer’s findings or votes. Only after all votes are submitted are they revealed and tallied. Reviewers must not be told how many others have already approved.',
  },
];

export const communicationById = (id: CommunicationMode): CommunicationEntry =>
  COMMUNICATION_MODES.find((c) => c.id === id) ?? COMMUNICATION_MODES[0];

/* ------------------------------------------------------------------ *
 * Approval policies
 * ------------------------------------------------------------------ */

export interface ApprovalEntry extends CatalogEntry<ApprovalPolicyKind> {
  consequence: string;
  promptRule: string;
}

export const APPROVAL_POLICIES: ApprovalEntry[] = [
  {
    id: 'all-mandatory',
    label: 'All mandatory reviewers must approve',
    blurb: 'Every reviewer you marked as required has to pass the work.',
    consequence:
      'Optional reviewers can still object, and their objections are recorded, but they cannot block completion on their own.',
    promptRule:
      'The work is complete only when every reviewer marked mandatory has returned an explicit approve verdict on the current artifact. Verdicts from earlier versions do not carry forward if the artifact has changed in an area that reviewer owns.',
  },
  {
    id: 'unanimous',
    label: 'Unanimous approval',
    blurb: 'Every active reviewer must approve, mandatory or not.',
    consequence: 'The highest bar. A single persistent objection prevents completion and forces escalation.',
    promptRule:
      'The work is complete only when every enabled reviewer returns approve on the current artifact. A single fail verdict blocks completion.',
  },
  {
    id: 'majority',
    label: 'Majority approval',
    blurb: 'More than half the reviewers must approve.',
    consequence: 'Tolerates one dissenting reviewer. Dissents are still recorded in the final report.',
    promptRule:
      'The work is complete when more than half of the eligible reviewers return approve. Dissenting verdicts and their evidence must still appear in the final report.',
  },
  {
    id: 'supermajority',
    label: 'Supermajority approval',
    blurb: 'A set percentage of reviewers must approve — you choose the percentage.',
    consequence: 'A middle ground between majority and unanimous.',
    promptRule:
      'The work is complete when at least the configured percentage of eligible reviewers return approve. Round up when the count is fractional.',
  },
  {
    id: 'weighted-consensus',
    label: 'Weighted consensus',
    blurb: 'Some reviewers’ votes count for more than others.',
    consequence: 'Lets a specialist carry more weight in its own area. Set weights carefully or one agent decides everything.',
    promptRule:
      'Each reviewer’s vote carries its configured weight. The work is complete when the approving weight divided by the total eligible weight reaches the configured threshold.',
  },
  {
    id: 'sequential-signoff',
    label: 'Sequential sign-off',
    blurb: 'Reviewers approve one after another, in a fixed order.',
    consequence: 'A later reviewer never sees work that failed an earlier gate, which saves effort but slows things down.',
    promptRule:
      'Reviewers sign off in the configured order. A reviewer is only invoked after every prior reviewer has approved. If any reviewer fails, the run returns to revision and sign-off restarts from the first reviewer whose owned area was modified.',
  },
  {
    id: 'lead-decides',
    label: 'Lead agent final decision',
    blurb: 'Reviewers give evidence, but the lead agent makes the final call.',
    consequence:
      'Fast and decisive, but the lead can overrule a valid objection. Every override must be justified in writing.',
    promptRule:
      'Reviewers submit evidence and verdicts. The designated lead makes the final determination. Any decision to complete over an outstanding fail verdict must state the reviewer, the finding, and the specific reason the lead judged it non-blocking. The lead may not override a mandatory security or safety gate.',
  },
  {
    id: 'human-final',
    label: 'Human final approval',
    blurb: 'Agents can recommend finishing, but a person makes the final decision.',
    consequence: 'Nothing is ever declared done without you. Requires you to be available.',
    promptRule:
      'Agents may recommend completion but may never declare the work complete. The run halts at a human approval checkpoint and presents the artifact, the evidence, all verdicts, and any unresolved items. Only an explicit human approval completes the run.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid approval',
    blurb: 'Required gates must pass first, then a group decision or a person finishes it.',
    consequence: 'Objective checks cannot be voted away, and judgement is applied only after they pass.',
    promptRule:
      'Completion has two stages. First, every configured gate must pass on objective evidence; these gates cannot be waived by vote. Only once all gates pass does the final stage decide completion.',
  },
];

export const approvalById = (id: ApprovalPolicyKind): ApprovalEntry =>
  APPROVAL_POLICIES.find((a) => a.id === id) ?? APPROVAL_POLICIES[0];

/* ------------------------------------------------------------------ *
 * Revision
 * ------------------------------------------------------------------ */

export const REVISION_STRATEGIES: Array<CatalogEntry<RevisionStrategy> & { promptRule: string }> = [
  {
    id: 'highest-impact-first',
    label: 'Fix the highest-impact defect first',
    blurb: 'Deal with the single biggest verified problem each round, then re-check.',
    promptRule:
      'Each revision round addresses the largest verified gap first. Re-collect evidence after the fix before moving to the next defect. This keeps every round attributable to one change.',
  },
  {
    id: 'fix-all',
    label: 'Fix all defects in one revision',
    blurb: 'Address everything reviewers found before going back for another review.',
    promptRule:
      'Each revision round addresses every open finding before requesting re-review. Report per-finding resolution status so that partial fixes are visible.',
  },
  {
    id: 'group-related',
    label: 'Group related defects',
    blurb: 'Batch problems that share a root cause and fix them together.',
    promptRule:
      'Group findings that share a root cause and resolve each group in one change. State the shared root cause for each group before making the change.',
  },
  {
    id: 'orchestrator-prioritizes',
    label: 'Let the orchestrator prioritise',
    blurb: 'The lead agent decides what order to fix things in each round.',
    promptRule:
      'The orchestrator sequences findings each round using severity, blast radius, and dependency order, and records the chosen order with a one-line justification.',
  },
];

export const revisionStrategyById = (id: RevisionStrategy) =>
  REVISION_STRATEGIES.find((r) => r.id === id) ?? REVISION_STRATEGIES[0];

/** Toggle-style revision options, with the rule each one contributes. */
export const REVISION_OPTIONS: Array<{
  key: keyof import('./types').RevisionPolicy;
  label: string;
  blurb: string;
  promptRule: string;
}> = [
  {
    key: 'requirePlanBeforeRevision',
    label: 'Require a plan before each revision',
    blurb: 'The builder states what it will change before changing it.',
    promptRule: 'Before each revision, the builder states which findings it will address and how, and waits for that plan to be recorded.',
  },
  {
    key: 'requireEvidenceAfterRevision',
    label: 'Require evidence after every revision',
    blurb: 'No change counts as done until it is demonstrated.',
    promptRule: 'After each revision, the builder re-collects the evidence relevant to the changed area and includes the raw output. A claim of "fixed" without evidence is treated as unfixed.',
  },
  {
    key: 'requireRegressionTests',
    label: 'Require regression testing after every revision',
    blurb: 'Check that fixing one thing did not break another.',
    promptRule: 'After each revision, re-run all previously passing mandatory checks, not only the checks related to the change. Report the result of each.',
  },
  {
    key: 'autoRollbackRegressions',
    label: 'Automatically roll back regressions',
    blurb: 'If a change breaks something that worked, undo it.',
    promptRule: 'If a revision causes a previously passing check to fail and the cause is not fixed within the same round, revert to the last known-good state and record the reversion in the ledger.',
  },
  {
    key: 'preserveApprovedComponents',
    label: 'Preserve approved components',
    blurb: 'Do not casually rewrite parts that already passed.',
    promptRule: 'Components that have passed review must not be modified except to fix a verified defect or a required integration change. Any such modification must be named in the ledger.',
  },
  {
    key: 'lockAfterApproval',
    label: 'Lock components after approval',
    blurb: 'Approved parts become read-only unless deliberately reopened.',
    promptRule: 'Once a component is approved it is locked. Editing a locked component requires explicitly reopening it, naming the reason, and re-running that component’s review afterwards.',
  },
  {
    key: 'reopenOnIntegrationRegression',
    label: 'Reopen approved components when integration breaks',
    blurb: 'If combining parts breaks something approved, that part goes back for rework.',
    promptRule: 'If integration reveals a defect inside an approved component, that component is reopened, reworked, and re-reviewed. Integration must never be "fixed" by working around a defect in an approved component without recording it.',
  },
];

/* ------------------------------------------------------------------ *
 * Critic strictness & behaviors
 * ------------------------------------------------------------------ */

export interface StrictnessEntry extends CatalogEntry<CriticStrictness> {
  /** Instruction block inserted into that critic's prompt. */
  promptRule: string;
  /** 1–5, used for the slider position and complexity estimate. */
  level: number;
}

export const STRICTNESS_LEVELS: StrictnessEntry[] = [
  {
    id: 'helpful',
    label: 'Helpful reviewer',
    blurb: 'Points out real problems and suggests fixes. Approves once the work is genuinely adequate.',
    level: 1,
    promptRule:
      'Review constructively. Report defects that genuinely matter for the stated goal and suggest a direction for each. Approve once every mandatory criterion is met, even if refinements remain possible. Do not invent problems to appear rigorous.',
  },
  {
    id: 'strict-professional',
    label: 'Strict professional reviewer',
    blurb: 'Reviews the way a demanding senior colleague would. Nothing sloppy gets through.',
    level: 2,
    promptRule:
      'Review to the standard of a demanding senior practitioner. Every mandatory criterion must be demonstrably met with evidence you personally inspected. Do not approve work that is merely close. Separate blocking defects from non-blocking observations, and say which is which.',
  },
  {
    id: 'adversarial',
    label: 'Adversarial reviewer',
    blurb: 'Actively tries to find what is wrong rather than confirming what is right.',
    level: 3,
    promptRule:
      'Your objective is to find what is wrong. Actively attempt to make the artifact fail: probe edge cases, malformed input, and the assumptions the work depends on. Treat every claim as unproven until you have personally verified it. Report what you actually tried and what happened, including attempts that failed to break anything.',
  },
  {
    id: 'extremely-demanding',
    label: 'Extremely demanding reviewer',
    blurb: 'Holds the work to the highest standard you would ever apply. Expect several rounds.',
    level: 4,
    promptRule:
      'Hold the artifact to the highest standard defensible from the stated criteria. Every criterion must be met with direct, inspected evidence. Any gap, however small, is reported with its severity. You may only approve when you would personally stake your professional reputation on the result. You must still ground every criticism in evidence — demanding does not mean vague.',
  },
  {
    id: 'reference-blind-judge',
    label: 'Reference-level blind judge',
    blurb: 'Compares the work against a reference example without knowing which is which.',
    level: 5,
    promptRule:
      'Judge the artifact against the supplied reference without knowing which is which. State which better satisfies each criterion and why, citing specific observable differences. Then reverse the presentation order and judge again. If your two judgements disagree, report the inconsistency rather than resolving it silently — an unstable judgement is itself a finding.',
  },
];

export const strictnessById = (id: CriticStrictness): StrictnessEntry =>
  STRICTNESS_LEVELS.find((s) => s.id === id) ?? STRICTNESS_LEVELS[1];

export interface BehaviorEntry extends CatalogEntry<CriticBehavior> {
  promptRule: string;
  /** Behaviors that cannot be combined with this one. */
  conflictsWith?: CriticBehavior[];
}

export const CRITIC_BEHAVIORS: BehaviorEntry[] = [
  {
    id: 'require-evidence',
    label: 'Require direct evidence for every criticism',
    blurb: 'Each finding must quote something the reviewer actually observed.',
    promptRule:
      'Every finding must cite direct evidence you personally observed: a command output, a specific line, a request and its response, or a described screenshot. A finding without evidence must be labelled as a suspicion and cannot block approval.',
  },
  {
    id: 'largest-defect',
    label: 'Identify the largest remaining defect',
    blurb: 'Name the single biggest problem so the next round has an obvious target.',
    promptRule:
      'Always name the single largest remaining verified gap, with its evidence and severity, so the next revision has one unambiguous target.',
  },
  {
    id: 'score-rubric',
    label: 'Score each rubric category',
    blurb: 'Give every criterion a number so progress between rounds is visible.',
    promptRule:
      'Score every rubric criterion from 0 to 1 and justify any score below 1 with the specific shortfall. Scores must be comparable between rounds.',
  },
  {
    id: 'root-cause',
    label: 'Distinguish symptoms from likely root causes',
    blurb: 'Say what is actually causing the problem, not just where it shows up.',
    promptRule:
      'For each finding, distinguish the observed symptom from the likely root cause, and mark which of the two you actually verified.',
  },
  {
    id: 'regression-risk',
    label: 'Identify regression risks',
    blurb: 'Warn about what fixing this might break.',
    promptRule:
      'For each finding, state what a plausible fix might break, and list the checks that must be re-run afterwards.',
  },
  {
    id: 'suggest-tests-only',
    label: 'Suggest tests but not implementation',
    blurb: 'The reviewer defines how to prove it works but leaves the how-to-fix to the builder.',
    promptRule:
      'Specify the tests or checks that would demonstrate the defect is resolved. Do not prescribe the implementation — leave the solution to the builder.',
    conflictsWith: ['recommend-implementation'],
  },
  {
    id: 'recommend-implementation',
    label: 'Recommend implementation changes',
    blurb: 'The reviewer proposes concrete fixes.',
    promptRule:
      'Where you can, propose a specific implementation change that would resolve the finding, while making clear the builder may choose another approach that satisfies the same criterion.',
    conflictsWith: ['suggest-tests-only'],
  },
  {
    id: 'compare-reference',
    label: 'Compare against a reference',
    blurb: 'Judge the work against the example provided rather than in isolation.',
    promptRule:
      'Compare the artifact against the supplied reference, listing concrete observable differences and whether each matters for the stated goal.',
  },
  {
    id: 'blind-ab',
    label: 'Perform blind A/B judgement',
    blurb: 'Compare two versions without knowing which one is the new work.',
    promptRule:
      'Judge the two candidates as A and B without knowing which is the current work. State which better satisfies each criterion and why.',
  },
  {
    id: 'reverse-ab',
    label: 'Reverse A/B order and judge again',
    blurb: 'Repeat the comparison the other way round to catch position bias.',
    promptRule:
      'After the first A/B judgement, swap the presentation order and judge again. Report both results. If they disagree, report the inconsistency as a finding.',
  },
  {
    id: 'seek-disconfirming',
    label: 'Search for disconfirming evidence',
    blurb: 'Actively look for facts that contradict the conclusion.',
    promptRule:
      'Actively seek evidence that would contradict the main claims. Report what you looked for, where you looked, and what you found — including searches that turned up nothing.',
  },
  {
    id: 'reject-unsupported',
    label: 'Reject unsupported claims',
    blurb: 'Anything asserted without backing is treated as a defect.',
    promptRule:
      'Treat any claim presented without support as a defect. List each unsupported claim and what would be required to support it.',
  },
  {
    id: 'ignore-builder-explanations',
    label: 'Ignore builder explanations',
    blurb: 'Judge only what was produced, not the story told about it.',
    promptRule:
      'Disregard any explanation, justification, or self-assessment supplied by the builder. Judge only the artifact and the evidence. If the artifact contradicts the explanation, the artifact governs.',
  },
  {
    id: 'final-artifact-only',
    label: 'Review only the final artifact',
    blurb: 'Do not read the process, drafts, or discussion — only the result.',
    promptRule:
      'Review only the final artifact as a user of it would encounter it. Do not read intermediate drafts, commit history, or prior discussion.',
  },
];

export const behaviorById = (id: CriticBehavior): BehaviorEntry =>
  CRITIC_BEHAVIORS.find((b) => b.id === id) ?? CRITIC_BEHAVIORS[0];

/* ------------------------------------------------------------------ *
 * Failure statuses & checkpoints
 * ------------------------------------------------------------------ */

export const FAILURE_STATUSES: Array<CatalogEntry<FailureStatus>> = [
  { id: 'blocked', label: 'Blocked', blurb: 'Something outside the agent’s control stopped progress.' },
  { id: 'incomplete', label: 'Incomplete', blurb: 'Real progress was made but the quality bar was not reached.' },
  { id: 'requires-human-decision', label: 'Requires human decision', blurb: 'A judgement call is needed that the agents may not make.' },
  { id: 'requirements-conflict', label: 'Requirements conflict', blurb: 'Two requirements cannot both be satisfied as written.' },
  { id: 'budget-exhausted', label: 'Budget exhausted', blurb: 'A round, time, token, or cost limit was reached first.' },
  { id: 'unable-to-verify', label: 'Unable to verify', blurb: 'The work may be correct but there was no way to prove it.' },
];

export const CHECKPOINT_TRIGGERS: Array<CatalogEntry<CheckpointTrigger>> = [
  { id: 'before-start', label: 'Before anything starts', blurb: 'Confirm the plan before any work happens.' },
  { id: 'after-plan', label: 'After the plan is written', blurb: 'Approve the approach before building begins.' },
  { id: 'after-first-build', label: 'After the first version exists', blurb: 'Check direction early, while changing it is cheap.' },
  { id: 'each-round', label: 'After every round', blurb: 'Stay in the loop continuously. Slow but fully controlled.' },
  { id: 'before-destructive-action', label: 'Before anything irreversible', blurb: 'Deleting data, deploying, or sending anything outward.' },
  { id: 'on-disagreement', label: 'When agents disagree', blurb: 'You decide when reviewers cannot agree.' },
  { id: 'on-budget-threshold', label: 'When a budget is nearly used up', blurb: 'Decide whether to extend before the run stops.' },
  { id: 'before-completion', label: 'Before declaring it finished', blurb: 'Final sign-off rests with you.' },
  { id: 'custom', label: 'Custom trigger', blurb: 'Describe your own moment to pause.' },
];

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export const MODEL_PREFERENCES: Array<CatalogEntry<ModelPreference>> = [
  { id: 'most-capable', label: 'Most capable', blurb: 'Use the strongest available model. Best for judgement-heavy roles.' },
  { id: 'balanced', label: 'Balanced', blurb: 'A good default for most building and reviewing work.' },
  { id: 'fast', label: 'Fast and cheap', blurb: 'For mechanical checks where speed matters more than nuance.' },
  { id: 'inherit', label: 'Same as the main agent', blurb: 'Do not request anything specific.' },
  { id: 'custom', label: 'Specific model', blurb: 'Name the exact model to use.' },
];

export const LEDGER_FIELDS: Array<CatalogEntry<LedgerField>> = [
  { id: 'round', label: 'Round number', blurb: 'Which iteration this row belongs to.' },
  { id: 'agent', label: 'Agent', blurb: 'Who acted.' },
  { id: 'action', label: 'Action performed', blurb: 'What they did.' },
  { id: 'artifact-changed', label: 'Artifact changed', blurb: 'What was actually modified.' },
  { id: 'evidence', label: 'Evidence collected', blurb: 'The proof gathered this round.' },
  { id: 'previous-score', label: 'Previous score', blurb: 'The rubric score before this round.' },
  { id: 'new-score', label: 'New score', blurb: 'The rubric score after this round.' },
  { id: 'defects-fixed', label: 'Defects fixed', blurb: 'Findings resolved this round.' },
  { id: 'new-defects', label: 'New defects', blurb: 'Problems discovered this round.' },
  { id: 'regressions', label: 'Regressions', blurb: 'Things that used to work and now do not.' },
  { id: 'reviewer-decisions', label: 'Reviewer decisions', blurb: 'Each reviewer’s verdict.' },
  { id: 'unresolved-blockers', label: 'Unresolved blockers', blurb: 'What still stands in the way.' },
  { id: 'estimated-cost', label: 'Estimated cost', blurb: 'Running total, to track the budget.' },
  { id: 'next-action', label: 'Next action', blurb: 'What happens next and who does it.' },
];

export const COMPLEXITY_LABELS: Record<string, string> = {
  light: 'Light',
  moderate: 'Moderate',
  heavy: 'Heavy',
  'very-heavy': 'Very heavy',
};
