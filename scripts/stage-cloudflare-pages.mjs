import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertSafeStaticHtml, buildPagesHeaders } from "./security-policy.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const distDir = path.join(siteDir, "dist");
const clientDir = path.join(distDir, "client");
const stageDir = path.join(distDir, "cloudflare-pages");

if (path.dirname(stageDir) !== distDir) throw new Error(`Unsafe staging path: ${stageDir}`);
await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });

for (const entry of await readdir(clientDir, { withFileTypes: true })) {
  if (entry.name === ".vite" || entry.name === ".assetsignore") continue;
  await cp(path.join(clientDir, entry.name), path.join(stageDir, entry.name), {
    recursive: entry.isDirectory(),
  });
}

const serverUrl = pathToFileURL(path.join(distDir, "server", "index.js"));
serverUrl.searchParams.set("static-pages-package", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(serverUrl.href);
const response = await worker.fetch(
  new Request("https://stamphelper-cn.feierbuqiu.uk/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);
if (!response.ok) throw new Error(`Static HTML render failed with HTTP ${response.status}`);
const html = await response.text();
if (!/<html[^>]+lang="zh-CN"/i.test(html)) throw new Error("Rendered HTML is incomplete");
assertSafeStaticHtml(html);
await writeFile(path.join(stageDir, "index.html"), html, "utf8");
await Promise.all([
  cp(path.join(siteDir, "LICENSE"), path.join(stageDir, "LICENSE.txt")),
  cp(path.join(siteDir, "DATA_LICENSES.md"), path.join(stageDir, "DATA_LICENSES.md")),
  cp(path.join(siteDir, "THIRD_PARTY_NOTICES.md"), path.join(stageDir, "THIRD_PARTY_NOTICES.md")),
]);
await writeFile(
  path.join(stageDir, "404.html"),
  '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面未找到｜贴票助手</title></head><body><main><h1>404</h1><p>没有找到这个页面。</p><p><a href="/">返回贴票助手</a></p></main></body></html>',
  "utf8",
);

const assetsDir = path.join(stageDir, "assets");
const assetNames = await readdir(assetsDir);
const workerNames = assetNames.filter((name) => /^stamp-solver\.worker-[^.]+\.js$/.test(name));
if (workerNames.length !== 1) {
  throw new Error(`Expected exactly one stamp-solver worker, found: ${workerNames.join(", ") || "none"}`);
}
const [workerName] = workerNames;
if (workerName === "stamp-solver.worker-BCBhPd-R.js") {
  throw new Error("The staged package still uses the poisoned production Worker URL");
}

const workerSource = await readFile(path.join(assetsDir, workerName), "utf8");
if (/<!doctype html/i.test(workerSource) || !workerSource.includes("2026-07-31-worker-redeploy-1")) {
  throw new Error(`${workerName} is not the expected JavaScript Worker`);
}
const javascriptNames = assetNames.filter((name) => name.endsWith(".js") && name !== workerName);
const referencesWorker = (
  await Promise.all(javascriptNames.map((name) => readFile(path.join(assetsDir, name), "utf8")))
).some((source) => source.includes(workerName));
if (!referencesWorker) throw new Error(`No staged client bundle references ${workerName}`);

const headersPath = path.join(stageDir, "_headers");
await writeFile(headersPath, buildPagesHeaders(html, assetNames, workerName), "utf8");

console.log(`Cloudflare Pages staging directory: ${stageDir}`);
console.log(`Verified Worker asset and client reference: assets/${workerName}`);
