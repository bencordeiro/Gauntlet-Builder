/**
 * Machine-readable workflow configuration.
 *
 * This is the export a future orchestration runner would consume, so it is
 * shaped for machines rather than mirroring the UI state: enums are resolved to
 * explicit values, derived facts (who blocks completion, what the completion
 * condition is) are materialised, and disabled agents are dropped.
 */

import {
  approvalById,
  communicationById,
  evidenceById,
  isReviewRole,
  roleById,
  strictnessById,
  structurePresetByKind,
} from '../model/catalog';
import type { GauntletConfig } from '../model/types';
import { SCHEMA_VERSION } from '../model/types';
import { completionSentence, derive, eligibleVoterCount } from './derive';
import { toYaml } from './yaml';

/** The normalised, machine-facing representation. */
export interface WorkflowDocument {
  schema: string;
  schemaVersion: number;
  generatedBy: string;
  project: Record<string, unknown>;
  quality: Record<string, unknown>;
  workflow: Record<string, unknown>;
  agents: Array<Record<string, unknown>>;
  communication: Record<string, unknown>;
  approval: Record<string, unknown>;
  revision: Record<string, unknown>;
  stopping: Record<string, unknown>;
  humanCheckpoints: Array<Record<string, unknown>>;
  ledger: Record<string, unknown>;
}

export function buildWorkflowDocument(config: GauntletConfig): WorkflowDocument {
  const ctx = derive(config);
  const structure = structurePresetByKind(config.topology);

  return {
    schema: 'gauntlet-builder/workflow',
    schemaVersion: SCHEMA_VERSION,
    generatedBy: 'Gauntlet Builder',

    project: {
      name: config.intent.projectName,
      goal: config.intent.goal,
      deliverable: config.intent.deliverable,
      audience: config.intent.audience,
      context: config.intent.context,
      references: config.intent.references,
      requirements: config.intent.requirements,
      prohibitions: config.intent.prohibitions,
      tools: config.intent.tools,
      environment: config.intent.environment,
      customEnvironment: config.intent.customEnvironment || undefined,
      environmentCapability: ctx.capability,
    },

    quality: {
      passingScore: config.quality.passingScore,
      subjectiveGoals: config.quality.subjectiveGoals,
      evidence: config.quality.evidence.map((kind) => ({
        kind,
        label: evidenceById(kind).label,
        requirement: evidenceById(kind).promptClause,
        config: config.quality.evidenceConfig[kind] ?? {},
      })),
      criteria: config.quality.criteria.map((c) => ({
        id: c.id,
        label: c.label,
        statement: c.statement,
        verification: c.verification,
        severity: c.severity,
        weight: c.weight,
        evidence: c.evidence,
        derivedFromSubjective: c.derivedFromSubjective,
        owners: ctx.active.filter((a) => a.ownedCriteria.includes(c.id)).map((a) => a.id),
      })),
    },

    workflow: {
      topology: config.topology,
      topologyName: structure.name,
      flow: structure.flowSummary,
      completionCondition: completionSentence(ctx),
      agentCount: ctx.active.length,
      builderCount: ctx.builders.length,
      reviewerCount: ctx.reviewers.length,
      hasIntegrationOwner: Boolean(ctx.integrator),
    },

    agents: ctx.active.map((a) => ({
      id: a.id,
      name: a.name,
      roleType: a.roleType,
      roleFamily: roleById(a.roleType).family,
      responsibility: a.responsibility,
      expertise: a.expertise || undefined,
      inputs: a.inputs,
      outputs: a.outputs,
      tools: a.tools,
      permissions: {
        write: a.permissions.write,
        readOnly: a.permissions.readOnly,
        forbidden: a.permissions.forbidden,
      },
      communicationMode: ctx.modeFor(a.id),
      canMessagePeers: a.canMessagePeers,
      mandatoryApproval: a.mandatoryApproval,
      blocksCompletion: ctx.blockingReviewers.some((r) => r.id === a.id),
      seesPriorReasoning: a.seesPriorReasoning,
      freshContext: a.freshContext,
      model: a.model === 'custom' ? a.customModel || 'custom' : a.model,
      authority: a.authority,
      maxRounds: a.maxRounds,
      ownedCriteria: a.ownedCriteria,
      gateOrder: a.gateOrder,
      review: isReviewRole(a.roleType)
        ? {
            strictness: a.strictness ?? 'strict-professional',
            strictnessLabel: strictnessById(a.strictness ?? 'strict-professional').label,
            behaviors: a.behaviors ?? [],
          }
        : undefined,
      notes: a.notes || undefined,
    })),

    communication: {
      globalMode: config.communication.globalMode,
      globalModeLabel: communicationById(config.communication.globalMode).label,
      rule: communicationById(config.communication.globalMode).promptRule,
      overrides: Object.entries(config.communication.overrides)
        .filter(([id]) => ctx.byId(id)?.enabled)
        .map(([agentId, mode]) => ({ agentId, mode })),
      anonymizeBuilder: config.communication.anonymizeBuilder,
      structuredFindingsOnly: config.communication.structuredFindingsOnly,
      allowClarifyingQuestions: config.communication.allowClarifyingQuestions,
      mediatorId: config.communication.mediatorId,
      edges: config.communication.edges
        .filter((e) => ctx.byId(e.from)?.enabled && ctx.byId(e.to)?.enabled)
        .map((e) => ({ id: e.id, from: e.from, to: e.to, kind: e.kind, payload: e.payload })),
    },

    approval: {
      policy: config.approval.kind,
      policyLabel: approvalById(config.approval.kind).label,
      rule: approvalById(config.approval.kind).promptRule,
      eligibleVoters: eligibleVoterCount(ctx),
      blockingReviewers: ctx.blockingReviewers.map((r) => ({ id: r.id, name: r.name })),
      supermajorityPercent:
        config.approval.kind === 'supermajority' ? config.approval.supermajorityPercent : undefined,
      weights: config.approval.kind === 'weighted-consensus' ? config.approval.weights : undefined,
      weightedThreshold:
        config.approval.kind === 'weighted-consensus' ? config.approval.weightedThreshold : undefined,
      signoffOrder: config.approval.kind === 'sequential-signoff' ? config.approval.signoffOrder : undefined,
      deciderId: config.approval.kind === 'lead-decides' ? config.approval.deciderId : undefined,
      hybrid:
        config.approval.kind === 'hybrid'
          ? { gateIds: config.approval.hybridGateIds, finalStage: config.approval.hybridFinalStage }
          : undefined,
      requiresHumanFinal: config.approval.requiresHumanFinal,
      allowVeto: config.approval.allowVeto,
      vetoEscalatesAfter: config.approval.vetoEscalatesAfter,
    },

    revision: {
      strategy: config.revision.strategy,
      requirePlanBeforeRevision: config.revision.requirePlanBeforeRevision,
      requireEvidenceAfterRevision: config.revision.requireEvidenceAfterRevision,
      requireRegressionTests: config.revision.requireRegressionTests,
      autoRollbackRegressions: config.revision.autoRollbackRegressions,
      preserveApprovedComponents: config.revision.preserveApprovedComponents,
      lockAfterApproval: config.revision.lockAfterApproval,
      reopenOnIntegrationRegression: config.revision.reopenOnIntegrationRegression,
    },

    stopping: {
      maxTotalRounds: config.stop.maxTotalRounds || null,
      maxRoundsPerAgent: config.stop.maxRoundsPerAgent || null,
      maxConsecutiveFailures: config.stop.maxConsecutiveFailures || null,
      maxRepeatedDefects: config.stop.maxRepeatedDefects || null,
      plateauRounds: config.stop.plateauRounds || null,
      plateauDelta: config.stop.plateauDelta,
      maxTokens: config.stop.maxTokens || null,
      maxCostUsd: config.stop.maxCostUsd || null,
      maxWallClockMinutes: config.stop.maxWallClockMinutes || null,
      allowedFailureStatuses: config.stop.allowedFailureStatuses,
      successRequiresApproval: true,
      limitReachedIsNotSuccess: true,
    },

    humanCheckpoints: config.checkpoints.map((c) => ({
      id: c.id,
      trigger: c.trigger,
      label: c.label,
      question: c.question,
      blocking: c.blocking,
    })),

    ledger: {
      enabled: config.ledger.enabled,
      format: config.ledger.format,
      fields: config.ledger.fields,
    },
  };
}

export function generateWorkflowJson(config: GauntletConfig): string {
  return `${JSON.stringify(buildWorkflowDocument(config), null, 2)}\n`;
}

export function generateWorkflowYaml(config: GauntletConfig): string {
  const doc = buildWorkflowDocument(config);
  // JSON round-trip strips `undefined` so YAML output stays clean.
  const clean = JSON.parse(JSON.stringify(doc));
  return toYaml(clean, `Gauntlet workflow — ${config.intent.projectName || 'Untitled'}`);
}
