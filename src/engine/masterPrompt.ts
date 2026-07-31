/**
 * Master prompt generator.
 *
 * Produces the single document a user pastes into their agent. Section order is
 * fixed and every section is derived from the config, so the same config always
 * yields the same bytes.
 */

import {
  approvalById,
  behaviorById,
  communicationById,
  evidenceById,
  FAILURE_STATUSES,
  LEDGER_FIELDS,
  revisionStrategyById,
  REVISION_OPTIONS,
  roleById,
  strictnessById,
  structurePresetByKind,
} from '../model/catalog';
import type { GauntletConfig } from '../model/types';
import { completionSentence, derive, eligibleVoterCount, type DerivedContext } from './derive';
import {
  blocks,
  bullets,
  fence,
  heading,
  humanize,
  lines,
  numbered,
  percent,
  plural,
  prose,
  sentence,
  table,
} from './text';

/* ------------------------------------------------------------------ *
 * Section builders
 * ------------------------------------------------------------------ */

function sectionHeader(ctx: DerivedContext): string {
  const { config } = ctx;
  const name = config.intent.projectName.trim() || 'Untitled Gauntlet';
  const structure = structurePresetByKind(config.topology);

  return blocks(
    heading(1, `Gauntlet Loop: ${name}`),
    lines(
      `You are running a **Gauntlet Loop** — a build-and-review cycle that repeats until an explicit, evidence-based quality bar is met, or until it stops honestly with an unresolved status.`,
      '',
      `**Structure:** ${structure.name} — ${structure.flowSummary}`,
      `**Target environment:** ${ctx.environmentLabel}`,
      `**Participants:** ${plural(ctx.active.length, 'agent role')}`,
    ),
    lines(
      'Read this entire document before taking any action. The rules in it are not suggestions;',
      'they define what "done" means for this task, and they override your default inclination to',
      'finish quickly or to declare success on partial work.',
    ),
  );
}

function sectionObjective(ctx: DerivedContext): string {
  const { intent } = ctx.config;
  const rows: string[] = [];

  if (intent.goal.trim()) rows.push(`**Goal.** ${sentence(intent.goal)}`);
  if (intent.deliverable.trim()) rows.push(`**Required deliverable.** ${sentence(intent.deliverable)}`);
  if (intent.audience.trim()) rows.push(`**Who it is for.** ${sentence(intent.audience)}`);
  if (intent.context.trim()) rows.push(`**Context you need.** ${sentence(intent.context)}`);
  if (intent.references.trim()) rows.push(`**Reference material.** ${sentence(intent.references)}`);

  return blocks(heading(2, '1. Objective'), lines(...rows));
}

function sectionConstraints(ctx: DerivedContext): string {
  const { intent } = ctx.config;
  const parts: string[] = [];

  if (intent.requirements.length > 0) {
    parts.push(
      blocks(
        heading(3, 'Fixed requirements'),
        'These must hold in the final deliverable. They are not negotiable and may not be reinterpreted to make the work easier.',
        bullets(intent.requirements),
      ),
    );
  }

  if (intent.prohibitions.length > 0) {
    parts.push(
      blocks(
        heading(3, 'Prohibited actions'),
        'Never do any of the following, regardless of how convenient it would be:',
        bullets(intent.prohibitions),
      ),
    );
  }

  if (intent.tools.length > 0) {
    parts.push(blocks(heading(3, 'Available tools'), bullets(intent.tools)));
  }

  if (parts.length === 0) return '';
  return blocks(heading(2, '2. Requirements and boundaries'), ...parts);
}

function sectionQualityBar(ctx: DerivedContext): string {
  const { config } = ctx;
  const q = config.quality;
  const parts: string[] = [
    heading(2, '3. Quality bar and required evidence'),
    lines(
      'The work is judged against the criteria below. Each criterion is met only when the stated',
      'verification has actually been carried out and its result reported. A criterion is **not**',
      'met because it looks met, because it was met in an earlier round, or because it seems',
      'unlikely to be a problem.',
    ),
  ];

  if (q.evidence.length > 0) {
    const evidenceRows = q.evidence.map((kind) => {
      const entry = evidenceById(kind);
      const cfg = q.evidenceConfig[kind] ?? {};
      const detail: string[] = [];

      if (cfg.testCommand) detail.push(`command: \`${cfg.testCommand}\``);
      if (cfg.minPassRate !== undefined && cfg.minPassRate > 0) detail.push(`at least ${cfg.minPassRate}% of tests passing`);
      if (cfg.minCoverage !== undefined && cfg.minCoverage > 0) detail.push(`coverage at least ${cfg.minCoverage}%`);
      if (cfg.viewports?.length) detail.push(`widths: ${cfg.viewports.join(', ')}px`);
      if (cfg.requiredFlows?.length) detail.push(`flows: ${cfg.requiredFlows.join('; ')}`);
      if (cfg.referenceDescription) detail.push(`reference: ${cfg.referenceDescription}`);
      if (cfg.visualSimilarityThreshold !== undefined && cfg.visualSimilarityThreshold > 0)
        detail.push(`must reach ${cfg.visualSimilarityThreshold}% similarity to the reference`);
      if (cfg.citationCoverage !== undefined && cfg.citationCoverage > 0)
        detail.push(`${cfg.citationCoverage}% of claims must carry a citation`);
      if (cfg.requiredChecks?.length) detail.push(`checks: ${cfg.requiredChecks.join('; ')}`);
      if (cfg.maxLatencyMs !== undefined && cfg.maxLatencyMs > 0) detail.push(`response under ${cfg.maxLatencyMs}ms`);
      if (cfg.performanceBudgets?.length) detail.push(`budgets: ${cfg.performanceBudgets.join('; ')}`);
      if (cfg.accessibilityStandard) detail.push(`standard: ${cfg.accessibilityStandard}`);
      if (cfg.analysisCommands?.length) detail.push(`commands: ${cfg.analysisCommands.map((c) => `\`${c}\``).join(', ')}`);
      if (cfg.humanReviewFocus) detail.push(`human checks: ${cfg.humanReviewFocus}`);
      if (cfg.notes) detail.push(cfg.notes);

      return [entry.label, `You must ${entry.promptClause}.`, detail.join(' · ') || '—'];
    });

    parts.push(
      blocks(
        heading(3, 'Evidence that must be collected'),
        table(['Evidence', 'What is required', 'Specifics'], evidenceRows),
      ),
    );
  }

  if (q.criteria.length > 0) {
    const criteriaRows = q.criteria.map((c) => [
      c.label || 'Unnamed criterion',
      c.severity === 'mandatory' ? 'Mandatory' : c.severity === 'important' ? 'Important' : 'Desirable',
      String(c.weight),
      c.statement || '—',
      c.verification || 'No verification method specified — treat as unverifiable and report it.',
    ]);

    parts.push(
      blocks(
        heading(3, 'Criteria'),
        table(['Criterion', 'Level', 'Weight', 'Passes when', 'Verified by'], criteriaRows),
      ),
    );
  }

  parts.push(
    blocks(
      heading(3, 'Scoring'),
      lines(
        `- Score each criterion from 0 to 1. The overall score is the weight-weighted mean.`,
        `- The overall score must reach **${percent(q.passingScore)}** *and* every mandatory criterion must be individually met.`,
        `- A high overall score never compensates for a failed mandatory criterion.`,
      ),
    ),
  );

  if (q.subjectiveGoals.length > 0) {
    parts.push(
      blocks(
        heading(3, 'Subjective goals'),
        lines(
          'The following goals are matters of judgement. They are still real requirements, but they',
          'must be assessed through the observable criteria above rather than by asserting that they',
          'have been achieved.',
        ),
        bullets(q.subjectiveGoals),
      ),
    );
  }

  parts.push(
    lines(
      '**Words that do not constitute evidence:** perfect, professional, excellent, beautiful,',
      'production-ready, high quality, robust, comprehensive, polished. If you find yourself',
      'reaching for one of these to justify a pass, you have not verified the criterion.',
    ),
  );

  return blocks(...parts);
}

function agentRosterTable(ctx: DerivedContext): string {
  const rows = ctx.active.map((a) => [
    a.name,
    roleById(a.roleType).label,
    a.mandatoryApproval ? 'Yes' : 'No',
    a.permissions.write.length > 0 ? a.permissions.write.join(', ') : '—',
    String(a.maxRounds),
  ]);
  return table(['Agent', 'Role', 'Approval required', 'May modify', 'Max rounds'], rows);
}

function sectionRoles(ctx: DerivedContext): string {
  const parts: string[] = [
    heading(2, '4. Agent roles and ownership'),
    agentRosterTable(ctx),
  ];

  const details = ctx.active.map((agent) => {
    const role = roleById(agent.roleType);
    const detail: string[] = [
      heading(3, `${agent.name} — ${role.label}`),
      sentence(agent.responsibility || role.defaultResponsibility),
    ];

    if (agent.expertise.trim()) detail.push(`**Brings:** ${sentence(agent.expertise)}`);
    if (agent.inputs.length > 0) detail.push(`**Receives:** ${prose(agent.inputs)}.`);
    if (agent.outputs.length > 0) detail.push(`**Must produce:** ${prose(agent.outputs)}.`);
    if (agent.tools.length > 0) detail.push(`**May use:** ${prose(agent.tools)}.`);

    const perms: string[] = [];
    if (agent.permissions.write.length > 0) perms.push(`may create or modify: ${agent.permissions.write.join(', ')}`);
    if (agent.permissions.readOnly.length > 0) perms.push(`may read but never modify: ${agent.permissions.readOnly.join(', ')}`);
    if (agent.permissions.forbidden.length > 0) perms.push(`must not open at all: ${agent.permissions.forbidden.join(', ')}`);
    if (perms.length > 0) detail.push(`**Ownership boundary:** ${perms.join('; ')}.`);
    else if (roleById(agent.roleType).family === 'review')
      detail.push('**Ownership boundary:** read-only. This agent reviews and never edits the artifact.');

    const flags: string[] = [];
    flags.push(agent.mandatoryApproval ? 'Its approval is required to finish.' : 'Its approval is not individually required.');
    if (agent.freshContext) flags.push('Starts from a clean context with no prior conversation.');
    if (!agent.seesPriorReasoning) flags.push('Must not be shown other agents’ reasoning or transcripts.');
    if (agent.canMessagePeers) flags.push('May message other agents directly.');
    if (agent.model !== 'inherit') {
      flags.push(
        agent.model === 'custom' && agent.customModel
          ? `Preferred model: ${agent.customModel}.`
          : `Model preference: ${agent.model.replace(/-/g, ' ')}.`,
      );
    }
    flags.push(`Authority level ${agent.authority} of 10.`);
    detail.push(bullets(flags));

    if (agent.ownedCriteria.length > 0) {
      const owned = agent.ownedCriteria
        .map((id) => ctx.config.quality.criteria.find((c) => c.id === id)?.label)
        .filter(Boolean) as string[];
      if (owned.length > 0) detail.push(`**Owns these criteria:** ${prose(owned)}.`);
    }

    if (agent.notes?.trim()) detail.push(`**Additional instructions:** ${sentence(agent.notes)}`);

    return blocks(...detail);
  });

  parts.push(...details);

  const writers = ctx.active.filter((a) => a.permissions.write.length > 0);
  if (writers.length > 1) {
    parts.push(
      lines(
        '**Ownership rule.** Exactly one agent may modify any given file or area. If two agents need',
        'the same area, one owns it and the other requests a change through the owner. Never resolve',
        'this by editing in parallel and merging afterwards.',
      ),
    );
  }

  return blocks(...parts);
}

function sectionCommunication(ctx: DerivedContext): string {
  const { config } = ctx;
  const global = communicationById(config.communication.globalMode);
  const parts: string[] = [
    heading(2, '5. How agents communicate'),
    `**Default mode: ${global.label}.** ${global.blurb}`,
    global.promptRule,
  ];

  const overrides = Object.entries(config.communication.overrides);
  if (overrides.length > 0) {
    const rows = overrides
      .map(([agentId, mode]) => {
        const agent = ctx.byId(agentId);
        if (!agent || !agent.enabled) return null;
        const entry = communicationById(mode);
        return [agent.name, entry.label, entry.blurb];
      })
      .filter((r): r is string[] => r !== null);
    if (rows.length > 0) {
      parts.push(
        blocks(heading(3, 'Per-agent exceptions'), table(['Agent', 'Mode', 'Meaning'], rows)),
      );
      parts.push(
        ...rows.map((r) => {
          const mode = overrides.find(([id]) => ctx.byId(id)?.name === r[0]);
          return mode ? `**${r[0]}:** ${communicationById(mode[1]).promptRule}` : '';
        }),
      );
    }
  }

  if (config.communication.edges.length > 0) {
    const rows = config.communication.edges
      .map((e) => {
        const from = ctx.byId(e.from);
        const to = ctx.byId(e.to);
        if (!from?.enabled || !to?.enabled) return null;
        return [from.name, humanize(e.kind), to.name, e.payload];
      })
      .filter((r): r is string[] => r !== null);
    if (rows.length > 0) {
      parts.push(
        blocks(
          heading(3, 'Reporting pathways'),
          'Information flows along these paths and no others:',
          table(['From', 'Relationship', 'To', 'What is sent'], rows),
        ),
      );
    }
  }

  const rules: string[] = [];
  if (config.communication.anonymizeBuilder) {
    rules.push(
      'Reviewers must not be told which agent produced the artifact, and must not receive its self-assessment or narrative. Strip author identity before handing anything to a reviewer.',
    );
  }
  if (config.communication.structuredFindingsOnly) {
    rules.push(
      'All review output must use the structured finding format in section 11. Prose-only reviews are rejected and must be redone — "it needs work" is not a finding.',
    );
  }
  rules.push(
    config.communication.allowClarifyingQuestions
      ? 'An agent that cannot proceed may ask one clarifying question through the orchestrator before acting on an assumption. State the assumption explicitly if no answer is available.'
      : 'Agents may not ask clarifying questions. Where something is ambiguous, state the assumption you are proceeding on and record it in the ledger.',
  );
  if (ctx.mediator) {
    rules.push(
      `Unresolved disagreements go to ${ctx.mediator.name}, whose decision is binding unless new evidence appears.`,
    );
  }
  parts.push(blocks(heading(3, 'Communication rules'), bullets(rules)));

  return blocks(...parts);
}

function sectionExecution(ctx: DerivedContext): string {
  const steps: string[] = [];

  steps.push(
    '**Inspect before delegating.** Examine the real problem, the existing material, and the actual state of things before assigning any work. Do not plan against an assumed structure.',
  );

  if (ctx.planner) {
    steps.push(
      `**Plan.** ${ctx.planner.name} produces an ordered plan naming each unit of work, its owner, and the boundary it must stay within.`,
    );
  }

  steps.push(
    '**Establish a baseline.** Before changing anything, record the current state and the current results of every check that already passes. This baseline is what regressions are measured against.',
  );

  if (ctx.isMultiBuilder) {
    steps.push(
      '**Parallelise only genuinely independent work.** Two units may run at the same time only if neither can invalidate the other’s output. Anything tightly coupled — shared data structures, shared styling, shared interfaces — stays under a single owner and is done sequentially.',
    );
  }

  steps.push('**Build.** Each builder produces its assigned work within its ownership boundary.');

  steps.push(
    '**Collect evidence.** Run the required checks against the real artifact and capture the actual output. Never describe what the output would probably be.',
  );

  steps.push(
    ctx.config.communication.anonymizeBuilder
      ? '**Review.** Hand each reviewer the artifact, the requirements, and the evidence — nothing about who produced it or why. Each reviewer returns a structured verdict.'
      : '**Review.** Each reviewer inspects the real artifact against its assigned criteria and returns a structured verdict.',
  );

  steps.push(
    '**Revise.** Apply the revision policy in section 8, then re-run the mandatory checks — including the ones that already passed.',
  );

  steps.push(
    `**Repeat** until ${completionSentence(ctx)}, or until a stopping condition in section 9 is reached.`,
  );

  const parts = [
    heading(2, '6. How to run the loop'),
    numbered(steps),
    lines(
      '**Inspect the real artifact.** Every judgement in this loop must be based on the thing itself:',
      'the running application, the rendered page, the actual file, the real command output. A summary',
      'of the artifact is not the artifact. A reviewer that reviews a description has not reviewed.',
    ),
  ];

  if (ctx.capability === 'sequential-simulation') {
    parts.push(sequentialSimulationBlock(ctx));
  } else {
    parts.push(
      lines(
        '**Sub-agents.** This environment supports real sub-agents. Dispatch each role as a separate',
        'agent with only the context that role is entitled to. Do not collapse two roles into one',
        'agent to save time — the separation between building and reviewing is the point of this loop.',
      ),
    );
  }

  return blocks(...parts);
}

/** Instructions for environments that cannot spawn genuinely separate agents. */
function sequentialSimulationBlock(ctx: DerivedContext): string {
  const isolated = ctx.active.filter((a) => a.freshContext || !a.seesPriorReasoning);
  return blocks(
    heading(3, 'Sequential role simulation'),
    lines(
      `${ctx.addressAs} may not have real sub-agents available. Run the roles sequentially within one`,
      'session, adopting each role fully and separately:',
    ),
    bullets([
      'Open each role with a delimiter line: `===== ROLE: <name> — ROUND <n> =====`, and close it with `===== END ROLE =====`.',
      'While in a role, act only within that role’s responsibility and permissions. Do not use knowledge that role would not have.',
      'Before a review role, write `--- CONTEXT RESET ---` and then restate, from the artifact alone, what you are reviewing. Do not carry forward your reasoning as the builder.',
      'A reviewing role must not defend work done by an earlier role. If you find yourself explaining why something is acceptable, you have leaked builder context — stop, reset, and judge only what is in front of you.',
      'Record each role’s output in the ledger before starting the next role.',
    ]),
    isolated.length > 0
      ? lines(
          `**Strict isolation required for:** ${isolated.map((a) => a.name).join(', ')}.`,
          'For these roles the reset is not optional. If a genuine reset is impossible in this',
          'environment, say so explicitly in the final report rather than pretending the review was independent.',
        )
      : '',
  );
}

function sectionBuilderInstructions(ctx: DerivedContext): string {
  const rules = [
    'Work only inside your ownership boundary. If a fix requires changing something you do not own, request it from the owner rather than editing it.',
    'Before claiming a change works, run the relevant check and paste the real output.',
    'When you disagree with a finding, say so with evidence rather than by ignoring it. An unaddressed finding is an open finding.',
    'Report what you did not do as clearly as what you did. Partial work described as complete is the single most damaging thing you can do in this loop.',
    'Never disable, skip, weaken or narrow a test in order to make it pass. If a test is genuinely wrong, say so explicitly and explain why.',
    'Never stub, mock, or hard-code a result to satisfy a check unless the task explicitly asked for a stub.',
  ];
  if (ctx.config.revision.requirePlanBeforeRevision) {
    rules.unshift('Before each revision, state which findings you will address and how. Wait for that plan to be recorded before editing.');
  }
  return blocks(
    heading(2, '7. Instructions for building agents'),
    bullets(rules),
  );
}

function sectionCriticInstructions(ctx: DerivedContext): string {
  const reviewers = ctx.integrator ? [...ctx.reviewers, ctx.integrator] : ctx.reviewers;
  if (reviewers.length === 0) return '';

  const parts: string[] = [
    heading(2, '8. Instructions for reviewing agents'),
    lines(
      'Every reviewer follows these rules. A reviewer may never return only a judgement — it returns',
      'findings that another agent could act on without asking a follow-up question.',
    ),
    bullets([
      'Inspect the artifact directly. If you cannot inspect it, report that as an inspection gap and score the affected criteria as unverified — never as passing.',
      'Every finding names what you observed, where, and what evidence supports it.',
      'Rate severity honestly. Marking everything critical is as useless as marking nothing critical.',
      'Distinguish "this is wrong" from "I would have done this differently". Only the first blocks approval.',
      'If the artifact meets your criteria, approve it. Withholding approval to appear rigorous wastes rounds and is itself a failure.',
    ]),
  ];

  const perReviewer = reviewers.map((agent) => {
    const strict = strictnessById(agent.strictness ?? 'strict-professional');
    const behaviors = (agent.behaviors ?? []).map((b) => behaviorById(b));
    return blocks(
      heading(3, `${agent.name} — ${strict.label}`),
      strict.promptRule,
      behaviors.length > 0 ? bullets(behaviors.map((b) => b.promptRule)) : '',
      agent.ownedCriteria.length > 0
        ? `Judge only these criteria: ${agent.ownedCriteria
            .map((id) => ctx.config.quality.criteria.find((c) => c.id === id)?.label)
            .filter(Boolean)
            .join(', ')}.`
        : 'Judge every criterion in the rubric.',
    );
  });

  parts.push(...perReviewer);
  return blocks(...parts);
}

function sectionCriticSchema(ctx: DerivedContext): string {
  const example = ctx.reviewers[0] ?? ctx.integrator;
  const criteria = ctx.config.quality.criteria.slice(0, 3);
  const scoreLines =
    criteria.length > 0
      ? criteria.map((c, i) => `    "${slugKey(c.label || `criterion_${i + 1}`)}": ${(0.9 - i * 0.15).toFixed(2)}`)
      : ['    "completeness": 0.90', '    "correctness": 0.60', '    "clarity": 0.80'];

  const schema = `{
  "reviewer": "${example?.name ?? 'Reviewer'}",
  "round": 1,
  "verdict": "fail",
  "mandatory_gate": ${example?.mandatoryApproval ?? true},
  "artifact_inspected": "What you actually opened, ran, or looked at",
  "criterion_scores": {
${scoreLines.join(',\n')}
  },
  "largest_verified_gap": {
    "description": "The single biggest confirmed problem, stated concretely",
    "evidence": [
      "The specific thing you observed that proves it"
    ],
    "severity": "critical"
  },
  "findings": [
    {
      "id": "F1",
      "criterion": "${criteria[0]?.label ?? 'correctness'}",
      "severity": "critical",
      "observed": "What is actually happening",
      "expected": "What the criterion requires",
      "evidence": ["Command output, file and line, request and response, or described screenshot"],
      "root_cause_hypothesis": "Likely cause, and whether you verified it",
      "verified": true
    }
  ],
  "regression_risks": [
    "What a plausible fix for this might break"
  ],
  "required_retest": [
    "Exactly which checks must be re-run after the fix"
  ],
  "approval_conditions": [
    "The specific, checkable condition that would turn this verdict into an approval"
  ],
  "unverifiable": [
    "Anything you could not check, and why"
  ]
}`;

  return blocks(
    heading(2, '9. Required review output format'),
    'Every reviewer returns exactly this structure. Adapt the criterion keys to the rubric; do not drop fields.',
    fence(schema, 'json'),
    bullets([
      '`verdict` is one of `approve`, `approve_with_conditions`, `fail`, or `abstain`.',
      '`abstain` is only valid when the reviewer genuinely could not inspect the artifact, and it never counts as an approval.',
      '`approve_with_conditions` requires the conditions to be checkable — and they must actually be checked before completion.',
      'A finding with `"verified": false` is a suspicion. It must be recorded but may not, on its own, block approval.',
    ]),
  );
}

function slugKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'criterion';
}

function sectionApproval(ctx: DerivedContext): string {
  const { config } = ctx;
  const policy = approvalById(config.approval.kind);
  const parts: string[] = [
    heading(2, '10. Approval policy'),
    `**${policy.label}.** ${policy.blurb}`,
    policy.promptRule,
    `**In this Gauntlet, the work is complete when ${completionSentence(ctx)}.**`,
  ];

  const details: string[] = [];
  if (config.approval.kind === 'supermajority') {
    details.push(`Required share: ${config.approval.supermajorityPercent}% of ${eligibleVoterCount(ctx)} reviewers.`);
  }
  if (config.approval.kind === 'weighted-consensus') {
    const rows = Object.entries(config.approval.weights)
      .map(([id, w]) => {
        const agent = ctx.byId(id);
        return agent?.enabled ? [agent.name, String(w)] : null;
      })
      .filter((r): r is string[] => r !== null);
    if (rows.length > 0) details.push(table(['Reviewer', 'Vote weight'], rows));
    details.push(`Required approving weight: ${percent(config.approval.weightedThreshold)} of the total.`);
  }
  if (config.approval.kind === 'sequential-signoff' && ctx.orderedGates.length > 0) {
    details.push(`Sign-off order: ${ctx.orderedGates.map((g) => g.name).join(' → ')}.`);
  }
  if (config.approval.kind === 'lead-decides' && ctx.lead) {
    details.push(`${ctx.lead.name} makes the final determination and must justify any override in writing.`);
  }
  if (config.approval.kind === 'hybrid') {
    const gates = config.approval.hybridGateIds.map((id) => ctx.byId(id)?.name).filter(Boolean);
    if (gates.length > 0) details.push(`Gates that cannot be waived: ${gates.join(', ')}.`);
    details.push(
      config.approval.hybridFinalStage === 'human'
        ? 'After the gates pass, a human makes the final decision.'
        : config.approval.hybridFinalStage === 'consensus'
          ? 'After the gates pass, the reviewers vote on completion.'
          : 'After the gates pass, the lead agent makes the final decision.',
    );
  }
  if (config.approval.allowVeto) {
    details.push(
      `A mandatory reviewer may block completion on its own. A block that persists for ${config.approval.vetoEscalatesAfter} rounds is escalated rather than overridden.`,
    );
  }
  if (config.approval.requiresHumanFinal && config.approval.kind !== 'human-final') {
    details.push('Regardless of the above, a human must give final approval before the work is declared complete.');
  }
  if (details.length > 0) parts.push(bullets(details));

  parts.push(
    blocks(
      heading(3, 'Approval integrity'),
      bullets([
        'Never record an approval that a reviewer did not actually give.',
        'Never infer approval from silence, from a lack of findings, or from a reviewer running out of rounds.',
        'An approval applies to the version that was reviewed. If that area changes afterwards, the approval lapses and must be renewed.',
        'Never lower a criterion, reinterpret a requirement, or narrow the scope in order to reach approval. If the bar cannot be met, report that — it is a valid outcome.',
      ]),
    ),
  );

  return blocks(...parts);
}

function sectionRevision(ctx: DerivedContext): string {
  const { config } = ctx;
  const strategy = revisionStrategyById(config.revision.strategy);
  const active = REVISION_OPTIONS.filter((opt) => config.revision[opt.key] === true);

  return blocks(
    heading(2, '11. Revision policy'),
    `**${strategy.label}.** ${strategy.blurb}`,
    strategy.promptRule,
    active.length > 0 ? blocks(heading(3, 'Additional revision rules'), bullets(active.map((o) => o.promptRule))) : '',
    blocks(
      heading(3, 'Regression protection'),
      bullets([
        'A regression is anything that worked before this round and does not work now. Regressions are defects, and they take priority over new work.',
        'Compare against the baseline recorded at the start, not against the previous round only.',
        'Report every regression even if you fixed it in the same round.',
        config.revision.autoRollbackRegressions
          ? 'If a regression cannot be fixed within the round in which it appeared, revert to the last known-good state and record the reversion.'
          : 'If a regression cannot be fixed in the round it appeared, record it as an open blocker rather than continuing past it.',
      ]),
    ),
  );
}

function sectionStopping(ctx: DerivedContext): string {
  const { stop } = ctx.config;
  const limits: string[] = [];

  if (stop.maxTotalRounds > 0) limits.push(`**Maximum rounds:** ${stop.maxTotalRounds} in total.`);
  if (stop.maxRoundsPerAgent > 0) limits.push(`**Per agent:** no agent runs more than ${stop.maxRoundsPerAgent} times.`);
  if (stop.maxConsecutiveFailures > 0)
    limits.push(`**Consecutive failures:** stop after ${stop.maxConsecutiveFailures} rounds in a row that fix nothing.`);
  if (stop.maxRepeatedDefects > 0)
    limits.push(`**Repeated defects:** if the same defect reappears ${stop.maxRepeatedDefects} times, stop and escalate rather than attempting it again.`);
  if (stop.plateauRounds > 0)
    limits.push(
      `**No progress:** if the overall score improves by less than ${percent(stop.plateauDelta)} for ${stop.plateauRounds} consecutive rounds, stop and report the plateau.`,
    );
  if (stop.maxTokens > 0) limits.push(`**Token budget:** approximately ${stop.maxTokens.toLocaleString('en-US')} tokens.`);
  if (stop.maxCostUsd > 0) limits.push(`**Cost budget:** approximately $${stop.maxCostUsd}.`);
  if (stop.maxWallClockMinutes > 0) limits.push(`**Time budget:** ${stop.maxWallClockMinutes} minutes.`);

  const statuses = stop.allowedFailureStatuses.map((s) => {
    const entry = FAILURE_STATUSES.find((f) => f.id === s);
    return `\`${s}\` — ${entry?.blurb ?? humanize(s)}`;
  });

  return blocks(
    heading(2, '12. Stopping conditions'),
    lines(
      '"Continue until everyone is happy" means: **continue until every mandatory approval condition',
      'is satisfied, or stop honestly with an unresolved status when a safety, budget, conflict or',
      'feasibility boundary is reached.** It does not mean continue forever, and it does not mean',
      'stop when you are tired of iterating.',
    ),
    blocks(
      limits.length > 0 ? blocks(heading(3, 'Budgets'), bullets(limits)) : '',
      // A plateau or failure-streak limit bounds the loop only if progress
      // actually stalls, so it is not a substitute for a hard ceiling.
      ctx.hasBudget
        ? ''
        : lines(
            '**No budget is configured.** No round, token, cost or time ceiling bounds this run.',
            'Continue until the approval conditions are met. If you reach a point where further rounds',
            'produce no measurable improvement, stop and report a plateau rather than continuing',
            'indefinitely — and say plainly that you stopped without meeting the bar.',
          ),
    ),
    blocks(
      heading(3, 'Reaching a limit is not success'),
      lines(
        'If a limit is reached before the approval conditions are met, the run has **not** succeeded.',
        'Report one of the following statuses. Do not report completion, and do not soften the outcome.',
      ),
      bullets(statuses),
    ),
    blocks(
      heading(3, 'Prohibited endings'),
      bullets([
        'Do not declare success because the round limit was reached.',
        'Do not declare success because no further improvements occurred to you.',
        'Do not claim reviewers approved when they did not, did not run, or abstained.',
        'Do not quietly drop a criterion that turned out to be hard.',
        'Do not redefine the deliverable to match what was built.',
        'Do not hide an exhausted budget, an unresolved conflict, or a failed gate anywhere in the final report.',
      ]),
    ),
  );
}

function sectionCheckpoints(ctx: DerivedContext): string {
  const { checkpoints } = ctx.config;
  if (checkpoints.length === 0) {
    return blocks(
      heading(2, '13. Human checkpoints'),
      'No human checkpoints are configured. Run autonomously to a stopping condition, then report.',
    );
  }

  const rows = checkpoints.map((c) => [
    c.label,
    humanize(c.trigger),
    c.blocking ? 'Stop and wait' : 'Notify and continue',
    c.question,
  ]);

  return blocks(
    heading(2, '13. Human checkpoints'),
    table(['Checkpoint', 'When', 'Behaviour', 'What to ask'], rows),
    lines(
      'At a blocking checkpoint, stop completely. Present the current state, the evidence collected',
      'so far, the open questions, and your recommendation — then wait. Do not continue on the',
      'assumption that approval would have been granted.',
    ),
  );
}

function sectionLedger(ctx: DerivedContext): string {
  const { ledger } = ctx.config;
  if (!ledger.enabled) return '';

  const fields = ledger.fields.map((f) => LEDGER_FIELDS.find((l) => l.id === f)).filter(Boolean);
  const labels = fields.map((f) => f!.label);

  let example = '';
  if (ledger.format === 'markdown-table') {
    example = table(labels, [labels.map((_, i) => (i === 0 ? '1' : '…'))]);
  } else if (ledger.format === 'json-lines') {
    example = fence(
      `{${fields.map((f) => `"${f!.id.replace(/-/g, '_')}": ""`).join(', ')}}`,
      'json',
    );
  } else {
    example = fence(fields.map((f) => `${f!.id.replace(/-/g, '_')}: `).join('\n'), 'yaml');
  }

  return blocks(
    heading(2, '14. Progress ledger'),
    lines(
      'Maintain a running ledger. Append one entry per round, before starting the next round. The',
      'ledger is how a human reconstructs what happened, so it must record what actually occurred,',
      'including rounds that achieved nothing.',
    ),
    example,
    bullets([
      'Never rewrite an earlier entry. Corrections are appended as new entries.',
      'Record rounds that made things worse as plainly as rounds that helped.',
      'If a round produced no change, say so and say why.',
    ]),
  );
}

function sectionFinalReport(ctx: DerivedContext): string {
  const reviewers = ctx.integrator ? [...ctx.reviewers, ctx.integrator] : ctx.reviewers;
  return blocks(
    heading(2, '15. Required final report'),
    'End the run with this report, whatever the outcome:',
    numbered([
      '**Status** — one of: `complete`, or one of the unresolved statuses in section 12.',
      '**What was produced** — the deliverable and where it is.',
      '**Criterion-by-criterion result** — every criterion, its final score, and the evidence that supports that score.',
      reviewers.length > 0
        ? `**Reviewer verdicts** — the final verdict from each of: ${reviewers.map((r) => r.name).join(', ')}. Report what each actually returned, including any that never ran.`
        : '**Reviewer verdicts** — none configured.',
      '**Unresolved items** — every criterion not met, every open finding, and every check that could not be run.',
      '**Regressions** — anything that broke during the run, whether or not it was fixed.',
      '**What was attempted and did not work** — so the next person does not repeat it.',
      '**Whether human intervention is required, and for what decision.**',
      '**Budget used** — rounds, and cost or time if tracked.',
    ]),
    lines(
      '**The honesty rule.** A report of `incomplete` with a clear account of what is missing is a',
      'successful outcome for this loop. A report of `complete` that turns out to be wrong is the',
      'only real failure. If you are unsure which applies, report the more conservative one.',
    ),
  );
}

function sectionAdditional(ctx: DerivedContext): string {
  const extra = ctx.config.additionalInstructions.trim();
  if (!extra) return '';
  return blocks(heading(2, '16. Additional instructions'), extra);
}

function sectionKickoff(ctx: DerivedContext): string {
  const first = ctx.planner?.name ?? ctx.lead?.name ?? ctx.builders[0]?.name ?? 'the first agent';
  return blocks(
    heading(2, 'Begin'),
    numbered([
      'Confirm you have read this document by restating the goal, the deliverable, and the exact completion condition in your own words.',
      'Inspect the current state of the problem before planning.',
      `Start the loop as ${first}.`,
      'Open the ledger with round 1.',
    ]),
  );
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export function generateMasterPrompt(config: GauntletConfig): string {
  const ctx = derive(config);
  return blocks(
    sectionHeader(ctx),
    sectionObjective(ctx),
    sectionConstraints(ctx),
    sectionQualityBar(ctx),
    sectionRoles(ctx),
    sectionCommunication(ctx),
    sectionExecution(ctx),
    sectionBuilderInstructions(ctx),
    sectionCriticInstructions(ctx),
    sectionCriticSchema(ctx),
    sectionApproval(ctx),
    sectionRevision(ctx),
    sectionStopping(ctx),
    sectionCheckpoints(ctx),
    sectionLedger(ctx),
    sectionFinalReport(ctx),
    sectionAdditional(ctx),
    sectionKickoff(ctx),
  );
}
