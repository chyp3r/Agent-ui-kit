#!/usr/bin/env node
import { createMockServer } from "./server.ts";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const port = Number(arg("port", process.env.PORT ?? "18100"));
const speed = Number(arg("speed", "1"));
const lang = arg("lang", "tr") === "en" ? "en" : "tr";

createMockServer({ port, speed, lang }).listen(port, "0.0.0.0", () => {
  console.log(`agent-kit mock listening on :${port} (speed ${speed}x, ${lang})`);
  console.log("words in a question pick the run: grafik, onay, hata, kopma, tekrar, say, düşün, merhaba");
});
