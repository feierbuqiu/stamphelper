import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const sourceDir = path.join(siteDir, "data");
const markdownPath = path.join(sourceDir, "postage-rates.zh-CN.md");
const stampsPath = path.join(sourceDir, "stamp-denominations.tsv");

const [markdown, stampText] = await Promise.all([
  readFile(markdownPath, "utf8"),
  readFile(stampsPath, "utf8"),
]);

function extractMarker(marker) {
  const start = `<!-- GENERATED:${marker}:START -->`;
  const end = `<!-- GENERATED:${marker}:END -->`;
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`Missing generated marker ${marker}`);
  }
  return markdown.slice(startIndex + start.length, endIndex);
}

function parseMoney(text) {
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) throw new Error(`Invalid money value: ${text}`);
  return Math.round(value * 100);
}

const denominationSet = new Set();
for (const line of stampText.split(/\r?\n/)) {
  const field = line.split("\t").at(-1)?.trim() ?? "";
  const fenMatch = field.match(/^(\d+(?:\.\d+)?)分$/);
  const yuanMatch = field.match(/^(\d+(?:\.\d+)?)元$/);
  if (fenMatch) denominationSet.add(Math.round(Number(fenMatch[1])));
  if (yuanMatch) denominationSet.add(parseMoney(yuanMatch[1]));
}
const ordinaryStampDenominations = [...denominationSet]
  .sort((a, b) => b - a)
  .map((fen) => ({
    fen,
    label: fen < 100 ? `${fen}分` : `${Number((fen / 100).toFixed(2))}元`,
    category: "ordinary",
    defaultStock: fen === 5 ? 0 : null,
  }));

if (ordinaryStampDenominations.length !== 17) {
  throw new Error(`Expected 17 unique ordinary stamp denominations, found ${ordinaryStampDenominations.length}`);
}

const stampDenominations = [
  ...ordinaryStampDenominations,
  {
    fen: 280,
    label: "2.8元",
    category: "commemorative",
    defaultStock: null,
  },
  {
    fen: 800,
    label: "8元",
    category: "commemorative",
    defaultStock: 0,
  },
].sort((left, right) => right.fen - left.fen);

const zoneBlock = extractMarker("DOMESTIC_ZONE_MATRIX");
const domesticParcelMatrix = {};
const provinceOrder = [];
let destinations = [];
for (const rawLine of zoneBlock.split(/\r?\n/)) {
  if (!rawLine.startsWith("|") || !rawLine.endsWith("|")) continue;
  const cells = rawLine.slice(1, -1).split("|").map((cell) => cell.trim());
  if (cells[0] === "寄出\\寄达") {
    destinations = cells.slice(1);
    continue;
  }
  if (cells[0] === "---" || !destinations.length) continue;
  if (!cells.slice(1).every((cell) => /^[1-6]$/.test(cell))) continue;
  const origin = cells[0];
  if (!provinceOrder.includes(origin)) provinceOrder.push(origin);
  domesticParcelMatrix[origin] ??= {};
  destinations.forEach((destination, index) => {
    domesticParcelMatrix[origin][destination] = Number(cells[index + 1]);
  });
}

if (provinceOrder.length !== 31) {
  throw new Error(`Expected 31 parcel origins, found ${provinceOrder.length}`);
}
for (const origin of provinceOrder) {
  if (Object.keys(domesticParcelMatrix[origin]).length !== 31) {
    throw new Error(`Incomplete parcel matrix row: ${origin}`);
  }
}

function parseInternationalParcels(marker, expectedRows) {
  const rows = [];
  for (const line of extractMarker(marker).split(/\r?\n/)) {
    const match = line.match(
      /^\|(\d+)\|([^|]*)\|([\d.]+)\|([\d.]+)\|([^|]+)\|([^|]+)\|$/,
    );
    if (!match) continue;
    const limitMatch = match[5].match(/[\d.]+/);
    if (!limitMatch) continue;
    const id = Number(match[1]);
    const destination = match[2].trim();
    rows.push({
      id,
      destination: destination || `路向 ${id}（源表名称缺失）`,
      firstFen: parseMoney(match[3]),
      nextFen: parseMoney(match[4]),
      limitKg: Number(limitMatch[0]),
      anomaly: !destination || match[5].includes("异常"),
    });
  }
  if (rows.length !== expectedRows) {
    throw new Error(`Expected ${expectedRows} rows for ${marker}, found ${rows.length}`);
  }
  return rows;
}

const output = {
  version: "2026-07-30",
  stampDenominations,
  domesticParcel: {
    provinces: provinceOrder,
    bands: {
      1: { firstFen: 500, nextFen: 100 },
      2: { firstFen: 600, nextFen: 150 },
      3: { firstFen: 700, nextFen: 200 },
      4: { firstFen: 800, nextFen: 300 },
      5: { firstFen: 900, nextFen: 400 },
      6: { firstFen: 1000, nextFen: 500 },
    },
    matrix: domesticParcelMatrix,
  },
  internationalParcels: {
    air: parseInternationalParcels("INTL_AIR_PARCEL", 230),
    surface: parseInternationalParcels("INTL_SURFACE_PARCEL", 134),
    sal: parseInternationalParcels("INTL_SAL_PARCEL", 116),
  },
};

await writeFile(
  path.join(siteDir, "app", "postage-data.json"),
  `${JSON.stringify(output)}\n`,
  "utf8",
);

console.log(
  `Generated ${output.stampDenominations.length} denominations, ` +
    `${provinceOrder.length ** 2} domestic parcel routes, and ` +
    `${Object.values(output.internationalParcels).flat().length} international parcel rows.`,
);
