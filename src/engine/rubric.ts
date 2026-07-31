/**
 * Evaluation rubric, plain-English summary, and execution checklist.
 *
 * These three outputs share the same derived context and a lot of the same
 * vocabulary, so they live together to keep the wording consistent.
 */

import {
  approvalById,
  communicationById,
  evidenceById,
  isReviewRole,
  revisionStrategyById,
  REVISION_OPTIONS,
  roleById,
  strictnessById,
  structurePresetByKind,
} from '../model/catalog';
import type { GauntletConfig } from '../model/types';
import { completionSentence, derive } from './derive';
import {
  blocks,
  bullets,
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
 * Rubric
 * ------------------------------------------------------------------ */

export function generateRubric(config: GauntletConfig): string {
  const ctx = derive(config);
  const q = config.quality;

  if (q.criteria.length === 0) {
    return blocks(
      heading(1, 'Evaluation rubric'),
      'No criteria are defined yet. Add criteria in step 2 so reviewers have something inspectable to judge against.',
    );
  }

  const totalWeight = q.criteria.reduce((sum, c) => sum + c.weight, 0);

  const section = (label: string, severity: string) => {
    const items = q.criteria.filter((c) => c.severity === severity);
    if (items.length === 0) return '';
    const rows = items.map((c) => {
      const owners = ctx.active
        .filter((a) => a.ownedCriteria.includes(c.id))
        .map((a) => a.name);
      return [
        c.label || 'Unnamed',
        c.statement || '—',
        c.verification || '⚠ No verification method',
        c.evidence.map((e) => evidenceById(e).label).join(', ') || '—',
        `${c.weight} (${percent(c.weight / totalWeight)})`,
        owners.length > 0 ? owners.join(', ') : 'All reviewers',
      ];
    });
    return blocks(
      heading(2, label),
      table(['Criterion', 'Passes when', 'Verified by', 'Evidence', 'Weight', 'Owner'], rows),
    );
  };

  const scoringGuide = blocks(
    heading(2, 'Scoring guide'),
    table(
      ['Score', 'Meaning'],
      [
        ['1.0', 'Fully met. Verified directly, with evidence recorded.'],
        ['0.8', 'Met, with a minor observation that does not affect the outcome.'],
        ['0.6', 'Partially met. A real gap remains but the shape is right.'],
        ['0.3', 'Largely unmet. Substantial rework required.'],
        ['0.0', 'Not met, or not attempted.'],
        ['—', 'Unverified. Could not be inspected. Never counts as passing.'],
      ],
    ),
    bullets([
      `Overall score = the weighted mean of all criterion scores. Passing requires **${percent(q.passingScore)}**.`,
      'Every mandatory criterion must independently reach a passing state. A strong overall score never substitutes for a failed mandatory criterion.',
      'Unverified criteria block completion under any policy — you cannot approve what nobody checked.',
    ]),
  );

  const subjective =
    q.subjectiveGoals.length > 0
      ? blocks(
          heading(2, 'Subjective goals behind these criteria'),
          'These are the judgement-based goals the criteria above were written to make checkable:',
          bullets(q.subjectiveGoals),
        )
      : '';

  return blocks(
    heading(1, `Evaluation rubric — ${config.intent.projectName || 'Untitled Gauntlet'}`),
    config.intent.goal.trim() ? `**Goal.** ${sentence(config.intent.goal)}` : '',
    section('Mandatory criteria', 'mandatory'),
    section('Important criteria', 'important'),
    section('Desirable criteria', 'desirable'),
    scoringGuide,
    subjective,
  );
}

/* ------------------------------------------------------------------ *
 * Plain-English summary
 * ------------------------------------------------------------------ */

export function generateSummary(config: GauntletConfig): string {
  const ctx = derive(config);
  const structure = structurePresetByKind(config.topology);
  const approval = approvalById(config.approval.kind);
  const comm = communicationById(config.communication.globalMode);
  const strategy = revisionStrategyById(config.revision.strategy);

  const who = blocks(
    heading(2, 'Who is involved'),
    ctx.active.length === 0
      ? 'No agents are configured.'
      : bullets(
          ctx.active.map((a) => {
            const bits = [roleById(a.roleType).label.toLowerCase()];
            if (a.mandatoryApproval) bits.push('approval required');
            if (isReviewRole(a.roleType) && a.strictness) bits.push(strictnessById(a.strictness).label.toLowerCase());
            return `**${a.name}** — ${bits.join(', ')}. ${sentence(a.responsibility)}`;
          }),
        ),
  );

  const howItRuns = blocks(
    heading(2, 'How it runs'),
    numbered(
      [
        ctx.planner ? `${ctx.planner.name} inspects the problem and writes a plan.` : 'The work is inspected before anything is built.',
        ctx.builders.length > 1
          ? `${plural(ctx.builders.length, 'builder')} work on separate parts, each owning its own area.`
          : `${ctx.builders[0]?.name ?? 'The builder'} produces the deliverable.`,
        'Evidence is collected by actually running the required checks.',
        ctx.reviewers.length > 0
          ? `${prose(ctx.reviewers.map((r) => r.name))} review the result and return structured findings.`
          : 'No reviewers are configured, so nothing independently checks the result.',
        ctx.integrator ? `${ctx.integrator.name} assembles the parts and checks the whole.` : '',
        `Problems are fixed using the rule: ${strategy.label.toLowerCase()}.`,
        `This repeats until ${completionSentence(ctx)}.`,
      ].filter(Boolean),
    ),
  );

  const quality = blocks(
    heading(2, 'What "done" means'),
    config.quality.criteria.length === 0
      ? '⚠ No quality criteria are defined, so there is no objective way to tell whether the work is finished.'
      : lines(
          `The work is judged on ${plural(config.quality.criteria.length, 'criterion', 'criteria')}, of which ${
            ctx.mandatoryCriteria.length
          } must be met individually. The overall score must reach ${percent(config.quality.passingScore)}.`,
          '',
          `Proof is collected through: ${
            config.quality.evidence.length > 0
              ? prose(config.quality.evidence.map((e) => evidenceById(e).label.toLowerCase()))
              : 'no evidence types selected'
          }.`,
        ),
  );

  const stopping = blocks(
    heading(2, 'When it stops'),
    bullets(
      [
        `**Success:** ${completionSentence(ctx)}.`,
        config.stop.maxTotalRounds > 0 ? `**Round limit:** ${config.stop.maxTotalRounds} rounds.` : null,
        config.stop.maxCostUsd > 0 ? `**Cost limit:** $${config.stop.maxCostUsd}.` : null,
        config.stop.maxWallClockMinutes > 0 ? `**Time limit:** ${config.stop.maxWallClockMinutes} minutes.` : null,
        config.stop.plateauRounds > 0
          ? `**No progress:** stops after ${config.stop.plateauRounds} rounds with less than ${percent(config.stop.plateauDelta)} improvement.`
          : null,
        `**If the bar is not met:** the run reports an honest unresolved status — it never claims success for running out of rounds.`,
      ].filter((x): x is string => x !== null),
    ),
  );

  const checkpoints =
    config.checkpoints.length > 0
      ? blocks(
          heading(2, 'Where you are involved'),
          bullets(
            config.checkpoints.map(
              (c) =>
                `**${c.label}** — ${humanize(c.trigger).toLowerCase()}. ${
                  c.blocking ? 'The run stops and waits for you.' : 'You are notified; the run continues.'
                } It asks: "${c.question}"`,
            ),
          ),
        )
      : blocks(heading(2, 'Where you are involved'), 'No checkpoints are configured — the run proceeds without pausing for you.');

  const revisionExtras = REVISION_OPTIONS.filter((o) => config.revision[o.key] === true);

  return blocks(
    heading(1, `${config.intent.projectName || 'Untitled Gauntlet'} — how this works`),
    config.intent.goal.trim() ? sentence(config.intent.goal) : 'No goal has been described yet.',
    blocks(
      heading(2, 'The shape of it'),
      `**${structure.name}.** ${structure.description}`,
      `**Communication: ${comm.label.toLowerCase()}.** ${comm.blurb}`,
      `**Approval: ${approval.label.toLowerCase()}.** ${approval.consequence}`,
    ),
    who,
    quality,
    howItRuns,
    revisionExtras.length > 0
      ? blocks(heading(2, 'Revision rules in force'), bullets(revisionExtras.map((o) => `**${o.label}.** ${o.blurb}`)))
      : '',
    stopping,
    checkpoints,
  );
}

/* ------------------------------------------------------------------ *
 * Execution checklist
 * ------------------------------------------------------------------ */

export function generateChecklist(config: GauntletConfig): string {
  const ctx = derive(config);
  const check = (s: string) => `- [ ] ${s}`;

  const before = [
    'The agent restated the goal, deliverable and completion condition before starting.',
    'The agent inspected the actual current state before planning.',
    'A baseline was recorded of what already works.',
  ];

  const during = [
    ctx.builders.length > 1
      ? 'Only genuinely independent work ran in parallel; coupled work stayed with one owner.'
      : 'Work stayed within the declared ownership boundary.',
    'Evidence came from actually running checks, not from descriptions of expected output.',
    config.quality.evidence.includes('automated-tests')
      ? 'Real test output was pasted in, showing counts — not summarised as "tests pass".'
      : '',
    config.quality.evidence.includes('visual-screenshots')
      ? 'Screenshots were actually captured and described, at every required width.'
      : '',
    config.quality.evidence.includes('browser-testing')
      ? 'Each required flow was walked in a running browser, with per-step results.'
      : '',
    config.communication.anonymizeBuilder
      ? 'Reviewers received the artifact and evidence only — no builder reasoning or identity.'
      : '',
    config.communication.structuredFindingsOnly
      ? 'Every review came back in the structured format, not as prose.'
      : '',
    'Each finding cited specific evidence rather than a general impression.',
    config.revision.requireRegressionTests
      ? 'After every revision, previously passing checks were re-run and their results reported.'
      : '',
    config.ledger.enabled ? 'The ledger has one entry per round, including rounds that achieved nothing.' : '',
  ].filter(Boolean);

  const reviewerChecks = ctx.blockingReviewers.map(
    (r) => `${r.name} returned an explicit verdict on the final version — not an earlier one.`,
  );

  const completion = [
    `The stated completion condition was actually met: ${completionSentence(ctx)}.`,
    'Every mandatory criterion has a score and evidence behind that score.',
    'No criterion was quietly dropped, reworded, or narrowed during the run.',
    'The deliverable matches what was asked for, not a redefinition of it.',
    'Any reviewer that abstained or never ran is reported as such, not counted as approving.',
    'Regressions introduced during the run are listed, whether or not they were fixed.',
    'If the bar was not met, the report says so with an honest status and names what is missing.',
  ];

  const redFlags = [
    'The report says "complete" but a mandatory criterion has no evidence.',
    'The round limit was reached and the run was still described as successful.',
    'A reviewer’s approval is claimed but no verdict from it appears anywhere.',
    'Tests were modified, skipped, or deleted in the same round they started passing.',
    'The final deliverable is described in different terms than the original request.',
    'Evidence is described in the future or conditional tense ("this would return", "should pass").',
    'A criterion’s wording changed between the rubric and the final report.',
  ];

  return blocks(
    heading(1, `Execution checklist — ${config.intent.projectName || 'Untitled Gauntlet'}`),
    'Use this to verify the AI actually ran the Gauntlet rather than describing one.',
    blocks(heading(2, 'Before work started'), before.map(check).join('\n')),
    blocks(heading(2, 'While it ran'), during.map(check).join('\n')),
    reviewerChecks.length > 0
      ? blocks(heading(2, 'Reviewer verdicts'), reviewerChecks.map(check).join('\n'))
      : '',
    blocks(heading(2, 'Before accepting the result'), completion.map(check).join('\n')),
    blocks(
      heading(2, 'Red flags — if you see any of these, do not accept the result'),
      bullets(redFlags, '⚠'),
    ),
  );
}
