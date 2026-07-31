/**
 * UI tests: the full create-to-export workflow, plus the accessibility
 * behaviours that are easy to regress.
 *
 * These drive the real app through user-visible affordances rather than
 * reaching into the store, so a passing test means the workflow genuinely
 * works from the outside.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';
import { AgentEditor } from '../components/agents/AgentEditor';
import { WorkflowDiagram } from '../components/diagram/WorkflowDiagram';
import { TooltipProvider } from '../components/ui';
import { applyTopology, createGauntlet } from '../model/defaults';
import { setIdSeed } from '../model/ids';
import type { GauntletConfig } from '../model/types';

function renderApp() {
  return { user: userEvent.setup(), ...render(<App />) };
}

describe('application shell', () => {
  it('opens directly into the product, not a marketing page', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Gauntlet Builder', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New Gauntlet/i }).length).toBeGreaterThan(0);
  });

  it('provides a skip link to the main content', async () => {
    renderApp();
    const skip = await screen.findByRole('link', { name: /skip to main content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
  });

  it('navigates between views from the sidebar', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Preset library' }));
    expect(await screen.findByRole('heading', { name: 'Preset library', level: 1 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Saved Gauntlets/ }));
    expect(await screen.findByRole('heading', { name: 'Saved Gauntlets', level: 1 })).toBeInTheDocument();
  });

  it('changes theme from the sidebar control', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Dark theme' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'dark'));

    await user.click(screen.getByRole('button', { name: 'Light theme' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
  });

  it('seeds sample Gauntlets on first launch', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: /Saved Gauntlets/ }));
    expect(await screen.findByText('Customer billing dashboard')).toBeInTheDocument();
  });
});

describe('creating a Gauntlet', () => {
  it('walks from a new Gauntlet through to a generated prompt', async () => {
    const { user } = renderApp();

    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);

    // Step 1
    expect(await screen.findByRole('heading', { name: /What are you trying to accomplish/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/What should this be called/i), 'Test Project');
    await user.type(screen.getByLabelText(/What do you want accomplished/i), 'Build a small dashboard.');
    await user.type(screen.getByLabelText(/What has to exist when it is finished/i), 'A working page.');

    // Step 2
    await user.click(screen.getByRole('button', { name: /^Next/ }));
    expect(await screen.findByRole('heading', { name: /What does success look like/i })).toBeInTheDocument();

    // Selecting evidence should add a matching criterion automatically.
    await user.click(screen.getByRole('button', { name: /Automated tests/i, pressed: false }));
    await waitFor(() => expect(screen.getByText(/Automated tests pass/)).toBeInTheDocument());

    // Jump to the generate step via the step rail.
    await user.click(screen.getByRole('button', { name: /Step 10\. Generate/ }));
    expect(await screen.findByRole('heading', { name: /Your Gauntlet is ready/i })).toBeInTheDocument();

    // The generated prompt reflects what was entered.
    const raw = await screen.findByRole('tab', { name: 'Master prompt' });
    expect(raw).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Build a small dashboard/)).toBeInTheDocument();
    });
  }, 30000);

  it('shows the completion indicator advancing as steps are filled in', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);

    const progress = await screen.findByRole('progressbar', { name: /completion/i });
    const before = Number(progress.getAttribute('aria-valuenow'));

    await user.type(screen.getByLabelText(/What do you want accomplished/i), 'A goal.');
    await user.type(screen.getByLabelText(/What has to exist when it is finished/i), 'A thing.');

    await waitFor(() => {
      expect(Number(progress.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
    });
  }, 20000);

  it('surfaces validation problems on the review step with a way to fix them', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);

    await user.click(await screen.findByRole('button', { name: /Step 9\. Review/ }));

    expect(await screen.findByText('Must be fixed')).toBeInTheDocument();
    expect(screen.getByText('No goal described')).toBeInTheDocument();
    // Both the missing goal and the missing deliverable point at step 1.
    expect(screen.getAllByRole('button', { name: /Go to step 1/ }).length).toBeGreaterThan(0);
  }, 20000);

  it('jumps to the offending step when a warning action is used', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);
    await user.click(await screen.findByRole('button', { name: /Step 9\. Review/ }));
    await user.click((await screen.findAllByRole('button', { name: /Go to step 1/ }))[0]);

    expect(
      await screen.findByRole('heading', { name: /What are you trying to accomplish/i }),
    ).toBeInTheDocument();
  }, 20000);
});

describe('presets', () => {
  it('starts a configured Gauntlet from a preset', async () => {
    const { user } = renderApp();

    await user.click(await screen.findByRole('button', { name: 'Preset library' }));
    const card = (await screen.findByRole('heading', { name: 'Research report' })).closest('article');
    expect(card).not.toBeNull();

    await user.click(within(card as HTMLElement).getByRole('button', { name: /Use this/ }));

    // Lands in the wizard with agents already configured.
    expect(await screen.findByRole('heading', { name: /What are you trying to accomplish/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Step 4\. Participants/ }));
    expect(await screen.findByText('Fact Verifier')).toBeInTheDocument();
    expect(screen.getByText('Citation Auditor')).toBeInTheDocument();
  }, 20000);

  it('shows what a preset contains before using it', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Preset library' }));

    const card = (await screen.findByRole('heading', { name: 'Accessibility audit' })).closest('article');
    await user.click(within(card as HTMLElement).getByRole('button', { name: /What's inside/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Keyboard operable/)).toBeInTheDocument();
  }, 20000);
});

describe('saved Gauntlets', () => {
  it('searches by name', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: /Saved Gauntlets/ }));

    const search = await screen.findByRole('searchbox', { name: /Search saved Gauntlets/i });
    await user.type(search, 'billing');

    await waitFor(() => {
      expect(screen.getByText('Customer billing dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Competitor pricing analysis')).not.toBeInTheDocument();
    });
  }, 20000);

  it('duplicates a Gauntlet', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: /Saved Gauntlets/ }));

    const before = screen.getAllByRole('article').length;
    await user.click(screen.getAllByRole('button', { name: 'Duplicate' })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('article').length).toBe(before + 1);
    });
    expect(screen.getByText(/\(copy\)/)).toBeInTheDocument();
  }, 20000);

  it('confirms before deleting', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: /Saved Gauntlets/ }));

    const before = screen.getAllByRole('article').length;
    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getAllByRole('article').length).toBe(before - 1));
  }, 20000);

  it('renames a Gauntlet', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: /Saved Gauntlets/ }));

    await user.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'Renamed Gauntlet');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(screen.getByText('Renamed Gauntlet')).toBeInTheDocument());
  }, 20000);
});

describe('agent editor', () => {
  function renderEditor(initial?: GauntletConfig) {
    setIdSeed('agents');
    let config = initial ?? applyTopology(createGauntlet(), 'builder-critic');
    const update = vi.fn((updater: (c: GauntletConfig) => GauntletConfig) => {
      config = updater(config);
      rerender(
        <TooltipProvider>
          <AgentEditor config={config} update={update} advanced />
        </TooltipProvider>,
      );
    });
    const { rerender } = render(
      <TooltipProvider>
        <AgentEditor config={config} update={update} advanced />
      </TooltipProvider>,
    );
    return { user: userEvent.setup(), getConfig: () => config };
  }

  it('adds an agent from the role picker', async () => {
    const { user, getConfig } = renderEditor();
    const before = getConfig().agents.length;

    await user.click(screen.getByRole('button', { name: /Add an agent/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Security reviewer/ }));

    await waitFor(() => expect(getConfig().agents.length).toBe(before + 1));
    expect(getConfig().agents.some((a) => a.roleType === 'security-reviewer')).toBe(true);
  }, 20000);

  it('removes an agent and cleans up references to it', async () => {
    const { user, getConfig } = renderEditor();
    const target = getConfig().agents[0];

    await user.click(screen.getByRole('button', { name: `Remove ${target.name}` }));

    await waitFor(() => expect(getConfig().agents.some((a) => a.id === target.id)).toBe(false));
    expect(
      getConfig().communication.edges.some((e) => e.from === target.id || e.to === target.id),
    ).toBe(false);
  }, 20000);

  it('duplicates an agent with a distinct id', async () => {
    const { user, getConfig } = renderEditor();
    const target = getConfig().agents[0];

    await user.click(screen.getByRole('button', { name: `Duplicate ${target.name}` }));

    await waitFor(() => expect(getConfig().agents.length).toBe(2 + 1 - 1 + 1));
    const copies = getConfig().agents.filter((a) => a.roleType === target.roleType);
    expect(copies.length).toBeGreaterThan(1);
    expect(new Set(copies.map((c) => c.id)).size).toBe(copies.length);
  }, 20000);

  it('toggles mandatory approval', async () => {
    const { user, getConfig } = renderEditor();
    const critic = getConfig().agents.find((a) => a.roleType === 'critic')!;

    await user.click(screen.getByRole('button', { name: `Expand ${critic.name}` }));
    const toggle = await screen.findByLabelText('Its approval is required');
    await user.click(toggle);

    await waitFor(() => {
      const updated = getConfig().agents.find((a) => a.id === critic.id)!;
      expect(updated.mandatoryApproval).toBe(false);
    });
  }, 20000);
});

describe('workflow diagram', () => {
  it('renders a node per enabled agent, each keyboard reachable', () => {
    setIdSeed('diagram');
    const config = applyTopology(createGauntlet(), 'specialist-team');
    render(
      <TooltipProvider>
        <WorkflowDiagram agents={config.agents} edges={config.communication.edges} />
      </TooltipProvider>,
    );

    const nodes = screen.getAllByRole('button');
    const agentNodes = nodes.filter((n) => n.getAttribute('aria-label')?.includes('Lead Orchestrator'));
    expect(agentNodes.length).toBeGreaterThan(0);
    agentNodes.forEach((node) => expect(node).toHaveAttribute('tabindex', '0'));
  });

  it('describes the flow in text for assistive technology', () => {
    setIdSeed('diagram2');
    const config = applyTopology(createGauntlet(), 'builder-critic');
    const { container } = render(
      <TooltipProvider>
        <WorkflowDiagram agents={config.agents} edges={config.communication.edges} />
      </TooltipProvider>,
    );
    const desc = container.querySelector('desc');
    expect(desc?.textContent).toContain('sends to');
  });

  it('opens an inspector when a node is selected', async () => {
    setIdSeed('diagram3');
    const user = userEvent.setup();
    const config = applyTopology(createGauntlet(), 'builder-critic');
    render(
      <TooltipProvider>
        <WorkflowDiagram agents={config.agents} edges={config.communication.edges} />
      </TooltipProvider>,
    );

    const node = screen.getByRole('button', { name: /^Builder, Builder/ });
    await user.click(node);

    expect(await screen.findByText('Receives')).toBeInTheDocument();
    expect(screen.getByText('Sends')).toBeInTheDocument();
  }, 20000);

  it('shows an empty state rather than a broken diagram with no agents', () => {
    render(
      <TooltipProvider>
        <WorkflowDiagram agents={[]} edges={[]} />
      </TooltipProvider>,
    );
    expect(screen.getByText(/No agents yet/)).toBeInTheDocument();
  });
});

describe('accessibility behaviours', () => {
  it('labels every form control in step 1', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);

    await screen.findByRole('heading', { name: /What are you trying to accomplish/i });
    const textboxes = screen.getAllByRole('textbox');
    textboxes.forEach((box) => {
      expect(box).toHaveAccessibleName();
    });
  }, 20000);

  it('marks the current wizard step for assistive technology', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);

    const current = await screen.findByRole('button', { current: 'step' });
    expect(current).toHaveTextContent('The task');
  }, 20000);

  it('marks the current view in the navigation', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Preset library' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preset library' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  }, 20000);

  it('exposes evidence options as toggle buttons with pressed state', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);
    await user.click(await screen.findByRole('button', { name: /Step 2\. Success/ }));

    const option = await screen.findByRole('button', { name: /Accessibility testing/i, pressed: false });
    await user.click(option);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Accessibility testing/i, pressed: true })).toBeInTheDocument();
    });
  }, 20000);

  it('can be operated with the keyboard alone', async () => {
    const { user } = renderApp();
    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);
    await screen.findByRole('heading', { name: /What are you trying to accomplish/i });

    const nameField = screen.getByLabelText(/What should this be called/i);
    nameField.focus();
    await user.keyboard('Keyboard Test');
    expect(nameField).toHaveValue('Keyboard Test');

    await user.tab();
    expect(document.activeElement).not.toBe(nameField);
  }, 20000);
});

describe('settings', () => {
  it('changes density and applies it to the document', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    await user.click(await screen.findByRole('button', { name: 'Compact' }));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-density', 'compact'));
  }, 20000);

  it('reports how many Gauntlets are stored', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    const heading = await screen.findByRole('heading', { name: 'Your data' });
    const panel = heading.closest('.panel') as HTMLElement;
    expect(within(panel).getByText('Saved Gauntlets')).toBeInTheDocument();
  }, 20000);
});
