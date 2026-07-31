/**
 * Application shell: brand, navigation, theme control, and the main region.
 *
 * Navigation is a plain state machine rather than a router — the app has seven
 * views and no URL requirements, and this keeps the whole thing dependency-free
 * while still giving every view a real landmark and a focusable heading.
 */

import { useEffect, useState, type ReactNode } from 'react';
import * as RDialog from '@radix-ui/react-dialog';

import { useStore } from '../../state/store';
import { Button } from '../ui';
import {
  Bookmark,
  Flow,
  Grid,
  Layers,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Sparkle,
  Sun,
  X,
} from '../ui/Icons';
import './AppShell.css';

export type ViewId =
  | 'dashboard'
  | 'wizard'
  | 'editor'
  | 'preview'
  | 'saved'
  | 'presets'
  | 'settings';

interface NavItem {
  id: ViewId;
  label: string;
  icon: ReactNode;
  /** Hidden from the nav list but still a reachable view. */
  hidden?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Grid size={15} /> },
  { id: 'wizard', label: 'New Gauntlet', icon: <Sparkle size={15} /> },
];

const WORK_NAV: NavItem[] = [
  { id: 'editor', label: 'Editor', icon: <Layers size={15} /> },
  { id: 'preview', label: 'Generated prompt', icon: <Flow size={15} /> },
];

const LIBRARY_NAV: NavItem[] = [
  { id: 'saved', label: 'Saved Gauntlets', icon: <Bookmark size={15} /> },
  { id: 'presets', label: 'Preset library', icon: <Grid size={15} /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon size={15} /> },
];

interface NavProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  savedCount: number;
  hasDraft: boolean;
  draftName?: string;
}

function NavList({ view, onNavigate, savedCount, hasDraft, draftName }: NavProps) {
  const renderGroup = (heading: string | null, items: NavItem[], disabledWhenNoDraft = false) => (
    <div className="app-nav-group" key={heading ?? 'primary'}>
      {heading && <h2 className="app-nav-heading">{heading}</h2>}
      {items.map((item) => {
        const disabled = disabledWhenNoDraft && !hasDraft;
        return (
          <button
            key={item.id}
            type="button"
            className="app-nav-item"
            aria-current={view === item.id ? 'page' : undefined}
            aria-disabled={disabled || undefined}
            onClick={() => !disabled && onNavigate(item.id)}
            title={disabled ? 'Start or open a Gauntlet first' : undefined}
            style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
          >
            <span className="app-nav-icon">{item.icon}</span>
            {item.label}
            {item.id === 'saved' && savedCount > 0 && (
              <span className="app-nav-count">{savedCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <nav className="app-nav" aria-label="Main">
        {renderGroup(null, PRIMARY_NAV)}
        {renderGroup('Current Gauntlet', WORK_NAV, true)}
        {renderGroup('Library', LIBRARY_NAV)}
      </nav>
      {hasDraft && draftName && (
        <p
          className="text-xs text-tertiary"
          style={{ padding: 'var(--space-4) var(--space-5) 0', overflowWrap: 'anywhere' }}
        >
          Working on <strong style={{ color: 'var(--text-secondary)' }}>{draftName}</strong>
        </p>
      )}
    </>
  );
}

function ThemeToggle() {
  const { state, updateSettings } = useStore();
  const theme = state.settings.theme;
  const options: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: ReactNode }> = [
    { value: 'light', label: 'Light', icon: <Sun size={14} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
    { value: 'system', label: 'System', icon: <span style={{ fontSize: 11, fontWeight: 600 }}>A</span> },
  ];
  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={theme === opt.value}
          aria-label={`${opt.label} theme`}
          title={`${opt.label} theme`}
          onClick={() => updateSettings({ theme: opt.value })}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

interface AppShellProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onNewGauntlet: () => void;
  children: ReactNode;
  /** Removes the content padding, for views that manage their own layout. */
  flush?: boolean;
}

export function AppShell({ view, onNavigate, onNewGauntlet, children, flush }: AppShellProps) {
  const { state, draft } = useStore();
  const [navOpen, setNavOpen] = useState(false);

  const savedCount = state.gauntlets.length;
  const draftName = draft?.intent.projectName || (draft ? 'Untitled Gauntlet' : undefined);

  // Close the mobile nav whenever the view changes.
  useEffect(() => setNavOpen(false), [view]);

  const navProps: NavProps = {
    view,
    onNavigate,
    savedCount,
    hasDraft: Boolean(draft),
    draftName,
  };

  const brand = (
    <div className="app-brand">
      <span className="app-brand-mark" aria-hidden="true">
        <Flow size={16} />
      </span>
      <span className="app-brand-text">
        <span className="app-brand-name">Gauntlet Builder</span>
        <span className="app-brand-sub">Multi-agent review loops</span>
      </span>
    </div>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="app-sidebar">
        {brand}
        <Button variant="primary" className="app-new-btn" onClick={onNewGauntlet}>
          <Plus size={15} /> New Gauntlet
        </Button>
        <NavList {...navProps} />
        <div className="app-sidebar-footer">
          <ThemeToggle />
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <RDialog.Root open={navOpen} onOpenChange={setNavOpen}>
            <RDialog.Trigger asChild>
              <Button variant="ghost" iconOnly aria-label="Open navigation">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
                </svg>
              </Button>
            </RDialog.Trigger>
            <RDialog.Portal>
              <RDialog.Overlay className="nav-sheet-overlay" />
              <RDialog.Content className="nav-sheet" aria-label="Navigation">
                <RDialog.Title className="visually-hidden">Navigation</RDialog.Title>
                <RDialog.Description className="visually-hidden">
                  Move between the views of Gauntlet Builder.
                </RDialog.Description>
                {brand}
                <Button
                  variant="primary"
                  className="app-new-btn"
                  onClick={() => {
                    onNewGauntlet();
                    setNavOpen(false);
                  }}
                >
                  <Plus size={15} /> New Gauntlet
                </Button>
                <NavList {...navProps} />
                <div className="app-sidebar-footer">
                  <ThemeToggle />
                </div>
                <RDialog.Close asChild>
                  <button type="button" className="dialog-close" aria-label="Close navigation">
                    <X size={16} />
                  </button>
                </RDialog.Close>
              </RDialog.Content>
            </RDialog.Portal>
          </RDialog.Root>

          <span className="app-brand-name">Gauntlet Builder</span>
          <span className="spacer" />
          <Button variant="primary" size="sm" onClick={onNewGauntlet}>
            <Plus size={14} /> New
          </Button>
        </header>

        <main id="main-content" className={`app-content ${flush ? 'app-content-flush' : ''}`} tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
