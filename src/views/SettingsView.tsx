/**
 * Settings, plus the data-management controls.
 *
 * Everything here is honest about what it actually does: local storage only, no
 * account, no sync. The destructive actions confirm first and point out that
 * export is the only backup.
 */

import { useState } from 'react';

import { PageHeader } from '../components/shell/AppShell';
import {
  Button,
  Callout,
  ConfirmDialog,
  SegmentedControl,
  Select,
  Toggle,
} from '../components/ui';
import { Download, Refresh, Trash } from '../components/ui/Icons';
import { ENVIRONMENTS } from '../model/catalog';
import { SCHEMA_VERSION } from '../model/types';
import type { TargetEnvironment } from '../model/types';
import { downloadFile, exportAllJson } from '../services/exportImport';
import { clearState, storageAvailable, STORAGE_KEY } from '../services/storage';
import { useStore } from '../state/store';
import { PROJECT_PRESETS } from '../presets/projectPresets';

export function SettingsView() {
  const { state, updateSettings, restoreSamples } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const settings = state.settings;

  const storageBytes = (() => {
    try {
      return (window.localStorage.getItem(STORAGE_KEY) ?? '').length;
    } catch {
      return 0;
    }
  })();

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Preferences apply to this browser only. There is no account and nothing is sent anywhere."
      />

      <div className="stack-lg" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Appearance</h2>
          </div>
          <div className="panel-body stack">
            <SegmentedControl
              label="Colour theme"
              value={settings.theme}
              onChange={(v) => updateSettings({ theme: v as typeof settings.theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'Match system' },
              ]}
            />
            <SegmentedControl
              label="Density"
              value={settings.density}
              onChange={(v) => updateSettings({ density: v as typeof settings.density })}
              options={[
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact', label: 'Compact' },
              ]}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Defaults for new Gauntlets</h2>
          </div>
          <div className="panel-body stack">
            <Select<TargetEnvironment>
              label="Where you usually run these"
              value={settings.defaultEnvironment}
              onChange={(v) => updateSettings({ defaultEnvironment: v })}
              options={ENVIRONMENTS.map((e) => ({ value: e.id, label: e.label, blurb: e.blurb }))}
              help="Pre-selected in step 1. You can change it per Gauntlet."
            />
            <Toggle
              label="Start the wizard in advanced mode"
              checked={settings.advancedByDefault}
              onChange={(v) => updateSettings({ advancedByDefault: v })}
              blurb="Shows every setting rather than hiding the deeper ones behind disclosures."
            />
            <Toggle
              label="Include a progress ledger by default"
              checked={settings.ledgerByDefault}
              onChange={(v) => updateSettings({ ledgerByDefault: v })}
              blurb="A per-round record in the generated prompt. Strongly recommended for anything long-running."
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Your data</h2>
          </div>
          <div className="panel-body stack">
            <Toggle
              label="Save changes automatically"
              checked={settings.autosave}
              onChange={(v) => updateSettings({ autosave: v })}
              blurb="Writes to this browser's local storage as you work. Turning it off means changes are lost when you close the tab."
            />

            {!storageAvailable() && (
              <Callout tone="danger" title="Storage is not available">
                This browser is blocking local storage, so nothing can be saved between visits.
                Export anything you want to keep before closing the tab.
              </Callout>
            )}

            <dl className="preset-detail-facts">
              <dt>Saved Gauntlets</dt>
              <dd>{state.gauntlets.length}</dd>
              <dt>Storage used</dt>
              <dd>{storageBytes > 0 ? `${Math.round(storageBytes / 1024)} KB` : 'Nothing stored'}</dd>
              <dt>Schema version</dt>
              <dd>
                {SCHEMA_VERSION} — older exports are upgraded automatically when imported
              </dd>
              <dt>Presets available</dt>
              <dd>{PROJECT_PRESETS.length}</dd>
            </dl>

            <div className="row-wrap">
              <Button
                onClick={() => downloadFile('gauntlets.json', exportAllJson(state.gauntlets))}
                disabled={state.gauntlets.length === 0}
              >
                <Download size={14} /> Export everything
              </Button>
              <Button onClick={restoreSamples}>
                <Refresh size={14} /> Restore the examples
              </Button>
              <Button variant="danger" onClick={() => setConfirmClear(true)}>
                <Trash size={14} /> Delete everything
              </Button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">About</h2>
          </div>
          <div className="panel-body stack-sm">
            <p className="text-sm text-secondary">
              Gauntlet Builder turns a plain description of what you want into a complete
              orchestration prompt: roles, ownership boundaries, evidence requirements, approval
              rules, and — the part that matters most — stopping conditions that will not let an
              agent claim success it has not earned.
            </p>
            <p className="text-sm text-secondary">
              Everything runs in your browser. No account, no server, no data leaves this machine.
            </p>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Delete everything?"
        description={
          <>
            All {state.gauntlets.length} saved Gauntlets and your settings will be removed from this
            browser. This cannot be undone. Export first if there is anything you want to keep.
          </>
        }
        confirmLabel="Delete everything"
        onConfirm={() => {
          clearState();
          window.location.reload();
        }}
      />
    </>
  );
}
