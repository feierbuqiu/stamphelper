import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { buildPagesHeaders } from "../scripts/security-policy.mjs";

const stageRoot = new URL("../dist/cloudflare-pages/", import.meta.url);

test("ships a strict hash-based CSP and defensive static-site headers", async () => {
  const html = await readFile(new URL("index.html", stageRoot), "utf8");
  const headers = await readFile(new URL("_headers", stageRoot), "utf8");
  const assetNames = await readdir(new URL("assets/", stageRoot));
  const workerName = assetNames.find((name) => /^stamp-solver\.worker-[^.]+\.js$/.test(name));
  assert.ok(workerName);

  assert.equal(headers, buildPagesHeaders(html, assetNames, workerName));
  assert.match(headers, /Content-Security-Policy: .*frame-ancestors 'none'/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.match(headers, /style-src-attr 'none'/);
  assert.match(headers, /worker-src 'self'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Permissions-Policy:/);
  assert.match(headers, /Cache-Control: public, max-age=0, must-revalidate/);
  assert.match(headers, /\/404\.html\n {2}Cache-Control: no-store/);
  assert.doesNotMatch(headers, /\/assets\/\*/);
  for (const assetName of assetNames) {
    assert.match(headers, new RegExp(`/assets/${assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n  Cache-Control: public, max-age=31536000, immutable`));
  }
  assert.doesNotMatch(headers, /'unsafe-inline'|'unsafe-eval'/);
  assert.ok(headers.split(/\r?\n/).every((line) => line.length <= 2_000), "Cloudflare _headers line limit exceeded");
  assert.ok(headers.split(/\r?\n/).filter((line) => line && !/^\s|#/.test(line)).length <= 100);
  assert.equal(assetNames.some((name) => name.endsWith(".map")), false);
});

test("does not package project metadata, secrets, or database scaffolding", async () => {
  const rootNames = await readdir(stageRoot);
  assert.equal(rootNames.includes("404.html"), true);
  for (const forbidden of [".env", ".git", ".openai", "drizzle", "db", "worker"]) {
    assert.equal(rootNames.includes(forbidden), false, forbidden);
  }
  const html = await readFile(new URL("index.html", stageRoot), "utf8");
  assert.doesNotMatch(html, /[A-Z]:\\|process\.env|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/);
});
