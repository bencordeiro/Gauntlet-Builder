/**
 * Application root: view switching and the shell.
 *
 * Navigation is deliberately simple state rather than a router — seven views,
 * no URL requirements, no deep linking in v1 — which keeps the app
 * dependency-free without giving anything up.
 */

import { useCallback, useState } from 'react';

import { AppShell, type ViewId } from './components/shell/AppShell';
import { TooltipProvider } from './components/ui';
import { StoreProvider, useStore } from './state/store';
import { DashboardView } from './views/DashboardView';
import { EditorView } from './views/EditorView';
import { PresetsView } from './views/PresetsView';
import { PreviewView } from './views/PreviewView';
import { SavedView } from './views/SavedView';
import { SettingsView } from './views/SettingsView';
import { WizardView } from './views/WizardView';
import './styles/global.css';

function AppInner() {
  const [view, setView] = useState<ViewId>('dashboard');
  const { createDraft } = useStore();

  const navigate = useCallback((next: ViewId) => {
    setView(next);
    // Views are tall; landing mid-page after a jump is disorienting.
    window.scrollTo({ top: 0 });
  }, []);

  const newGauntlet = useCallback(() => {
    createDraft();
    navigate('wizard');
  }, [createDraft, navigate]);

  return (
    <AppShell
      view={view}
      onNavigate={navigate}
      onNewGauntlet={newGauntlet}
      flush={view === 'wizard'}
    >
      {view === 'dashboard' && <DashboardView onNavigate={navigate} onNewGauntlet={newGauntlet} />}
      {view === 'wizard' && <WizardView onNavigate={navigate} />}
      {view === 'editor' && <EditorView onNavigate={navigate} />}
      {view === 'preview' && <PreviewView onNavigate={navigate} />}
      {view === 'saved' && <SavedView onNavigate={navigate} />}
      {view === 'presets' && <PresetsView onNavigate={navigate} />}
      {view === 'settings' && <SettingsView />}
    </AppShell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <TooltipProvider>
        <AppInner />
      </TooltipProvider>
    </StoreProvider>
  );
}
