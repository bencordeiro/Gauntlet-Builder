/**
 * Standalone generated-prompt view, for a Gauntlet opened from the saved list.
 */

import { useMemo } from 'react';

import { PromptPreview } from '../components/preview/PromptPreview';
import { PageHeader, type ViewId } from '../components/shell/AppShell';
import { Button, Callout, EmptyState } from '../components/ui';
import { Edit } from '../components/ui/Icons';
import { useStore } from '../state/store';
import { validate } from '../validation/validate';

interface Props {
  onNavigate: (view: ViewId) => void;
}

export function PreviewView({ onNavigate }: Props) {
  const { draft, createDraft } = useStore();
  const warnings = useMemo(() => (draft ? validate(draft) : []), [draft]);
  const blocking = warnings.filter((w) => w.severity === 'blocking');

  if (!draft) {
    return (
      <EmptyState
        title="No Gauntlet open"
        action={
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => createDraft()}>
              Start a new one
            </Button>
            <Button onClick={() => onNavigate('saved')}>Open a saved Gauntlet</Button>
          </div>
        }
      >
        Open a Gauntlet to see the prompt it generates.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        title="Generated prompt"
        subtitle={
          <>
            For <strong>{draft.intent.projectName || 'Untitled Gauntlet'}</strong>. Copy the master
            prompt into your agent, or download the whole package.
          </>
        }
        actions={
          <Button onClick={() => onNavigate('editor')}>
            <Edit size={14} /> Edit this Gauntlet
          </Button>
        }
      />

      <PromptPreview
        config={draft}
        banner={
          blocking.length > 0 ? (
            <Callout
              tone="danger"
              title={`${blocking.length} problem${blocking.length > 1 ? 's' : ''} would stop this working`}
            >
              {blocking[0].problem}{' '}
              <Button
                size="sm"
                onClick={() => onNavigate('editor')}
                style={{ marginTop: 'var(--space-2)' }}
              >
                Fix it in the editor
              </Button>
            </Callout>
          ) : undefined
        }
      />
    </>
  );
}
