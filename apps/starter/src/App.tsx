import { AgentApp } from "@agent-kit/react";
import { lazy, Suspense, useMemo } from "react";

import { createAdapter, createStore } from "./adapter";
import { kit } from "./kit";
// Loaded on demand: the gallery is for restyling, not for the product.
const Gallery = lazy(() => import("./Gallery").then((module) => ({ default: module.Gallery })));

const params = new URLSearchParams(globalThis.location.search);
const locale = params.get("lang") === "en" ? "en" : "tr";

export default function App() {
  const adapter = useMemo(createAdapter, []);
  const store = useMemo(createStore, []);
  if (params.get("view") === "gallery") {
    return (
      <Suspense fallback={null}>
        <Gallery locale={locale} />
      </Suspense>
    );
  }
  return <AgentApp adapter={adapter} store={store} kit={kit} locale={locale} />;
}
