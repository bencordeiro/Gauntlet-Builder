/**
 * Project presets.
 *
 * Each preset is a complete, opinionated starting point: roster, evidence,
 * criteria, communication, approval, revision and stopping policy. Users can
 * change everything afterwards, so these should be genuinely usable defaults
 * rather than skeletons.
 */

import { applyTopology, createAgent, createCheckpoint, createCriterion, refreshEdges } from '../model/defaults';
import type {
  Agent,
  AgentRoleType,
  EvidenceKind,
  GauntletConfig,
  ProjectPreset,
  QualityCriterion,
  TopologyKind,
} from '../model/types';

/* ------------------------------------------------------------------ *
 * Builder helper
 * ------------------------------------------------------------------ */

interface PresetSpec {
  topology: TopologyKind;
  /** Replaces the topology's default roster when provided. */
  agents?: Array<{ role: AgentRoleType; name: string; patch?: Partial<Agent> }>;
  evidence: EvidenceKind[];
  evidenceConfig?: GauntletConfig['quality']['evidenceConfig'];
  criteria: Array<Partial<QualityCriterion> & { label: string; statement: string; verification: string }>;
  passingScore?: number;
  communication?: Partial<GauntletConfig['communication']>;
  approval?: Partial<GauntletConfig['approval']>;
  revision?: Partial<GauntletConfig['revision']>;
  stop?: Partial<GauntletConfig['stop']>;
  checkpoints?: Array<{ trigger: GauntletConfig['checkpoints'][number]['trigger']; label: string; question: string; blocking?: boolean }>;
  intent?: Partial<GauntletConfig['intent']>;
  tags?: string[];
}

function build(spec: PresetSpec) {
  return (base: GauntletConfig): GauntletConfig => {
    let config = applyTopology(base, spec.topology);

    if (spec.agents) {
      config = { ...config, agents: spec.agents.map((a) => createAgent(a.role, { name: a.name, ...a.patch })) };
    }

    const criteria = spec.criteria.map((c) =>
      createCriterion({ severity: 'mandatory', weight: 3, evidence: [], ...c }),
    );

    // Give reviewers ownership of criteria matching their evidence types, so
    // multi-reviewer presets do not have every reviewer judging everything.
    const agents = config.agents.map((agent) => {
      const owned = criteria
        .filter((c) => c.evidence.some((e) => ownedEvidenceFor(agent.roleType).includes(e)))
        .map((c) => c.id);
      return owned.length > 0 && ownedEvidenceFor(agent.roleType).length > 0
        ? { ...agent, ownedCriteria: owned }
        : agent;
    });

    config = {
      ...config,
      agents,
      intent: { ...config.intent, ...spec.intent },
      quality: {
        ...config.quality,
        evidence: spec.evidence,
        evidenceConfig: spec.evidenceConfig ?? {},
        criteria,
        passingScore: spec.passingScore ?? 0.85,
      },
      communication: { ...config.communication, ...spec.communication },
      approval: { ...config.approval, ...spec.approval },
      revision: { ...config.revision, ...spec.revision },
      stop: { ...config.stop, ...spec.stop },
      checkpoints: (spec.checkpoints ?? []).map((c) =>
        createCheckpoint({ trigger: c.trigger, label: c.label, question: c.question, blocking: c.blocking ?? true }),
      ),
      meta: { ...config.meta, tags: spec.tags ?? [] },
    };

    // Sign-off order and hybrid gates reference agent ids, which changed above.
    const gates = config.agents
      .filter((a) => a.gateOrder !== undefined)
      .sort((a, b) => (a.gateOrder ?? 0) - (b.gateOrder ?? 0))
      .map((a) => a.id);
    config = {
      ...config,
      approval: {
        ...config.approval,
        signoffOrder: gates.length > 0 ? gates : config.approval.signoffOrder,
        hybridGateIds: gates.length > 0 ? gates : config.approval.hybridGateIds,
        deciderId: config.agents.find((a) => a.roleType === 'lead-orchestrator')?.id,
      },
      communication: {
        ...config.communication,
        mediatorId: config.agents.find((a) => a.roleType === 'mediator')?.id,
      },
    };

    return refreshEdges(config);
  };
}

/** Evidence kinds a role is the natural owner of, used to assign criteria. */
function ownedEvidenceFor(role: AgentRoleType): EvidenceKind[] {
  switch (role) {
    case 'security-reviewer':
      return ['security-review'];
    case 'functional-tester':
      return ['browser-testing', 'automated-tests'];
    case 'visual-critic':
      return ['visual-screenshots', 'reference-comparison'];
    case 'citation-auditor':
      return ['source-verification'];
    case 'research-verifier':
      return ['factual-accuracy'];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

export const PROJECT_PRESETS: ProjectPreset[] = [
  {
    id: 'production-web-app',
    name: 'Production web application',
    category: 'Software',
    summary: 'Specialist builders, ordered quality gates, and an integration owner. For software that real people will use.',
    apply: build({
      topology: 'hybrid',
      evidence: ['automated-tests', 'browser-testing', 'visual-screenshots', 'accessibility', 'static-analysis', 'log-inspection'],
      evidenceConfig: {
        'automated-tests': { testCommand: 'npm test', minPassRate: 100 },
        'browser-testing': { requiredFlows: ['Complete the primary user journey end to end'], viewports: [390, 1280] },
        'visual-screenshots': { viewports: [390, 768, 1280] },
        accessibility: { accessibilityStandard: 'WCAG 2.2 AA', requiredChecks: ['Keyboard-only operation', 'Visible focus states'] },
        'static-analysis': { analysisCommands: ['npm run typecheck', 'npm run lint'] },
      },
      criteria: [
        { label: 'Tests pass', statement: 'Every automated test passes.', verification: 'Run the test command and paste the summary line.', evidence: ['automated-tests'], weight: 5 },
        { label: 'Primary flows work', statement: 'Each required user journey completes without an error.', verification: 'Walk each flow in a running browser and record the result per step.', evidence: ['browser-testing'], weight: 5 },
        { label: 'Renders correctly', statement: 'The interface is correct and readable at every required width.', verification: 'Capture a screenshot per width and describe what is visible.', evidence: ['visual-screenshots'], weight: 4 },
        { label: 'Accessible', statement: 'The application meets WCAG 2.2 AA and is fully keyboard operable.', verification: 'Run an automated audit, then operate the app with the keyboard alone.', evidence: ['accessibility'], weight: 4 },
        { label: 'Type-safe and clean', statement: 'Type checking and linting report no errors.', verification: 'Run each command and paste the output.', evidence: ['static-analysis'], weight: 3 },
        { label: 'No console errors', statement: 'No unexplained errors appear in the browser console during normal use.', verification: 'Exercise the app and paste the console output.', evidence: ['log-inspection'], weight: 3 },
      ],
      approval: { kind: 'hybrid', hybridFinalStage: 'lead' },
      revision: { strategy: 'highest-impact-first', requireRegressionTests: true, requireEvidenceAfterRevision: true, preserveApprovedComponents: true },
      stop: { maxTotalRounds: 12, maxConsecutiveFailures: 3, plateauRounds: 2 },
      checkpoints: [
        { trigger: 'after-plan', label: 'Approve the plan', question: 'Is this the right approach and the right breakdown of work?' },
        { trigger: 'before-completion', label: 'Final sign-off', question: 'Does the finished application do what you asked for?' },
      ],
      tags: ['software', 'web'],
    }),
  },

  {
    id: 'cybersecurity-investigation',
    name: 'Cybersecurity investigation',
    category: 'Security',
    summary: 'A red team that attacks findings, with blind review so conclusions must survive scrutiny rather than persuasion.',
    apply: build({
      topology: 'red-team',
      evidence: ['security-review', 'log-inspection', 'factual-accuracy', 'source-verification'],
      evidenceConfig: {
        'security-review': { requiredChecks: ['Reproduce each claimed finding', 'Confirm exploitability, not just presence'] },
        'source-verification': { citationCoverage: 100 },
      },
      criteria: [
        { label: 'Findings are reproducible', statement: 'Every reported finding can be reproduced from the steps given.', verification: 'Follow each reproduction step exactly and record whether it worked.', evidence: ['security-review'], weight: 5 },
        { label: 'Severity is justified', statement: 'Each severity rating is supported by demonstrated impact, not assumed impact.', verification: 'Check each rating against what was actually demonstrated.', evidence: ['security-review'], weight: 4 },
        { label: 'No unsupported conclusions', statement: 'Every conclusion follows from evidence actually collected.', verification: 'Trace each conclusion back to its supporting evidence.', evidence: ['factual-accuracy'], weight: 5 },
        { label: 'Evidence is preserved', statement: 'Raw evidence is recorded for every claim.', verification: 'Confirm each claim has attached logs, output, or captures.', evidence: ['log-inspection'], weight: 4 },
      ],
      communication: { globalMode: 'blind-independent', anonymizeBuilder: true, structuredFindingsOnly: true },
      approval: { kind: 'all-mandatory', allowVeto: true },
      revision: { strategy: 'highest-impact-first', requireEvidenceAfterRevision: true },
      stop: { maxTotalRounds: 10, maxRepeatedDefects: 2 },
      checkpoints: [
        { trigger: 'before-destructive-action', label: 'Before any active testing', question: 'Is active testing authorised against this target?' },
        { trigger: 'before-completion', label: 'Review the findings', question: 'Are these findings accurate and appropriately rated?' },
      ],
      intent: {
        prohibitions: [
          'Do not test any system that has not been explicitly authorised',
          'Do not exfiltrate, modify, or destroy real data',
        ],
      },
      tags: ['security', 'research'],
    }),
  },

  {
    id: 'security-code-review',
    name: 'Security code review',
    category: 'Security',
    summary: 'Ordered gates ending in a security reviewer whose approval cannot be voted away.',
    apply: build({
      topology: 'sequential-gates',
      agents: [
        { role: 'lead-orchestrator', name: 'Review Lead' },
        { role: 'builder', name: 'Remediation Engineer' },
        { role: 'security-reviewer', name: 'Security Reviewer', patch: { gateOrder: 1, strictness: 'adversarial', mandatoryApproval: true } },
        { role: 'functional-tester', name: 'Regression Tester', patch: { gateOrder: 2, mandatoryApproval: true } },
        { role: 'integration-owner', name: 'Final Reviewer', patch: { gateOrder: 3, mandatoryApproval: true } },
      ],
      evidence: ['security-review', 'automated-tests', 'static-analysis'],
      evidenceConfig: {
        'security-review': {
          requiredChecks: [
            'Authentication on every protected route',
            'Authorization for every privileged action',
            'Input validation and output encoding',
            'Secret handling and storage',
            'Dependency vulnerabilities',
          ],
        },
        'automated-tests': { testCommand: 'npm test', minPassRate: 100 },
      },
      criteria: [
        { label: 'Authorization', statement: 'No privileged action is reachable by an unprivileged caller.', verification: 'Attempt each privileged action with a standard account and record the response code.', evidence: ['security-review'], weight: 5 },
        { label: 'Input validation', statement: 'Untrusted input cannot alter control flow or reach an interpreter unescaped.', verification: 'Submit malformed and hostile input to each entry point and record the behaviour.', evidence: ['security-review'], weight: 5 },
        { label: 'Secrets', statement: 'No credential or key is committed, logged, or exposed to the client.', verification: 'Search the repository and logs for credential patterns and report findings.', evidence: ['static-analysis'], weight: 5 },
        { label: 'No regressions', statement: 'Security fixes did not break existing behaviour.', verification: 'Run the full test suite and compare against the baseline.', evidence: ['automated-tests'], weight: 4 },
      ],
      approval: { kind: 'sequential-signoff' },
      revision: { strategy: 'highest-impact-first', requireRegressionTests: true, autoRollbackRegressions: true },
      stop: { maxTotalRounds: 10 },
      checkpoints: [{ trigger: 'before-completion', label: 'Accept the review', question: 'Are you satisfied the security findings are resolved?' }],
      tags: ['security', 'software'],
    }),
  },

  {
    id: 'research-report',
    name: 'Research report',
    category: 'Research',
    summary: 'A citation auditor and a fact verifier that independently check every claim before the report is accepted.',
    apply: build({
      topology: 'specialist-team',
      agents: [
        { role: 'lead-orchestrator', name: 'Research Lead' },
        { role: 'specialist-builder', name: 'Researcher' },
        { role: 'specialist-builder', name: 'Writer' },
        { role: 'research-verifier', name: 'Fact Verifier', patch: { mandatoryApproval: true, strictness: 'adversarial' } },
        { role: 'citation-auditor', name: 'Citation Auditor', patch: { mandatoryApproval: true } },
        { role: 'critic', name: 'Editor', patch: { mandatoryApproval: false } },
      ],
      evidence: ['source-verification', 'factual-accuracy', 'human-review'],
      evidenceConfig: {
        'source-verification': { citationCoverage: 100 },
        'human-review': { humanReviewFocus: 'Whether the report answers the question that was actually asked' },
      },
      criteria: [
        { label: 'Claims are sourced', statement: 'Every material claim carries a citation that genuinely supports it.', verification: 'Open each cited source and confirm it states the claim.', evidence: ['source-verification'], weight: 5 },
        { label: 'Sources are real', statement: 'Every citation exists and is retrievable.', verification: 'Retrieve each source and record whether it resolved.', evidence: ['source-verification'], weight: 5 },
        { label: 'No overstatement', statement: 'Conclusions do not claim more than the evidence supports.', verification: 'Compare each conclusion against its evidence and flag any gap.', evidence: ['factual-accuracy'], weight: 5 },
        { label: 'Contrary evidence addressed', statement: 'Evidence that contradicts the conclusion is acknowledged rather than omitted.', verification: 'Search for disconfirming evidence and check whether the report engages with it.', evidence: ['factual-accuracy'], weight: 4 },
        { label: 'Answers the question', statement: 'The report addresses what was actually asked.', verification: 'Read the brief and the report side by side and note anything unanswered.', evidence: ['human-review'], weight: 4, severity: 'important' },
      ],
      communication: { globalMode: 'blind-independent', anonymizeBuilder: true },
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'group-related', requireEvidenceAfterRevision: true },
      stop: { maxTotalRounds: 8 },
      checkpoints: [{ trigger: 'before-completion', label: 'Accept the report', question: 'Does this answer your question with sources you trust?' }],
      intent: { environment: 'research-agent' },
      tags: ['research', 'writing'],
    }),
  },

  {
    id: 'business-proposal',
    name: 'Business proposal',
    category: 'Business',
    summary: 'A council of independent reviewers votes, with one reviewer told to argue against the proposal.',
    apply: build({
      topology: 'consensus-council',
      agents: [
        { role: 'lead-orchestrator', name: 'Chair' },
        { role: 'builder', name: 'Proposal Writer' },
        { role: 'critic', name: 'Commercial Reviewer' },
        { role: 'critic', name: 'Feasibility Reviewer' },
        { role: 'adversarial-reviewer', name: 'Devil’s Advocate', patch: { strictness: 'adversarial', mandatoryApproval: false } },
      ],
      evidence: ['human-review', 'factual-accuracy', 'reference-comparison'],
      evidenceConfig: {
        'human-review': { humanReviewFocus: 'Whether you would actually approve this if it landed on your desk' },
        'reference-comparison': { referenceDescription: 'A proposal that previously succeeded with this audience' },
      },
      criteria: [
        { label: 'The ask is clear', statement: 'A reader knows exactly what is being requested and what it costs.', verification: 'Read the proposal once and state the ask and the number without re-reading.', evidence: ['human-review'], weight: 5 },
        { label: 'Numbers hold up', statement: 'Every figure is sourced and the arithmetic is correct.', verification: 'Recompute each figure and check its source.', evidence: ['factual-accuracy'], weight: 5 },
        { label: 'Risks are addressed', statement: 'The obvious objections are anticipated and answered.', verification: 'List the three strongest objections and check whether the proposal answers them.', evidence: ['human-review'], weight: 4 },
        { label: 'Fits the audience', statement: 'Tone, length and detail match how this audience makes decisions.', verification: 'Compare against the reference proposal and note the differences.', evidence: ['reference-comparison'], weight: 3, severity: 'important' },
      ],
      communication: { globalMode: 'isolated-voting', anonymizeBuilder: true },
      approval: { kind: 'majority' },
      revision: { strategy: 'orchestrator-prioritizes' },
      stop: { maxTotalRounds: 6 },
      checkpoints: [{ trigger: 'before-completion', label: 'Final approval', question: 'Would you send this?' }],
      intent: { environment: 'general-llm' },
      tags: ['business', 'writing'],
    }),
  },

  {
    id: 'data-analysis',
    name: 'Data analysis',
    category: 'Research',
    summary: 'An adversarial reviewer tries to break the analysis before its conclusions are accepted.',
    apply: build({
      topology: 'red-team',
      agents: [
        { role: 'lead-orchestrator', name: 'Analysis Lead' },
        { role: 'builder', name: 'Analyst' },
        { role: 'adversarial-reviewer', name: 'Methodology Challenger', patch: { strictness: 'adversarial', mandatoryApproval: true } },
        { role: 'research-verifier', name: 'Result Verifier', patch: { mandatoryApproval: true } },
      ],
      evidence: ['automated-tests', 'factual-accuracy', 'log-inspection', 'static-analysis'],
      evidenceConfig: {
        'automated-tests': { testCommand: 'Re-run the analysis end to end', minPassRate: 100 },
      },
      criteria: [
        { label: 'Reproducible', statement: 'Re-running the analysis produces the same numbers.', verification: 'Run the analysis from scratch and compare every reported figure.', evidence: ['automated-tests'], weight: 5 },
        { label: 'Method fits the question', statement: 'The method chosen can actually answer the question asked.', verification: 'State the assumptions the method requires and check each against the data.', evidence: ['factual-accuracy'], weight: 5 },
        { label: 'Data handling is sound', statement: 'Missing values, outliers and filters are handled explicitly and justified.', verification: 'Inspect each transformation and confirm it is documented and defensible.', evidence: ['log-inspection'], weight: 4 },
        { label: 'Conclusions are proportionate', statement: 'Conclusions do not exceed what the data supports, and uncertainty is stated.', verification: 'Check each conclusion against effect size, sample size and confidence.', evidence: ['factual-accuracy'], weight: 5 },
      ],
      communication: { globalMode: 'blind-independent', anonymizeBuilder: true },
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'highest-impact-first', requireEvidenceAfterRevision: true },
      stop: { maxTotalRounds: 8 },
      tags: ['research', 'data'],
    }),
  },

  {
    id: 'ui-design-review',
    name: 'UI and visual design review',
    category: 'Design',
    summary: 'A visual critic judges from real screenshots, blind, against a reference you supply.',
    apply: build({
      topology: 'builder-critic',
      agents: [
        { role: 'builder', name: 'Designer' },
        { role: 'visual-critic', name: 'Visual Critic', patch: { strictness: 'reference-blind-judge', mandatoryApproval: true, behaviors: ['require-evidence', 'largest-defect', 'score-rubric', 'compare-reference', 'blind-ab', 'reverse-ab'] } },
        { role: 'critic', name: 'Accessibility Reviewer', patch: { mandatoryApproval: true } },
      ],
      evidence: ['visual-screenshots', 'reference-comparison', 'accessibility', 'browser-testing'],
      evidenceConfig: {
        'visual-screenshots': { viewports: [390, 768, 1280, 1600] },
        'reference-comparison': { referenceDescription: 'Describe or link the design you want this to stand alongside', visualSimilarityThreshold: 80 },
        accessibility: { accessibilityStandard: 'WCAG 2.2 AA', requiredChecks: ['Contrast ratios', 'Focus visibility', 'Target sizes'] },
      },
      criteria: [
        { label: 'Visual hierarchy', statement: 'The most important element on each screen is the most visually prominent.', verification: 'Look at each screenshot for two seconds and name what you noticed first.', evidence: ['visual-screenshots'], weight: 5 },
        { label: 'Spacing and rhythm', statement: 'Spacing is consistent and follows a discernible scale.', verification: 'Measure the gaps in the screenshots and list any that break the pattern.', evidence: ['visual-screenshots'], weight: 4 },
        { label: 'Holds up against the reference', statement: 'A blind judge would not immediately prefer the reference.', verification: 'Judge both blind, then reverse the order and judge again.', evidence: ['reference-comparison'], weight: 5 },
        { label: 'Contrast and focus', statement: 'Text contrast meets AA and every interactive element has a visible focus state.', verification: 'Measure contrast ratios and tab through the interface.', evidence: ['accessibility'], weight: 5 },
        { label: 'Responsive', statement: 'Nothing overflows, overlaps, or becomes unreadable at any required width.', verification: 'Inspect each width and report anything broken.', evidence: ['browser-testing'], weight: 4 },
      ],
      communication: { globalMode: 'blind-independent', anonymizeBuilder: true },
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'highest-impact-first' },
      stop: { maxTotalRounds: 8, plateauRounds: 2 },
      tags: ['design', 'web'],
    }),
  },

  {
    id: 'technical-documentation',
    name: 'Technical documentation',
    category: 'Writing',
    summary: 'A reviewer follows the instructions literally to find out whether they actually work.',
    apply: build({
      topology: 'builder-critic',
      agents: [
        { role: 'builder', name: 'Technical Writer' },
        { role: 'functional-tester', name: 'Instruction Follower', patch: { mandatoryApproval: true, strictness: 'strict-professional', responsibility: 'Follow the documentation exactly as written, with no prior knowledge, and report every point where it fails.' } },
        { role: 'critic', name: 'Accuracy Reviewer', patch: { mandatoryApproval: true } },
      ],
      evidence: ['browser-testing', 'factual-accuracy', 'human-review'],
      evidenceConfig: {
        'browser-testing': { requiredFlows: ['Follow the getting-started guide from a clean state'] },
        'human-review': { humanReviewFocus: 'Whether a newcomer could actually succeed with this' },
      },
      criteria: [
        { label: 'Instructions work', statement: 'Following the steps exactly, from a clean state, produces the described result.', verification: 'Execute every step literally and record where it diverges.', evidence: ['browser-testing'], weight: 5 },
        { label: 'Nothing assumed', statement: 'No step depends on knowledge the document never provides.', verification: 'Flag every term or prerequisite used before it is introduced.', evidence: ['factual-accuracy'], weight: 4 },
        { label: 'Technically accurate', statement: 'Every statement about behaviour matches actual behaviour.', verification: 'Verify each claim against the real system.', evidence: ['factual-accuracy'], weight: 5 },
        { label: 'Findable', statement: 'A reader can locate the answer to a specific question quickly.', verification: 'Pick three realistic questions and time how long finding each answer takes.', evidence: ['human-review'], weight: 3, severity: 'important' },
      ],
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'fix-all' },
      stop: { maxTotalRounds: 6 },
      tags: ['writing', 'software'],
    }),
  },

  {
    id: 'api-integration',
    name: 'API integration',
    category: 'Software',
    summary: 'Gates on real request/response evidence, including the failure paths that integrations usually skip.',
    apply: build({
      topology: 'sequential-gates',
      agents: [
        { role: 'lead-orchestrator', name: 'Integration Lead' },
        { role: 'builder', name: 'Integration Engineer' },
        { role: 'functional-tester', name: 'Contract Tester', patch: { gateOrder: 1, mandatoryApproval: true } },
        { role: 'security-reviewer', name: 'Credential Reviewer', patch: { gateOrder: 2, mandatoryApproval: true } },
        { role: 'integration-owner', name: 'Final Reviewer', patch: { gateOrder: 3, mandatoryApproval: true } },
      ],
      evidence: ['automated-tests', 'log-inspection', 'security-review', 'performance'],
      evidenceConfig: {
        'automated-tests': { testCommand: 'npm test', minPassRate: 100 },
        'security-review': { requiredChecks: ['Credentials are never logged or committed', 'Tokens are refreshed and scoped correctly'] },
        performance: { maxLatencyMs: 2000 },
      },
      criteria: [
        { label: 'Happy path works', statement: 'A successful call returns and is parsed correctly.', verification: 'Make a real call and paste the request and response.', evidence: ['log-inspection'], weight: 5 },
        { label: 'Failures are handled', statement: 'Timeouts, rate limits, malformed responses and auth failures are each handled explicitly.', verification: 'Trigger or simulate each failure and record the behaviour.', evidence: ['automated-tests'], weight: 5 },
        { label: 'Credentials are safe', statement: 'No secret appears in logs, source, or client-visible output.', verification: 'Search logs and source for credential patterns.', evidence: ['security-review'], weight: 5 },
        { label: 'Within latency budget', statement: 'Calls complete inside the stated ceiling under normal conditions.', verification: 'Measure round-trip time across several calls and report the numbers.', evidence: ['performance'], weight: 3, severity: 'important' },
      ],
      approval: { kind: 'sequential-signoff' },
      revision: { strategy: 'highest-impact-first', requireRegressionTests: true },
      stop: { maxTotalRounds: 8 },
      tags: ['software', 'integration'],
    }),
  },

  {
    id: 'debugging-rca',
    name: 'Debugging and root-cause analysis',
    category: 'Software',
    summary: 'Forces a demonstrated root cause and a failing-then-passing test, rather than a fix that happens to help.',
    apply: build({
      topology: 'builder-critic',
      agents: [
        { role: 'builder', name: 'Investigator' },
        { role: 'adversarial-reviewer', name: 'Root Cause Challenger', patch: { mandatoryApproval: true, strictness: 'adversarial', behaviors: ['require-evidence', 'root-cause', 'regression-risk', 'seek-disconfirming', 'reject-unsupported'] } },
        { role: 'functional-tester', name: 'Regression Tester', patch: { mandatoryApproval: true } },
      ],
      evidence: ['automated-tests', 'log-inspection', 'static-analysis'],
      evidenceConfig: { 'automated-tests': { testCommand: 'npm test', minPassRate: 100 } },
      criteria: [
        { label: 'Reproduced first', statement: 'The bug was reproduced reliably before any fix was attempted.', verification: 'Show the reproduction and its output before the change.', evidence: ['log-inspection'], weight: 5 },
        { label: 'Root cause demonstrated', statement: 'The stated cause is shown to produce the symptom, not merely correlated with it.', verification: 'Show that reverting the fix restores the symptom and re-applying removes it.', evidence: ['log-inspection'], weight: 5 },
        { label: 'Regression test exists', statement: 'A test fails before the fix and passes after it.', verification: 'Run the new test against the old code and the new code, and paste both outputs.', evidence: ['automated-tests'], weight: 5 },
        { label: 'Nothing else broke', statement: 'The full suite still passes.', verification: 'Run the full suite and compare against the baseline.', evidence: ['automated-tests'], weight: 4 },
      ],
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'highest-impact-first', requireRegressionTests: true, autoRollbackRegressions: true },
      stop: { maxTotalRounds: 8, maxRepeatedDefects: 2 },
      intent: {
        prohibitions: ['Do not fix the symptom without demonstrating the cause', 'Do not weaken or delete a test to make it pass'],
      },
      tags: ['software', 'debugging'],
    }),
  },

  {
    id: 'refactoring',
    name: 'Refactoring project',
    category: 'Software',
    summary: 'Behaviour must stay identical. Every round is measured against the baseline captured at the start.',
    apply: build({
      topology: 'builder-critic',
      agents: [
        { role: 'builder', name: 'Refactorer' },
        { role: 'functional-tester', name: 'Behaviour Guard', patch: { mandatoryApproval: true } },
        { role: 'critic', name: 'Design Reviewer', patch: { mandatoryApproval: true } },
      ],
      evidence: ['automated-tests', 'static-analysis', 'performance'],
      evidenceConfig: {
        'automated-tests': { testCommand: 'npm test', minPassRate: 100 },
        'static-analysis': { analysisCommands: ['npm run typecheck', 'npm run lint'] },
      },
      criteria: [
        { label: 'Behaviour unchanged', statement: 'Every test that passed before still passes, with no test modified.', verification: 'Compare the full test output against the baseline, and diff the test files.', evidence: ['automated-tests'], weight: 5 },
        { label: 'Tests untouched', statement: 'No test was weakened, skipped, or deleted during the refactor.', verification: 'Diff the test files against the baseline and report every change.', evidence: ['static-analysis'], weight: 5 },
        { label: 'Genuinely simpler', statement: 'The result is measurably easier to follow, not merely rearranged.', verification: 'Name the specific complexity removed and show the before and after.', evidence: ['static-analysis'], weight: 4 },
        { label: 'No performance loss', statement: 'Performance is not materially worse than the baseline.', verification: 'Measure before and after and report both numbers.', evidence: ['performance'], weight: 3, severity: 'important' },
      ],
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'group-related', requireRegressionTests: true, autoRollbackRegressions: true, preserveApprovedComponents: true },
      stop: { maxTotalRounds: 10 },
      intent: { prohibitions: ['Do not change behaviour', 'Do not modify tests to accommodate the refactor'] },
      tags: ['software', 'refactoring'],
    }),
  },

  {
    id: 'accessibility-audit',
    name: 'Accessibility audit',
    category: 'Design',
    summary: 'Manual keyboard and screen-reader testing alongside automated checks, because automation catches maybe a third of it.',
    apply: build({
      topology: 'sequential-gates',
      agents: [
        { role: 'lead-orchestrator', name: 'Audit Lead' },
        { role: 'builder', name: 'Remediation Engineer' },
        { role: 'critic', name: 'Automated Audit', patch: { gateOrder: 1, mandatoryApproval: true } },
        { role: 'functional-tester', name: 'Keyboard and Screen Reader Tester', patch: { gateOrder: 2, mandatoryApproval: true, strictness: 'strict-professional' } },
        { role: 'integration-owner', name: 'Final Reviewer', patch: { gateOrder: 3, mandatoryApproval: true } },
      ],
      evidence: ['accessibility', 'browser-testing', 'visual-screenshots', 'static-analysis'],
      evidenceConfig: {
        accessibility: {
          accessibilityStandard: 'WCAG 2.2 AA',
          requiredChecks: ['Automated audit', 'Keyboard-only traversal', 'Screen reader announcement', 'Contrast measurement', 'Reflow at 320px'],
        },
        'browser-testing': { requiredFlows: ['Complete the primary task using only the keyboard'], viewports: [320, 1280] },
      },
      criteria: [
        { label: 'Keyboard operable', statement: 'Every function can be reached and used with the keyboard alone, with no trap.', verification: 'Tab through the entire interface and record every unreachable or trapping element.', evidence: ['browser-testing'], weight: 5 },
        { label: 'Focus visible', statement: 'Focus is always clearly visible against its background.', verification: 'Screenshot each focused state and measure contrast.', evidence: ['visual-screenshots'], weight: 5 },
        { label: 'Announced correctly', statement: 'Controls announce their role, name, and state.', verification: 'Traverse with a screen reader and record what is announced for each control.', evidence: ['accessibility'], weight: 5 },
        { label: 'Contrast meets AA', statement: 'All text and meaningful graphics meet the AA contrast ratio.', verification: 'Measure each combination and list the ratios.', evidence: ['accessibility'], weight: 5 },
        { label: 'Reflows without loss', statement: 'At 320px nothing is lost and no horizontal scrolling is required.', verification: 'Inspect at 320px and report anything cut off or overlapping.', evidence: ['browser-testing'], weight: 4 },
      ],
      approval: { kind: 'sequential-signoff' },
      revision: { strategy: 'group-related', requireRegressionTests: true },
      stop: { maxTotalRounds: 10 },
      tags: ['design', 'accessibility', 'web'],
    }),
  },

  {
    id: 'performance-optimization',
    name: 'Performance optimization',
    category: 'Software',
    summary: 'Every claimed improvement must be measured, and correctness is gated so speed is never bought with broken behaviour.',
    apply: build({
      topology: 'builder-critic',
      agents: [
        { role: 'builder', name: 'Optimiser' },
        { role: 'functional-tester', name: 'Measurement Verifier', patch: { mandatoryApproval: true, behaviors: ['require-evidence', 'largest-defect', 'score-rubric', 'reject-unsupported'] } },
        { role: 'critic', name: 'Correctness Guard', patch: { mandatoryApproval: true } },
      ],
      evidence: ['performance', 'automated-tests', 'log-inspection'],
      evidenceConfig: {
        performance: { maxLatencyMs: 1000, performanceBudgets: ['No regression in any other measured path'] },
        'automated-tests': { testCommand: 'npm test', minPassRate: 100 },
      },
      criteria: [
        { label: 'Baseline recorded', statement: 'Performance was measured before any change.', verification: 'Show the baseline measurement with its methodology.', evidence: ['performance'], weight: 5 },
        { label: 'Improvement measured', statement: 'Each claimed improvement is backed by a before-and-after number from the same method.', verification: 'Compare measurements taken the same way and report both.', evidence: ['performance'], weight: 5 },
        { label: 'Correctness preserved', statement: 'All tests still pass and behaviour is unchanged.', verification: 'Run the full suite and compare against the baseline.', evidence: ['automated-tests'], weight: 5 },
        { label: 'No path got slower', statement: 'No other measured path regressed.', verification: 'Re-measure every previously measured path and report each.', evidence: ['performance'], weight: 4 },
      ],
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'highest-impact-first', requireRegressionTests: true, requireEvidenceAfterRevision: true },
      stop: { maxTotalRounds: 10, plateauRounds: 2, plateauDelta: 0.03 },
      intent: { prohibitions: ['Do not claim an improvement without a measurement taken the same way as the baseline'] },
      tags: ['software', 'performance'],
    }),
  },

  {
    id: 'custom-project',
    name: 'Custom project',
    category: 'General',
    summary: 'A minimal builder-and-critic starting point. Everything is yours to configure.',
    apply: build({
      topology: 'builder-critic',
      evidence: ['human-review'],
      evidenceConfig: { 'human-review': { humanReviewFocus: 'Whether the result does what you asked for' } },
      criteria: [
        { label: 'Does what was asked', statement: 'The deliverable satisfies the stated goal.', verification: 'Compare the result against the goal point by point.', evidence: ['human-review'], weight: 5 },
      ],
      approval: { kind: 'all-mandatory' },
      stop: { maxTotalRounds: 6 },
      tags: ['general'],
    }),
  },
];

export const presetById = (id: string): ProjectPreset | undefined =>
  PROJECT_PRESETS.find((p) => p.id === id);

export const PRESET_CATEGORIES = Array.from(new Set(PROJECT_PRESETS.map((p) => p.category)));
