import type { AddressInfo } from "node:net";

import { createMemorySessionStore, createNdjsonAdapter } from "@agent-kit/core";
import { createMockServer } from "@agent-kit/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AgentApp } from "./AgentApp";

let server: ReturnType<typeof createMockServer>;
let base = "";

beforeAll(async () => {
  server = createMockServer({ speed: 300, lang: "tr" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

// jsdom's AbortSignal is not the one Node's fetch expects, so the signal is dropped here:
// these tests never stop a run (adapter tests in @agent-kit/core cover that).
const fetchImpl = ((url: string, init?: RequestInit) => fetch(url, { ...init, signal: undefined })) as typeof fetch;

function screenFor(locale: "tr" | "en" = "tr") {
  const adapter = createNdjsonAdapter({ baseUrl: base, retry: false, fetchImpl, healthPath: "/health", approvalPath: (id) => `/approvals/${id}` });
  const store = createMemorySessionStore();
  const user = userEvent.setup();
  render(<AgentApp adapter={adapter} store={store} locale={locale} syncAddress={false} />);
  const ask = async (question: string) => {
    await user.type(screen.getByLabelText(locale === "tr" ? "Sorunuz" : "Your question"), question);
    await user.click(screen.getByRole("button", { name: locale === "tr" ? "Soruyu gönder" : "Send the question" }));
  };
  return { user, ask, store };
}

describe("AgentApp against the mock backend", () => {
  it("teaches what can be asked, then answers a question and files it in the sidebar", async () => {
    const { ask, store } = screenFor();
    expect(await screen.findByText("Kayıt arama")).toBeInTheDocument();
    await ask("merhaba");

    expect(await screen.findByText(/Kayıtları arayabilir/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText("merhaba").length).toBeGreaterThan(0);
    await waitFor(async () => expect(await store.list()).toHaveLength(1));
    expect(await screen.findByRole("button", { name: "merhaba" })).toBeInTheDocument();
  });

  it("shows records as rows, sources behind them and the way the run went", async () => {
    const { ask, user } = screenFor();
    await ask("Son 30 günün kayıtlarını listele");

    expect(await screen.findByText(/sekiz kayıt buldum/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").some((item) => item.classList.contains("record-row"))).toBe(true);
    expect(await screen.findByText("Doğrulandı", {}, { timeout: 5000 })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Kaynakları aç/ }));
    expect(await screen.findByRole("tab", { name: /Kaynaklar/ })).toHaveAttribute("aria-selected", "true");
  });

  it("asks before an irreversible action and continues on approval", async () => {
    const { ask, user } = screenFor();
    await ask("sonucu e-posta ile gönder");

    const approve = await screen.findByRole("button", { name: "Onayla" }, { timeout: 8000 });
    expect(screen.getByText("E-posta gönderilsin mi?")).toBeInTheDocument();
    await user.click(approve);

    expect(await screen.findByText(/E-posta ekibe gönderildi/, {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("keeps a failed question on screen with what the backend said, and a way to retry", async () => {
    const { ask } = screenFor();
    await ask("bu hata versin");

    const alert = await screen.findByRole("alert", {}, { timeout: 8000 });
    expect(within(alert).getByText("Ajan bu soruyu tamamlayamadı")).toBeInTheDocument();
    expect(within(alert).getByText("Arama servisi zaman aşımına uğradı.")).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: /Tekrar dene/ })).toBeInTheDocument();
  });

  it("says a dropped connection is a dropped connection", async () => {
    const { ask } = screenFor();
    await ask("bağlantı kopma testi");
    expect(await screen.findByText("Bağlantı yarıda kesildi", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("takes the last question back to be edited, and asks it again on request", async () => {
    const { ask, user } = screenFor();
    await ask("merhaba");
    await screen.findByText(/Kayıtları arayabilir/, {}, { timeout: 5000 });

    await user.click(screen.getByRole("button", { name: "Soruyu düzenle" }));
    expect(screen.queryByText(/Kayıtları arayabilir/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Sorunuz")).toHaveValue("merhaba");
    await user.click(screen.getByRole("button", { name: "Soruyu gönder" }));
    await screen.findByText(/Kayıtları arayabilir/, {}, { timeout: 5000 });

    await user.click(screen.getByRole("button", { name: "Yeniden üret" }));
    expect(await screen.findByText(/Kayıtları arayabilir/, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it("records a rating on the answer", async () => {
    const { ask, user, store } = screenFor();
    await ask("merhaba");
    await screen.findByText(/Kayıtları arayabilir/, {}, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "İyi yanıt" }));
    expect(screen.getByRole("button", { name: "İyi yanıt" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () => {
      const [row] = await store.list();
      const detail = await store.get(row.session_id);
      expect(detail.messages.some((message) => message.feedback === "up")).toBe(true);
    });
  });

  it("speaks English", async () => {
    const { ask } = screenFor("en");
    expect(await screen.findByText("Record search")).toBeInTheDocument();
    await ask("hello");
    // The mock answers in Turkish; the screen around it is English.
    expect(await screen.findByRole("button", { name: "Copy the answer" }, { timeout: 5000 })).toBeInTheDocument();
  });
});
