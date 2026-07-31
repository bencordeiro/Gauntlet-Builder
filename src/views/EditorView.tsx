/**
 * Gauntlet editor — non-linear access to every section.
 *
 * This is the same set of controls as the wizard, reachable in any order for
 * someone who knows what they want to change. It reuses the wizard step
 * components directly so there is one implementation of each editor, not two.
 */

import { useMemo, useState } from 'react';

import { AgentEditor } from '../components/agents/AgentEditor';
import { WorkflowDiagram } from '../components/diagram/WorkflowDiagram';
import { QualityBarBuilder } from '../components/quality/QualityBarBuilder';
import { PageHeader, type ViewId } from '../components/shell/AppShell';
import {
  Button,
  Callout,
  EmptyState,
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
} from '../components/ui';
import { Download, Eye } from '../components/ui/Icons';
import { RiskPanel } from '../components/validation/RiskPanel';
import { Step1Intent } from '../components/wizard/steps/Step1Intent';
import { Step3Structure } from '../components/wizard/steps/Step3Structure';
import { Step5Communication } from '../components/wizard/steps/Step5Communication';
import { Step6Approval } from '../components/wizard/steps/Step6Approval';
import { Step7Revision } from '../components/wizard/steps/Step7Revision';
import { Step8Strictness } from '../components/wizard/steps/Step8Strictness';
import { downloadGauntlet } from '../services/exportImport';
import { useStore } from '../state/store';
import { validate } from '../validation/validate';
import './EditorView.css';

interface Props {
  onNavigate: (view: ViewId) => void;
}

const SECTIONS = [
  { id: 'task', label: 'Task' },
  { id: 'quality', label: 'Quality bar' },
  { id: 'structure', label: 'Structure' },
  { id: 'agents', label: 'Agents' },
  { id: 'communication', label: 'Communication' },
  { id: 'approval', label: 'Approval' },
  { id: 'revisions', label: 'Revisions' },
  { id: 'strictness', label: 'Strictness' },
  { id: 'issues', label: 'Issues' },
];

export function EditorView({ onNavigate }: Props) {
  const { draft, updateDraft, state, createDraft } = useStore();
  const [section, setSection] = useState('task');
  const [advanced, setAdvanced] = useState(state.settings.advancedByDefault);

  const warnings = useMemo(() => (draft ? validate(draft) : []), [draft]);
  const blockingCount = warnings.filter((w) => w.severity === 'blocking').length;

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
        Open one from your saved list, or start something new.
      </EmptyState>
    );
  }

  const stepProps = { config: draft, update: updateDraft, advanced };

  return (
    <>
      <PageHeader
        title={draft.intent.projectName || 'Untitled Gauntlet'}
        subtitle={draft.intent.goal || 'No goal described yet. Start in the Task section.'}
        actions={
          <>
            <SegmentedControl
              label="Detail level"
              hideLabel
              value={advanced ? 'advanced' : 'simple'}
              onChange={(v) => setAdvanced(v === 'advanced')}
              options={[
                { value: 'simple', label: 'Simple' },
                { value: 'advanced', label: 'Advanced' },
              ]}
            />
            <Button onClick={() => downloadGauntlet(draft)}>
              <Download size={14} /> Export
            </Button>
            <Button variant="primary" onClick={() => onNavigate('preview')}>
              <Eye size={14} /> Generated prompt
            </Button>
          </>
        }
      />

      {blockingCount > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <Callout tone="danger" title={`${blockingCount} problem${blockingCount > 1 ? 's' : ''} would stop this working`}>
            {warnings.find((w) => w.severity === 'blocking')?.problem}{' '}
            <Button size="sm" onClick={() => setSection('issues')} style={{ marginTop: 'var(--space-2)' }}>
              See all problems
            </Button>
          </Callout>
        </div>
      )}

      <Tabs value={section} onValueChange={setSection}>
        <TabsList label="Gauntlet sections">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.label}
              {s.id === 'issues' && warnings.length > 0 && (
                <span className="editor-tab-count">{warnings.length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="editor-panel">
          <TabsContent value="task">
            <Step1Intent {...stepProps} />
            <div style={{ marginTop: 'var(--space-6)' }}>
              <TextArea
                label="Anything else to add to the generated prompt?"
                value={draft.additionalInstructions}
                onChange={(v) => updateDraft((c) => ({ ...c, additionalInstructions: v }))}
                rows={4}
                help="Appended verbatim at the end of the master prompt, before the kickoff section."
                optional
              />
            </div>
          </TabsContent>

          <TabsContent value="quality">
            <QualityBarBuilder {...stepProps} />
          </TabsContent>

          <TabsContent value="structure">
            <Step3Structure config={draft} update={updateDraft} />
          </TabsContent>

          <TabsContent value="agents">
            <div className="editor-split">
              <div className="editor-split-main">
                <AgentEditor {...stepProps} />
              </div>
              <div className="editor-split-side">
                <WorkflowDiagram
                  agents={draft.agents}
                  edges={draft.communication.edges}
                  compact
                  caption="Current workflow"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="communication">
            <Step5Communication {...stepProps} />
          </TabsContent>

          <TabsContent value="approval">
            <Step6Approval {...stepProps} />
          </TabsContent>

          <TabsContent value="revisions">
            <Step7Revision {...stepProps} />
          </TabsContent>

          <TabsContent value="strictness">
            <Step8Strictness {...stepProps} />
          </TabsContent>

          <TabsContent value="issues">
            <RiskPanel warnings={warnings} />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
