import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const requestedTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const expectedTag = `v${packageJson.version}`;

if (!requestedTag) {
  throw new Error(`A release tag is required; expected ${expectedTag}`);
}
if (requestedTag !== expectedTag) {
  throw new Error(`Release tag ${requestedTag} does not match package version ${packageJson.version}`);
}

console.log(`Release version verified: ${requestedTag}`);
