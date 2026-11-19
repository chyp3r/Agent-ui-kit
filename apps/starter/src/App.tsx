import { AgentApp } from "@agent-kit/react";
import { useMemo } from "react";

import { createAdapter, createStore } from "./adapter";
import { kit } from "./kit";
import { Gallery } from "./Gallery";

const params = new URLSearchParams(globalThis.location.search);
const locale = params.get("lang") === "en" ? "en" : "tr";

export default function App() {
  const adapter = useMemo(createAdapter, []);
  const store = useMemo(createStore, []);
  if (params.get("view") === "gallery") return <Gallery locale={locale} />;
  return <AgentApp adapter={adapter} store={store} kit={kit} locale={locale} />;
}
