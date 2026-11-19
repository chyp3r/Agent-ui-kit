#!/usr/bin/env node
/**
 * The kit must carry nothing of the product it was extracted from. Fails when a
 * source file mentions one of the banned words, so a stray example cannot slip in.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const BANNED = /aselsan|kamera|otopark|plaka|nizamiye|danisman|kkb|hackathon/i;
const SKIP = new Set(["node_modules", "dist", ".git", "package-lock.json", "check-clean.mjs"]);

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|css|md|json|html|mjs|yaml|yml|svg|template|txt)$/.test(name) || name === "Dockerfile") {
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (BANNED.test(line)) hits.push(`${relative(root, path)}:${index + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
  }
}
walk(root);

if (hits.length) {
  console.error(`clean gate failed: ${hits.length} line(s) mention the source product\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("clean gate passed: no trace of the source product");
