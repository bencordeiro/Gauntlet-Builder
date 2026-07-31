/**
 * Validation engine.
 *
 * Each rule is a pure function returning zero or more warnings. Rules never
 * throw and never mutate the config, so the panel can run the whole set on
 * every keystroke. Every warning states the problem and a concrete correction —
 * a warning the user cannot act on is not worth showing.
 */

import { isReviewRole, roleById } from '../model/catalog';
import type { GauntletConfig, ValidationWarning } from '../model/types';
import { derive, eligibleVoterCount, type DerivedContext } from '../engine/derive';

type Rule = (ctx: DerivedContext) => ValidationWarning[];

const none: ValidationWarning[] = [];

/* ------------------------------------------------------------------ *
 * Step 1 — intent
 * ------------------------------------------------------------------ */

const missingGoal: Rule = (ctx) =>
  ctx.config.intent.goal.trim().length === 0
    ? [
        {
          code: 'missing-goal',
          severity: 'blocking',
          title: 'No goal described',
          problem: 'Nothing tells the agents what they are trying to achieve, so nothing can judge whether they achieved it.',
          suggestion: 'Describe in one or two sentences what you want accomplished.',
          step: 1,
        },
      ]
    : none;

const missingDeliverable: Rule = (ctx) =>
  ctx.config.intent.deliverable.trim().length === 0
    ? [
        {
          code: 'missing-deliverable',
          severity: 'blocking',
          title: 'No deliverable defined',
          problem: 'Without a concrete deliverable, agents can produce something plausible that is not what you wanted, and no reviewer can tell.',
          suggestion: 'Name the specific thing that must exist at the end — a working application, a report, a fixed test suite.',
          step: 1,
        },
      ]
    : none;

const vagueGoal: Rule = (ctx) => {
  const goal = ctx.config.intent.goal.toLowerCase();
  const vague = ['production-ready', 'high quality', 'professional', 'beautiful', 'perfect', 'excellent', 'polished', 'robust'];
  const found = vague.filter((word) => goal.includes(word));
  if (found.length === 0 || ctx.config.quality.criteria.length >= 3) return none;
  return [
    {
      code: 'vague-goal-adjectives',
      severity: 'recommendation',
      title: 'The goal leans on adjectives',
      problem: `"${found[0]}" means something different to every reviewer, so agents can satisfy it by asserting they did.`,
      suggestion: 'Add criteria in step 2 that say what that word means here in observable terms.',
      step: 2,
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Step 2 — quality bar
 * ------------------------------------------------------------------ */

const noCriteria: Rule = (ctx) =>
  ctx.config.quality.criteria.length === 0
    ? [
        {
          code: 'no-criteria',
          severity: 'blocking',
          title: 'No quality criteria',
          problem: 'Reviewers have nothing to judge against, so approval becomes a matter of opinion and the loop cannot end honestly.',
          suggestion: 'Add at least one criterion describing what "done" looks like and how a reviewer would check it.',
          step: 2,
        },
      ]
    : none;

const noObjectiveEvidence: Rule = (ctx) => {
  if (ctx.config.quality.evidence.length === 0 && ctx.config.quality.criteria.length > 0) {
    return [
      {
        code: 'no-evidence-types',
        severity: 'warning',
        title: 'No evidence types selected',
        problem: 'Criteria exist but nothing says how proof is gathered, so reviewers will judge from descriptions rather than from the artifact.',
        suggestion: 'Select at least one evidence type in step 2 — automated tests, screenshots, browser testing, or human review.',
        step: 2,
      },
    ];
  }
  const subjectiveOnly =
    ctx.config.quality.evidence.length > 0 &&
    ctx.config.quality.evidence.every((e) => e === 'human-review' || e === 'custom-evidence');
  if (subjectiveOnly) {
    return [
      {
        code: 'only-subjective-evidence',
        severity: 'recommendation',
        title: 'Completion depends only on subjective satisfaction',
        problem: 'The only evidence configured is human or free-form, so nothing objective can confirm the work independently.',
        suggestion: 'Add at least one mechanical check — tests, static analysis, or a measured performance number.',
        step: 2,
      },
    ];
  }
  return none;
};

const criteriaWithoutVerification: Rule = (ctx) => {
  const bad = ctx.config.quality.criteria.filter((c) => c.verification.trim().length === 0);
  if (bad.length === 0) return none;
  return [
    {
      code: 'criteria-without-verification',
      severity: 'warning',
      title: `${bad.length} criterion/criteria have no verification method`,
      problem: 'A criterion with no way to check it cannot be failed, so it will be marked as passing by default.',
      suggestion: 'For each, describe what a reviewer would actually do to confirm it.',
      step: 2,
      relatedIds: bad.map((c) => c.id),
    },
  ];
};

const noMandatoryCriteria: Rule = (ctx) =>
  ctx.config.quality.criteria.length > 0 && ctx.mandatoryCriteria.length === 0
    ? [
        {
          code: 'no-mandatory-criteria',
          severity: 'warning',
          title: 'No criterion is mandatory',
          problem: 'Every criterion is optional, so the work can pass while failing all of them if the weighted score happens to clear the bar.',
          suggestion: 'Mark the criteria that genuinely must hold as mandatory.',
          step: 2,
        },
      ]
    : none;

const referenceWithoutReference: Rule = (ctx) => {
  if (!ctx.config.quality.evidence.includes('reference-comparison')) return none;
  const cfg = ctx.config.quality.evidenceConfig['reference-comparison'];
  const hasRef = Boolean(cfg?.referenceDescription?.trim()) || Boolean(ctx.config.intent.references.trim());
  if (hasRef) return none;
  return [
    {
      code: 'reference-without-reference',
      severity: 'blocking',
      title: 'Reference comparison selected with no reference',
      problem: 'Reviewers are told to compare against an example, but no example has been supplied. They will invent one.',
      suggestion: 'Describe or link the reference in step 2, or remove reference comparison.',
      step: 2,
    },
  ];
};

const blindJudgeWithoutReference: Rule = (ctx) => {
  const judges = ctx.reviewers.filter((r) => r.strictness === 'reference-blind-judge');
  if (judges.length === 0) return none;
  const hasRef =
    Boolean(ctx.config.quality.evidenceConfig['reference-comparison']?.referenceDescription?.trim()) ||
    Boolean(ctx.config.intent.references.trim());
  if (hasRef) return none;
  return [
    {
      code: 'blind-judge-without-reference',
      severity: 'warning',
      title: 'Blind judge has nothing to compare against',
      problem: `${judges.map((j) => j.name).join(', ')} is set to judge against a reference, but no reference exists.`,
      suggestion: 'Supply a reference in step 1 or 2, or lower that reviewer’s strictness.',
      step: 8,
      relatedIds: judges.map((j) => j.id),
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Step 4 — roster
 * ------------------------------------------------------------------ */

const noBuilder: Rule = (ctx) =>
  ctx.builders.length === 0
    ? [
        {
          code: 'no-builder',
          severity: 'blocking',
          title: 'Nobody produces the work',
          problem: 'No agent has a building role, so the Gauntlet reviews something that never gets made.',
          suggestion: 'Add a builder or specialist builder in step 4.',
          step: 4,
        },
      ]
    : none;

const noCritic: Rule = (ctx) =>
  ctx.reviewers.length === 0 && !ctx.integrator && !ctx.human
    ? [
        {
          code: 'no-critic',
          severity: 'blocking',
          title: 'Nobody reviews the work',
          problem: 'Without an independent reviewer this is not a Gauntlet — the builder decides for itself when it is finished.',
          suggestion: 'Add a critic, or another reviewing role such as a functional tester or security reviewer.',
          step: 4,
        },
      ]
    : none;

const builderReviewsSelf: Rule = (ctx) => {
  const offenders = ctx.active.filter(
    (a) => roleById(a.roleType).family === 'production' && a.mandatoryApproval,
  );
  if (offenders.length === 0) return none;
  return [
    {
      code: 'builder-reviews-own-work',
      severity: 'warning',
      title: 'A building agent approves its own work',
      problem: `${offenders.map((o) => o.name).join(', ')} both produces work and holds approval authority over it. Self-approval is the failure mode this whole structure exists to prevent.`,
      suggestion: 'Turn off mandatory approval for that agent and let an independent reviewer hold the gate.',
      step: 4,
      relatedIds: offenders.map((o) => o.id),
    },
  ];
};

const noIntegrationOwner: Rule = (ctx) => {
  if (ctx.builders.length <= 1 || ctx.integrator) return none;
  return [
    {
      code: 'no-integration-owner',
      severity: 'warning',
      title: 'No one owns the combined result',
      problem: `${ctx.builders.length} agents produce separate parts, but nobody is responsible for assembling them or checking that the whole thing works.`,
      suggestion: 'Add an integration owner in step 4.',
      step: 4,
    },
  ];
};

const overlappingWrites: Rule = (ctx) => {
  const owners = new Map<string, string[]>();
  ctx.active.forEach((agent) => {
    agent.permissions.write.forEach((path) => {
      const key = path.trim().toLowerCase();
      if (!key) return;
      owners.set(key, [...(owners.get(key) ?? []), agent.name]);
    });
  });
  const clashes = [...owners.entries()].filter(([, names]) => names.length > 1);
  if (clashes.length === 0) return none;
  return [
    {
      code: 'overlapping-write-ownership',
      severity: 'warning',
      title: 'Multiple agents can edit the same area',
      problem: clashes
        .slice(0, 3)
        .map(([path, names]) => `"${path}" is writable by ${names.join(' and ')}`)
        .join('; ') + '. Parallel edits to the same area produce conflicts and silently lost work.',
      suggestion: 'Give each area exactly one owner. Other agents request changes through that owner.',
      step: 4,
    },
  ];
};

const tooManyMandatory: Rule = (ctx) => {
  const count = ctx.blockingReviewers.length;
  if (count < 5) return none;
  return [
    {
      code: 'too-many-mandatory-reviewers',
      severity: 'recommendation',
      title: `${count} reviewers can each block completion`,
      problem: 'Every additional mandatory reviewer multiplies the chance that one of them always has an objection, which can stall the loop indefinitely.',
      suggestion: 'Keep mandatory approval for the reviewers that genuinely gate release; let the rest report findings without blocking.',
      step: 6,
      relatedIds: ctx.blockingReviewers.map((r) => r.id),
    },
  ];
};

const parallelCoupledWork: Rule = (ctx) => {
  if (ctx.specialists.length < 2) return none;
  const withoutBoundaries = ctx.specialists.filter((s) => s.permissions.write.length === 0);
  if (withoutBoundaries.length === 0) return none;
  return [
    {
      code: 'parallel-without-boundaries',
      severity: 'warning',
      title: 'Parallel agents have no ownership boundaries',
      problem: `${withoutBoundaries.map((s) => s.name).join(', ')} work in parallel but no files or areas are assigned to them, so they will overlap.`,
      suggestion: 'Give each specialist an explicit list of what it may modify in step 4.',
      step: 4,
      relatedIds: withoutBoundaries.map((s) => s.id),
    },
  ];
};

const reviewerCannotSeeArtifact: Rule = (ctx) => {
  const isolated = ctx.blockingReviewers.filter((reviewer) => {
    const incoming = ctx.config.communication.edges.filter(
      (e) => e.to === reviewer.id && ctx.byId(e.from)?.enabled,
    );
    return incoming.length === 0;
  });
  if (isolated.length === 0) return none;
  return [
    {
      code: 'reviewer-cannot-receive-artifact',
      severity: 'blocking',
      title: 'A required reviewer never receives the work',
      problem: `${isolated.map((r) => r.name).join(', ')} must approve, but no communication path delivers the artifact to them. They can never approve, so the Gauntlet can never finish.`,
      suggestion: 'Add a reporting path in step 5, or turn off mandatory approval for that reviewer.',
      step: 5,
      relatedIds: isolated.map((r) => r.id),
    },
  ];
};

const criticReviewsSummaryOnly: Rule = (ctx) => {
  const offenders = ctx.reviewers.filter(
    (r) => r.behaviors?.includes('final-artifact-only') && r.inputs.some((i) => /summary|report|description/i.test(i)),
  );
  if (offenders.length === 0) return none;
  return [
    {
      code: 'critic-reviews-summary',
      severity: 'warning',
      title: 'A reviewer is fed a summary rather than the artifact',
      problem: `${offenders.map((o) => o.name).join(', ')} lists a summary among its inputs. Reviewing a description of the work instead of the work is how defects survive review.`,
      suggestion: 'Change that reviewer’s inputs to the artifact itself plus the collected evidence.',
      step: 4,
      relatedIds: offenders.map((o) => o.id),
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Step 5 — communication
 * ------------------------------------------------------------------ */

const blindReviewConflict: Rule = (ctx) => {
  const blindMode =
    ctx.config.communication.globalMode === 'blind-independent' ||
    Object.values(ctx.config.communication.overrides).includes('blind-independent');
  if (!blindMode) return none;

  const leaking = ctx.reviewers.filter((r) => r.seesPriorReasoning);
  const warnings: ValidationWarning[] = [];

  if (leaking.length > 0) {
    warnings.push({
      code: 'blind-review-sees-reasoning',
      severity: 'warning',
      title: 'Blind review is undermined by context settings',
      problem: `Blind independent review is selected, but ${leaking
        .map((r) => r.name)
        .join(', ')} is still set to see previous agent reasoning. The review will not actually be blind.`,
      suggestion: 'Turn off "sees previous agent reasoning" for those reviewers in step 4.',
      step: 4,
      relatedIds: leaking.map((r) => r.id),
    });
  }

  if (!ctx.config.communication.anonymizeBuilder) {
    warnings.push({
      code: 'blind-review-not-anonymised',
      severity: 'recommendation',
      title: 'Blind review without anonymising the author',
      problem: 'Reviewers will still be told who produced the artifact, which is part of what blind review is meant to remove.',
      suggestion: 'Enable "hide who produced the work" in step 5.',
      step: 5,
    });
  }

  return warnings;
};

const mediatorMissing: Rule = (ctx) => {
  const needsMediator =
    ctx.config.communication.globalMode === 'mediated-disagreement' ||
    Object.values(ctx.config.communication.overrides).includes('mediated-disagreement');
  if (!needsMediator || ctx.mediator) return none;
  return [
    {
      code: 'mediator-missing',
      severity: 'blocking',
      title: 'Mediated disagreement without a mediator',
      problem: 'Disputes are meant to escalate to a mediator, but no mediator agent exists, so disagreements have nowhere to go.',
      suggestion: 'Add a mediator in step 4, or choose a different communication mode.',
      step: 5,
    },
  ];
};

const conflictingCommunication: Rule = (ctx) => {
  const warnings: ValidationWarning[] = [];
  const { globalMode, overrides } = ctx.config.communication;

  if (globalMode === 'isolated-voting') {
    const discussing = Object.entries(overrides).filter(([, mode]) => mode === 'council-discussion');
    if (discussing.length > 0) {
      const names = discussing.map(([id]) => ctx.byId(id)?.name).filter(Boolean);
      warnings.push({
        code: 'conflicting-communication-modes',
        severity: 'warning',
        title: 'Isolated voting mixed with council discussion',
        problem: `Votes are meant to be independent, but ${names.join(', ')} may discuss before voting. Once one reviewer shares its view, the votes are no longer independent.`,
        suggestion: 'Use one or the other. Remove the per-agent override, or change the default mode.',
        step: 5,
      });
    }
  }

  if (globalMode === 'blind-independent' && ctx.config.communication.allowClarifyingQuestions) {
    warnings.push({
      code: 'blind-review-allows-questions',
      severity: 'info',
      title: 'Blind reviewers may ask questions',
      problem: 'Clarifying questions can reveal who built the artifact and why, which weakens the blind setup.',
      suggestion: 'Consider turning off clarifying questions while blind review is active.',
      step: 5,
    });
  }

  return warnings;
};

const circularDependency: Rule = (ctx) => {
  // Only sign-off/gate ordering can genuinely deadlock; review edges are
  // expected to cycle (builder ↔ critic is the loop itself).
  const gates = ctx.config.approval.signoffOrder;
  if (ctx.config.approval.kind !== 'sequential-signoff' || gates.length === 0) return none;

  const seen = new Set<string>();
  const dupes = gates.filter((id) => {
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
  if (dupes.length === 0) return none;

  return [
    {
      code: 'circular-signoff-order',
      severity: 'warning',
      title: 'A reviewer appears twice in the sign-off order',
      problem: 'The same reviewer is scheduled to sign off more than once, which makes the ordering ambiguous.',
      suggestion: 'Remove the duplicate entries from the sign-off order in step 6.',
      step: 6,
      relatedIds: dupes,
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Step 6 — approval
 * ------------------------------------------------------------------ */

const impossibleApproval: Rule = (ctx) => {
  const { approval } = ctx.config;
  const voters = eligibleVoterCount(ctx);
  const warnings: ValidationWarning[] = [];

  if (voters === 0 && approval.kind !== 'human-final') {
    warnings.push({
      code: 'approval-impossible-no-voters',
      severity: 'blocking',
      title: 'The approval policy has nobody to satisfy it',
      problem: 'No reviewers exist, so the chosen approval policy can never be evaluated and the loop has no defined end.',
      suggestion: 'Add at least one reviewer in step 4, or switch to human final approval.',
      step: 6,
    });
  }

  if (approval.kind === 'supermajority' && voters > 0) {
    const needed = Math.ceil((approval.supermajorityPercent / 100) * voters);
    if (needed > voters) {
      warnings.push({
        code: 'approval-impossible-supermajority',
        severity: 'blocking',
        title: 'The required percentage cannot be reached',
        problem: `${approval.supermajorityPercent}% of ${voters} reviewers rounds up to ${needed}, which is more reviewers than exist.`,
        suggestion: 'Lower the percentage or add more reviewers.',
        step: 6,
      });
    }
  }

  if (approval.kind === 'weighted-consensus') {
    const totalWeight = Object.entries(approval.weights)
      .filter(([id]) => ctx.byId(id)?.enabled)
      .reduce((sum, [, w]) => sum + w, 0);
    if (totalWeight === 0) {
      warnings.push({
        code: 'approval-impossible-no-weights',
        severity: 'blocking',
        title: 'Weighted consensus with no weights set',
        problem: 'Every reviewer has a weight of zero, so the approving weight can never reach the threshold.',
        suggestion: 'Assign vote weights to your reviewers in step 6.',
        step: 6,
      });
    }
  }

  if (approval.kind === 'sequential-signoff' && approval.signoffOrder.length === 0) {
    warnings.push({
      code: 'approval-no-signoff-order',
      severity: 'blocking',
      title: 'Sequential sign-off with no order defined',
      problem: 'Reviewers are meant to approve in a set order, but no order has been set.',
      suggestion: 'Choose the sign-off order in step 6.',
      step: 6,
    });
  }

  if (approval.kind === 'lead-decides' && !ctx.lead && !approval.deciderId) {
    warnings.push({
      code: 'approval-no-decider',
      severity: 'blocking',
      title: 'No agent is designated to make the final decision',
      problem: 'The policy gives one agent the final call, but no lead orchestrator exists and no decider has been chosen.',
      suggestion: 'Add a lead orchestrator in step 4, or pick a different approval policy.',
      step: 6,
    });
  }

  if (approval.kind === 'hybrid' && approval.hybridGateIds.length === 0) {
    warnings.push({
      code: 'approval-hybrid-no-gates',
      severity: 'warning',
      title: 'Hybrid approval with no gates',
      problem: 'Hybrid approval is meant to run objective gates before a judgement call, but no gates are configured, so only the final stage applies.',
      suggestion: 'Select which reviewers act as non-waivable gates in step 6.',
      step: 6,
    });
  }

  return warnings;
};

const humanApprovalWithoutCheckpoint: Rule = (ctx) => {
  const needsHuman =
    ctx.config.approval.kind === 'human-final' ||
    ctx.config.approval.requiresHumanFinal ||
    (ctx.config.approval.kind === 'hybrid' && ctx.config.approval.hybridFinalStage === 'human');
  if (!needsHuman) return none;

  const hasCheckpoint = ctx.config.checkpoints.some(
    (c) => c.blocking && (c.trigger === 'before-completion' || c.trigger === 'custom'),
  );
  if (hasCheckpoint) return none;

  return [
    {
      code: 'human-approval-without-checkpoint',
      severity: 'warning',
      title: 'Human approval required but no checkpoint stops the run',
      problem: 'The policy says a person must approve, but nothing pauses the run to ask. The agents will reach the end and have no defined way to wait for you.',
      suggestion: 'Add a blocking checkpoint before completion in step 7.',
      step: 7,
    },
  ];
};

const noHumanCheckpointHighRisk: Rule = (ctx) => {
  if (ctx.config.checkpoints.length > 0) return none;
  const risky =
    ctx.config.quality.evidence.includes('security-review') ||
    ctx.config.intent.prohibitions.some((p) => /delete|deploy|production|irreversible|send|publish/i.test(p)) ||
    /deploy|production|migrate|delete|payment|credential/i.test(ctx.config.intent.goal);
  if (!risky) return none;
  return [
    {
      code: 'no-checkpoint-high-risk',
      severity: 'recommendation',
      title: 'High-risk work with no human checkpoint',
      problem: 'This task touches security, deployment, or irreversible actions, but the run never pauses for a person.',
      suggestion: 'Add a checkpoint before anything irreversible, or before completion, in step 7.',
      step: 7,
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Step 7 — stopping
 * ------------------------------------------------------------------ */

const unlimitedLoop: Rule = (ctx) => {
  if (ctx.hasBudget) return none;
  return [
    {
      code: 'unlimited-loop',
      severity: 'warning',
      title: 'The loop has no limit of any kind',
      problem: 'No round, cost, token or time budget is set. If the quality bar turns out to be unreachable, the run has no defined point at which to stop and report that.',
      suggestion: 'Set at least a maximum number of rounds in step 7.',
      step: 7,
    },
  ];
};

const noCompletionPolicy: Rule = (ctx) => {
  const hasMandatory = ctx.blockingReviewers.length > 0;
  const isConsensus = ['majority', 'supermajority', 'weighted-consensus', 'unanimous'].includes(
    ctx.config.approval.kind,
  );
  const isDecided = ['lead-decides', 'human-final', 'hybrid', 'sequential-signoff'].includes(
    ctx.config.approval.kind,
  );
  if (hasMandatory || isConsensus || isDecided) return none;
  return [
    {
      code: 'no-completion-policy',
      severity: 'blocking',
      title: 'Nothing defines when the work is finished',
      problem: 'No reviewer is mandatory and the approval policy does not require a vote or a decision, so there is no condition that ends the loop successfully.',
      suggestion: 'Mark at least one reviewer as mandatory in step 4, or choose a policy that requires a decision in step 6.',
      step: 6,
    },
  ];
};

const noRegressionChecks: Rule = (ctx) => {
  if (ctx.config.revision.requireRegressionTests) return none;
  if (ctx.config.stop.maxTotalRounds <= 2) return none;
  return [
    {
      code: 'no-regression-checks',
      severity: 'recommendation',
      title: 'No regression checking between rounds',
      problem: 'Revisions are not required to re-run checks that already passed, so a later round can silently break an earlier fix.',
      suggestion: 'Turn on "require regression testing after every revision" in step 7.',
      step: 7,
    },
  ];
};

const noFailureStatuses: Rule = (ctx) =>
  ctx.config.stop.allowedFailureStatuses.length === 0
    ? [
        {
          code: 'no-failure-statuses',
          severity: 'warning',
          title: 'No honest failure statuses allowed',
          problem: 'If the quality bar cannot be met, the run has no permitted way to say so, which pushes it toward claiming success.',
          suggestion: 'Allow at least "incomplete" and "requires human decision" in step 7.',
          step: 7,
        },
      ]
    : none;

/* ------------------------------------------------------------------ *
 * Step 8 — critics
 * ------------------------------------------------------------------ */

const conflictingBehaviors: Rule = (ctx) => {
  const warnings: ValidationWarning[] = [];
  ctx.reviewers.forEach((r) => {
    const behaviors = r.behaviors ?? [];
    if (behaviors.includes('suggest-tests-only') && behaviors.includes('recommend-implementation')) {
      warnings.push({
        code: 'conflicting-critic-behaviors',
        severity: 'warning',
        title: `${r.name} has contradictory review instructions`,
        problem: 'It is told both to withhold implementation advice and to recommend implementation changes.',
        suggestion: 'Pick one. Withholding suits an independent reviewer; recommending suits a collaborative one.',
        step: 8,
        relatedIds: [r.id],
      });
    }
    if (behaviors.includes('reverse-ab') && !behaviors.includes('blind-ab')) {
      warnings.push({
        code: 'reverse-ab-without-ab',
        severity: 'info',
        title: `${r.name} reverses an A/B comparison it never makes`,
        problem: '"Reverse A/B order" only has an effect when blind A/B judgement is also enabled.',
        suggestion: 'Enable blind A/B judgement as well, or turn off the reversal.',
        step: 8,
        relatedIds: [r.id],
      });
    }
  });
  return warnings;
};

const criticNoEvidenceRequirement: Rule = (ctx) => {
  const lax = ctx.reviewers.filter((r) => !(r.behaviors ?? []).includes('require-evidence'));
  if (lax.length === 0 || lax.length !== ctx.reviewers.length) return none;
  return [
    {
      code: 'no-evidence-required-from-critics',
      severity: 'recommendation',
      title: 'No reviewer is required to back up its criticism',
      problem: 'Reviewers can block the work on impressions alone, which produces rounds of unactionable feedback.',
      suggestion: 'Turn on "require direct evidence for every criticism" in step 8.',
      step: 8,
    },
  ];
};

const excessiveStrictness: Rule = (ctx) => {
  const harsh = ctx.reviewers.filter(
    (r) => r.strictness === 'extremely-demanding' && r.mandatoryApproval,
  );
  if (harsh.length < 2 || ctx.config.stop.maxTotalRounds > 10) return none;
  return [
    {
      code: 'excessive-strictness-for-budget',
      severity: 'recommendation',
      title: 'Very demanding reviewers with a short round budget',
      problem: `${harsh.length} reviewers are set to the highest strictness and can each block completion, but only ${ctx.config.stop.maxTotalRounds} rounds are allowed. The run will most likely end unresolved.`,
      suggestion: 'Raise the round limit in step 7, or lower strictness for reviewers where it is not essential.',
      step: 7,
      relatedIds: harsh.map((h) => h.id),
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Cross-cutting
 * ------------------------------------------------------------------ */

const simulationLimits: Rule = (ctx) => {
  if (ctx.capability !== 'sequential-simulation') return none;
  const needIsolation = ctx.active.filter((a) => a.freshContext);
  if (needIsolation.length === 0) return none;
  return [
    {
      code: 'simulation-context-isolation',
      severity: 'info',
      title: 'True context isolation is not guaranteed here',
      problem: `${ctx.environmentLabel} runs roles inside one conversation, so "fresh context" for ${needIsolation
        .map((a) => a.name)
        .join(', ')} is simulated with explicit resets rather than genuinely enforced.`,
      suggestion: 'The generated prompt handles this with reset markers. For genuinely independent review, run those roles as separate conversations.',
      step: 4,
    },
  ];
};

const disabledMandatoryReviewer: Rule = (ctx) => {
  const offenders = ctx.config.agents.filter(
    (a) => !a.enabled && a.mandatoryApproval && isReviewRole(a.roleType),
  );
  if (offenders.length === 0) return none;
  return [
    {
      code: 'disabled-mandatory-reviewer',
      severity: 'info',
      title: 'A required reviewer is switched off',
      problem: `${offenders.map((o) => o.name).join(', ')} is marked as required but is currently disabled, so its approval is not being sought.`,
      suggestion: 'Re-enable it, or clear its mandatory flag so the roster reflects what will actually happen.',
      step: 4,
      relatedIds: offenders.map((o) => o.id),
    },
  ];
};

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

const RULES: Rule[] = [
  missingGoal,
  missingDeliverable,
  vagueGoal,
  noCriteria,
  noObjectiveEvidence,
  criteriaWithoutVerification,
  noMandatoryCriteria,
  referenceWithoutReference,
  blindJudgeWithoutReference,
  noBuilder,
  noCritic,
  builderReviewsSelf,
  noIntegrationOwner,
  overlappingWrites,
  tooManyMandatory,
  parallelCoupledWork,
  reviewerCannotSeeArtifact,
  criticReviewsSummaryOnly,
  blindReviewConflict,
  mediatorMissing,
  conflictingCommunication,
  circularDependency,
  impossibleApproval,
  humanApprovalWithoutCheckpoint,
  noHumanCheckpointHighRisk,
  unlimitedLoop,
  noCompletionPolicy,
  noRegressionChecks,
  noFailureStatuses,
  conflictingBehaviors,
  criticNoEvidenceRequirement,
  excessiveStrictness,
  simulationLimits,
  disabledMandatoryReviewer,
];

const SEVERITY_ORDER: Record<ValidationWarning['severity'], number> = {
  blocking: 0,
  warning: 1,
  recommendation: 2,
  info: 3,
};

/** Runs every rule and returns warnings sorted by severity. */
export function validate(config: GauntletConfig): ValidationWarning[] {
  const ctx = derive(config);
  const all = RULES.flatMap((rule) => {
    try {
      return rule(ctx);
    } catch {
      // A rule that throws must never take down the panel.
      return none;
    }
  });
  return all.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export interface ValidationSummary {
  warnings: ValidationWarning[];
  blocking: number;
  warning: number;
  recommendation: number;
  info: number;
  /** True when nothing prevents the config from producing a usable prompt. */
  canGenerate: boolean;
}

export function validateWithSummary(config: GauntletConfig): ValidationSummary {
  const warnings = validate(config);
  const count = (s: ValidationWarning['severity']) => warnings.filter((w) => w.severity === s).length;
  const blocking = count('blocking');
  return {
    warnings,
    blocking,
    warning: count('warning'),
    recommendation: count('recommendation'),
    info: count('info'),
    canGenerate: blocking === 0,
  };
}

/** Estimated complexity band, shown on the review step. */
export function estimateComplexity(config: GauntletConfig): {
  band: 'light' | 'moderate' | 'heavy' | 'very-heavy';
  score: number;
  drivers: string[];
} {
  const ctx = derive(config);
  const drivers: string[] = [];
  let score = 0;

  score += ctx.active.length * 2;
  if (ctx.active.length > 4) drivers.push(`${ctx.active.length} agents`);

  score += ctx.blockingReviewers.length * 3;
  if (ctx.blockingReviewers.length > 2) drivers.push(`${ctx.blockingReviewers.length} blocking reviewers`);

  score += config.quality.criteria.length;
  if (config.quality.criteria.length > 6) drivers.push(`${config.quality.criteria.length} criteria`);

  score += config.quality.evidence.length * 2;
  if (config.quality.evidence.length > 4) drivers.push(`${config.quality.evidence.length} evidence types`);

  const rounds = config.stop.maxTotalRounds || 12;
  score += rounds;
  if (rounds > 10) drivers.push(`up to ${rounds} rounds`);

  const demanding = ctx.reviewers.filter(
    (r) => r.strictness === 'extremely-demanding' || r.strictness === 'reference-blind-judge',
  ).length;
  score += demanding * 4;
  if (demanding > 0) drivers.push(`${demanding} very demanding reviewer${demanding > 1 ? 's' : ''}`);

  const band = score < 25 ? 'light' : score < 45 ? 'moderate' : score < 70 ? 'heavy' : 'very-heavy';
  return { band, score, drivers };
}
