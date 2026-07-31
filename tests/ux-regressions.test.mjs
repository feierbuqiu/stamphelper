import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("delays visible solver feedback and keeps the previous result card mounted", async () => {
  const hook = await readFile(new URL("../lib/use-stamp-calculation.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(hook, /PENDING_DISPLAY_DELAY_MS\s*=\s*200/);
  assert.match(page, /solverPending && hasTarget[\s\S]*solver-update-badge/);
  assert.match(page, /\) : !solverReady \? \(/);
  assert.doesNotMatch(page, /\) : solverPending \? \(/);
});

test("sets explicit native option colors for both desktop color schemes", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.select-wrap select option,[\s\S]*background-color: #fff;[\s\S]*color: #17332a;/);
  assert.match(css, /data-color-scheme="dark"[^}]+\.select-wrap select option[\s\S]*background-color: #17251f;[\s\S]*color: #e3efe9;/);
  assert.match(css, /color-scheme: dark;/);
});
