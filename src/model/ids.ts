/**
 * Stable ID generation.
 *
 * Agents, criteria, edges and checkpoints are referenced from other parts of
 * the config (approval weights, sign-off order, owned criteria), so their IDs
 * must survive renames, reordering, save/load and export/import. Tests can
 * call `setIdSeed` to make a run reproducible.
 */

let counter = 0;
let seed: string | null = null;

const RADIX = 36;

/** Short, URL-safe, collision-resistant enough for a single-user local app. */
function randomChunk(): string {
  if (seed !== null) return seed;
  return Math.random().toString(RADIX).slice(2, 8);
}

/**
 * Creates a new ID with a type prefix, e.g. `agent_lq4f8s_3`.
 * The prefix makes IDs readable in exported JSON and easier to debug.
 */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${randomChunk()}_${counter}`;
}

export const agentId = () => newId('agent');
export const criterionId = () => newId('crit');
export const edgeId = () => newId('edge');
export const checkpointId = () => newId('chk');
export const gauntletId = () => newId('gauntlet');

/**
 * Forces deterministic IDs. Pass a fixed string in tests, `null` to restore
 * random behaviour. Also resets the counter so sequences repeat exactly.
 */
export function setIdSeed(value: string | null): void {
  seed = value;
  counter = 0;
}
