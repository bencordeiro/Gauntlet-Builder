/**
 * Minimal deterministic YAML serializer.
 *
 * Written rather than pulled in as a dependency so that output formatting is
 * fully under our control and byte-stable across runs — the determinism test
 * compares generated exports directly. Handles the subset of YAML the workflow
 * config actually needs: maps, sequences, strings, numbers, booleans, null.
 */

type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };

/** YAML indicator characters, which only matter as the first character. */
const LEADING_INDICATORS = new Set([
  '-', '?', ':', ',', '[', ']', '{', '}', '#', '&', '*', '!', '|', '>', "'", '"', '%', '@', '`',
]);

const RESERVED_WORDS = /^(true|false|null|yes|no|on|off|~)$/i;
const NUMERIC = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Decides whether a scalar needs quoting. Written as explicit checks rather
 * than one regex: an earlier version used a character class containing `#-?`,
 * which YAML-quoted almost every string because `#-?` is a *range*, not three
 * literals.
 */
function needsQuotes(value: string): boolean {
  if (value.length === 0) return true;
  if (value !== value.trim()) return true;
  if (LEADING_INDICATORS.has(value[0])) return true;
  // `: ` starts a mapping and ` #` starts a comment, anywhere in the scalar.
  if (value.includes(': ') || value.includes(' #')) return true;
  if (value.endsWith(':')) return true;
  if (RESERVED_WORDS.test(value)) return true;
  if (NUMERIC.test(value)) return true;
  return false;
}

function quoteString(value: string): string {
  // Multi-line strings use a literal block, handled by the caller.
  if (value.includes('\n')) return '';
  return needsQuotes(value) ? `'${value.replace(/'/g, "''")}'` : value;
}

function isPlainObject(value: unknown): value is Record<string, Serializable> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeValue(value: Serializable, indentLevel: number): string {
  const pad = '  '.repeat(indentLevel);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';

  if (typeof value === 'string') {
    if (value.includes('\n')) {
      const body = value
        .split('\n')
        .map((line) => (line.length > 0 ? `${pad}  ${line}` : ''))
        .join('\n');
      return `|-\n${body}`;
    }
    return quoteString(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `\n${value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          const nested = serializeValue(item, indentLevel + 1);
          // Hoist the first key onto the dash line for conventional formatting.
          const trimmed = nested.replace(/^\n/, '');
          const firstNewline = trimmed.indexOf('\n');
          if (firstNewline === -1) return `${pad}- ${trimmed.trim()}`;
          const first = trimmed.slice(0, firstNewline).trim();
          const rest = trimmed.slice(firstNewline + 1);
          return `${pad}- ${first}\n${rest}`;
        }
        return `${pad}- ${serializeValue(item, indentLevel + 1)}`;
      })
      .join('\n')}`;
  }

  const entries = Object.entries(value).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '{}';

  return `\n${entries
    .map(([key, v]) => {
      const rendered = serializeValue(v, indentLevel + 1);
      if (rendered.startsWith('\n')) return `${pad}${key}:${rendered}`;
      return `${pad}${key}: ${rendered}`;
    })
    .join('\n')}`;
}

/** Serializes a value to a YAML document. */
export function toYaml(value: Serializable, header?: string): string {
  const body = serializeValue(value, 0).replace(/^\n/, '');
  return header ? `# ${header}\n${body}\n` : `${body}\n`;
}
