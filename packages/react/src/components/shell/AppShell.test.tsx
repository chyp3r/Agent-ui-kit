import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

afterEach(() => vi.unstubAllGlobals());

describe("AppShell", () => {
  it("does not let a split stored on a wider window push the panel off this one", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key.includes("room") ? "1300" : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("innerWidth", 1440);
    const { container } = render(
      <AppShell
        started={false}
        sidebar={() => null}
        panel={<div />}
        panelAvailable
        panelExpanded={false}
        onTogglePanel={() => undefined}
        onClosePanel={() => undefined}
        onNew={() => undefined}
      >
        <div />
      </AppShell>,
    );
    const room = Number.parseInt((container.firstChild as HTMLElement).style.getPropertyValue("--room-w"), 10);
    // 1440 wide, 272 of sidebar, 20 of chrome, and the panel keeps its 400.
    expect(room).toBeLessThanOrEqual(1440 - 272 - 20 - 400);
  });
});
