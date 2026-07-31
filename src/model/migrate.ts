/**
 * Schema migration.
 *
 * Saved and imported configs carry a `schemaVersion`. Each migration step
 * upgrades one version to the next, so a v1 file imported into a v3 build runs
 * through every step in order. Unknown or missing sections are filled from
 * defaults rather than rejected — a partially-valid import is more useful to a
 * user than an error.
 */

import {
  defaultApproval,
  defaultCommunication,
  defaultIntent,
  defaultLedger,
  defaultQualityBar,
  defaultRevision,
  defaultStop,
} from './defaults';
import { SCHEMA_VERSION } from './types';
import type { GauntletConfig } from './types';

export interface MigrationResult {
  config: GauntletConfig;
  /** Human-readable notes about what had to be changed on the way in. */
  notes: string[];
}

type Migration = (input: Record<string, unknown>, notes: string[]) => Record<string, unknown>;

/**
 * v1 → v2: stop policy gained explicit failure statuses, and the ledger moved
 * from a boolean to a configuration object.
 */
const v1ToV2: Migration = (input, notes) => {
  const stop = (input.stop ?? {}) as Record<string, unknown>;
  if (!Array.isArray(stop.allowedFailureStatuses)) {
    stop.allowedFailureStatuses = defaultStop().allowedFailureStatuses;
    notes.push('Added the default set of honest failure statuses.');
  }
  if (typeof input.ledger === 'boolean') {
    notes.push('Upgraded the progress ledger from on/off to a field configuration.');
    input.ledger = { ...defaultLedger(), enabled: input.ledger };
  }
  input.stop = stop;
  input.schemaVersion = 2;
  return input;
};

/**
 * v2 → v3: agents gained per-agent strictness/behaviors, and the approval
 * policy gained the hybrid two-stage fields.
 */
const v2ToV3: Migration = (input, notes) => {
  const approval = (input.approval ?? {}) as Record<string, unknown>;
  if (approval.hybridFinalStage === undefined) {
    approval.hybridFinalStage = 'lead';
    approval.hybridGateIds = approval.hybridGateIds ?? [];
    notes.push('Added hybrid approval settings.');
  }
  if (approval.allowVeto === undefined) {
    approval.allowVeto = true;
    approval.vetoEscalatesAfter = 3;
  }
  input.approval = approval;

  const agents = Array.isArray(input.agents) ? (input.agents as Record<string, unknown>[]) : [];
  let patched = 0;
  agents.forEach((agent) => {
    if (agent.ownedCriteria === undefined) {
      agent.ownedCriteria = [];
      patched += 1;
    }
    if (agent.permissions === undefined) {
      agent.permissions = { write: [], readOnly: [], forbidden: [] };
    }
  });
  if (patched > 0) notes.push(`Added criterion ownership to ${patched} agent(s).`);

  input.schemaVersion = 3;
  return input;
};

const MIGRATIONS: Record<number, Migration> = {
  1: v1ToV2,
  2: v2ToV3,
};

/** Fills in any section missing from an imported object. */
function fillMissingSections(input: Record<string, unknown>, notes: string[]): void {
  const sections: Array<[string, () => unknown]> = [
    ['intent', defaultIntent],
    ['quality', defaultQualityBar],
    ['communication', defaultCommunication],
    ['approval', defaultApproval],
    ['revision', defaultRevision],
    ['stop', defaultStop],
    ['ledger', defaultLedger],
  ];
  for (const [key, factory] of sections) {
    if (input[key] === undefined || input[key] === null || typeof input[key] !== 'object') {
      input[key] = factory();
      notes.push(`Restored missing "${key}" settings from defaults.`);
    }
  }
  if (!Array.isArray(input.agents)) {
    input.agents = [];
    notes.push('No agents were present in the file.');
  }
  if (!Array.isArray(input.checkpoints)) input.checkpoints = [];
  if (typeof input.topology !== 'string') input.topology = 'custom';
  if (typeof input.additionalInstructions !== 'string') input.additionalInstructions = '';
}

/** Fills defaults for keys added inside an existing section. */
function backfillSectionKeys(config: GauntletConfig): GauntletConfig {
  return {
    ...config,
    intent: { ...defaultIntent(), ...config.intent },
    quality: { ...defaultQualityBar(), ...config.quality },
    communication: { ...defaultCommunication(), ...config.communication },
    approval: { ...defaultApproval(), ...config.approval },
    revision: { ...defaultRevision(), ...config.revision },
    stop: { ...defaultStop(), ...config.stop },
    ledger: { ...defaultLedger(), ...config.ledger },
  };
}

/**
 * Brings any previously-exported config up to the current schema version.
 * Throws only when the input is not an object at all.
 */
export function migrateConfig(raw: unknown): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('This file does not contain a Gauntlet configuration.');
  }

  const notes: string[] = [];
  let working = { ...(raw as Record<string, unknown>) };

  let version = typeof working.schemaVersion === 'number' ? working.schemaVersion : 1;
  if (typeof working.schemaVersion !== 'number') {
    notes.push('No schema version found; assumed version 1.');
  }

  if (version > SCHEMA_VERSION) {
    notes.push(
      `This file was made by a newer version of Gauntlet Builder (schema ${version}). ` +
        'Unknown settings were kept as-is and may not be editable here.',
    );
    version = SCHEMA_VERSION;
    working.schemaVersion = SCHEMA_VERSION;
  }

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    working = step(working, notes);
    version = working.schemaVersion as number;
  }

  fillMissingSections(working, notes);
  working.schemaVersion = SCHEMA_VERSION;

  const meta = (working.meta ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  working.meta = {
    id: typeof meta.id === 'string' ? meta.id : `gauntlet_imported_${Date.now()}`,
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : now,
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : now,
    basePresetId: typeof meta.basePresetId === 'string' ? meta.basePresetId : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    isSample: false,
  };

  return { config: backfillSectionKeys(working as unknown as GauntletConfig), notes };
}
