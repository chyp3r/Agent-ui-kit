import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// `globals: false` keeps vitest out of the app's type space, which also means
// Testing Library's automatic cleanup is never registered. Without this every
// render stacks on the previous one.
afterEach(cleanup);

// jsdom draws nothing and measures nothing. The circuit steps aside without a
// context, and the observers only need to exist.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
// Assigned, not stubbed: a test's `vi.unstubAllGlobals()` must not take these with it.
globalThis.ResizeObserver = NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver;
