import assert from "node:assert/strict";
import test from "node:test";
import {
  DESTINATION_DATA,
  buildDestinationOptions,
  resolveInternationalSelection,
  searchDestinationOptions,
  type DestinationOption,
} from "../lib/destination-search";
import type { PostageInput } from "../lib/postage-calculator";

const base: PostageInput = {
  region: "international",
  product: "letter",
  weightG: 20,
  local: false,
  transport: "air",
  group: 2,
  zone: 3,
  origin: "北京",
  destination: "",
  parcelRouteId: 1,
  contents: "document",
  quoteFen: 0,
  registered: false,
  appointment: false,
  receipt: false,
  insured: false,
  insuredValueYuan: 500,
  taiwan: false,
  surfaceDiscountRoute: false,
};

function countryCode(option: DestinationOption | undefined): string | undefined {
  return option?.selection.kind === "country" ? option.selection.code : undefined;
}

function firstCountry(input: PostageInput, query: string): string | undefined {
  return countryCode(searchDestinationOptions(buildDestinationOptions(input), query)[0]);
}

test("finds Australia, the United States, and Japan through every requested input style", () => {
  for (const query of ["61", "AU", "AUS", "Australia", "澳大利亚", "aodaliya", "adly"]) {
    assert.equal(firstCountry(base, query), "AUS", query);
  }
  for (const query of ["1", "US", "USA", "United States", "United States of America", "States", "美国", "美利坚合众国", "meiguo", "mg"]) {
    assert.equal(firstCountry(base, query), "USA", query);
  }
  for (const query of ["81", "JP", "JPN", "Japan", "Nihon", "Nippon", "日本", "riben", "rb"]) {
    assert.equal(firstCountry(base, query), "JPN", query);
  }
  const australia = DESTINATION_DATA.countries.find((country) => country.code === "AUS");
  const japan = DESTINATION_DATA.countries.find((country) => country.code === "JPN");
  assert.deepEqual(australia?.callingCodes, ["61"]);
  assert.deepEqual(japan?.callingCodes, ["81"]);
});

test("keeps direct price-zone selection searchable", () => {
  for (const query of ["三区", "3区", "第 3 区", "zone 3"]) {
    const results = searchDestinationOptions(buildDestinationOptions(base), query);
    const zone = results.find((option) => option.selection.kind === "zone" && option.selection.value === 3);
    assert.ok(zone, query);
    assert.match(zone.badge, /3 区/, query);
  }

  const resolved = resolveInternationalSelection(base, { kind: "zone", value: 3 });
  assert.equal(resolved.input.zone, 3);
  assert.match(resolved.badge, /3 区/);
});

test("derives the effective tariff mapping from the selected destination", () => {
  const australia = resolveInternationalSelection(base, { kind: "country", code: "AUS" });
  assert.equal(australia.input.zone, 3);
  assert.match(australia.badge, /航空信函 3 区/);

  const japan = resolveInternationalSelection(base, { kind: "country", code: "JPN" });
  assert.equal(japan.input.zone, 1);

  const georgiaSal = resolveInternationalSelection(
    { ...base, product: "printed", transport: "sal" },
    { kind: "country", code: "GEO" },
  );
  assert.equal(georgiaSal.input.group, 1);
  assert.match(georgiaSal.badge, /第 1 组/);

  const usaEms = resolveInternationalSelection(
    { ...base, product: "ems" },
    { kind: "country", code: "USA" },
  );
  assert.equal(usaEms.input.zone, 5);

  const australiaSurface = resolveInternationalSelection(
    { ...base, transport: "surface" },
    { kind: "country", code: "AUS" },
  );
  assert.equal(australiaSurface.input.surfaceDiscountRoute, true);
});

test("explains unavailable SAL destinations instead of silently using a wrong zone", () => {
  const input = { ...base, transport: "sal" as const };
  const options = buildDestinationOptions(input);
  const afghanistan = searchDestinationOptions(options, "AFG")[0];
  assert.equal(countryCode(afghanistan), "AFG");
  assert.equal(afghanistan.disabled, true);
  assert.match(afghanistan.disabledReason ?? "", /SAL/);

  const resolved = resolveInternationalSelection(input, { kind: "country", code: "AFG" });
  assert.match(resolved.error ?? "", /SAL/);
});

test("does not expose direct SAL zones for the air-only aerogram product", () => {
  const options = buildDestinationOptions({ ...base, product: "aerogram", transport: "sal" });
  assert.equal(options.some((option) => option.kind === "zone"), false);
  assert.equal(options.every((option) => option.disabled), true);
});

test("maps a country selection to the matching international parcel route", () => {
  for (const transport of ["air", "sal", "surface"] as const) {
    const resolved = resolveInternationalSelection(
      { ...base, product: "parcel", transport },
      { kind: "country", code: "AUS" },
    );
    assert.equal(resolved.error, undefined, transport);
    assert.ok(resolved.input.parcelRouteId > 0, transport);
    assert.match(resolved.label, /澳大利亚/);
  }
});

test("keeps distinct parcel rows separate even when they belong to one country", () => {
  const input = { ...base, product: "parcel", transport: "air" as const };
  const option = searchDestinationOptions(buildDestinationOptions(input), "加那利群岛")[0];
  assert.equal(option.selection.kind, "parcel");
  const resolved = resolveInternationalSelection(input, option.selection);
  assert.equal(resolved.label, "加那利群岛");

  const dominican = searchDestinationOptions(buildDestinationOptions(input), "多米尼加共和国")[0];
  assert.match(dominican.secondary, /DOM/);
});

test("international countries exclude domestic regions and the six invalid destinations", () => {
  const codes = new Set(DESTINATION_DATA.countries.map((country) => country.code));
  for (const code of ["CHN", "HKG", "MAC", "TWN", "UNK", "X-AKR", "X-CLI", "X-MEL", "X-SIK", "X-CEU"]) {
    assert.equal(codes.has(code), false, code);
  }
  assert.equal(DESTINATION_DATA.countries.length, 254);

  const forbiddenNames = ["科索沃", "阿克罗蒂里和泽凯利亚", "克利珀顿岛", "克里波顿岛", "梅利利亚", "锡金", "休达"];
  const searchableText = DESTINATION_DATA.countries
    .flatMap((country) => [country.zh, country.zhOfficial, ...country.aliases])
    .join("\n");
  for (const name of forbiddenNames) assert.doesNotMatch(searchableText, new RegExp(name), name);
  assert.equal(
    Object.values(DESTINATION_DATA.parcelDestinations).flat().some((route) => route.destination === "锡金"),
    false,
  );
});

test("uses mainland Simplified Chinese destination names and keeps old names searchable", () => {
  assert.equal(DESTINATION_DATA.countries.find((country) => country.code === "MKD")?.zh, "北马其顿");
  assert.equal(
    DESTINATION_DATA.countries.find((country) => country.code === "BES")?.zh,
    "博奈尔岛、圣尤斯特歇斯岛和萨巴岛（荷兰加勒比地区）",
  );
  assert.equal(firstCountry(base, "北马其顿"), "MKD");
  assert.equal(firstCountry(base, "beimaqidun"), "MKD");
  assert.equal(firstCountry(base, "荷属加勒比区"), "BES");
  assert.equal(firstCountry(base, "helanjialebiqu"), "BES");
  assert.equal(
    DESTINATION_DATA.countries.some((country) => /[國區臺灣門島與馬東爾蘭後裡為]/u.test(country.zh)),
    false,
  );
});

test("uses the requested destination labels and common search aliases", () => {
  const expectedLabels = new Map([
    ["ARE", "阿拉伯联合酋长国（阿联酋）"],
    ["AIA", "安圭拉岛（英）"],
    ["ALA", "奥兰群岛"],
    ["PSE", "巴勒斯坦"],
    ["BIH", "波斯尼亚和黑塞哥维那（波黑）"],
    ["BES", "博奈尔岛、圣尤斯特歇斯岛和萨巴岛（荷兰加勒比地区）"],
    ["FLK", "福克兰群岛（马尔维纳斯群岛）"],
    ["CCK", "科科斯（基林）群岛"],
    ["MNG", "蒙古"],
    ["PCN", "皮特凯恩岛"],
    ["MAF", "法属圣马丁"],
    ["SXM", "荷属圣马丁"],
    ["SPM", "圣皮埃尔和密克隆群岛"],
    ["VEN", "委内瑞拉"],
  ]);
  for (const [code, label] of expectedLabels) {
    assert.equal(DESTINATION_DATA.countries.find((country) => country.code === code)?.zh, label, code);
  }

  const aliases = new Map([
    ["ARE", ["阿联酋", "alianqiu", "UAE"]],
    ["BIH", ["波黑", "bohei", "bh", "波斯尼亚和黑塞哥维纳"]],
    ["FLK", ["马尔维纳斯群岛", "马岛", "Malvinas"]],
    ["ESP", ["espanol"]],
    ["DEU", ["Deutschland", "Deutsch"]],
  ]);
  for (const [code, queries] of aliases) {
    for (const query of queries) assert.equal(firstCountry(base, query), code, `${code}: ${query}`);
  }
});

test("includes ISO and non-ISO postal territories requested by users", () => {
  const expected = new Map([
    ["伊夫尼", "X-IFNI"],
    ["中途岛", "X-MID"],
    ["斯瓦尔巴和扬马延", "SJM"],
    ["南乔治亚岛和南桑威奇群岛", "SGS"],
  ]);
  for (const [query, code] of expected) assert.equal(firstCountry(base, query), code, query);
});

test("keeps repeated-code postal destinations separate and prefers the exact place", () => {
  assert.equal(firstCountry(base, "美国本土外小岛屿"), "UMI");
  assert.equal(firstCountry(base, "中途岛"), "X-MID");
  assert.equal(firstCountry(base, "威克岛"), "X-WAK");
  assert.equal(firstCountry(base, "约翰斯顿岛"), "X-JOH");

  const input = { ...base, product: "parcel", transport: "air" as const };
  const midway = searchDestinationOptions(buildDestinationOptions(input), "中途岛")[0];
  const wake = searchDestinationOptions(buildDestinationOptions(input), "威克岛")[0];
  assert.equal(midway.selection.kind, "parcel");
  assert.equal(wake.selection.kind, "parcel");
  assert.equal(resolveInternationalSelection(input, midway.selection).label, "中途岛");
  assert.equal(resolveInternationalSelection(input, wake.selection).label, "威克岛");
  if (midway.selection.kind === "parcel" && wake.selection.kind === "parcel") {
    assert.equal(midway.selection.routeId, wake.selection.routeId);
    assert.notEqual(midway.selection.label, wake.selection.label);
  }
});

test("applies the November 2025 third-party transport availability snapshot", () => {
  assert.equal(DESTINATION_DATA.routeAvailability.asOf, "2025-11");

  const northMacedoniaSal = searchDestinationOptions(
    buildDestinationOptions({ ...base, transport: "sal" }),
    "北马其顿",
  )[0];
  assert.equal(countryCode(northMacedoniaSal), "MKD");
  assert.equal(northMacedoniaSal.disabled, false);

  const afghanistanSurface = searchDestinationOptions(
    buildDestinationOptions({ ...base, transport: "surface" }),
    "AFG",
  )[0];
  assert.equal(countryCode(afghanistanSurface), "AFG");
  assert.equal(afghanistanSurface.disabled, true);
  assert.match(afghanistanSurface.disabledReason ?? "", /2025 年 11 月/);

  const northKoreaAir = resolveInternationalSelection(base, { kind: "country", code: "PRK" });
  assert.equal(northKoreaAir.error, undefined);
  assert.match(northKoreaAir.warning ?? "", /不稳定/);

  const northKoreaSurface = resolveInternationalSelection(
    { ...base, transport: "surface" },
    { kind: "country", code: "PRK" },
  );
  assert.equal(northKoreaSurface.error, undefined);
});
