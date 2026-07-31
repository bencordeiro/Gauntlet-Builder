/**
 * Test environment setup.
 *
 * jsdom lacks several browser APIs that Radix primitives and the export helpers
 * rely on. Stubbing them here keeps individual tests focused on behaviour
 * rather than on environment plumbing.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

import { setIdSeed } from '../model/ids';

// Radix uses these for positioning and for detecting pointer capability.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
}

// jsdom defines scrollTo but throws "not implemented" when called, so this is
// replaced unconditionally rather than only when absent.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// URL.createObjectURL is used by the download helper.
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
}

beforeEach(() => {
  window.localStorage.clear();
  // Deterministic IDs so generated output can be compared across runs.
  setIdSeed('test');
});

afterEach(() => {
  cleanup();
  setIdSeed(null);
  vi.clearAllMocks();
});
