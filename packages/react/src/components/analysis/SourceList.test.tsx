import type { Source } from "@agent-kit/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SourceList } from "./SourceList";

const source = (id: string, tag: string | null, text: string): Source => ({ id, tag, time: "01/10/2026 09:00", agent: "researcher", confidence: 0.9, text });
const SOURCES = [
  source("1", "wiki", "alpha İzmir"),
  source("2", "wiki", "beta"),
  source("3", "crm", "gamma"),
  source("4", "crm", "delta"),
  source("5", "crm", "epsilon"),
  source("6", null, "zeta without a tag"),
];

describe("SourceList", () => {
  it("lists every source and counts tags", () => {
    render(<SourceList sources={SOURCES} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("filters by tag and starts on the tag it was opened with", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SourceList sources={SOURCES} />);
    await user.click(screen.getByRole("button", { name: /^crm/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    rerender(<SourceList key="again" sources={SOURCES} tag="wiki" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("finds text the way the language folds it: İzmir by typing izmir", async () => {
    const user = userEvent.setup();
    render(<SourceList sources={SOURCES} />);
    await user.type(screen.getByRole("searchbox"), "izmir");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("alpha İzmir")).toBeInTheDocument();
  });

  it("says where a tagless source came from instead of inventing a tag", () => {
    render(<SourceList sources={SOURCES} />);
    expect(screen.getByText("Araştırmacı")).toBeInTheDocument();
  });
});
