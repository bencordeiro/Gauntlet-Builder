/**
 * Local-storage persistence.
 *
 * Everything is stored under one key as a versioned envelope so that migration
 * has a single entry point. All reads are defensive: a corrupted or truncated
 * value must degrade to defaults rather than leaving the app unusable, since
 * the user has no other copy of their data.
 */

import { migrateConfig } from '../model/migrate';
import { SCHEMA_VERSION } from '../model/types';
import type { AppSettings, GauntletConfig, PersistedState } from '../model/types';
import { createSampleGauntlets } from '../presets/samples';

export const STORAGE_KEY = 'gauntlet-builder:state:v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  advancedByDefault: false,
  defaultEnvironment: 'claude-code',
  ledgerByDefault: true,
  showSamples: true,
  autosave: true,
  density: 'comfortable',
};

function emptyState(): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    gauntlets: [],
    settings: { ...DEFAULT_SETTINGS },
    samplesSeeded: false,
  };
}

/** True when localStorage is actually usable (it throws in some private modes). */
export function storageAvailable(): boolean {
  try {
    const probe = '__gauntlet_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult {
  state: PersistedState;
  /** Notes from migrating stored gauntlets, surfaced once in the UI. */
  notes: string[];
  /** True when the stored value could not be read and defaults were used. */
  recovered: boolean;
}

export function loadState(): LoadResult {
  const notes: string[] = [];

  if (!storageAvailable()) {
    return { state: seedIfNeeded(emptyState(), notes), notes, recovered: false };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { state: seedIfNeeded(emptyState(), notes), notes, recovered: false };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const gauntlets: GauntletConfig[] = [];

    if (Array.isArray(parsed.gauntlets)) {
      parsed.gauntlets.forEach((candidate) => {
        try {
          const { config, notes: migrationNotes } = migrateConfig(candidate);
          gauntlets.push(config);
          migrationNotes.forEach((n) => {
            const message = `${config.intent.projectName || 'A saved Gauntlet'}: ${n}`;
            if (!notes.includes(message)) notes.push(message);
          });
        } catch {
          notes.push('One saved Gauntlet could not be read and was skipped.');
        }
      });
    }

    const state: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      gauntlets,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      draftId: typeof parsed.draftId === 'string' ? parsed.draftId : undefined,
      samplesSeeded: parsed.samplesSeeded === true,
    };

    return { state: seedIfNeeded(state, notes), notes, recovered: false };
  } catch {
    notes.push('Your saved data could not be read, so the app started fresh. Nothing was overwritten yet.');
    return { state: seedIfNeeded(emptyState(), notes), notes, recovered: true };
  }
}

/** Adds the sample gauntlets exactly once, on genuine first launch. */
function seedIfNeeded(state: PersistedState, notes: string[]): PersistedState {
  if (state.samplesSeeded || state.gauntlets.length > 0) return state;
  notes.push('Added four example Gauntlets so you have something to look at. You can delete them any time.');
  return { ...state, gauntlets: createSampleGauntlets(), samplesSeeded: true };
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/** Writes immediately. Returns false if the write failed (e.g. quota). */
export function saveState(state: PersistedState): boolean {
  if (!storageAvailable()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Debounced write, used by autosave so typing in a textarea does not serialise
 * the whole state on every keystroke.
 */
export function saveStateDebounced(state: PersistedState, delayMs = 400): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    saveState(state);
    writeTimer = null;
  }, delayMs);
}

/** Flushes any pending debounced write. Called before unload. */
export function flushPendingSave(state: PersistedState): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  saveState(state);
}

export function clearState(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do; the caller will reload into defaults anyway.
  }
}
