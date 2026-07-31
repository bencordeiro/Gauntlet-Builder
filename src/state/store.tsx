/**
 * Application state.
 *
 * A single reducer owns everything persisted: the saved Gauntlets, the active
 * draft, and settings. Keeping it in one place means autosave has one thing to
 * watch, and undoing a bad edit is a matter of replacing one object.
 *
 * The draft is stored by id and always lives in the `gauntlets` array, so
 * "saving" is not a separate copy — it is just a flag on whether the user has
 * chosen to keep it. This avoids the classic bug where wizard edits and saved
 * copies drift apart.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import { createGauntlet, refreshEdges } from '../model/defaults';
import { gauntletId } from '../model/ids';
import type { AppSettings, GauntletConfig, PersistedState } from '../model/types';
import { presetById } from '../presets/projectPresets';
import { createSampleGauntlets } from '../presets/samples';
import {
  DEFAULT_SETTINGS,
  flushPendingSave,
  loadState,
  saveStateDebounced,
} from '../services/storage';

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

type Action =
  | { type: 'hydrate'; state: PersistedState; notes: string[] }
  | { type: 'update-draft'; updater: (config: GauntletConfig) => GauntletConfig }
  | { type: 'set-draft'; id: string | undefined }
  | { type: 'create-draft'; presetId?: string }
  | { type: 'save-gauntlet'; config: GauntletConfig }
  | { type: 'delete-gauntlet'; id: string }
  | { type: 'duplicate-gauntlet'; id: string }
  | { type: 'rename-gauntlet'; id: string; name: string }
  | { type: 'import-gauntlets'; configs: GauntletConfig[]; notes: string[] }
  | { type: 'update-settings'; patch: Partial<AppSettings> }
  | { type: 'restore-samples' }
  | { type: 'dismiss-notes' };

interface State extends PersistedState {
  hydrated: boolean;
  /** One-off messages from loading/importing, shown then dismissed. */
  notes: string[];
}

const initialState: State = {
  schemaVersion: 3,
  gauntlets: [],
  settings: { ...DEFAULT_SETTINGS },
  draftId: undefined,
  samplesSeeded: false,
  hydrated: false,
  notes: [],
};

/** Stamps `updatedAt` and recomputes derived edges after any structural edit. */
function touch(config: GauntletConfig): GauntletConfig {
  return refreshEdges({
    ...config,
    meta: { ...config.meta, updatedAt: new Date().toISOString(), isSample: false },
  });
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.state, hydrated: true, notes: action.notes };

    case 'update-draft': {
      if (!state.draftId) return state;
      return {
        ...state,
        gauntlets: state.gauntlets.map((g) =>
          g.meta.id === state.draftId ? touch(action.updater(g)) : g,
        ),
      };
    }

    case 'set-draft':
      return { ...state, draftId: action.id };

    case 'create-draft': {
      let config = createGauntlet();
      if (action.presetId) {
        const preset = presetById(action.presetId);
        if (preset) {
          config = preset.apply(config);
          config = { ...config, meta: { ...config.meta, basePresetId: action.presetId } };
        }
      }
      config = {
        ...config,
        intent: { ...config.intent, environment: state.settings.defaultEnvironment },
        ledger: { ...config.ledger, enabled: state.settings.ledgerByDefault },
      };
      return { ...state, gauntlets: [config, ...state.gauntlets], draftId: config.meta.id };
    }

    case 'save-gauntlet':
      return {
        ...state,
        gauntlets: state.gauntlets.some((g) => g.meta.id === action.config.meta.id)
          ? state.gauntlets.map((g) => (g.meta.id === action.config.meta.id ? touch(action.config) : g))
          : [touch(action.config), ...state.gauntlets],
      };

    case 'delete-gauntlet':
      return {
        ...state,
        gauntlets: state.gauntlets.filter((g) => g.meta.id !== action.id),
        draftId: state.draftId === action.id ? undefined : state.draftId,
      };

    case 'duplicate-gauntlet': {
      const source = state.gauntlets.find((g) => g.meta.id === action.id);
      if (!source) return state;
      const now = new Date().toISOString();
      const copy: GauntletConfig = {
        ...source,
        meta: {
          ...source.meta,
          id: gauntletId(),
          createdAt: now,
          updatedAt: now,
          isSample: false,
          tags: source.meta.tags.filter((t) => t !== 'sample'),
        },
        intent: { ...source.intent, projectName: `${source.intent.projectName || 'Untitled'} (copy)` },
      };
      const index = state.gauntlets.findIndex((g) => g.meta.id === action.id);
      const next = [...state.gauntlets];
      next.splice(index + 1, 0, copy);
      return { ...state, gauntlets: next };
    }

    case 'rename-gauntlet':
      return {
        ...state,
        gauntlets: state.gauntlets.map((g) =>
          g.meta.id === action.id
            ? touch({ ...g, intent: { ...g.intent, projectName: action.name } })
            : g,
        ),
      };

    case 'import-gauntlets':
      return {
        ...state,
        gauntlets: [...action.configs, ...state.gauntlets],
        notes: action.notes,
      };

    case 'update-settings':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'restore-samples': {
      const withoutSamples = state.gauntlets.filter((g) => !g.meta.isSample);
      return { ...state, gauntlets: [...createSampleGauntlets(), ...withoutSamples] };
    }

    case 'dismiss-notes':
      return { ...state, notes: [] };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

interface StoreValue {
  state: State;
  /** The Gauntlet currently open in the wizard or editor. */
  draft: GauntletConfig | undefined;
  updateDraft: (updater: (config: GauntletConfig) => GauntletConfig) => void;
  setDraft: (id: string | undefined) => void;
  createDraft: (presetId?: string) => void;
  saveGauntlet: (config: GauntletConfig) => void;
  deleteGauntlet: (id: string) => void;
  duplicateGauntlet: (id: string) => void;
  renameGauntlet: (id: string, name: string) => void;
  importGauntlets: (configs: GauntletConfig[], notes: string[]) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  restoreSamples: () => void;
  dismissNotes: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydratedRef = useRef(false);

  // Load once on mount.
  useEffect(() => {
    const { state: loaded, notes } = loadState();
    dispatch({ type: 'hydrate', state: loaded, notes });
    hydratedRef.current = true;
  }, []);

  // Autosave. Skipped until hydration so we never overwrite stored data with
  // the empty initial state during the first render.
  useEffect(() => {
    if (!state.hydrated || !hydratedRef.current) return;
    if (!state.settings.autosave) return;
    const { hydrated: _h, notes: _n, ...persisted } = state;
    saveStateDebounced(persisted);
  }, [state]);

  // Flush on unload so a debounced write is never lost.
  useEffect(() => {
    const handler = () => {
      if (!state.hydrated) return;
      const { hydrated: _h, notes: _n, ...persisted } = state;
      flushPendingSave(persisted);
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  // Apply theme and density to the document root.
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.settings.theme);
    root.setAttribute('data-density', state.settings.density);
  }, [state.settings.theme, state.settings.density]);

  const draft = useMemo(
    () => state.gauntlets.find((g) => g.meta.id === state.draftId),
    [state.gauntlets, state.draftId],
  );

  const value = useMemo<StoreValue>(
    () => ({
      state,
      draft,
      updateDraft: (updater) => dispatch({ type: 'update-draft', updater }),
      setDraft: (id) => dispatch({ type: 'set-draft', id }),
      createDraft: (presetId) => dispatch({ type: 'create-draft', presetId }),
      saveGauntlet: (config) => dispatch({ type: 'save-gauntlet', config }),
      deleteGauntlet: (id) => dispatch({ type: 'delete-gauntlet', id }),
      duplicateGauntlet: (id) => dispatch({ type: 'duplicate-gauntlet', id }),
      renameGauntlet: (id, name) => dispatch({ type: 'rename-gauntlet', id, name }),
      importGauntlets: (configs, notes) => dispatch({ type: 'import-gauntlets', configs, notes }),
      updateSettings: (patch) => dispatch({ type: 'update-settings', patch }),
      restoreSamples: () => dispatch({ type: 'restore-samples' }),
      dismissNotes: () => dispatch({ type: 'dismiss-notes' }),
    }),
    [state, draft],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside a StoreProvider.');
  return value;
}
