/**
 * Per-agent instruction generator.
 *
 * Produces a standalone prompt for each agent, containing only what that agent
 * is entitled to know. This matters for blind review: a critic's prompt must
 * not leak the builder's reasoning, so the generator deliberately omits
 * sections rather than relying on the agent to ignore them.
 */

import {
  behaviorById,
  communicationById,
  evidenceById,
  isReviewRole,
  roleById,
  strictnessById,
} from '../model/catalog';
import type { Agent, GauntletConfig } from '../model/types';
import { completionSentence, derive, type DerivedContext } from './derive';
import { blocks, bullets, heading, lines, percent, prose, sentence, table } from './text';

function sharedContext(ctx: DerivedContext, agent: Agent): string {
  const { intent } = ctx.config;
  const blind = !agent.seesPriorReasoning && isReviewRole(agent.roleType);

  const rows: string[] = [];
  if (intent.goal.trim()) rows.push(`**Goal.** ${sentence(intent.goal)}`);
  if (intent.deliverable.trim()) rows.push(`**Deliverable.** ${sentence(intent.deliverable)}`);
  if (intent.audience.trim()) rows.push(`**Audience.** ${sentence(intent.audience)}`);
  // Context and references go to everyone; builder narrative does not.
  if (!blind && intent.context.trim()) rows.push(`**Context.** ${sentence(intent.context)}`);
  if (intent.references.trim()) rows.push(`**Reference material.** ${sentence(intent.references)}`);

  return blocks(heading(2, 'What this project is'), lines(...rows));
}

function criteriaFor(ctx: DerivedContext, agent: Agent): string {
  const all = ctx.config.quality.criteria;
  const owned = agent.ownedCriteria.length > 0
    ? all.filter((c) => agent.ownedCriteria.includes(c.id))
    : all;

  if (owned.length === 0) return '';

  const rows = owned.map((c) => [
    c.label || 'Unnamed',
    c.severity === 'mandatory' ? 'Mandatory' : c.severity === 'important' ? 'Important' : 'Desirable',
    c.statement || '—',
    c.verification || 'No verification method specified.',
  ]);

  return blocks(
    heading(2, agent.ownedCriteria.length > 0 ? 'The criteria you own' : 'The quality bar'),
    table(['Criterion', 'Level', 'Passes when', 'Verified by'], rows),
    `Overall passing score: ${percent(ctx.config.quality.passingScore)}, with every mandatory criterion individually met.`,
  );
}

function evidenceFor(ctx: DerivedContext): string {
  const { evidence, evidenceConfig } = ctx.config.quality;
  if (evidence.length === 0) return '';
  const items = evidence.map((kind) => {
    const entry = evidenceById(kind);
    const cfg = evidenceConfig[kind] ?? {};
    const bits: string[] = [];
    if (cfg.testCommand) bits.push(`run \`${cfg.testCommand}\``);
    if (cfg.minPassRate) bits.push(`at least ${cfg.minPassRate}% passing`);
    if (cfg.viewports?.length) bits.push(`at widths ${cfg.viewports.join(', ')}px`);
    if (cfg.requiredFlows?.length) bits.push(`flows: ${cfg.requiredFlows.join('; ')}`);
    if (cfg.requiredChecks?.length) bits.push(`checks: ${cfg.requiredChecks.join('; ')}`);
    if (cfg.maxLatencyMs) bits.push(`under ${cfg.maxLatencyMs}ms`);
    if (cfg.accessibilityStandard) bits.push(cfg.accessibilityStandard);
    if (cfg.citationCoverage) bits.push(`${cfg.citationCoverage}% of claims cited`);
    if (cfg.analysisCommands?.length) bits.push(cfg.analysisCommands.map((c) => `\`${c}\``).join(', '));
    if (cfg.referenceDescription) bits.push(`against: ${cfg.referenceDescription}`);
    if (cfg.notes) bits.push(cfg.notes);
    return `**${entry.label}** — ${entry.promptClause}${bits.length ? ` (${bits.join('; ')})` : ''}.`;
  });
  return blocks(heading(2, 'Evidence required'), bullets(items));
}

function permissionsFor(agent: Agent): string {
  const p = agent.permissions;
  const items: string[] = [];
  if (p.write.length > 0) items.push(`You may create and modify: ${p.write.join(', ')}.`);
  else if (isReviewRole(agent.roleType)) items.push('You may not modify anything. You inspect and report only.');
  if (p.readOnly.length > 0) items.push(`You may read but must not modify: ${p.readOnly.join(', ')}.`);
  if (p.forbidden.length > 0) items.push(`You must not open at all: ${p.forbidden.join(', ')}.`);
  if (agent.tools.length > 0) items.push(`Tools available to you: ${prose(agent.tools)}.`);
  items.push(`You may run at most ${agent.maxRounds} times in this loop.`);
  if (items.length === 0) return '';
  return blocks(heading(2, 'Your boundaries'), bullets(items));
}

function communicationFor(ctx: DerivedContext, agent: Agent): string {
  const mode = communicationById(ctx.modeFor(agent.id));
  const items: string[] = [mode.promptRule];

  const outgoing = ctx.config.communication.edges.filter((e) => e.from === agent.id);
  const incoming = ctx.config.communication.edges.filter((e) => e.to === agent.id);

  outgoing.forEach((e) => {
    const to = ctx.byId(e.to);
    if (to?.enabled) items.push(`You send ${e.payload.toLowerCase()} to **${to.name}**.`);
  });
  incoming.forEach((e) => {
    const from = ctx.byId(e.from);
    if (from?.enabled) items.push(`You receive ${e.payload.toLowerCase()} from **${ctx.displayName(from)}**.`);
  });

  if (!agent.seesPriorReasoning) {
    items.push(
      'You must not be given, and must not ask for, other agents’ reasoning or transcripts. Judge from the artifact and the evidence alone.',
    );
  }
  if (agent.freshContext) {
    items.push('You begin with no prior conversation. Everything you need is in this prompt and the artifact itself.');
  }
  if (!ctx.config.communication.allowClarifyingQuestions) {
    items.push('You may not ask clarifying questions. State any assumption you make explicitly.');
  }

  return blocks(heading(2, 'How you communicate'), bullets(items));
}

function builderBody(ctx: DerivedContext, agent: Agent): string {
  return blocks(
    heading(2, 'How to work'),
    bullets([
      'Inspect the current state before changing anything.',
      'Work only inside your boundary. To change something you do not own, ask its owner.',
      'After each change, run the relevant check and keep the real output — you will be asked for it.',
      ctx.config.revision.requirePlanBeforeRevision
        ? 'Before revising, state which findings you will address and how.'
        : 'When you receive findings, address them in the order the revision policy specifies.',
      ctx.config.revision.requireRegressionTests
        ? 'After each change, re-run every check that previously passed, not only the ones related to your change.'
        : 'After each change, verify you have not broken anything that previously worked.',
      'Never weaken a test, stub a result, or narrow a requirement to make a check pass.',
      'Report what you did not finish as clearly as what you did.',
    ]),
    heading(2, 'What you return'),
    bullets(
      agent.outputs.length > 0
        ? agent.outputs
        : ['The artifact', 'A summary of what changed', 'The evidence that it works'],
    ),
  );
}

function reviewerBody(agent: Agent): string {
  const strict = strictnessById(agent.strictness ?? 'strict-professional');
  const behaviors = (agent.behaviors ?? []).map((b) => behaviorById(b));

  return blocks(
    blocks(heading(2, `Your review standard: ${strict.label}`), strict.promptRule),
    behaviors.length > 0 ? blocks(heading(2, 'How to review'), bullets(behaviors.map((b) => b.promptRule))) : '',
    blocks(
      heading(2, 'Rules that always apply'),
      bullets([
        'Inspect the artifact directly. If you cannot, record an inspection gap and score the affected criteria as unverified — never as passing.',
        'Every finding must name what you observed and the evidence for it.',
        'Separate "this is wrong" from "I would have done it differently". Only the first blocks approval.',
        'If the criteria are met, approve. Withholding approval to seem rigorous wastes a round and is itself a failure.',
        'You may not say only "not good enough". Return structured findings that someone could act on without asking you a question.',
      ]),
    ),
    blocks(
      heading(2, 'Your verdict'),
      agent.mandatoryApproval
        ? 'Your approval is **required**. The work cannot be declared complete while you have an open fail verdict.'
        : 'Your approval is not individually required, but your findings are recorded and must be addressed or explicitly deferred with a reason.',
      `Return the structured JSON review format defined in the master prompt. Set \`"mandatory_gate": ${agent.mandatoryApproval}\`.`,
    ),
  );
}

function humanBody(ctx: DerivedContext): string {
  return blocks(
    heading(2, 'What you are being asked'),
    'You are the human approver. The agents will pause and present their work to you.',
    bullets([
      'You will receive the artifact, the evidence collected, every reviewer verdict, and the open items.',
      'Nothing may be declared complete without your explicit approval.',
      `The agents’ own completion condition is: ${completionSentence(ctx)}.`,
    ]),
  );
}

export function generateAgentInstruction(config: GauntletConfig, agent: Agent): string {
  const ctx = derive(config);
  const role = roleById(agent.roleType);
  const review = isReviewRole(agent.roleType);

  const opening = blocks(
    heading(1, `${agent.name} — ${role.label}`),
    lines(
      `You are **${agent.name}** in a Gauntlet Loop: a build-and-review cycle that repeats until an`,
      'evidence-based quality bar is met, or stops honestly with an unresolved status.',
    ),
    `**Your responsibility.** ${sentence(agent.responsibility || role.defaultResponsibility)}`,
    agent.expertise.trim() ? `**What you bring.** ${sentence(agent.expertise)}` : '',
    agent.inputs.length > 0 ? `**You receive.** ${prose(agent.inputs)}.` : '',
  );

  const body =
    agent.roleType === 'human-approver'
      ? humanBody(ctx)
      : review
        ? reviewerBody(agent)
        : builderBody(ctx, agent);

  const closing = blocks(
    heading(2, 'The completion condition'),
    `The Gauntlet is complete when ${completionSentence(ctx)}. Reaching a round or budget limit is not completion — it is an unresolved status that must be reported as such.`,
    agent.notes?.trim() ? blocks(heading(2, 'Additional instructions'), agent.notes.trim()) : '',
  );

  return blocks(
    opening,
    sharedContext(ctx, agent),
    criteriaFor(ctx, agent),
    review ? evidenceFor(ctx) : evidenceFor(ctx),
    permissionsFor(agent),
    communicationFor(ctx, agent),
    body,
    closing,
  );
}

/** All agent instructions concatenated, with separators, for the tab view. */
export function generateAllAgentInstructions(config: GauntletConfig): string {
  const ctx = derive(config);
  if (ctx.active.length === 0) {
    return 'No agents are configured yet. Add at least one agent to generate instructions.';
  }
  return ctx.active
    .map((agent) => generateAgentInstruction(config, agent))
    .join('\n\n---\n\n');
}
