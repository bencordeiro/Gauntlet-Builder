/**
 * Prompt-generation engine tests.
 *
 * These run against the engine directly, with no React involved, and assert the
 * properties that actually matter: the same config produces the same bytes, the
 * user's configuration genuinely reaches the output, and the anti-false-success
 * rules are present regardless of how the Gauntlet was configured.
 */

import { describe, expect, it } from 'vitest';

import {
  generateAgentInstruction,
  generateChecklist,
  generateMasterPrompt,
  generatePackage,
  generateRubric,
  generateSummary,
  generateWorkflowJson,
  generateWorkflowYaml,
} from '../engine';
import { buildWorkflowDocument } from '../engine/workflowConfig';
import { applyTopology, createAgent, createCriterion, createGauntlet } from '../model/defaults';
import { setIdSeed } from '../model/ids';
import { presetById } from '../presets/projectPresets';
import type { GauntletConfig } from '../model/types';

/** A realistic config used across several tests. */
function sampleConfig(): GauntletConfig {
  setIdSeed('fixture');
  const preset = presetById('production-web-app')!;
  const base = preset.apply(createGauntlet());
  return {
    ...base,
    intent: {
      ...base.intent,
      projectName: 'Billing dashboard',
      goal: 'Build a billing dashboard showing plan, invoices and usage.',
      deliverable: 'A working React page with tests passing.',
      audience: 'Paying customers on a phone.',
      requirements: ['Must work at 390px wide'],
      prohibitions: ['Do not modify the billing API'],
      tools: ['Shell commands'],
    },
  };
}

describe('master prompt generation', () => {
  it('is deterministic for the same configuration', () => {
    const a = generateMasterPrompt(sampleConfig());
    const b = generateMasterPrompt(sampleConfig());
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(2000);
  });

  it('produces byte-identical packages when the timestamp is pinned', () => {
    const at = '2026-01-01T00:00:00.000Z';
    const a = generatePackage(sampleConfig(), at);
    const b = generatePackage(sampleConfig(), at);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('includes every required section', () => {
    const prompt = generateMasterPrompt(sampleConfig());
    const required = [
      'Objective',
      'Requirements and boundaries',
      'Quality bar and required evidence',
      'Agent roles and ownership',
      'How agents communicate',
      'How to run the loop',
      'Instructions for building agents',
      'Instructions for reviewing agents',
      'Required review output format',
      'Approval policy',
      'Revision policy',
      'Stopping conditions',
      'Human checkpoints',
      'Progress ledger',
      'Required final report',
    ];
    required.forEach((section) => expect(prompt).toContain(section));
  });

  it('carries the user’s goal, deliverable, requirements and prohibitions through', () => {
    const prompt = generateMasterPrompt(sampleConfig());
    expect(prompt).toContain('Build a billing dashboard');
    expect(prompt).toContain('A working React page with tests passing');
    expect(prompt).toContain('Must work at 390px wide');
    expect(prompt).toContain('Do not modify the billing API');
  });

  it('forbids claiming success on reaching a limit, under every approval policy', () => {
    const policies: Array<GauntletConfig['approval']['kind']> = [
      'all-mandatory',
      'unanimous',
      'majority',
      'supermajority',
      'weighted-consensus',
      'sequential-signoff',
      'lead-decides',
      'human-final',
      'hybrid',
    ];

    policies.forEach((kind) => {
      const config = { ...sampleConfig(), approval: { ...sampleConfig().approval, kind } };
      const prompt = generateMasterPrompt(config);
      expect(prompt, kind).toContain('Do not declare success because the round limit was reached');
      expect(prompt, kind).toContain('Do not claim reviewers approved when they did not');
      expect(prompt, kind).toContain('Reaching a limit is not success');
    });
  });

  it('lists the honest failure statuses the user allowed', () => {
    const config = sampleConfig();
    const prompt = generateMasterPrompt(config);
    config.stop.allowedFailureStatuses.forEach((status) => {
      expect(prompt).toContain(status);
    });
  });

  it('omits failure statuses the user removed', () => {
    const base = sampleConfig();
    const config: GauntletConfig = {
      ...base,
      stop: { ...base.stop, allowedFailureStatuses: ['incomplete'] },
    };
    const prompt = generateMasterPrompt(config);
    expect(prompt).toContain('`incomplete`');
    expect(prompt).not.toContain('`budget-exhausted`');
  });

  it('reflects the chosen communication mode in the rules', () => {
    const base = sampleConfig();
    const blind: GauntletConfig = {
      ...base,
      communication: { ...base.communication, globalMode: 'blind-independent', anonymizeBuilder: true },
    };
    const prompt = generateMasterPrompt(blind);
    expect(prompt).toContain('Blind independent review');
    expect(prompt).toContain('must not receive the builder’s reasoning');
  });

  it('emits sequential simulation instructions only when subagents are unavailable', () => {
    const base = sampleConfig();

    const withSubagents = generateMasterPrompt({
      ...base,
      intent: { ...base.intent, environment: 'claude-code' },
    });
    expect(withSubagents).toContain('This environment supports real sub-agents');
    expect(withSubagents).not.toContain('Sequential role simulation');

    const withoutSubagents = generateMasterPrompt({
      ...base,
      intent: { ...base.intent, environment: 'general-llm' },
    });
    expect(withoutSubagents).toContain('Sequential role simulation');
    expect(withoutSubagents).toContain('CONTEXT RESET');
  });

  it('includes the structured critic response schema', () => {
    const prompt = generateMasterPrompt(sampleConfig());
    expect(prompt).toContain('"largest_verified_gap"');
    expect(prompt).toContain('"regression_risks"');
    expect(prompt).toContain('"required_retest"');
    expect(prompt).toContain('"approval_conditions"');
    expect(prompt).toContain('"mandatory_gate"');
  });

  it('renders the progress ledger only when enabled', () => {
    const base = sampleConfig();
    expect(generateMasterPrompt(base)).toContain('Progress ledger');
    const off = generateMasterPrompt({ ...base, ledger: { ...base.ledger, enabled: false } });
    expect(off).not.toContain('## 14. Progress ledger');
  });

  it('warns when no budget bounds the loop', () => {
    const base = sampleConfig();
    const unbounded: GauntletConfig = {
      ...base,
      stop: {
        ...base.stop,
        maxTotalRounds: 0,
        maxTokens: 0,
        maxCostUsd: 0,
        maxWallClockMinutes: 0,
      },
    };
    expect(generateMasterPrompt(unbounded)).toContain('No budget is configured');
  });
});

describe('agent instructions', () => {
  it('generates one prompt per enabled agent', () => {
    const config = sampleConfig();
    config.agents.forEach((agent) => {
      const instruction = generateAgentInstruction(config, agent);
      expect(instruction).toContain(agent.name);
      expect(instruction).toContain('The completion condition');
    });
  });

  it('withholds project context from a reviewer that must not see reasoning', () => {
    setIdSeed('blind');
    let config = createGauntlet();
    config = {
      ...config,
      intent: {
        ...config.intent,
        goal: 'Ship the thing',
        deliverable: 'A page',
        context: 'SECRET_BUILDER_RATIONALE',
      },
    };
    const critic = config.agents.find((a) => a.roleType === 'critic')!;
    const blindCritic = { ...critic, seesPriorReasoning: false };

    const instruction = generateAgentInstruction(config, blindCritic);
    expect(instruction).not.toContain('SECRET_BUILDER_RATIONALE');
    expect(instruction).toContain('Judge from the artifact and the evidence alone');
  });

  it('tells a mandatory reviewer that its approval is required', () => {
    const config = sampleConfig();
    const mandatory = config.agents.find((a) => a.mandatoryApproval)!;
    const instruction = generateAgentInstruction(config, mandatory);
    expect(instruction).toContain('Your approval is **required**');
  });

  it('forbids reviewers from returning only a judgement', () => {
    const config = sampleConfig();
    const reviewer = config.agents.find((a) => a.roleType === 'security-reviewer');
    if (!reviewer) return;
    const instruction = generateAgentInstruction(config, reviewer);
    expect(instruction).toContain('You may not say only "not good enough"');
  });
});

describe('rubric, summary and checklist', () => {
  it('lists every criterion in the rubric', () => {
    const config = sampleConfig();
    const rubric = generateRubric(config);
    config.quality.criteria.forEach((criterion) => {
      expect(rubric).toContain(criterion.label);
    });
  });

  it('marks criteria that have no verification method', () => {
    setIdSeed('novalid');
    const base = createGauntlet();
    const config: GauntletConfig = {
      ...base,
      quality: {
        ...base.quality,
        criteria: [createCriterion({ label: 'Vague', statement: 'It is good', verification: '' })],
      },
    };
    expect(generateRubric(config)).toContain('No verification method');
  });

  it('says plainly when nothing objective is configured', () => {
    setIdSeed('empty');
    const config = createGauntlet();
    const summary = generateSummary(config);
    expect(summary).toContain('No quality criteria are defined');
  });

  it('produces a checklist with red flags', () => {
    const checklist = generateChecklist(sampleConfig());
    expect(checklist).toContain('Red flags');
    expect(checklist).toContain('The round limit was reached and the run was still described as successful');
    expect(checklist).toContain('- [ ]');
  });
});

describe('workflow config export', () => {
  it('produces valid JSON with the current schema version', () => {
    const json = generateWorkflowJson(sampleConfig());
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('gauntlet-builder/workflow');
    expect(parsed.schemaVersion).toBeGreaterThan(0);
    expect(Array.isArray(parsed.agents)).toBe(true);
  });

  it('materialises which reviewers actually block completion', () => {
    const doc = buildWorkflowDocument(sampleConfig());
    expect(Array.isArray(doc.approval.blockingReviewers)).toBe(true);
    const blocking = doc.agents.filter((a) => a.blocksCompletion);
    expect(blocking.length).toBeGreaterThan(0);
  });

  it('records that reaching a limit is not success', () => {
    const doc = buildWorkflowDocument(sampleConfig());
    expect(doc.stopping.limitReachedIsNotSuccess).toBe(true);
    expect(doc.stopping.successRequiresApproval).toBe(true);
  });

  it('excludes disabled agents from the machine-readable export', () => {
    const base = sampleConfig();
    const disabled = base.agents[1];
    const config: GauntletConfig = {
      ...base,
      agents: base.agents.map((a) => (a.id === disabled.id ? { ...a, enabled: false } : a)),
    };
    const doc = buildWorkflowDocument(config);
    expect(doc.agents.some((a) => a.id === disabled.id)).toBe(false);
  });

  it('produces YAML that round-trips the key fields', () => {
    const yaml = generateWorkflowYaml(sampleConfig());
    expect(yaml).toContain('schema: gauntlet-builder/workflow');
    expect(yaml).toContain('agents:');
    expect(yaml).toContain('approval:');
    // Values needing quotes must actually be quoted.
    expect(yaml).not.toMatch(/name: .*: /);
  });

  it('is deterministic', () => {
    expect(generateWorkflowYaml(sampleConfig())).toBe(generateWorkflowYaml(sampleConfig()));
    expect(generateWorkflowJson(sampleConfig())).toBe(generateWorkflowJson(sampleConfig()));
  });
});

describe('package generation', () => {
  it('returns all seven outputs with filenames', () => {
    const pkg = generatePackage(sampleConfig());
    expect(pkg.outputs).toHaveLength(7);
    pkg.outputs.forEach((output) => {
      expect(output.filename).toMatch(/\.(md|json|yaml)$/);
      expect(output.content.length).toBeGreaterThan(0);
    });
  });

  it('estimates the master prompt size', () => {
    const pkg = generatePackage(sampleConfig());
    expect(pkg.masterPromptTokens).toBeGreaterThan(300);
  });
});

describe('topology application', () => {
  it('builds a distinct roster per structure', () => {
    setIdSeed('topo');
    const kinds = [
      'builder-critic',
      'specialist-team',
      'sequential-gates',
      'red-team',
      'consensus-council',
      'hybrid',
    ] as const;

    kinds.forEach((kind) => {
      const config = applyTopology(createGauntlet({ agents: [] }), kind);
      expect(config.agents.length, kind).toBeGreaterThan(0);
      expect(config.communication.edges.length, kind).toBeGreaterThan(0);
      expect(config.topology).toBe(kind);
    });
  });

  it('gives every enabled agent at least one communication path', () => {
    const config = applyTopology(createGauntlet({ agents: [] }), 'hybrid');
    config.agents
      .filter((a) => a.enabled)
      .forEach((agent) => {
        const connected = config.communication.edges.some(
          (e) => e.from === agent.id || e.to === agent.id,
        );
        expect(connected, `${agent.name} is isolated`).toBe(true);
      });
  });

  it('creates unique ids for duplicated agents', () => {
    setIdSeed(null);
    const a = createAgent('critic');
    const b = createAgent('critic');
    expect(a.id).not.toBe(b.id);
  });
});
