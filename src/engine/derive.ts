/**
 * Derived view of a Gauntlet config.
 *
 * The generators all need the same computed facts — who builds, who reviews,
 * which reviewers can actually block completion, whether the environment can
 * run real sub-agents. Computing them once here keeps the individual
 * generators focused on wording rather than on re-deriving structure.
 */

import {
  environmentById,
  isReviewRole,
  roleById,
  structurePresetByKind,
} from '../model/catalog';
import type {
  Agent,
  CommunicationMode,
  EnvironmentCapability,
  GauntletConfig,
  QualityCriterion,
} from '../model/types';

export interface DerivedContext {
  config: GauntletConfig;
  /** Enabled agents only, in roster order. */
  active: Agent[];
  lead?: Agent;
  planner?: Agent;
  builders: Agent[];
  specialists: Agent[];
  reviewers: Agent[];
  integrator?: Agent;
  mediator?: Agent;
  human?: Agent;
  /** Reviewers whose approval is required by the current approval policy. */
  blockingReviewers: Agent[];
  /** Reviewers ordered for sequential sign-off, when that policy is active. */
  orderedGates: Agent[];
  capability: EnvironmentCapability;
  environmentLabel: string;
  /** How to address the target model in the prompt. */
  addressAs: string;
  mandatoryCriteria: QualityCriterion[];
  optionalCriteria: QualityCriterion[];
  /** True when the topology involves more than a single builder. */
  isMultiBuilder: boolean;
  /** Structure preset metadata for the chosen topology. */
  structureName: string;
  /** Effective communication mode for a given agent. */
  modeFor: (agentId: string) => CommunicationMode;
  /** Agent lookup by id. */
  byId: (id: string) => Agent | undefined;
  /** Display name, honouring anonymisation for blind review. */
  displayName: (agent: Agent) => string;
  /** True when at least one budget bounds the loop. */
  hasBudget: boolean;
}

export function derive(config: GauntletConfig): DerivedContext {
  const active = config.agents.filter((a) => a.enabled);
  const byId = (id: string) => config.agents.find((a) => a.id === id);

  const lead = active.find((a) => a.roleType === 'lead-orchestrator');
  const planner = active.find((a) => a.roleType === 'planner');
  const integrator = active.find((a) => a.roleType === 'integration-owner');
  const mediator = active.find((a) => a.roleType === 'mediator');
  const human = active.find((a) => a.roleType === 'human-approver');

  const builders = active.filter((a) => roleById(a.roleType).family === 'production');
  const specialists = active.filter((a) => a.roleType === 'specialist-builder');
  const reviewers = active.filter(
    (a) => isReviewRole(a.roleType) && a.roleType !== 'integration-owner',
  );

  const env = environmentById(config.intent.environment);
  const capability = config.intent.capabilityOverride ?? env.capability;

  const allReviewers = integrator ? [...reviewers, integrator] : reviewers;
  const blockingReviewers = computeBlockingReviewers(config, allReviewers);

  const orderedGates = config.approval.signoffOrder
    .map((id) => byId(id))
    .filter((a): a is Agent => Boolean(a) && a!.enabled);

  const mandatoryCriteria = config.quality.criteria.filter((c) => c.severity === 'mandatory');
  const optionalCriteria = config.quality.criteria.filter((c) => c.severity !== 'mandatory');

  const stop = config.stop;
  const hasBudget =
    stop.maxTotalRounds > 0 ||
    stop.maxTokens > 0 ||
    stop.maxCostUsd > 0 ||
    stop.maxWallClockMinutes > 0;

  const modeFor = (agentId: string): CommunicationMode =>
    config.communication.overrides[agentId] ?? config.communication.globalMode;

  const anonymise = config.communication.anonymizeBuilder;
  const displayName = (agent: Agent): string => {
    const producing = roleById(agent.roleType).family === 'production';
    return anonymise && producing ? 'the author (identity withheld)' : agent.name;
  };

  return {
    config,
    active,
    lead,
    planner,
    builders,
    specialists,
    reviewers,
    integrator,
    mediator,
    human,
    blockingReviewers,
    orderedGates,
    capability,
    environmentLabel:
      config.intent.environment === 'custom' && config.intent.customEnvironment.trim()
        ? config.intent.customEnvironment.trim()
        : env.label,
    addressAs:
      config.intent.environment === 'custom' && config.intent.customEnvironment.trim()
        ? 'the agent'
        : env.addressAs,
    mandatoryCriteria,
    optionalCriteria,
    isMultiBuilder: builders.length > 1,
    structureName: structurePresetByKind(config.topology).name,
    modeFor,
    byId,
    displayName,
    hasBudget,
  };
}

/**
 * Which reviewers can actually prevent completion under the chosen policy.
 * This is the set the generated prompt must never claim approval from without
 * a real verdict, so it is computed once and reused everywhere.
 */
function computeBlockingReviewers(config: GauntletConfig, reviewers: Agent[]): Agent[] {
  switch (config.approval.kind) {
    case 'unanimous':
      return reviewers;
    case 'sequential-signoff':
      return config.approval.signoffOrder
        .map((id) => reviewers.find((r) => r.id === id))
        .filter((r): r is Agent => Boolean(r));
    case 'hybrid':
      return reviewers.filter(
        (r) => r.mandatoryApproval || config.approval.hybridGateIds.includes(r.id),
      );
    case 'majority':
    case 'supermajority':
    case 'weighted-consensus':
      // No single reviewer blocks, but mandatory ones still must be satisfied
      // when the user explicitly marked them so.
      return reviewers.filter((r) => r.mandatoryApproval);
    case 'lead-decides':
      // The lead may override, except on gates the policy forbids overriding.
      return reviewers.filter(
        (r) =>
          r.mandatoryApproval &&
          (r.roleType === 'security-reviewer' || r.roleType === 'adversarial-reviewer'),
      );
    case 'human-final':
    case 'all-mandatory':
    default:
      return reviewers.filter((r) => r.mandatoryApproval);
  }
}

/** Number of enabled reviewers eligible to vote. */
export function eligibleVoterCount(ctx: DerivedContext): number {
  const base = ctx.reviewers.length + (ctx.integrator ? 1 : 0);
  return base;
}

/**
 * Plain-language statement of exactly what must be true for the run to be
 * considered complete. Used in the master prompt, the summary and the review
 * step, so the user reads the same sentence everywhere.
 */
export function completionSentence(ctx: DerivedContext): string {
  const { config } = ctx;
  const names = ctx.blockingReviewers.map((r) => r.name);
  const total = eligibleVoterCount(ctx);

  switch (config.approval.kind) {
    case 'unanimous':
      return `all ${total} active reviewers return an approve verdict`;
    case 'majority':
      return `more than half of the ${total} eligible reviewers approve${
        names.length ? `, and ${names.join(', ')} must be among them` : ''
      }`;
    case 'supermajority':
      return `at least ${config.approval.supermajorityPercent}% of the ${total} eligible reviewers approve`;
    case 'weighted-consensus':
      return `approving reviewers account for at least ${Math.round(
        config.approval.weightedThreshold * 100,
      )}% of the total vote weight`;
    case 'sequential-signoff':
      return names.length
        ? `each reviewer approves in order: ${names.join(' → ')}`
        : 'each reviewer approves in the configured order';
    case 'lead-decides':
      return 'the lead agent determines the work is complete after reading every reviewer verdict';
    case 'human-final':
      return 'a human reviews the result and explicitly approves it';
    case 'hybrid': {
      const gates = config.approval.hybridGateIds
        .map((id) => ctx.byId(id)?.name)
        .filter(Boolean) as string[];
      const stage =
        config.approval.hybridFinalStage === 'human'
          ? 'a human gives final approval'
          : config.approval.hybridFinalStage === 'consensus'
            ? 'the reviewers reach consensus'
            : 'the lead agent makes the final call';
      return gates.length
        ? `every gate passes (${gates.join(', ')}) and then ${stage}`
        : `every configured gate passes and then ${stage}`;
    }
    case 'all-mandatory':
    default:
      return names.length
        ? `every mandatory reviewer approves: ${names.join(', ')}`
        : 'every mandatory reviewer approves';
  }
}
