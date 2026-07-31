/**
 * Import and export utilities.
 *
 * Exports carry an envelope with a schema version and an export timestamp so a
 * file can be identified and migrated later. Imports accept both the envelope
 * and a bare config, because users will inevitably paste one of the workflow
 * exports back in.
 */

import { gauntletId } from '../model/ids';
import { migrateConfig } from '../model/migrate';
import { SCHEMA_VERSION } from '../model/types';
import type { GauntletConfig } from '../model/types';
import { slugify } from '../engine/text';

export interface ExportEnvelope {
  format: 'gauntlet-builder/export';
  schemaVersion: number;
  exportedAt: string;
  gauntlets: GauntletConfig[];
}

export function buildExportEnvelope(gauntlets: GauntletConfig[]): ExportEnvelope {
  return {
    format: 'gauntlet-builder/export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    gauntlets,
  };
}

export function exportGauntletJson(config: GauntletConfig): string {
  return `${JSON.stringify(buildExportEnvelope([config]), null, 2)}\n`;
}

export function exportAllJson(configs: GauntletConfig[]): string {
  return `${JSON.stringify(buildExportEnvelope(configs), null, 2)}\n`;
}

export interface ImportResult {
  gauntlets: GauntletConfig[];
  notes: string[];
}

/**
 * Parses an import file. Accepts:
 *   - a full export envelope with one or many gauntlets
 *   - a single bare `GauntletConfig`
 *   - an array of bare configs
 * Throws with a readable message when none of those apply.
 */
export function parseImport(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON. Check that it was downloaded from Gauntlet Builder.');
  }

  const notes: string[] = [];
  const candidates: unknown[] = [];

  if (Array.isArray(raw)) {
    candidates.push(...raw);
  } else if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.gauntlets)) {
      candidates.push(...obj.gauntlets);
      if (typeof obj.schemaVersion === 'number' && obj.schemaVersion !== SCHEMA_VERSION) {
        notes.push(`This file uses schema version ${obj.schemaVersion}; it was upgraded to version ${SCHEMA_VERSION}.`);
      }
    } else if (obj.schema === 'gauntlet-builder/workflow') {
      throw new Error(
        'That is a generated workflow file, not a saved Gauntlet. Import the file downloaded from the Saved view instead.',
      );
    } else {
      candidates.push(raw);
    }
  } else {
    throw new Error('That file does not contain a Gauntlet configuration.');
  }

  if (candidates.length === 0) {
    throw new Error('That file contains no Gauntlets.');
  }

  const gauntlets: GauntletConfig[] = [];
  candidates.forEach((candidate, index) => {
    try {
      const { config, notes: migrationNotes } = migrateConfig(candidate);
      // A fresh id avoids silently overwriting an existing saved Gauntlet.
      gauntlets.push({
        ...config,
        meta: { ...config.meta, id: gauntletId(), isSample: false, updatedAt: new Date().toISOString() },
      });
      notes.push(...migrationNotes);
    } catch (error) {
      notes.push(
        `Entry ${index + 1} could not be imported: ${error instanceof Error ? error.message : 'unknown problem'}.`,
      );
    }
  });

  if (gauntlets.length === 0) {
    throw new Error('None of the entries in that file could be read as a Gauntlet.');
  }

  return { gauntlets, notes: Array.from(new Set(notes)) };
}

/* ------------------------------------------------------------------ *
 * Browser file helpers
 * ------------------------------------------------------------------ */

const MIME: Record<string, string> = {
  md: 'text/markdown;charset=utf-8',
  json: 'application/json;charset=utf-8',
  yaml: 'text/yaml;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
};

/** Triggers a browser download without leaving the page. */
export function downloadFile(filename: string, content: string): void {
  const ext = filename.split('.').pop() ?? 'txt';
  const blob = new Blob([content], { type: MIME[ext] ?? MIME.txt });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadGauntlet(config: GauntletConfig): void {
  downloadFile(`${slugify(config.intent.projectName, 'gauntlet')}.gauntlet.json`, exportGauntletJson(config));
}

/** Copies text, falling back to a hidden textarea where the API is blocked. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Reads a user-selected file as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsText(file);
  });
}
