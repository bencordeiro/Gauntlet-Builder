/**
 * Generated output preview with export controls.
 *
 * The seven tabs come straight from the engine. Markdown is rendered to HTML by
 * a small purpose-built renderer rather than a dependency — the engine only
 * emits headings, lists, tables, code fences, bold and inline code, so a full
 * CommonMark parser would be far more machinery than the job needs, and this
 * way nothing user-supplied is ever interpreted as raw HTML.
 */

import { useMemo, useState } from 'react';

import { generateAgentOutputs, generatePackage } from '../../engine';
import type { GauntletConfig, GeneratedOutput } from '../../model/types';
import { copyToClipboard, downloadFile } from '../../services/exportImport';
import { Badge, Button, SegmentedControl, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';
import { Check, Copy, Download, Printer } from '../ui/Icons';
import './PromptPreview.css';

interface Props {
  config: GauntletConfig;
  /** Shown above the tabs, e.g. a blocking-error warning. */
  banner?: React.ReactNode;
}

export function PromptPreview({ config, banner }: Props) {
  const [tab, setTab] = useState('master-prompt');
  const [rendered, setRendered] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const pkg = useMemo(() => generatePackage(config), [config]);
  const agentOutputs = useMemo(() => generateAgentOutputs(config), [config]);

  const active = pkg.outputs.find((o) => o.id === tab) ?? pkg.outputs[0];

  const copy = async (output: GeneratedOutput) => {
    const ok = await copyToClipboard(output.content);
    setCopied(ok ? output.id : null);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const downloadAll = () => {
    pkg.outputs.forEach((output, i) => {
      // Stagger so browsers do not suppress the later downloads.
      window.setTimeout(() => downloadFile(output.filename, output.content), i * 220);
    });
  };

  return (
    <div className="preview">
      {banner}

      <div className="preview-toolbar no-print">
        <div className="preview-toolbar-info">
          <span className="text-sm text-secondary">{active.description}</span>
          {active.id === 'master-prompt' && (
            <Badge>~{pkg.masterPromptTokens.toLocaleString('en-US')} tokens</Badge>
          )}
        </div>

        <div className="preview-toolbar-actions">
          {active.format === 'markdown' && (
            <SegmentedControl
              label="View"
              hideLabel
              value={rendered ? 'rendered' : 'raw'}
              onChange={(v) => setRendered(v === 'rendered')}
              options={[
                { value: 'rendered', label: 'Formatted' },
                { value: 'raw', label: 'Raw' },
              ]}
            />
          )}
          <Button variant="primary" onClick={() => copy(active)}>
            {copied === active.id ? <Check size={14} /> : <Copy size={14} />}
            {copied === active.id ? 'Copied' : 'Copy'}
          </Button>
          <Button onClick={() => downloadFile(active.filename, active.content)}>
            <Download size={14} /> Download
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={14} /> Print
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="no-print">
          <TabsList label="Generated outputs">
            {pkg.outputs.map((output) => (
              <TabsTrigger key={output.id} value={output.id}>
                {output.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {pkg.outputs.map((output) => (
          <TabsContent key={output.id} value={output.id}>
            <div className="preview-body">
              {output.id === 'agent-instructions' && agentOutputs.length > 0 && (
                <div className="preview-agent-strip no-print">
                  <span className="text-sm text-secondary">Copy one agent’s prompt:</span>
                  {agentOutputs.map((agent) => (
                    <Button key={agent.filename} size="sm" onClick={() => copy(agent)}>
                      {copied === agent.id && <Check size={12} />} {agent.label}
                    </Button>
                  ))}
                </div>
              )}

              {rendered && output.format === 'markdown' ? (
                <article className="prose preview-rendered">
                  <MarkdownView source={output.content} />
                </article>
              ) : (
                <pre className="preview-raw scrollable">
                  <code>{output.content}</code>
                </pre>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="preview-footer no-print">
        <Button onClick={downloadAll}>
          <Download size={14} /> Download everything
        </Button>
        <span className="text-sm text-tertiary">
          Seven files: prompt, agent instructions, rubric, JSON, YAML, summary, checklist.
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Markdown rendering
 * ------------------------------------------------------------------ */

/**
 * Renders the markdown subset the engine emits. Everything is produced as React
 * elements, never `dangerouslySetInnerHTML`, so no generated or user-entered
 * text can inject markup.
 */
function MarkdownView({ source }: { source: string }) {
  const blocks = useMemo(() => parseBlocks(source), [source]);
  return <>{blocks}</>;
}

type Block = React.ReactElement;

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const out: Block[] = [];
  let i = 0;
  let key = 0;

  const nextKey = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        <pre key={nextKey()}>
          <code className={lang ? `language-${lang}` : undefined}>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(6, level)}` as 'h1';
      out.push(<Tag key={nextKey()}>{inline(heading[2])}</Tag>);
      i += 1;
      continue;
    }

    // Table
    if (line.trimStart().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      out.push(
        <div className="scroll-x" key={nextKey()}>
          <table>
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list, including the checklist and ⚠ marker variants
    if (/^\s*([-*⚠])\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*⚠])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*⚠])\s+/, ''));
        i += 1;
      }
      out.push(
        <ul key={nextKey()}>
          {items.map((item, ii) => {
            const task = /^\[([ xX])\]\s+(.*)$/.exec(item);
            if (task) {
              return (
                <li key={ii} className="preview-task">
                  <input type="checkbox" defaultChecked={task[1] !== ' '} aria-label={task[2]} />
                  <span>{inline(task[2])}</span>
                </li>
              );
            }
            return <li key={ii}>{inline(item)}</li>;
          })}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      out.push(
        <ol key={nextKey()}>
          {items.map((item, ii) => (
            <li key={ii}>{inline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: gather until a blank line or the start of another block.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*([-*⚠])\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('|')
    ) {
      para.push(lines[i]);
      i += 1;
    }
    out.push(<p key={nextKey()}>{inline(para.join(' '))}</p>);
  }

  return out;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim());
}

/** Renders bold and inline code inside a line of text. */
function inline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
