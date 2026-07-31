/**
 * Console-cleanliness smoke test.
 *
 * Mounts every view and exercises the deeper wizard steps, failing on any
 * console error or warning. This is what catches React key warnings, invalid
 * DOM nesting, controlled/uncontrolled switches and missing-`act` warnings —
 * the class of defect that never fails an assertion but fills a real browser's
 * console.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';

/** Warnings that come from the environment rather than from our code. */
const IGNORED = [
  'Not implemented: window.scrollTo',
  'Not implemented: navigation',
  // jsdom cannot lay out SVG, so Radix position warnings are not actionable.
  'getComputedStyle',
];

let messages: string[] = [];
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  messages = [];
  const capture = (...args: unknown[]) => {
    const text = args
      .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');
    if (!IGNORED.some((ignored) => text.includes(ignored))) messages.push(text);
  };
  errorSpy = vi.spyOn(console, 'error').mockImplementation(capture);
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(capture);
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

function expectCleanConsole() {
  expect(messages, `console output:\n${messages.join('\n---\n')}`).toEqual([]);
}

describe('console cleanliness', () => {
  it('mounts the dashboard without errors or warnings', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Gauntlet Builder', level: 1 });
    expectCleanConsole();
  });

  it('visits every view without errors or warnings', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Gauntlet Builder', level: 1 });

    for (const view of ['Preset library', 'Saved Gauntlets', 'Settings', 'Dashboard']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${view}`) }));
      await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    }

    expectCleanConsole();
  }, 30000);

  it('walks all ten wizard steps without errors or warnings', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click((await screen.findAllByRole('button', { name: /New Gauntlet/i }))[0]);
    await screen.findByRole('heading', { name: /What are you trying to accomplish/i });

    for (let step = 1; step <= 10; step += 1) {
      await user.click(screen.getByRole('button', { name: new RegExp(`Step ${step}\\.`) }));
      // The step heading is the stable anchor; several steps also render h1s
      // inside their own content, so query it by id rather than by role.
      await waitFor(() =>
        expect(document.getElementById('wizard-step-title')).toBeInTheDocument(),
      );
    }

    expectCleanConsole();
  }, 45000);

  it('renders the editor with every section open', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /^Saved Gauntlets/ }));
    await user.click((await screen.findAllByRole('button', { name: 'Open' }))[0]);
    await screen.findByRole('tab', { name: 'Task' });

    for (const section of [
      'Quality bar',
      'Structure',
      'Agents',
      'Communication',
      'Approval',
      'Revisions',
      'Strictness',
      'Issues',
    ]) {
      // The Issues tab carries a warning count in its label.
      const pattern = new RegExp(`^${section}`);
      await user.click(screen.getByRole('tab', { name: pattern }));
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: pattern })).toHaveAttribute('data-state', 'active'),
      );
    }

    expectCleanConsole();
  }, 45000);

  it('renders every generated output tab', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /^Saved Gauntlets/ }));
    await user.click((await screen.findAllByRole('button', { name: 'Prompt' }))[0]);
    await screen.findByRole('tab', { name: 'Master prompt' });

    for (const tabName of [
      'Agent instructions',
      'Evaluation rubric',
      'Workflow JSON',
      'Workflow YAML',
      'Plain-English summary',
      'Execution checklist',
      'Master prompt',
    ]) {
      await user.click(screen.getByRole('tab', { name: tabName }));
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: tabName })).toHaveAttribute('data-state', 'active'),
      );
    }

    expectCleanConsole();
  }, 45000);

  it('renders generated markdown as elements, never as raw HTML', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(await screen.findByRole('button', { name: /^Saved Gauntlets/ }));
    await user.click((await screen.findAllByRole('button', { name: 'Prompt' }))[0]);
    await screen.findByRole('tab', { name: 'Master prompt' });

    const prose = container.querySelector('.preview-rendered');
    expect(prose).not.toBeNull();
    // Headings and tables arrived as real elements, which only happens if the
    // markdown renderer ran rather than dumping text.
    expect(prose!.querySelectorAll('h2').length).toBeGreaterThan(3);
    expect(prose!.querySelectorAll('table').length).toBeGreaterThan(0);
    expectCleanConsole();
  }, 45000);
});
