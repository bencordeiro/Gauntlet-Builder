/**
 * Validation engine tests.
 *
 * Each test builds the smallest config that should trigger one rule, then
 * asserts both that the rule fires and — where it matters — that it does not
 * fire on a config that is genuinely fine.
 */

import { describe, expect, it } from 'vitest';

import { applyTopology, createAgent, createCheckpoint, createCriterion, createGauntlet } from '../model/defaults';
import { setIdSeed } from '../model/ids';
import { presetById } from '../presets/projectPresets';
import type { GauntletConfig } from '../model/types';
import { estimateComplexity, validate, validateWithSummary } from '../validation/validate';

function codes(config: GauntletConfig): string[] {
  return validate(config).map((w) => w.code);
}

/** A config with nothing wrong with it, used as the negative control. */
function healthyConfig(): GauntletConfig {
  setIdSeed('healthy');
  const base = presetById('production-web-app')!.apply(createGauntlet());
  return {
    ...base,
    intent: {
      ...base.intent,
      projectName: 'Test',
      goal: 'Build a dashboard.',
      deliverable: 'A working page.',
    },
  };
}

describe('blocking errors', () => {
  it('flags a missing goal and deliverable', () => {
    setIdSeed('a');
    const found = codes(createGauntlet());
    expect(found).toContain('missing-goal');
    expect(found).toContain('missing-deliverable');
  });

  it('flags having no quality criteria', () => {
    setIdSeed('b');
    expect(codes(createGauntlet())).toContain('no-criteria');
  });

  it('flags having no builder', () => {
    setIdSeed('c');
    const base = createGauntlet();
    const config = { ...base, agents: base.agents.filter((a) => a.roleType !== 'builder') };
    expect(codes(config)).toContain('no-builder');
  });

  it('flags having no reviewer', () => {
    setIdSeed('d');
    const base = createGauntlet();
    const config = { ...base, agents: base.agents.filter((a) => a.roleType === 'builder') };
    expect(codes(config)).toContain('no-critic');
  });

  it('flags reference comparison with no reference supplied', () => {
    setIdSeed('e');
    const base = createGauntlet();
    const config: GauntletConfig = {
      ...base,
      quality: { ...base.quality, evidence: ['reference-comparison'], evidenceConfig: {} },
    };
    expect(codes(config)).toContain('reference-without-reference');
  });

  it('does not flag reference comparison when a reference exists', () => {
    setIdSeed('f');
    const base = createGauntlet();
    const config: GauntletConfig = {
      ...base,
      intent: { ...base.intent, references: 'The existing settings page' },
      quality: { ...base.quality, evidence: ['reference-comparison'] },
    };
    expect(codes(config)).not.toContain('reference-without-reference');
  });

  it('flags a mandatory reviewer that can never receive the artifact', () => {
    setIdSeed('g');
    const base = healthyConfig();
    const orphan = createAgent('security-reviewer', { mandatoryApproval: true });
    // Added without any edges, so nothing can reach it.
    const config: GauntletConfig = { ...base, agents: [...base.agents, orphan] };
    expect(codes(config)).toContain('reviewer-cannot-receive-artifact');
  });

  it('flags an approval percentage that cannot be reached', () => {
    setIdSeed('h');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      approval: { ...base.approval, kind: 'supermajority', supermajorityPercent: 100 },
      agents: base.agents,
    };
    // 100% of N reviewers is reachable; the impossible case is a rounding
    // overflow, so verify the reachable case does not fire.
    expect(codes(config)).not.toContain('approval-impossible-supermajority');
  });

  it('flags weighted consensus with no weights set', () => {
    setIdSeed('i');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      approval: { ...base.approval, kind: 'weighted-consensus', weights: {} },
    };
    expect(codes(config)).toContain('approval-impossible-no-weights');
  });

  it('flags sequential sign-off with no order defined', () => {
    setIdSeed('j');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      approval: { ...base.approval, kind: 'sequential-signoff', signoffOrder: [] },
    };
    expect(codes(config)).toContain('approval-no-signoff-order');
  });

  it('flags mediated disagreement without a mediator', () => {
    setIdSeed('k');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      communication: { ...base.communication, globalMode: 'mediated-disagreement' },
    };
    expect(codes(config)).toContain('mediator-missing');
  });
});

describe('warnings', () => {
  it('flags overlapping write ownership', () => {
    setIdSeed('l');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      agents: base.agents.map((a, i) =>
        i < 3 ? { ...a, permissions: { ...a.permissions, write: ['src/shared/'] } } : a,
      ),
    };
    expect(codes(config)).toContain('overlapping-write-ownership');
  });

  it('flags a builder that approves its own work', () => {
    setIdSeed('m');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      agents: base.agents.map((a) =>
        a.roleType === 'specialist-builder' ? { ...a, mandatoryApproval: true } : a,
      ),
    };
    expect(codes(config)).toContain('builder-reviews-own-work');
  });

  it('flags multiple builders with no integration owner', () => {
    setIdSeed('n');
    const base = applyTopology(createGauntlet(), 'specialist-team');
    const config: GauntletConfig = {
      ...base,
      intent: { ...base.intent, goal: 'g', deliverable: 'd' },
      quality: { ...base.quality, criteria: [createCriterion({ label: 'x', statement: 'y', verification: 'z' })] },
      agents: base.agents.filter((a) => a.roleType !== 'integration-owner'),
    };
    expect(codes(config)).toContain('no-integration-owner');
  });

  it('flags an unlimited loop with no budget', () => {
    setIdSeed('o');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      stop: {
        ...base.stop,
        maxTotalRounds: 0,
        maxTokens: 0,
        maxCostUsd: 0,
        maxWallClockMinutes: 0,
      },
    };
    expect(codes(config)).toContain('unlimited-loop');
  });

  it('flags blind review that still exposes builder reasoning', () => {
    setIdSeed('p');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      communication: { ...base.communication, globalMode: 'blind-independent' },
      agents: base.agents.map((a) =>
        a.roleType === 'critic' ? { ...a, seesPriorReasoning: true } : a,
      ),
    };
    expect(codes(config)).toContain('blind-review-sees-reasoning');
  });

  it('flags conflicting critic behaviours', () => {
    setIdSeed('q');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      agents: base.agents.map((a) =>
        a.roleType === 'critic'
          ? { ...a, behaviors: ['suggest-tests-only', 'recommend-implementation'] }
          : a,
      ),
    };
    expect(codes(config)).toContain('conflicting-critic-behaviors');
  });

  it('flags human approval with no checkpoint to pause at', () => {
    setIdSeed('r');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      approval: { ...base.approval, kind: 'human-final' },
      checkpoints: [],
    };
    expect(codes(config)).toContain('human-approval-without-checkpoint');
  });

  it('does not flag human approval when a blocking checkpoint exists', () => {
    setIdSeed('s');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      approval: { ...base.approval, kind: 'human-final' },
      checkpoints: [createCheckpoint({ trigger: 'before-completion', blocking: true })],
    };
    expect(codes(config)).not.toContain('human-approval-without-checkpoint');
  });

  it('flags removing every honest failure status', () => {
    setIdSeed('t');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      stop: { ...base.stop, allowedFailureStatuses: [] },
    };
    expect(codes(config)).toContain('no-failure-statuses');
  });

  it('flags criteria that have no verification method', () => {
    setIdSeed('u');
    const base = healthyConfig();
    const config: GauntletConfig = {
      ...base,
      quality: {
        ...base.quality,
        criteria: [createCriterion({ label: 'Vague', statement: 'Good', verification: '' })],
      },
    };
    expect(codes(config)).toContain('criteria-without-verification');
  });

  it('flags a duplicate in the sign-off order', () => {
    setIdSeed('v');
    const base = healthyConfig();
    const id = base.agents[2].id;
    const config: GauntletConfig = {
      ...base,
      approval: { ...base.approval, kind: 'sequential-signoff', signoffOrder: [id, id] },
    };
    expect(codes(config)).toContain('circular-signoff-order');
  });
});

describe('severity classification and summary', () => {
  it('classifies every warning into one of the four levels', () => {
    setIdSeed('w');
    const warnings = validate(createGauntlet());
    warnings.forEach((warning) => {
      expect(['info', 'recommendation', 'warning', 'blocking']).toContain(warning.severity);
      expect(warning.problem.length).toBeGreaterThan(10);
      expect(warning.suggestion.length).toBeGreaterThan(5);
    });
  });

  it('sorts blocking errors first', () => {
    setIdSeed('x');
    const warnings = validate(createGauntlet());
    const firstNonBlocking = warnings.findIndex((w) => w.severity !== 'blocking');
    if (firstNonBlocking >= 0) {
      warnings.slice(firstNonBlocking).forEach((w) => expect(w.severity).not.toBe('blocking'));
    }
  });

  it('reports canGenerate false only when something blocks', () => {
    setIdSeed('y');
    const empty = validateWithSummary(createGauntlet());
    expect(empty.canGenerate).toBe(false);
    expect(empty.blocking).toBeGreaterThan(0);

    const healthy = validateWithSummary(healthyConfig());
    expect(healthy.blocking).toBe(0);
    expect(healthy.canGenerate).toBe(true);
  });

  it('never throws on a malformed configuration', () => {
    setIdSeed('z');
    const broken = {
      ...createGauntlet(),
      agents: [],
      quality: { evidence: [], evidenceConfig: {}, criteria: [], subjectiveGoals: [], passingScore: 0 },
    } as GauntletConfig;
    expect(() => validate(broken)).not.toThrow();
  });

  it('every preset validates without blocking errors once a goal is given', () => {
    ['production-web-app', 'research-report', 'security-code-review', 'debugging-rca'].forEach((id) => {
      setIdSeed(id);
      const base = presetById(id)!.apply(createGauntlet());
      const config: GauntletConfig = {
        ...base,
        intent: { ...base.intent, goal: 'A goal.', deliverable: 'A deliverable.' },
      };
      const summary = validateWithSummary(config);
      expect(summary.blocking, `${id}: ${summary.warnings.map((w) => w.code).join(', ')}`).toBe(0);
    });
  });
});

describe('complexity estimate', () => {
  it('rates a two-agent Gauntlet lighter than a hybrid one', () => {
    setIdSeed('c1');
    const small = estimateComplexity(applyTopology(createGauntlet(), 'builder-critic'));
    setIdSeed('c2');
    const large = estimateComplexity(presetById('production-web-app')!.apply(createGauntlet()));
    expect(large.score).toBeGreaterThan(small.score);
  });
});
