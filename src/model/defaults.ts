/**
 * Factory functions and topology templates.
 *
 * `createGauntlet` produces a valid empty config; `applyTopology` swaps in the
 * agent roster, communication edges and approval policy that match a chosen
 * structure. Both are pure, so tests can build configs without React.
 */

import {
  agentId,
  checkpointId,
  criterionId,
  edgeId,
  gauntletId,
} from './ids';
import { roleById, isReviewRole } from './catalog';
import type {
  Agent,
  AgentRoleType,
  ApprovalPolicy,
  CommunicationEdge,
  CommunicationPolicy,
  EdgeKind,
  GauntletConfig,
  HumanCheckpoint,
  Intent,
  LedgerConfig,
  QualityBar,
  QualityCriterion,
  RevisionPolicy,
  StopPolicy,
  TopologyKind,
} from './types';
import { SCHEMA_VERSION } from './types';

/* ------------------------------------------------------------------ *
 * Small factories
 * ------------------------------------------------------------------ */

export function createAgent(roleType: AgentRoleType, overrides: Partial<Agent> = {}): Agent {
  const role = roleById(roleType);
  const review = isReviewRole(roleType);
  return {
    id: agentId(),
    name: role.label,
    roleType,
    enabled: true,
    responsibility: role.defaultResponsibility,
    expertise: role.defaultExpertise,
    inputs: [...role.defaultInputs],
    outputs: [...role.defaultOutputs],
    tools: [],
    permissions: { write: [], readOnly: [], forbidden: [] },
    canMessagePeers: false,
    mandatoryApproval: role.defaultMandatory,
    seesPriorReasoning: !review,
    freshContext: review,
    model: 'balanced',
    authority: role.defaultAuthority,
    maxRounds: 5,
    strictness: review ? 'strict-professional' : undefined,
    behaviors: review ? ['require-evidence', 'largest-defect', 'score-rubric'] : undefined,
    ownedCriteria: [],
    ...overrides,
  };
}

export function createCriterion(overrides: Partial<QualityCriterion> = {}): QualityCriterion {
  return {
    id: criterionId(),
    label: '',
    statement: '',
    verification: '',
    severity: 'mandatory',
    evidence: [],
    weight: 3,
    ...overrides,
  };
}

export function createCheckpoint(overrides: Partial<HumanCheckpoint> = {}): HumanCheckpoint {
  return {
    id: checkpointId(),
    trigger: 'before-completion',
    label: 'Final sign-off',
    question: 'Does this meet what you asked for?',
    blocking: true,
    ...overrides,
  };
}

export function createEdge(
  from: string,
  to: string,
  kind: EdgeKind,
  payload: string,
  userDefined = false,
): CommunicationEdge {
  return { id: edgeId(), from, to, kind, payload, userDefined };
}

/* ------------------------------------------------------------------ *
 * Defaults for each config section
 * ------------------------------------------------------------------ */

export function defaultIntent(): Intent {
  return {
    projectName: '',
    goal: '',
    deliverable: '',
    audience: '',
    context: '',
    references: '',
    requirements: [],
    prohibitions: [],
    tools: [],
    environment: 'claude-code',
    customEnvironment: '',
  };
}

export function defaultQualityBar(): QualityBar {
  return {
    evidence: [],
    evidenceConfig: {},
    criteria: [],
    subjectiveGoals: [],
    passingScore: 0.85,
  };
}

export function defaultCommunication(): CommunicationPolicy {
  return {
    globalMode: 'orchestrator-controlled',
    overrides: {},
    edges: [],
    anonymizeBuilder: false,
    structuredFindingsOnly: true,
    allowClarifyingQuestions: true,
  };
}

export function defaultApproval(): ApprovalPolicy {
  return {
    kind: 'all-mandatory',
    supermajorityPercent: 75,
    weights: {},
    weightedThreshold: 0.7,
    signoffOrder: [],
    requiresHumanFinal: false,
    hybridGateIds: [],
    hybridFinalStage: 'lead',
    allowVeto: true,
    vetoEscalatesAfter: 3,
  };
}

export function defaultRevision(): RevisionPolicy {
  return {
    strategy: 'highest-impact-first',
    requirePlanBeforeRevision: false,
    requireEvidenceAfterRevision: true,
    requireRegressionTests: true,
    autoRollbackRegressions: false,
    preserveApprovedComponents: true,
    lockAfterApproval: false,
    reopenOnIntegrationRegression: true,
  };
}

export function defaultStop(): StopPolicy {
  return {
    maxTotalRounds: 8,
    maxRoundsPerAgent: 5,
    maxConsecutiveFailures: 3,
    maxRepeatedDefects: 3,
    plateauRounds: 2,
    plateauDelta: 0.02,
    maxTokens: 0,
    maxCostUsd: 0,
    maxWallClockMinutes: 0,
    allowedFailureStatuses: [
      'blocked',
      'incomplete',
      'requires-human-decision',
      'requirements-conflict',
      'budget-exhausted',
      'unable-to-verify',
    ],
  };
}

export function defaultLedger(): LedgerConfig {
  return {
    enabled: true,
    format: 'markdown-table',
    fields: [
      'round',
      'agent',
      'action',
      'artifact-changed',
      'evidence',
      'previous-score',
      'new-score',
      'defects-fixed',
      'new-defects',
      'regressions',
      'reviewer-decisions',
      'unresolved-blockers',
      'next-action',
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Whole-config factory
 * ------------------------------------------------------------------ */

export function createGauntlet(overrides: Partial<GauntletConfig> = {}): GauntletConfig {
  const now = new Date().toISOString();
  const base: GauntletConfig = {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: gauntletId(),
      createdAt: now,
      updatedAt: now,
      tags: [],
    },
    intent: defaultIntent(),
    quality: defaultQualityBar(),
    topology: 'builder-critic',
    agents: [],
    communication: defaultCommunication(),
    approval: defaultApproval(),
    revision: defaultRevision(),
    stop: defaultStop(),
    checkpoints: [],
    ledger: defaultLedger(),
    additionalInstructions: '',
    ...overrides,
  };
  return base.agents.length === 0 ? applyTopology(base, base.topology) : base;
}

/* ------------------------------------------------------------------ *
 * Topology templates
 * ------------------------------------------------------------------ */

interface RosterSpec {
  roleType: AgentRoleType;
  name?: string;
  overrides?: Partial<Agent>;
}

const ROSTERS: Record<TopologyKind, RosterSpec[]> = {
  'builder-critic': [
    { roleType: 'builder', name: 'Builder' },
    { roleType: 'critic', name: 'Critic' },
  ],
  'specialist-team': [
    { roleType: 'lead-orchestrator', name: 'Lead Orchestrator' },
    { roleType: 'specialist-builder', name: 'Specialist A' },
    { roleType: 'specialist-builder', name: 'Specialist B' },
    { roleType: 'specialist-builder', name: 'Specialist C' },
    { roleType: 'integration-owner', name: 'Integration Owner' },
    { roleType: 'critic', name: 'Quality Critic' },
  ],
  'sequential-gates': [
    { roleType: 'lead-orchestrator', name: 'Lead Orchestrator' },
    { roleType: 'builder', name: 'Implementer' },
    { roleType: 'functional-tester', name: 'Functional QA', overrides: { gateOrder: 1 } },
    { roleType: 'security-reviewer', name: 'Security Gate', overrides: { gateOrder: 2 } },
    { roleType: 'critic', name: 'Accessibility Gate', overrides: { gateOrder: 3 } },
    { roleType: 'integration-owner', name: 'Final Review', overrides: { gateOrder: 4 } },
  ],
  'red-team': [
    { roleType: 'lead-orchestrator', name: 'Lead Orchestrator' },
    { roleType: 'builder', name: 'Builder' },
    { roleType: 'adversarial-reviewer', name: 'Red Team Lead', overrides: { strictness: 'adversarial' } },
    { roleType: 'security-reviewer', name: 'Security Attacker', overrides: { strictness: 'adversarial' } },
    { roleType: 'critic', name: 'Claim Auditor', overrides: { strictness: 'extremely-demanding' } },
  ],
  'consensus-council': [
    { roleType: 'lead-orchestrator', name: 'Council Chair' },
    { roleType: 'builder', name: 'Builder' },
    { roleType: 'critic', name: 'Reviewer 1' },
    { roleType: 'critic', name: 'Reviewer 2' },
    { roleType: 'critic', name: 'Reviewer 3' },
  ],
  hybrid: [
    { roleType: 'lead-orchestrator', name: 'Lead Orchestrator' },
    { roleType: 'planner', name: 'Planner' },
    { roleType: 'specialist-builder', name: 'Specialist A' },
    { roleType: 'specialist-builder', name: 'Specialist B' },
    { roleType: 'critic', name: 'Quality Critic' },
    { roleType: 'functional-tester', name: 'Functional QA', overrides: { gateOrder: 1 } },
    { roleType: 'security-reviewer', name: 'Security Gate', overrides: { gateOrder: 2 } },
    { roleType: 'integration-owner', name: 'Integration Owner', overrides: { gateOrder: 3 } },
  ],
  custom: [
    { roleType: 'builder', name: 'Builder' },
  ],
};

/** Communication and approval defaults that suit each structure. */
const TOPOLOGY_DEFAULTS: Record<
  TopologyKind,
  { communication: CommunicationPolicy['globalMode']; approval: ApprovalPolicy['kind']; anonymize?: boolean }
> = {
  'builder-critic': { communication: 'direct-feedback', approval: 'all-mandatory' },
  'specialist-team': { communication: 'orchestrator-controlled', approval: 'all-mandatory' },
  'sequential-gates': { communication: 'orchestrator-controlled', approval: 'sequential-signoff' },
  'red-team': { communication: 'blind-independent', approval: 'all-mandatory', anonymize: true },
  'consensus-council': { communication: 'isolated-voting', approval: 'majority', anonymize: true },
  hybrid: { communication: 'orchestrator-controlled', approval: 'hybrid' },
  custom: { communication: 'orchestrator-controlled', approval: 'all-mandatory' },
};

/**
 * Replaces the agent roster, derived edges and approval defaults with the
 * template for `kind`. User-defined edges are preserved when the agents they
 * reference still exist.
 */
export function applyTopology(config: GauntletConfig, kind: TopologyKind): GauntletConfig {
  const agents = ROSTERS[kind].map((spec) =>
    createAgent(spec.roleType, { name: spec.name ?? roleById(spec.roleType).label, ...spec.overrides }),
  );

  const defaults = TOPOLOGY_DEFAULTS[kind];
  const edges = deriveEdges(agents, kind);

  const mediator = agents.find((a) => a.roleType === 'mediator');
  const lead = agents.find((a) => a.roleType === 'lead-orchestrator');
  const gates = agents
    .filter((a) => a.gateOrder !== undefined)
    .sort((a, b) => (a.gateOrder ?? 0) - (b.gateOrder ?? 0));

  return {
    ...config,
    topology: kind,
    agents,
    communication: {
      ...config.communication,
      globalMode: defaults.communication,
      overrides: {},
      edges,
      anonymizeBuilder: defaults.anonymize ?? config.communication.anonymizeBuilder,
      mediatorId: mediator?.id,
    },
    approval: {
      ...config.approval,
      kind: defaults.approval,
      weights: {},
      signoffOrder: gates.map((g) => g.id),
      deciderId: lead?.id,
      hybridGateIds: gates.map((g) => g.id),
    },
  };
}

/**
 * Builds the communication edges implied by a topology. These are marked
 * `userDefined: false` so they can be recomputed whenever the roster changes.
 */
export function deriveEdges(agents: Agent[], kind: TopologyKind): CommunicationEdge[] {
  const active = agents.filter((a) => a.enabled);
  const lead = active.find((a) => a.roleType === 'lead-orchestrator');
  const planner = active.find((a) => a.roleType === 'planner');
  const builders = active.filter((a) => roleById(a.roleType).family === 'production');
  const reviewers = active.filter(
    (a) => isReviewRole(a.roleType) && a.roleType !== 'integration-owner',
  );
  const integrator = active.find((a) => a.roleType === 'integration-owner');
  const human = active.find((a) => a.roleType === 'human-approver');
  const mediator = active.find((a) => a.roleType === 'mediator');

  const edges: CommunicationEdge[] = [];

  if (lead && planner) edges.push(createEdge(lead.id, planner.id, 'assigns', 'Goal and constraints'));
  if (planner) builders.forEach((b) => edges.push(createEdge(planner.id, b.id, 'assigns', 'Plan and boundaries')));
  else if (lead) builders.forEach((b) => edges.push(createEdge(lead.id, b.id, 'assigns', 'Assignment and boundaries')));

  // Builders submit to whoever owns assembly, or straight to reviewers.
  const submitTarget = integrator ?? lead;
  builders.forEach((b) => {
    if (submitTarget && submitTarget.id !== b.id) {
      edges.push(createEdge(b.id, submitTarget.id, 'submits', 'Artifact and evidence'));
    }
    if (!submitTarget) {
      reviewers.forEach((r) => edges.push(createEdge(b.id, r.id, 'submits', 'Artifact and evidence')));
    }
  });

  // Reviewers inspect the artifact and return verdicts.
  reviewers.forEach((r) => {
    const source = integrator ?? builders[0];
    if (source) edges.push(createEdge(source.id, r.id, 'submits', 'Artifact for review'));

    if (kind === 'builder-critic' && builders[0]) {
      edges.push(createEdge(r.id, builders[0].id, 'reviews', 'Structured findings'));
    } else if (lead) {
      edges.push(createEdge(r.id, lead.id, 'reports-to', 'Verdict and findings'));
    } else if (builders[0]) {
      edges.push(createEdge(r.id, builders[0].id, 'reviews', 'Structured findings'));
    }
  });

  if (integrator) {
    if (lead) edges.push(createEdge(integrator.id, lead.id, 'reports-to', 'Integration verdict'));
    reviewers.forEach((r) => edges.push(createEdge(r.id, integrator.id, 'reports-to', 'Findings for integration')));
  }

  if (kind === 'specialist-team' || kind === 'hybrid') {
    // Cross-review ring between specialists, so each output is seen by a peer.
    const specialists = active.filter((a) => a.roleType === 'specialist-builder');
    specialists.forEach((s, i) => {
      const peer = specialists[(i + 1) % specialists.length];
      if (peer && peer.id !== s.id) {
        edges.push(createEdge(s.id, peer.id, 'discusses', 'Interface contract check'));
      }
    });
  }

  if (mediator) {
    reviewers.forEach((r) => edges.push(createEdge(r.id, mediator.id, 'escalates', 'Disputed finding')));
    builders.forEach((b) => edges.push(createEdge(b.id, mediator.id, 'escalates', 'Disputed finding')));
  }

  if (human) {
    const reporter = lead ?? integrator ?? builders[0];
    if (reporter) edges.push(createEdge(reporter.id, human.id, 'approves', 'Result, evidence, open items'));
  }

  return edges;
}

/**
 * Recomputes derived edges after the roster changes while keeping any edge the
 * user added by hand, provided both of its endpoints still exist.
 */
export function refreshEdges(config: GauntletConfig): GauntletConfig {
  const ids = new Set(config.agents.map((a) => a.id));
  const userEdges = config.communication.edges.filter(
    (e) => e.userDefined && ids.has(e.from) && ids.has(e.to),
  );
  return {
    ...config,
    communication: {
      ...config.communication,
      edges: [...deriveEdges(config.agents, config.topology), ...userEdges],
    },
  };
}
