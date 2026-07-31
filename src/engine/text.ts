/**
 * Deterministic text helpers for the prompt engine.
 *
 * Every function here is pure and order-preserving: the same config must always
 * produce byte-identical output, which is what the determinism test asserts.
 */

/** Joins non-empty blocks with exactly one blank line between them. */
export function blocks(...parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.replace(/\s+$/, ''))
    .join('\n\n');
}

/** Joins lines, dropping empties. */
export function lines(...parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('\n');
}

/** Renders a markdown bullet list. Returns '' for an empty list. */
export function bullets(items: Array<string | null | undefined>, marker = '-'): string {
  const clean = items.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
  if (clean.length === 0) return '';
  return clean.map((i) => `${marker} ${i.trim()}`).join('\n');
}

/** Renders a numbered list starting at 1. */
export function numbered(items: Array<string | null | undefined>): string {
  const clean = items.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
  if (clean.length === 0) return '';
  return clean.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');
}

/** A markdown heading at the given level. */
export function heading(level: number, text: string): string {
  return `${'#'.repeat(Math.max(1, Math.min(6, level)))} ${text}`;
}

/** A fenced code block. */
export function fence(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${content.replace(/\s+$/, '')}\n\`\`\``;
}

/** Escapes pipe characters so text is safe inside a markdown table cell. */
export function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}

/** Renders a markdown table. `rows` must match `headers` in length. */
export function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.map(cell).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(cell).join(' | ')} |`).join('\n');
  return rows.length > 0 ? `${head}\n${sep}\n${body}` : `${head}\n${sep}`;
}

/** Sentence-cases a slug like `requires-human-decision`. */
export function humanize(slug: string): string {
  const words = slug.replace(/[-_]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Trims and collapses internal whitespace, for single-line embedding. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Ends a sentence with a period if it does not already end with punctuation. */
export function sentence(text: string): string {
  const t = text.trim();
  if (t.length === 0) return '';
  return /[.!?:;]$/.test(t) ? t : `${t}.`;
}

/** Indents every line by `n` spaces. */
export function indent(text: string, n = 2): string {
  const pad = ' '.repeat(n);
  return text
    .split('\n')
    .map((l) => (l.length > 0 ? pad + l : l))
    .join('\n');
}

/**
 * Rough token estimate. Deliberately simple: ~4 characters per token is close
 * enough to warn a user that a prompt is getting long, and it stays
 * deterministic without pulling in a tokenizer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Filesystem-safe slug for download filenames. */
export function slugify(text: string, fallback = 'gauntlet'): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug.length > 0 ? slug : fallback;
}

/** Formats a 0–1 fraction as a whole percentage. */
export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Joins a list into readable prose: `a, b and c`. */
export function prose(items: string[], conjunction = 'and'): string {
  const clean = items.filter((i) => i && i.trim().length > 0);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conjunction} ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} ${conjunction} ${clean[clean.length - 1]}`;
}

/** `1 agent` / `3 agents` */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}
