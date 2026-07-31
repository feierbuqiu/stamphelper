import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinyin } from "pinyin-pro";
import worldCountries from "world-countries";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(scriptDir, "..");
const postageData = JSON.parse(
  await readFile(path.join(siteDir, "app", "postage-data.json"), "utf8"),
);

const set = (values) => new Set(values.trim().split(/\s+/).filter(Boolean));
const regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

const AIR_LETTER_ZONE_1 = set("PRK MNG VNM JPN KOR KAZ KGZ TJK UZB TKM");
const AIR_OTHER_GROUP_1 = set(
  "ARE OMN PAK BHR PHL GEO KHM QAT KWT LAO MDV MYS BGD MMR NPL LKA THA BRN SGP IND IDN",
);
const AIR_OTHER_GROUP_2 = set(
  "AZE PRK KAZ KOR KGZ MNG JPN TJK TUR TKM UZB IRQ JOR VNM ALB IRL EST AUT BLR BGR BEL ISL POL DNK DEU FRA FIN NLD CZE HRV LVA LTU LUX ROU MLT MDA NOR PRT SWE SRB SVK SVN UKR ESP GRC HUN ITA GBR CAN USA AUS NZL",
);

const SAL_LETTER_ZONE_1 = set("KOR JPN");
const SAL_LETTER_ZONE_2 = set("CYP");
const SAL_LETTER_ZONE_3 = set(
  "ARM AZE GEO ALB DEU AND AUT BLR BEL BIH BGR HRV DNK ESP EST FRO FIN FRA GIB GBR GRC HUN IRL ISL ITA LVA LIE LTU LUX MKD MLT MDA MCO NOR NLD POL PRT SMR ROU RUS SVK SVN SWE CHE CZE UKR VAT SRB MNE USA CAN AUS",
);
const SAL_LETTER_ZONE_4 = set(
  "COM LSO STP AIA SHN BOL BRA GRL BMU SPM VIR PRY PRI",
);
const SAL_OTHER_GROUP_3 = set(
  "RUS SHN COM STP LSO AIA PRY BRA BMU PRI BOL GRL VIR SPM AND BIH FRO VAT MNE LIE MKD MCO CHE SMR GIB CYP ARM",
);
const SAL_OTHER_GROUP_2 = new Set(
  [...SAL_LETTER_ZONE_3, ...SAL_LETTER_ZONE_1, "CYP"]
    .filter((code) => code !== "GEO" && !SAL_OTHER_GROUP_3.has(code)),
);
SAL_OTHER_GROUP_2.add("AZE");

const SURFACE_DISCOUNT = set(
  "AFG AUS BTN BGD BRN KHM FJI IND IDN IRN JPN KOR LAO MYS MDV MMR NRU NPL NZL PAK PNG PHL SGP SLB LKA THA VNM",
);

// Third-party route-availability snapshot supplied for this project. These
// sets deliberately describe whether a transport mode was reported open in
// November 2025; they are separate from the long-lived tariff-zone tables.
const SAL_OPEN_ISO2 = set(
  "AD AI AL AM AT AU AZ BA BE BG BM BO BR BY CA CH CY CZ DE DK EE ES FI FO FR GB GE GI GL GR HR HU IE IS IT JP KM KR LI LS LT LU LV MC MD ME MK MT NL NO PL PM PR PT PY RO RS RU SE SI SK SM ST UA US VA VI",
);
const SURFACE_OPEN_ISO2 = set(
  "AE AT AU BD BE BG BR BY CA CH CO CY CZ DE DK EE EG ES FI FJ FR GB GR HR HU ID IE IN IT JM JP KG KP KR KZ LA LT LU LV MN MU MX MY NL NO NZ PH PL PT RE RO RS RU SE SI SK TH TJ TM TN TR UA US UZ VN ZA",
);

const EMS_ZONES = [
  null,
  null,
  set("PRK KOR JPN"),
  set("PHL KHM MYS MNG THA SGP IDN VNM"),
  set("AUS PNG NZL"),
  set("USA"),
  set("IRL AUT BEL DNK DEU FRA FIN NLD CAN LUX MLT ZAF NOR PRT SWE LTU CHE ESP GRC ITA GBR"),
  set("PAK LAO BGD NPL LKA TUR IND"),
  set("ARG ARE PAN BRA BLR POL RUS COL CUB GUY CZE PER MEX UKR CHL HUN ISR JOR LBN URY CRI MDA SVN"),
  set("OMN EGY ETH AZE EST BHR BGR BWA BFA COG COD KAZ DJI GIN GHA GAB QAT CYM CIV KWT HRV KEN LVA RWA ROU MDG MLI MAR MOZ NER NGA SEN CYP KGZ TZA"),
];

const CUSTOM_ALIASES = {
  AIA: ["安圭拉", "安圭拉岛", "Anguilla"],
  ARE: ["阿联酋", "alianqiu", "UAE", "Emirates"],
  AUS: ["澳洲"],
  BIH: ["波黑", "bohei", "bh", "波斯尼亚和黑塞哥维纳", "Bosnia", "Herzegovina"],
  BOL: ["玻利维亚共和国"],
  BRN: ["文莱达鲁萨兰国"],
  CIV: ["象牙海岸"],
  COD: ["刚果（金）", "刚果民主共和国"],
  COG: ["刚果（布）", "刚果共和国"],
  CPV: ["佛得角"],
  CZE: ["捷克共和国"],
  DEU: ["Deutschland", "Deutsch"],
  ESP: ["espanol"],
  FLK: ["福克兰群岛", "马尔维纳斯群岛", "马岛", "madao", "Falklands", "Malvinas", "Islas Malvinas"],
  GBR: ["英国", "大不列颠", "UK"],
  IRN: ["伊朗"],
  JPN: ["Nihon", "Nippon"],
  KOR: ["韩国", "大韩民国"],
  LAO: ["老挝"],
  MKD: ["马其顿"],
  MMR: ["缅甸"],
  PRK: ["朝鲜", "朝鲜民主主义人民共和国"],
  PCN: ["皮特凯恩群岛", "Pitcairn Islands"],
  PSE: ["巴勒斯坦领土"],
  RUS: ["俄罗斯", "俄联邦"],
  SHN: ["圣赫勒拿岛", "阿松森岛", "阿森松岛", "特里斯坦达库尼亚"],
  SWZ: ["斯威士兰"],
  TLS: ["东帝汶"],
  TZA: ["坦桑尼亚"],
  USA: ["美国", "美利坚合众国", "America", "United States of America", "States"],
  VEN: ["委内瑞拉"],
  VAT: ["梵蒂冈"],
  VIR: ["美属维尔京群岛"],
  VGB: ["英属维尔京群岛"],
  WSM: ["西萨摩亚"],
  BES: ["荷兰加勒比区", "荷属加勒比区", "加勒比荷兰", "helanjialebiqu", "Caribbean Netherlands", "Bonaire", "Sint Eustatius", "Saba", "BES"],
  SGS: ["南乔治亚和南桑威奇群岛"],
  SJM: ["斯瓦尔巴群岛和扬马延岛", "斯匹次卑尔根群岛"],
};

const CUSTOM_ZH_NAMES = {
  AIA: { common: "安圭拉岛（英）", official: "安圭拉岛（英）" },
  ALA: { common: "奥兰群岛", official: "奥兰群岛" },
  ARE: { common: "阿拉伯联合酋长国（阿联酋）", official: "阿拉伯联合酋长国" },
  BES: { common: "博奈尔岛、圣尤斯特歇斯岛和萨巴岛（荷兰加勒比地区）", official: "博奈尔岛、圣尤斯特歇斯岛和萨巴岛（荷兰加勒比地区）" },
  BIH: { common: "波斯尼亚和黑塞哥维那（波黑）", official: "波斯尼亚和黑塞哥维那" },
  CCK: { common: "科科斯（基林）群岛", official: "科科斯（基林）群岛" },
  CIV: { common: "科特迪瓦", official: "科特迪瓦共和国" },
  COD: { common: "刚果（金）", official: "刚果民主共和国" },
  COG: { common: "刚果（布）", official: "刚果共和国" },
  CPV: { common: "佛得角", official: "佛得角共和国" },
  DMA: { common: "多米尼克", official: "多米尼克国" },
  DOM: { common: "多米尼加", official: "多米尼加共和国" },
  FLK: { common: "福克兰群岛（马尔维纳斯群岛）", official: "福克兰群岛" },
  GBR: { common: "英国", official: "大不列颠及北爱尔兰联合王国" },
  KOR: { common: "韩国", official: "大韩民国" },
  MAF: { common: "法属圣马丁", official: "法属圣马丁" },
  MKD: { common: "北马其顿", official: "北马其顿共和国" },
  MNG: { common: "蒙古", official: "蒙古" },
  PCN: { common: "皮特凯恩岛", official: "皮特凯恩群岛" },
  PSE: { common: "巴勒斯坦", official: "巴勒斯坦" },
  PRK: { common: "朝鲜", official: "朝鲜民主主义人民共和国" },
  RUS: { common: "俄罗斯", official: "俄罗斯联邦" },
  SGS: { common: "南乔治亚岛和南桑威奇群岛", official: "南乔治亚岛和南桑威奇群岛" },
  SJM: { common: "斯瓦尔巴和扬马延", official: "斯瓦尔巴和扬马延" },
  SPM: { common: "圣皮埃尔和密克隆群岛", official: "圣皮埃尔和密克隆群岛" },
  SWZ: { common: "斯威士兰", official: "斯威士兰王国" },
  SXM: { common: "荷属圣马丁", official: "荷属圣马丁" },
  TLS: { common: "东帝汶", official: "东帝汶民主共和国" },
  USA: { common: "美国", official: "美利坚合众国" },
  VAT: { common: "梵蒂冈", official: "梵蒂冈城国" },
};

const POPULARITY = {
  USA: 1000,
  JPN: 990,
  AUS: 980,
  GBR: 970,
  CAN: 960,
  KOR: 950,
  SGP: 940,
  NZL: 930,
  DEU: 920,
  FRA: 910,
  ITA: 900,
  GEO: 890,
};

function getEmsZone(code) {
  for (let zone = 2; zone <= 9; zone += 1) {
    if (EMS_ZONES[zone]?.has(code)) return zone;
  }
  return null;
}

function getCallingCodes(country) {
  const root = country.idd?.root?.replace(/\D/g, "") ?? "";
  const suffixes = country.idd?.suffixes ?? [];
  const values = new Set();
  // world-countries splits e.g. +61 into root "+6" and suffix "1".
  // A bare +6 is not a country calling code, while +1 and +7 are genuine
  // shared codes, so only retain a root by itself in those shared-code cases.
  if (root && (!suffixes.length || root === "1" || root === "7")) values.add(root);
  if (root && suffixes.length && suffixes.length <= 12) {
    suffixes.forEach((suffix) => values.add(`${root}${String(suffix).replace(/\D/g, "")}`));
  }
  return [...values].sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function flagForIso2(iso2, fallback = "📮") {
  if (!/^[A-Z]{2}$/.test(iso2)) return fallback;
  return String.fromCodePoint(...[...iso2].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

function transliterate(chinese) {
  const syllables = pinyin(chinese, { toneType: "none", type: "array" });
  const initials = pinyin(chinese, { pattern: "first", toneType: "none", type: "array" });
  return {
    pinyin: syllables.join(""),
    pinyinSpaced: syllables.join(" "),
    initials: initials.join(""),
  };
}

function availabilityForIso2(iso2) {
  return {
    air: iso2 === "KP" ? "unstable" : "open",
    sal: SAL_OPEN_ISO2.has(iso2) ? "open" : "closed",
    surface: SURFACE_OPEN_ISO2.has(iso2) ? "open" : "closed",
  };
}

function tariffsFor(country) {
  const code = country.cca3;
  const airLetterZone = AIR_LETTER_ZONE_1.has(code)
    ? 1
    : country.region === "Asia"
      ? 2
      : country.region === "Europe" || ["USA", "CAN", "AUS", "NZL"].includes(code)
        ? 3
        : 4;
  const salLetterZone = SAL_LETTER_ZONE_1.has(code)
    ? 1
    : SAL_LETTER_ZONE_2.has(code)
      ? 2
      : SAL_LETTER_ZONE_3.has(code)
        ? 3
        : SAL_LETTER_ZONE_4.has(code)
          ? 4
          : null;
  const salOtherGroup = code === "GEO"
    ? 1
    : SAL_OTHER_GROUP_2.has(code)
      ? 2
      : SAL_OTHER_GROUP_3.has(code)
        ? 3
        : null;
  return {
    airLetterZone,
    airOtherGroup: AIR_OTHER_GROUP_1.has(code) ? 1 : AIR_OTHER_GROUP_2.has(code) ? 2 : 3,
    salLetterZone,
    salOtherGroup,
    surfaceLetterDiscount: SURFACE_DISCOUNT.has(code),
    emsZone: getEmsZone(code),
  };
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()（）\u005b\u005d【】,，.。·'’"“”\-—_\s]/g, "");
}

function baseChineseName(value) {
  return normalizeName(value)
    .replace(/中华人民共和国|社会主义共和国|民主共和国|联合共和国|联邦共和国|伊斯兰共和国|共和国|特别行政区|自治领|领地|地区/g, "")
    .replace(/王国$|公国$|群岛$|诸岛$|国$/g, "");
}

const countries = worldCountries
  .filter((country) => !["CHN", "HKG", "MAC", "TWN"].includes(country.cca3) && country.cca2 !== "XK")
  .map((country) => {
    const zh = CUSTOM_ZH_NAMES[country.cca3]?.common ?? regionNames.of(country.cca2) ?? country.name.common;
    const zhOfficial = CUSTOM_ZH_NAMES[country.cca3]?.official ?? zh;
    const preferredAliases = CUSTOM_ALIASES[country.cca3] ?? [];
    const aliases = [
      ...(country.altSpellings ?? []).filter((value) => !/[\u3400-\u9fff]/u.test(value)),
      ...preferredAliases,
    ].filter((value, index, values) => value && ![zh, zhOfficial, country.name.common, country.name.official].includes(value) && values.indexOf(value) === index);
    return {
      code: country.cca3,
      iso2: country.cca2,
      iso3: country.cca3,
      zh,
      zhOfficial,
      en: country.name.common,
      enOfficial: country.name.official,
      flag: country.flag || flagForIso2(country.cca2),
      callingCodes: getCallingCodes(country),
      aliases,
      preferredAliases,
      ...transliterate(zh),
      region: country.region,
      priority: POPULARITY[country.cca3] ?? (country.unMember ? 100 : 10),
      tariffs: tariffsFor(country),
      availability: availabilityForIso2(country.cca2),
    };
  });

const countryByIso3 = new Map(countries.map((country) => [country.iso3, country]));

function addPostalTerritory({ code, parent, zh, en, aliases = [], tariffs, callingCodes }) {
  const parentCountry = countryByIso3.get(parent);
  if (!parentCountry) throw new Error(`Unknown postal-territory parent: ${parent}`);
  countries.push({
    code,
    iso2: "",
    iso3: "",
    zh,
    zhOfficial: zh,
    en,
    enOfficial: en,
    flag: parentCountry.flag,
    callingCodes: callingCodes ?? parentCountry.callingCodes,
    aliases,
    preferredAliases: aliases,
    ...transliterate(zh),
    region: parentCountry.region,
    priority: 25,
    postalParent: parentCountry.code,
    tariffs: tariffs ?? { ...parentCountry.tariffs },
    availability: { ...parentCountry.availability },
  });
}

// Postal territories and legacy rows that do not have their own ISO 3166-1
// alpha-2 entry. They stay searchable as distinct destinations while inheriting
// the parent jurisdiction's availability unless the historic tariff row differs.
addPostalTerritory({ code: "X-IFNI", parent: "MAR", zh: "伊夫尼（摩洛哥）", en: "Ifni (Morocco)", aliases: ["伊夫尼", "Sidi Ifni"] });
addPostalTerritory({ code: "X-MID", parent: "UMI", zh: "中途岛", en: "Midway Atoll", aliases: ["中途岛环礁", "Midway Islands"], callingCodes: ["1"] });
addPostalTerritory({ code: "X-WAK", parent: "UMI", zh: "威克岛", en: "Wake Island", aliases: ["威克环礁"], callingCodes: ["1"] });
addPostalTerritory({ code: "X-JOH", parent: "UMI", zh: "约翰斯顿岛", en: "Johnston Atoll", aliases: ["约翰斯顿环礁"], callingCodes: ["1"] });
addPostalTerritory({ code: "X-ASC", parent: "SHN", zh: "阿森松岛", en: "Ascension Island", aliases: ["阿松森岛"] });
addPostalTerritory({ code: "X-TRI", parent: "SHN", zh: "特里斯坦-达库尼亚", en: "Tristan da Cunha", aliases: ["特里斯坦达库尼亚"] });
addPostalTerritory({
  code: "X-AZO",
  parent: "PRT",
  zh: "亚速尔群岛和马德拉群岛",
  en: "Azores and Madeira Islands",
  aliases: ["亚速尔和马德拉群岛", "亚速尔群岛", "马德拉群岛", "Azores", "Madeira"],
  tariffs: { airLetterZone: 3, airOtherGroup: 2, salLetterZone: 4, salOtherGroup: 3, surfaceLetterDiscount: false, emsZone: null },
});
addPostalTerritory({ code: "X-CAN", parent: "ESP", zh: "加那利群岛", en: "Canary Islands", aliases: ["Canaries"] });
addPostalTerritory({ code: "X-CAB", parent: "AGO", zh: "卡宾达（安哥拉）", en: "Cabinda (Angola)", aliases: ["卡宾达", "卡奔达"] });

const aliasIndex = new Map();
for (const country of countries) {
  const names = [country.zh, country.zhOfficial, ...country.aliases]
    .filter((value) => /[\u3400-\u9fff]/u.test(value));
  for (const name of names) {
    for (const key of [normalizeName(name), baseChineseName(name)]) {
      if (!key) continue;
      const existing = aliasIndex.get(key) ?? [];
      if (!existing.includes(country.code)) existing.push(country.code);
      aliasIndex.set(key, existing);
    }
  }
}

const ROUTE_OVERRIDES = new Map(
  Object.entries({
    "伯里兹": "BLZ",
    "波黑": "BIH",
    "卡奔达": "X-CAB",
    "卡宾达": "X-CAB",
    "多米尼克": "DMA",
    "多米尼加共和国": "DOM",
    "东萨摩亚": "ASM",
    "凡蒂冈": "VAT",
    "格陵兰岛": "GRL",
    "马尔维纳斯福克兰群岛": "FLK",
    "马提尼克岛": "MTQ",
    "蒙特塞拉特岛": "MSR",
    "南乔治亚岛和南桑德维奇岛": "SGS",
    "皮特克恩岛": "PCN",
    "塞舌耳": "SYC",
    "圣基茨和尼维斯岛": "KNA",
    "新喀里多尼亚岛": "NCL",
    "伊夫尼": "X-IFNI",
    "约翰斯敦岛": "X-JOH",
    "留尼汪岛": "REU",
    "西萨摩亚": "WSM",
    "南朝鲜": "KOR",
    "北朝鲜": "PRK",
    "刚果布": "COG",
    "刚果金": "COD",
    "阿松森岛": "X-ASC",
    "亚速尔群岛和马德拉群岛": "X-AZO",
    "亚速尔和马德拉群岛": "X-AZO",
    "加那利群岛": "X-CAN",
    "瓦里斯和富图纳群岛": "WLF",
    "科科斯群岛洛德豪岛": "CCK",
    "英属维尔京群岛": "VGB",
    "美属维尔京群岛": "VIR",
  }).map(([name, code]) => [normalizeName(name), code]),
);

function matchCountryCode(destination) {
  const normalized = normalizeName(destination);
  if (ROUTE_OVERRIDES.has(normalized)) return ROUTE_OVERRIDES.get(normalized);
  const exact = aliasIndex.get(normalized) ?? [];
  if (exact.length === 1) return exact[0];
  const base = aliasIndex.get(baseChineseName(destination)) ?? [];
  if (base.length === 1) return base[0];
  return null;
}

const countryByCode = new Map(countries.map((country) => [country.code, country]));
const parcelDestinations = {};
const REMOVED_PARCEL_DESTINATIONS = new Set(["锡金"]);

function expandParcelRoute(route) {
  if (normalizeName(route.destination) !== "中途岛威克岛") return [route];
  // The historic tariff row combines two acceptance-system destinations.
  // Keep two visible choices while reusing the same underlying price row.
  return [
    { ...route, destination: "中途岛", forcedCountryCode: "X-MID", optionSuffix: "midway" },
    { ...route, destination: "威克岛", forcedCountryCode: "X-WAK", optionSuffix: "wake" },
  ];
}

for (const mode of ["air", "surface", "sal"]) {
  parcelDestinations[mode] = postageData.internationalParcels[mode]
    .filter((route) => !REMOVED_PARCEL_DESTINATIONS.has(route.destination))
    .flatMap(expandParcelRoute)
    .map((route) => {
      const countryCode = route.forcedCountryCode ?? matchCountryCode(route.destination);
      const country = countryCode ? countryByCode.get(countryCode) : null;
      const transliteration = transliterate(route.destination);
      return {
        id: `${mode}:${route.id}${route.optionSuffix ? `:${route.optionSuffix}` : ""}`,
        routeId: route.id,
        destination: route.destination,
        countryCode: country?.code ?? null,
        flag: country?.flag ?? "📮",
        en: country?.en ?? "",
        iso2: country?.iso2 ?? "",
        iso3: country?.iso3 ?? "",
        callingCodes: country?.callingCodes ?? [],
        aliases: country ? [country.zh, country.zhOfficial, country.enOfficial, ...country.aliases] : [],
        preferredAliases: country?.preferredAliases ?? [],
        pinyin: transliteration.pinyin,
        pinyinSpaced: transliteration.pinyinSpaced,
        initials: transliteration.initials,
        limitKg: route.limitKg,
        anomaly: route.anomaly,
        priority: country?.priority ?? 0,
      };
    });
}

countries.sort((left, right) => right.priority - left.priority || left.zh.localeCompare(right.zh, "zh-CN"));

const output = {
  version: "2026-07-31.3",
  routeAvailability: {
    asOf: "2025-11",
    sourceType: "third-party-reference",
    note: "邮路开通状态来自第三方参考快照，可能随时调整；收寄当日请以中国邮政营业系统或柜台查询为准。朝鲜航空邮路标为不稳定。",
  },
  countries,
  parcelDestinations,
};

await writeFile(
  path.join(siteDir, "app", "destination-data.json"),
  `${JSON.stringify(output)}\n`,
  "utf8",
);

const matchedRoutes = Object.values(parcelDestinations)
  .flat()
  .filter((route) => route.countryCode).length;
console.log(
  `Generated ${countries.length} searchable destinations and ${Object.values(parcelDestinations).flat().length} parcel routes (${matchedRoutes} linked to destinations).`,
);
