/**
 * Gauntlet Builder — core data model.
 *
 * Everything the app knows about a Gauntlet lives in `GauntletConfig`. The
 * prompt engine, the validation engine and every export format consume this
 * one object, so it is deliberately explicit: no `any`, no loose records, and
 * stable IDs on anything that can be referenced from somewhere else.
 */

/** Bumped whenever the shape of `GauntletConfig` changes in a breaking way. */
export const SCHEMA_VERSION = 3;

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export type ID = string;

/** ISO-8601 timestamp. */
export type Timestamp = string;

export type TargetEnvironment =
  | 'claude-code'
  | 'openai-codex'
  | 'general-coding-agent'
  | 'research-agent'
  | 'general-llm'
  | 'custom';

/** How much orchestration machinery the environment can actually run. */
export type EnvironmentCapability = 'real-subagents' | 'sequential-simulation';

export type ComplexityBand = 'light' | 'moderate' | 'heavy' | 'very-heavy';

/* ------------------------------------------------------------------ *
 * Step 1 — Intent
 * ------------------------------------------------------------------ */

export interface Intent {
  /** Short human name, also used as the default save name. */
  projectName: string;
  /** What the user wants accomplished, in their own words. */
  goal: string;
  /** The concrete thing that must exist when the work is done. */
  deliverable: string;
  /** Who the deliverable is for. */
  audience: string;
  /** Background the agents need but could not infer. */
  context: string;
  /** Reference material, links, prior art, examples to match. */
  references: string;
  /** Hard requirements that must hold. Free text, one per entry. */
  requirements: string[];
  /** Things agents must never do. */
  prohibitions: string[];
  /** Tools available in the target environment. */
  tools: string[];
  environment: TargetEnvironment;
  /** Free text used when `environment === 'custom'`. */
  customEnvironment: string;
  /** Overrides the capability implied by `environment` when set. */
  capabilityOverride?: EnvironmentCapability;
}

/* ------------------------------------------------------------------ *
 * Step 2 — Quality bar
 * ------------------------------------------------------------------ */

export type EvidenceKind =
  | 'automated-tests'
  | 'visual-screenshots'
  | 'reference-comparison'
  | 'human-review'
  | 'source-verification'
  | 'security-review'
  | 'performance'
  | 'accessibility'
  | 'browser-testing'
  | 'log-inspection'
  | 'static-analysis'
  | 'factual-accuracy'
  | 'custom-evidence';

/**
 * Configuration attached to a selected evidence type. Every field is optional
 * because each evidence kind reveals only the subset that applies to it; the
 * catalog declares which fields a kind uses.
 */
export interface EvidenceConfig {
  /** Minimum percentage of automated tests that must pass. */
  minPassRate?: number;
  /** Test command the agent should run, e.g. `npm test`. */
  testCommand?: string;
  /** Coverage floor, percent. */
  minCoverage?: number;
  /** Viewport widths in CSS pixels that must be captured/tested. */
  viewports?: number[];
  /** Named flows that must be exercised in a real browser. */
  requiredFlows?: string[];
  /** What the artifact is compared against. */
  referenceDescription?: string;
  /** 0–100; how closely the artifact must match the reference. */
  visualSimilarityThreshold?: number;
  /** Percentage of claims that must carry a citation. */
  citationCoverage?: number;
  /** Named checks, e.g. `OWASP Top 10`, `dependency audit`. */
  requiredChecks?: string[];
  /** Milliseconds. */
  maxLatencyMs?: number;
  /** Other performance ceilings, e.g. bundle size. */
  performanceBudgets?: string[];
  /** e.g. `WCAG 2.2 AA`. */
  accessibilityStandard?: string;
  /** Lint/typecheck commands that must be clean. */
  analysisCommands?: string[];
  /** What a human must personally look at. */
  humanReviewFocus?: string;
  /** Anything the catalog does not model. */
  notes?: string;
}

export type CriterionSeverity = 'mandatory' | 'important' | 'desirable';

/**
 * One inspectable line of the quality bar. A criterion is only meaningful if
 * `verification` says how a reviewer would actually check it, which is what
 * keeps the generated prompt away from "make it good".
 */
export interface QualityCriterion {
  id: ID;
  /** Short label, e.g. `Authorization`. */
  label: string;
  /** What "passing" concretely means. */
  statement: string;
  /** How a reviewer proves it, in observable terms. */
  verification: string;
  severity: CriterionSeverity;
  /** Evidence kinds that support this criterion. */
  evidence: EvidenceKind[];
  /** Relative weight when scoring, 1–5. */
  weight: number;
  /** Set when the criterion was derived from a subjective goal. */
  derivedFromSubjective?: string;
}

export interface QualityBar {
  /** Selected evidence kinds, in catalog order. */
  evidence: EvidenceKind[];
  /** Per-kind configuration, keyed by evidence kind. */
  evidenceConfig: Partial<Record<EvidenceKind, EvidenceConfig>>;
  criteria: QualityCriterion[];
  /** Subjective goals the user wants honoured, before conversion. */
  subjectiveGoals: string[];
  /** Minimum weighted rubric score, 0–1, required to pass. */
  passingScore: number;
}

/* ------------------------------------------------------------------ *
 * Step 3 — Topology
 * ------------------------------------------------------------------ */

export type TopologyKind =
  | 'builder-critic'
  | 'specialist-team'
  | 'sequential-gates'
  | 'red-team'
  | 'consensus-council'
  | 'hybrid'
  | 'custom';

/* ------------------------------------------------------------------ *
 * Step 4 — Agents
 * ------------------------------------------------------------------ */

export type AgentRoleType =
  | 'lead-orchestrator'
  | 'planner'
  | 'builder'
  | 'specialist-builder'
  | 'critic'
  | 'visual-critic'
  | 'functional-tester'
  | 'security-reviewer'
  | 'research-verifier'
  | 'citation-auditor'
  | 'adversarial-reviewer'
  | 'integration-owner'
  | 'mediator'
  | 'human-approver'
  | 'custom-role';

/** Broad behavioural family, derived from role type via the catalog. */
export type RoleFamily = 'orchestration' | 'production' | 'review' | 'human';

export type ModelPreference =
  | 'most-capable'
  | 'balanced'
  | 'fast'
  | 'inherit'
  | 'custom';

export type CriticStrictness =
  | 'helpful'
  | 'strict-professional'
  | 'adversarial'
  | 'extremely-demanding'
  | 'reference-blind-judge';

export type CriticBehavior =
  | 'require-evidence'
  | 'largest-defect'
  | 'score-rubric'
  | 'root-cause'
  | 'regression-risk'
  | 'suggest-tests-only'
  | 'recommend-implementation'
  | 'compare-reference'
  | 'blind-ab'
  | 'reverse-ab'
  | 'seek-disconfirming'
  | 'reject-unsupported'
  | 'ignore-builder-explanations'
  | 'final-artifact-only';

/** What an agent is allowed to touch. */
export interface PermissionScope {
  /** Paths/areas the agent may create or modify. */
  write: string[];
  /** Paths/areas the agent may read but never change. */
  readOnly: string[];
  /** Paths/areas the agent must not open at all. */
  forbidden: string[];
}

export interface Agent {
  id: ID;
  name: string;
  roleType: AgentRoleType;
  enabled: boolean;
  /** One-sentence description of what this agent is accountable for. */
  responsibility: string;
  /** Domain knowledge the agent should bring. */
  expertise: string;
  /** What it is handed at the start of its turn. */
  inputs: string[];
  /** What it must hand back. */
  outputs: string[];
  tools: string[];
  permissions: PermissionScope;
  /** May message other agents directly rather than via the orchestrator. */
  canMessagePeers: boolean;
  /** Its approval is required before the Gauntlet can complete. */
  mandatoryApproval: boolean;
  /** Sees the reasoning/transcripts of agents that ran before it. */
  seesPriorReasoning: boolean;
  /** Starts from a clean context rather than the running conversation. */
  freshContext: boolean;
  model: ModelPreference;
  /** Free text used when `model === 'custom'`. */
  customModel?: string;
  /** 1–10; higher wins ties and carries more weight in weighted consensus. */
  authority: number;
  /** Cap on how many times this agent may re-run. */
  maxRounds: number;
  /** Review-family only. */
  strictness?: CriticStrictness;
  /** Review-family only. */
  behaviors?: CriticBehavior[];
  /** Criteria this agent owns. Empty means "all criteria". */
  ownedCriteria: ID[];
  /** Ordering hint for sequential gate topologies. */
  gateOrder?: number;
  /** Free-form extra instructions appended to this agent's prompt. */
  notes?: string;
}

/* ------------------------------------------------------------------ *
 * Step 5 — Communication
 * ------------------------------------------------------------------ */

export type CommunicationMode =
  | 'direct-feedback'
  | 'orchestrator-controlled'
  | 'bidirectional'
  | 'blind-independent'
  | 'cross-review'
  | 'mediated-disagreement'
  | 'council-discussion'
  | 'isolated-voting';

export type EdgeKind =
  | 'assigns'
  | 'submits'
  | 'reviews'
  | 'reports-to'
  | 'discusses'
  | 'escalates'
  | 'approves';

/** A directed communication relationship between two agents. */
export interface CommunicationEdge {
  id: ID;
  from: ID;
  to: ID;
  kind: EdgeKind;
  /** What travels along this edge, e.g. `structured findings`. */
  payload: string;
  /** Derived edges are recomputed from the topology; user edges are kept. */
  userDefined: boolean;
}

export interface CommunicationPolicy {
  /** Applies to every agent that does not override it. */
  globalMode: CommunicationMode;
  /** Per-agent overrides, keyed by agent id. */
  overrides: Record<ID, CommunicationMode>;
  edges: CommunicationEdge[];
  /** Critics never see who produced the artifact. */
  anonymizeBuilder: boolean;
  /** Findings must use the structured critic schema. */
  structuredFindingsOnly: boolean;
  /** Agents may ask the orchestrator clarifying questions. */
  allowClarifyingQuestions: boolean;
  /** Agent id of the mediator used by `mediated-disagreement`. */
  mediatorId?: ID;
}

/* ------------------------------------------------------------------ *
 * Step 6 — Approval
 * ------------------------------------------------------------------ */

export type ApprovalPolicyKind =
  | 'all-mandatory'
  | 'unanimous'
  | 'majority'
  | 'supermajority'
  | 'weighted-consensus'
  | 'sequential-signoff'
  | 'lead-decides'
  | 'human-final'
  | 'hybrid';

export interface ApprovalPolicy {
  kind: ApprovalPolicyKind;
  /** Percentage required by `supermajority`, 50–100. */
  supermajorityPercent: number;
  /** Vote weights by agent id, used by `weighted-consensus`. */
  weights: Record<ID, number>;
  /** Minimum total weight fraction required to pass, 0–1. */
  weightedThreshold: number;
  /** Agent ids in required sign-off order, used by `sequential-signoff`. */
  signoffOrder: ID[];
  /** Agent id whose call is final under `lead-decides`. */
  deciderId?: ID;
  /** Whether a human must confirm the very last step. */
  requiresHumanFinal: boolean;
  /** Under `hybrid`: gates that must pass before the consensus stage. */
  hybridGateIds: ID[];
  /** Under `hybrid`: what resolves the final call after the gates. */
  hybridFinalStage: 'consensus' | 'human' | 'lead';
  /** A reviewer may block completion on its own. */
  allowVeto: boolean;
  /** Rounds a blocking veto survives before escalation. */
  vetoEscalatesAfter: number;
}

/** One reviewer's decision on one round — used in the ledger schema. */
export type VoteVerdict = 'approve' | 'approve-with-conditions' | 'fail' | 'abstain';

/* ------------------------------------------------------------------ *
 * Step 7 — Revision & stopping
 * ------------------------------------------------------------------ */

export type RevisionStrategy =
  | 'highest-impact-first'
  | 'fix-all'
  | 'group-related'
  | 'orchestrator-prioritizes';

export interface RevisionPolicy {
  strategy: RevisionStrategy;
  requirePlanBeforeRevision: boolean;
  requireEvidenceAfterRevision: boolean;
  requireRegressionTests: boolean;
  autoRollbackRegressions: boolean;
  preserveApprovedComponents: boolean;
  lockAfterApproval: boolean;
  reopenOnIntegrationRegression: boolean;
}

/**
 * Every budget that can end a run. `0` consistently means "no limit", which
 * the validation engine flags when nothing else bounds the loop.
 */
export interface StopPolicy {
  maxTotalRounds: number;
  maxRoundsPerAgent: number;
  maxConsecutiveFailures: number;
  /** Same defect reappearing this many times triggers escalation. */
  maxRepeatedDefects: number;
  /** Rounds with score improvement below `plateauDelta` before stopping. */
  plateauRounds: number;
  /** Minimum score improvement that counts as progress, 0–1. */
  plateauDelta: number;
  maxTokens: number;
  maxCostUsd: number;
  maxWallClockMinutes: number;
  /** Statuses the run may end with when the bar was not met. */
  allowedFailureStatuses: FailureStatus[];
}

export type FailureStatus =
  | 'blocked'
  | 'incomplete'
  | 'requires-human-decision'
  | 'requirements-conflict'
  | 'budget-exhausted'
  | 'unable-to-verify';

export type CheckpointTrigger =
  | 'before-start'
  | 'after-plan'
  | 'after-first-build'
  | 'each-round'
  | 'before-destructive-action'
  | 'on-disagreement'
  | 'on-budget-threshold'
  | 'before-completion'
  | 'custom';

export interface HumanCheckpoint {
  id: ID;
  trigger: CheckpointTrigger;
  label: string;
  /** What the human is being asked to decide. */
  question: string;
  /** Run halts until answered, versus advisory notification. */
  blocking: boolean;
}

/* ------------------------------------------------------------------ *
 * Ledger
 * ------------------------------------------------------------------ */

export type LedgerField =
  | 'round'
  | 'agent'
  | 'action'
  | 'artifact-changed'
  | 'evidence'
  | 'previous-score'
  | 'new-score'
  | 'defects-fixed'
  | 'new-defects'
  | 'regressions'
  | 'reviewer-decisions'
  | 'unresolved-blockers'
  | 'estimated-cost'
  | 'next-action';

export interface LedgerConfig {
  enabled: boolean;
  fields: LedgerField[];
  format: 'markdown-table' | 'json-lines' | 'yaml-blocks';
}

/* ------------------------------------------------------------------ *
 * The whole thing
 * ------------------------------------------------------------------ */

export interface GauntletMeta {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /** Preset the gauntlet started from, for display only. */
  basePresetId?: string;
  /** Free tags used by search/filter on the Saved view. */
  tags: string[];
  /** True for the seeded examples, so they can be visually distinguished. */
  isSample?: boolean;
}

export interface GauntletConfig {
  schemaVersion: number;
  meta: GauntletMeta;
  intent: Intent;
  quality: QualityBar;
  topology: TopologyKind;
  agents: Agent[];
  communication: CommunicationPolicy;
  approval: ApprovalPolicy;
  revision: RevisionPolicy;
  stop: StopPolicy;
  checkpoints: HumanCheckpoint[];
  ledger: LedgerConfig;
  /** Extra instructions appended verbatim to the master prompt. */
  additionalInstructions: string;
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export type WarningSeverity = 'info' | 'recommendation' | 'warning' | 'blocking';

export interface ValidationWarning {
  /** Stable rule identifier, e.g. `no-critic`. */
  code: string;
  severity: WarningSeverity;
  title: string;
  /** What is wrong, in plain language. */
  problem: string;
  /** What the user should do about it. */
  suggestion: string;
  /** Wizard step the user should return to, 1-indexed. */
  step?: number;
  /** Agents/criteria implicated, for highlighting. */
  relatedIds?: ID[];
}

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

export interface StructurePreset {
  kind: TopologyKind;
  name: string;
  tagline: string;
  description: string;
  bestFor: string[];
  advantages: string[];
  risks: string[];
  agentCountLabel: string;
  complexity: ComplexityBand;
  costLabel: string;
  approvalSummary: string;
  flowSummary: string;
}

export interface ProjectPreset {
  id: string;
  name: string;
  category: string;
  summary: string;
  /** Applied on top of a fresh gauntlet. */
  apply: (base: GauntletConfig) => GauntletConfig;
}

/* ------------------------------------------------------------------ *
 * Exports
 * ------------------------------------------------------------------ */

export type ExportFormat = 'markdown' | 'json' | 'yaml' | 'text';

export type OutputTabId =
  | 'master-prompt'
  | 'agent-instructions'
  | 'rubric'
  | 'workflow-json'
  | 'workflow-yaml'
  | 'summary'
  | 'checklist';

export interface GeneratedOutput {
  id: OutputTabId;
  label: string;
  /** Short explanation of what this output is for. */
  description: string;
  format: ExportFormat;
  content: string;
  /** Suggested download filename, without a directory. */
  filename: string;
}

export interface GeneratedPackage {
  outputs: GeneratedOutput[];
  /** Rough token estimate for the master prompt. */
  masterPromptTokens: number;
  generatedAt: Timestamp;
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

export interface StoredGauntlet {
  config: GauntletConfig;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  /** Wizard defaults to advanced mode. */
  advancedByDefault: boolean;
  defaultEnvironment: TargetEnvironment;
  /** Include the progress ledger in generated prompts by default. */
  ledgerByDefault: boolean;
  /** Show the sample gauntlets on the dashboard. */
  showSamples: boolean;
  /** Autosave wizard progress to local storage. */
  autosave: boolean;
  /** Density of the interface. */
  density: 'comfortable' | 'compact';
}

/** Envelope written to local storage, versioned for migration. */
export interface PersistedState {
  schemaVersion: number;
  gauntlets: GauntletConfig[];
  settings: AppSettings;
  /** Gauntlet currently open in the wizard/editor, if any. */
  draftId?: ID;
  /** Set once the samples have been seeded so they are not re-added. */
  samplesSeeded?: boolean;
}
