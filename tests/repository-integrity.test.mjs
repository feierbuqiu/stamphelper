import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirectories = new Set([".git", ".local", ".next", ".vinext", ".wrangler", "dist", "node_modules"]);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

test("publishes complete package and repository metadata", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(packageJson.name, "@feierbuqiu/stamphelper");
  assert.equal(packageJson.version, "1.0.0");
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.license, "MIT");
  assert.equal(packageJson.repository.url, "git+https://github.com/feierbuqiu/stamphelper.git");

  for (const required of [
    "README.md",
    "README.zh-CN.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "DATA_LICENSES.md",
    "THIRD_PARTY_NOTICES.md",
    "data/postage-rates.zh-CN.md",
    "data/stamp-denominations.tsv",
  ]) {
    assert.equal((await stat(path.join(repositoryRoot, required))).isFile(), true, required);
  }
});

test("keeps local Markdown links valid", async () => {
  const markdownFiles = (await walk(repositoryRoot)).filter((file) => file.endsWith(".md"));
  const missing = [];

  for (const file of markdownFiles) {
    const markdown = await readFile(file, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, "");
      if (!rawTarget || rawTarget.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(rawTarget)) continue;
      const target = decodeURIComponent(rawTarget.split("#", 1)[0].split("?", 1)[0]);
      if (!target) continue;
      try {
        await stat(path.resolve(path.dirname(file), target));
      } catch {
        missing.push(`${path.relative(repositoryRoot, file)} -> ${rawTarget}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});

test("pins workflow actions and excludes local secrets", async () => {
  const files = await walk(repositoryRoot);
  const forbiddenNames = files
    .map((file) => path.relative(repositoryRoot, file).replaceAll("\\", "/"))
    .filter((file) => /(^|\/)(?:\.env(?:\.|$)|id_(?:rsa|ed25519)|[^/]+\.(?:pem|key))$/i.test(file));
  assert.deepEqual(forbiddenNames, []);

  const textFiles = files.filter((file) => /\.(?:css|html|js|json|md|mjs|ts|tsx|txt|yml|yaml)$/i.test(file));
  for (const file of textFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /[A-Z]:\\Users\\|BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|github_pat_[A-Za-z0-9_]+/i, path.relative(repositoryRoot, file));
  }

  const workflowFiles = files.filter((file) => /\.github[\\/]workflows[\\/].+\.ya?ml$/i.test(file));
  for (const file of workflowFiles) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/^\s*uses:\s*([^\s]+)$/gm)) {
      if (match[1].startsWith("./")) continue;
      assert.match(match[1], /@[0-9a-f]{40}$/i, `${path.basename(file)}: ${match[1]}`);
    }
  }
});
