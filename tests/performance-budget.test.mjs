import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { gzipSync } from "node:zlib";

const clientRoot = new URL("../dist/client/", import.meta.url);

test("keeps the interactive client within a conservative compressed-size budget", async () => {
  const manifest = JSON.parse(await readFile(new URL(".vite/manifest.json", clientRoot), "utf8"));
  const javascriptFiles = [...new Set(Object.values(manifest).map((entry) => entry.file))];
  let totalGzipBytes = 0;
  let pageGzipBytes = 0;

  for (const file of javascriptFiles) {
    const compressed = gzipSync(await readFile(new URL(file, clientRoot))).length;
    totalGzipBytes += compressed;
    if (/\/page-[^/]+\.js$/.test(`/${file}`)) pageGzipBytes = compressed;
  }

  assert.ok(pageGzipBytes > 0, "page bundle was not found in the client manifest");
  assert.ok(pageGzipBytes <= 120_000, `page bundle is ${pageGzipBytes} gzip bytes`);
  assert.ok(totalGzipBytes <= 220_000, `interactive JavaScript is ${totalGzipBytes} gzip bytes`);
});

test("keeps critical CSS small and avoids loading a second webfont family", async () => {
  const assetNames = await readdir(new URL("assets/", clientRoot));
  const cssName = assetNames.find((name) => /^index-[^.]+\.css$/.test(name));
  assert.ok(cssName, "compiled stylesheet was not found");
  const css = await readFile(new URL(`assets/${cssName}`, clientRoot));
  assert.ok(gzipSync(css).length <= 12_000);
  assert.doesNotMatch(css.toString("utf8"), /font-geist-mono|Geist Mono/);
});

test("ships the stamp solver as a dedicated Web Worker asset", async () => {
  const assetNames = await readdir(new URL("assets/", clientRoot));
  const workerName = assetNames.find((name) => /^stamp-solver\.worker-[^.]+\.js$/.test(name));
  assert.ok(workerName, "compiled stamp-solver Web Worker was not found");
  assert.notEqual(workerName, "stamp-solver.worker-BCBhPd-R.js", "worker cache-bust did not change the poisoned production URL");
  const worker = await readFile(new URL(`assets/${workerName}`, clientRoot));
  assert.ok(worker.length < 20_000, `worker asset is unexpectedly large: ${worker.length} bytes`);
  assert.match(worker.toString("utf8"), /2026-07-31-worker-redeploy-1/);
  assert.doesNotMatch(worker.toString("utf8"), /<!doctype html/i);

  const clientJavaScript = await Promise.all(
    assetNames
      .filter((name) => name.endsWith(".js") && name !== workerName)
      .map((name) => readFile(new URL(`assets/${name}`, clientRoot), "utf8")),
  );
  assert.ok(
    clientJavaScript.some((source) => source.includes(workerName)),
    `no client bundle references ${workerName}`,
  );
});
