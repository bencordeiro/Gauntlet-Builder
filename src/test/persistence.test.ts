/**
 * Storage, import/export, and schema-migration tests.
 *
 * These cover the paths where a bug loses the user's work, so they lean on
 * hostile inputs: truncated JSON, a config from a future schema version, and a
 * file that is the wrong kind of export entirely.
 */

import { describe, expect, it } from 'vitest';

import { migrateConfig } from '../model/migrate';
import { createGauntlet } from '../model/defaults';
import { setIdSeed } from '../model/ids';
import { SCHEMA_VERSION } from '../model/types';
import type { GauntletConfig } from '../model/types';
import { presetById } from '../presets/projectPresets';
import { createSampleGauntlets } from '../presets/samples';
import {
  buildExportEnvelope,
  exportAllJson,
  exportGauntletJson,
  parseImport,
} from '../services/exportImport';
import { clearState, loadState, saveState, STORAGE_KEY } from '../services/storage';

function sample(): GauntletConfig {
  setIdSeed('persist');
  const base = presetById('research-report')!.apply(createGauntlet());
  return {
    ...base,
    intent: { ...base.intent, projectName: 'Round trip', goal: 'A goal.', deliverable: 'A report.' },
  };
}

describe('local storage', () => {
  it('seeds the sample Gauntlets on first launch', () => {
    clearState();
    const { state, notes } = loadState();
    expect(state.gauntlets.length).toBeGreaterThan(0);
    expect(state.samplesSeeded).toBe(true);
    expect(notes.join(' ')).toContain('example Gauntlets');
  });

  it('does not re-seed samples once they have been seeded', () => {
    clearState();
    const first = loadState().state;
    saveState({ ...first, gauntlets: [] });
    const second = loadState().state;
    expect(second.gauntlets).toHaveLength(0);
  });

  it('round-trips saved Gauntlets', () => {
    clearState();
    const config = sample();
    saveState({
      schemaVersion: SCHEMA_VERSION,
      gauntlets: [config],
      settings: loadState().state.settings,
      samplesSeeded: true,
    });

    const { state } = loadState();
    expect(state.gauntlets).toHaveLength(1);
    expect(state.gauntlets[0].intent.projectName).toBe('Round trip');
    expect(state.gauntlets[0].agents.length).toBe(config.agents.length);
  });

  it('recovers from corrupted stored data instead of throwing', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ this is not json');
    const { state, recovered, notes } = loadState();
    expect(recovered).toBe(true);
    expect(state.settings).toBeDefined();
    expect(notes.join(' ')).toContain('could not be read');
  });

  it('skips an unreadable Gauntlet rather than losing the rest', () => {
    const good = sample();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        gauntlets: [good, 'not an object'],
        settings: {},
        samplesSeeded: true,
      }),
    );
    const { state, notes } = loadState();
    expect(state.gauntlets).toHaveLength(1);
    expect(notes.join(' ')).toContain('could not be read and was skipped');
  });

  it('preserves settings across a save and load', () => {
    clearState();
    const { state } = loadState();
    saveState({ ...state, settings: { ...state.settings, theme: 'dark', density: 'compact' } });
    const reloaded = loadState().state;
    expect(reloaded.settings.theme).toBe('dark');
    expect(reloaded.settings.density).toBe('compact');
  });
});

describe('export and import', () => {
  it('exports an envelope carrying the schema version', () => {
    const envelope = buildExportEnvelope([sample()]);
    expect(envelope.format).toBe('gauntlet-builder/export');
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.gauntlets).toHaveLength(1);
  });

  it('round-trips a single Gauntlet through export and import', () => {
    const original = sample();
    const { gauntlets } = parseImport(exportGauntletJson(original));
    expect(gauntlets).toHaveLength(1);
    expect(gauntlets[0].intent.goal).toBe(original.intent.goal);
    expect(gauntlets[0].agents.length).toBe(original.agents.length);
    expect(gauntlets[0].quality.criteria.length).toBe(original.quality.criteria.length);
  });

  it('assigns a new id on import so nothing is silently overwritten', () => {
    const original = sample();
    const { gauntlets } = parseImport(exportGauntletJson(original));
    expect(gauntlets[0].meta.id).not.toBe(original.meta.id);
  });

  it('imports a multi-Gauntlet export', () => {
    const many = createSampleGauntlets();
    const { gauntlets } = parseImport(exportAllJson(many));
    expect(gauntlets).toHaveLength(many.length);
  });

  it('accepts a bare config without an envelope', () => {
    const original = sample();
    const { gauntlets } = parseImport(JSON.stringify(original));
    expect(gauntlets).toHaveLength(1);
    expect(gauntlets[0].intent.projectName).toBe('Round trip');
  });

  it('rejects invalid JSON with a readable message', () => {
    expect(() => parseImport('not json at all')).toThrow(/not valid JSON/);
  });

  it('rejects a generated workflow file with a specific explanation', () => {
    const workflowFile = JSON.stringify({ schema: 'gauntlet-builder/workflow', agents: [] });
    expect(() => parseImport(workflowFile)).toThrow(/generated workflow file/);
  });

  it('rejects an empty gauntlet list', () => {
    expect(() => parseImport(JSON.stringify({ gauntlets: [] }))).toThrow(/no Gauntlets/);
  });
});

describe('schema migration', () => {
  it('upgrades a version 1 config to the current version', () => {
    const v1 = {
      schemaVersion: 1,
      meta: { id: 'old', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', tags: [] },
      intent: { projectName: 'Legacy', goal: 'g', deliverable: 'd' },
      quality: { criteria: [], evidence: [] },
      topology: 'builder-critic',
      agents: [{ id: 'a1', name: 'Builder', roleType: 'builder', enabled: true }],
      communication: { globalMode: 'direct-feedback', edges: [] },
      approval: { kind: 'all-mandatory' },
      revision: { strategy: 'fix-all' },
      stop: { maxTotalRounds: 5 },
      ledger: true,
    };

    const { config, notes } = migrateConfig(v1);
    expect(config.schemaVersion).toBe(SCHEMA_VERSION);
    expect(config.intent.projectName).toBe('Legacy');
    expect(config.ledger.enabled).toBe(true);
    expect(config.stop.allowedFailureStatuses.length).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('backfills sections missing from an old file', () => {
    const partial = { schemaVersion: 2, intent: { goal: 'g' }, agents: [] };
    const { config } = migrateConfig(partial);
    expect(config.approval).toBeDefined();
    expect(config.revision).toBeDefined();
    expect(config.stop).toBeDefined();
    expect(config.ledger.fields.length).toBeGreaterThan(0);
  });

  it('assumes version 1 when none is stated', () => {
    const { config, notes } = migrateConfig({ intent: { goal: 'g' }, agents: [] });
    expect(config.schemaVersion).toBe(SCHEMA_VERSION);
    expect(notes.join(' ')).toContain('assumed version 1');
  });

  it('handles a config from a newer schema without discarding it', () => {
    const future = { ...sample(), schemaVersion: SCHEMA_VERSION + 5 };
    const { config, notes } = migrateConfig(future);
    expect(config.intent.projectName).toBe('Round trip');
    expect(notes.join(' ')).toContain('newer version');
  });

  it('rejects input that is not an object', () => {
    expect(() => migrateConfig('a string')).toThrow();
    expect(() => migrateConfig([1, 2, 3])).toThrow();
    expect(() => migrateConfig(null)).toThrow();
  });

  it('adds agent fields introduced after version 2', () => {
    const v2 = {
      schemaVersion: 2,
      intent: { goal: 'g', deliverable: 'd' },
      agents: [{ id: 'a', name: 'Critic', roleType: 'critic', enabled: true }],
      approval: { kind: 'all-mandatory' },
    };
    const { config } = migrateConfig(v2);
    expect(config.agents[0].ownedCriteria).toEqual([]);
    expect(config.agents[0].permissions).toEqual({ write: [], readOnly: [], forbidden: [] });
    expect(config.approval.hybridFinalStage).toBeDefined();
  });
});

describe('sample gauntlets', () => {
  it('creates realistic, fully-populated examples', () => {
    const samples = createSampleGauntlets();
    expect(samples.length).toBeGreaterThanOrEqual(4);
    samples.forEach((sampleConfig) => {
      expect(sampleConfig.intent.projectName).not.toBe('');
      expect(sampleConfig.intent.goal.length).toBeGreaterThan(20);
      expect(sampleConfig.intent.deliverable).not.toBe('');
      expect(sampleConfig.agents.length).toBeGreaterThan(1);
      expect(sampleConfig.quality.criteria.length).toBeGreaterThan(0);
      expect(sampleConfig.meta.isSample).toBe(true);
    });
  });

  it('gives each sample a unique id', () => {
    const ids = createSampleGauntlets().map((s) => s.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
