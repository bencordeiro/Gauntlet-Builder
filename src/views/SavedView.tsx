/**
 * Saved Gauntlets: search, filter, rename, duplicate, delete, export, import.
 *
 * `GauntletCard` is exported because the dashboard shows the same card for its
 * recent list — one card component means the two views can never disagree about
 * what a Gauntlet looks like.
 */

import { useMemo, useRef, useState } from 'react';

import { PageHeader, type ViewId } from '../components/shell/AppShell';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Select,
  TextInput,
} from '../components/ui';
import { Download, Duplicate, Edit, Plus, Search, Trash, Upload } from '../components/ui/Icons';
import { derive } from '../engine/derive';
import { structurePresetByKind } from '../model/catalog';
import type { GauntletConfig } from '../model/types';
import { PROJECT_PRESETS } from '../presets/projectPresets';
import {
  downloadFile,
  downloadGauntlet,
  exportAllJson,
  parseImport,
  readFileAsText,
} from '../services/exportImport';
import { useStore } from '../state/store';
import { validate } from '../validation/validate';
import './SavedView.css';

interface Props {
  onNavigate: (view: ViewId) => void;
}

export function SavedView({ onNavigate }: Props) {
  const { state, setDraft, deleteGauntlet, duplicateGauntlet, renameGauntlet, importGauntlets } =
    useStore();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'updated' | 'created' | 'name'>('updated');
  const [renaming, setRenaming] = useState<GauntletConfig | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<GauntletConfig | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const tags = new Set<string>();
    state.gauntlets.forEach((g) => g.meta.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [state.gauntlets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.gauntlets
      .filter((g) => {
        if (category !== 'all' && !g.meta.tags.includes(category)) return false;
        if (!q) return true;
        return (
          g.intent.projectName.toLowerCase().includes(q) ||
          g.intent.goal.toLowerCase().includes(q) ||
          g.intent.deliverable.toLowerCase().includes(q) ||
          g.meta.tags.some((t) => t.toLowerCase().includes(q)) ||
          g.agents.some((a) => a.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sort === 'name') {
          return (a.intent.projectName || 'Untitled').localeCompare(b.intent.projectName || 'Untitled');
        }
        if (sort === 'created') return b.meta.createdAt.localeCompare(a.meta.createdAt);
        return b.meta.updatedAt.localeCompare(a.meta.updatedAt);
      });
  }, [state.gauntlets, query, category, sort]);

  const handleImport = async (file: File) => {
    setImportError(null);
    try {
      const text = await readFileAsText(file);
      const { gauntlets, notes } = parseImport(text);
      importGauntlets(gauntlets, notes);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'That file could not be imported.');
    }
  };

  const open = (id: string, view: ViewId = 'editor') => {
    setDraft(id);
    onNavigate(view);
  };

  return (
    <>
      <PageHeader
        title="Saved Gauntlets"
        subtitle={`${state.gauntlets.length} stored in this browser. Nothing is uploaded anywhere.`}
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Import
            </Button>
            <Button
              onClick={() => downloadFile('gauntlets.json', exportAllJson(state.gauntlets))}
              disabled={state.gauntlets.length === 0}
            >
              <Download size={14} /> Export all
            </Button>
          </>
        }
      />

      {importError && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Callout tone="danger" title="Import failed">
            {importError}
          </Callout>
        </div>
      )}

      <div className="saved-filters">
        <div className="saved-search">
          <Search size={15} className="saved-search-icon" />
          <input
            type="search"
            className="input"
            value={query}
            placeholder="Search by name, goal, or agent"
            aria-label="Search saved Gauntlets"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {categories.length > 0 && (
          <Select
            label="Filter by type"
            bare
            ariaLabel="Filter by project type"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'All types' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
        )}

        <Select
          label="Sort"
          bare
          ariaLabel="Sort saved Gauntlets"
          value={sort}
          onChange={(v) => setSort(v as typeof sort)}
          options={[
            { value: 'updated', label: 'Recently changed' },
            { value: 'created', label: 'Recently created' },
            { value: 'name', label: 'Name' },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        state.gauntlets.length === 0 ? (
          <EmptyState
            title="No saved Gauntlets"
            action={
              <Button variant="primary" onClick={() => onNavigate('presets')}>
                <Plus size={14} /> Start from a preset
              </Button>
            }
          >
            Everything you build is saved here automatically, in this browser only.
          </EmptyState>
        ) : (
          <EmptyState title="Nothing matches that search">
            Try a different term, or clear the filters.
          </EmptyState>
        )
      ) : (
        <div className="saved-grid">
          {filtered.map((gauntlet) => (
            <GauntletCard
              key={gauntlet.meta.id}
              config={gauntlet}
              onOpen={() => open(gauntlet.meta.id)}
              onPreview={() => open(gauntlet.meta.id, 'preview')}
              onRename={() => {
                setRenaming(gauntlet);
                setRenameValue(gauntlet.intent.projectName);
              }}
              onDuplicate={() => duplicateGauntlet(gauntlet.meta.id)}
              onExport={() => downloadGauntlet(gauntlet)}
              onDelete={() => setDeleting(gauntlet)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename Gauntlet"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (renaming) renameGauntlet(renaming.meta.id, renameValue.trim() || 'Untitled');
                setRenaming(null);
              }}
            >
              Rename
            </Button>
          </>
        }
      >
        <TextInput label="Name" value={renameValue} onChange={setRenameValue} autoFocus />
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this Gauntlet?"
        description={
          <>
            <strong>{deleting?.intent.projectName || 'Untitled Gauntlet'}</strong> will be removed
            from this browser. This cannot be undone — export it first if you might want it back.
          </>
        }
        onConfirm={() => deleting && deleteGauntlet(deleting.meta.id)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

interface CardProps {
  config: GauntletConfig;
  onOpen: () => void;
  onPreview?: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export function GauntletCard({
  config,
  onOpen,
  onPreview,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  compact,
}: CardProps) {
  const ctx = derive(config);
  const blocking = useMemo(
    () => validate(config).filter((w) => w.severity === 'blocking').length,
    [config],
  );
  const preset = config.meta.basePresetId
    ? PROJECT_PRESETS.find((p) => p.id === config.meta.basePresetId)
    : undefined;

  return (
    <article className="saved-card">
      <div className="saved-card-head">
        <button type="button" className="saved-card-name" onClick={onOpen}>
          {config.intent.projectName || 'Untitled Gauntlet'}
        </button>
        {config.meta.isSample && <Badge>Example</Badge>}
        {blocking > 0 && <Badge tone="danger">{blocking} to fix</Badge>}
      </div>

      <p className="saved-card-goal">
        {config.intent.goal || <span className="text-tertiary">No goal described yet.</span>}
      </p>

      <dl className="saved-card-facts">
        <div>
          <dt>Structure</dt>
          <dd>{structurePresetByKind(config.topology).name}</dd>
        </div>
        <div>
          <dt>Agents</dt>
          <dd>{ctx.active.length}</dd>
        </div>
        <div>
          <dt>Criteria</dt>
          <dd>{config.quality.criteria.length}</dd>
        </div>
        <div>
          <dt>Changed</dt>
          <dd>{formatRelative(config.meta.updatedAt)}</dd>
        </div>
      </dl>

      {preset && <p className="saved-card-preset">From “{preset.name}”</p>}

      {!compact && (
        <div className="saved-card-actions">
          <Button size="sm" variant="primary" onClick={onOpen}>
            <Edit size={13} /> Open
          </Button>
          {onPreview && (
            <Button size="sm" onClick={onPreview}>
              Prompt
            </Button>
          )}
          {onRename && (
            <Button size="sm" variant="ghost" onClick={onRename}>
              Rename
            </Button>
          )}
          {onDuplicate && (
            <Button size="sm" variant="ghost" iconOnly onClick={onDuplicate} aria-label="Duplicate">
              <Duplicate size={13} />
            </Button>
          )}
          {onExport && (
            <Button size="sm" variant="ghost" iconOnly onClick={onExport} aria-label="Export">
              <Download size={13} />
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="ghost" iconOnly onClick={onDelete} aria-label="Delete">
              <Trash size={13} />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

/** Short relative time. Falls back to a date once it stops being useful. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
