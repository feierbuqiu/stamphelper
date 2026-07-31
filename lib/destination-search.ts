import destinationData from "@/app/destination-data.json";
import type { PostageInput, Transport } from "@/lib/postage-calculator";

export interface DestinationTariffs {
  airLetterZone: number;
  airOtherGroup: number;
  salLetterZone: number | null;
  salOtherGroup: number | null;
  surfaceLetterDiscount: boolean;
  emsZone: number | null;
}

export type RouteAvailability = "open" | "closed" | "unstable";

export interface DestinationAvailability {
  air: RouteAvailability;
  sal: RouteAvailability;
  surface: RouteAvailability;
}

export interface CountryDestination {
  code: string;
  iso2: string;
  iso3: string;
  zh: string;
  zhOfficial: string;
  en: string;
  enOfficial: string;
  flag: string;
  callingCodes: string[];
  aliases: string[];
  preferredAliases: string[];
  pinyin: string;
  pinyinSpaced: string;
  initials: string;
  region: string;
  priority: number;
  postalParent?: string;
  tariffs: DestinationTariffs;
  availability: DestinationAvailability;
}

export interface ParcelDestination {
  id: string;
  routeId: number;
  destination: string;
  countryCode: string | null;
  flag: string;
  en: string;
  iso2: string;
  iso3: string;
  callingCodes: string[];
  aliases: string[];
  preferredAliases: string[];
  pinyin: string;
  pinyinSpaced: string;
  initials: string;
  limitKg: number;
  anomaly: boolean;
  priority: number;
}

type DestinationData = {
  version: string;
  routeAvailability: {
    asOf: string;
    sourceType: "third-party-reference";
    note: string;
  };
  countries: CountryDestination[];
  parcelDestinations: Record<Transport, ParcelDestination[]>;
};

export const DESTINATION_DATA = destinationData as unknown as DestinationData;
export const ROUTE_AVAILABILITY_NOTE = DESTINATION_DATA.routeAvailability.note;

export type DestinationSelection =
  | { kind: "country"; code: string }
  | { kind: "zone"; value: number; surfaceDiscount?: boolean }
  | { kind: "parcel"; routeId: number; mode: Transport; label: string };

export interface DestinationOption {
  id: string;
  kind: "country" | "zone" | "parcel";
  primary: string;
  secondary: string;
  flag?: string;
  badge: string;
  disabled: boolean;
  disabledReason?: string;
  priority: number;
  preferredTerms: string[];
  exactTerms: string[];
  terms: string[];
  dialCodes: string[];
  selection: DestinationSelection;
}

export interface DestinationResolution {
  input: PostageInput;
  label: string;
  badge: string;
  flag?: string;
  error?: string;
  warning?: string;
}

function chineseNumber(value: number): string {
  return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"][value] ?? String(value);
}

function isLetterProduct(product: string): boolean {
  return product === "letter";
}

function isOtherLetterProduct(product: string): boolean {
  return ["postcard", "aerogram", "printed", "blind", "smallPacket", "mbag"].includes(product);
}

function zoneOptions(input: PostageInput): DestinationOption[] {
  if (input.product === "parcel") return [];
  if (input.product === "aerogram" && input.transport !== "air") return [];
  if (input.product === "ems") {
    return Array.from({ length: 8 }, (_, index) => index + 2).map((zone) => makeZoneOption(zone, "EMS", "区"));
  }
  if (input.transport === "surface" && isLetterProduct(input.product)) {
    return [
      makeSurfaceOption(false, "水陆路一般路向", "首 20 g ¥4.00"),
      makeSurfaceOption(true, "27 个水陆路优惠路向", "首 20 g ¥3.50"),
    ];
  }
  if (input.transport === "surface") return [];
  if (isLetterProduct(input.product)) {
    return [1, 2, 3, 4].map((zone) => makeZoneOption(zone, input.transport === "sal" ? "SAL 信函" : "航空信函", "区"));
  }
  if (isOtherLetterProduct(input.product)) {
    return [1, 2, 3].map((group) => makeZoneOption(group, input.transport === "sal" ? "SAL 其他函件" : "航空其他函件", "组"));
  }
  return [];
}

function makeZoneOption(value: number, prefix: string, unit: "区" | "组"): DestinationOption {
  const chinese = chineseNumber(value);
  const label = unit === "区" ? `${prefix} ${value} 区` : `${prefix}第 ${value} 组`;
  return {
    id: `zone:${prefix}:${value}`,
    kind: "zone",
    primary: `直接按${unit === "区" ? `第 ${value} 区` : `第 ${value} 组`}计算`,
    secondary: "不指定具体国家／地区",
    badge: label,
    disabled: false,
    priority: 2000 - value,
    preferredTerms: [],
    exactTerms: unit === "区"
      ? [`${value}区`, `第${value}区`, `${chinese}区`, `第${chinese}区`, `zone${value}`]
      : [`${value}组`, `第${value}组`, `${chinese}组`, `第${chinese}组`, `group${value}`, `${value}区`, `${chinese}区`],
    terms: [label, prefix, `zone ${value}`, `group ${value}`],
    dialCodes: [],
    selection: { kind: "zone", value },
  };
}

function makeSurfaceOption(surfaceDiscount: boolean, label: string, secondary: string): DestinationOption {
  return {
    id: `surface:${surfaceDiscount ? "discount" : "normal"}`,
    kind: "zone",
    primary: `直接按${surfaceDiscount ? "优惠" : "一般"}路向计算`,
    secondary,
    badge: label,
    disabled: false,
    priority: surfaceDiscount ? 1999 : 2000,
    preferredTerms: [],
    exactTerms: surfaceDiscount
      ? ["优惠路向", "水陆路优惠", "27个优惠路向"]
      : ["一般路向", "普通路向", "水陆路一般"],
    terms: [label, secondary],
    dialCodes: [],
    selection: { kind: "zone", value: surfaceDiscount ? 1 : 0, surfaceDiscount },
  };
}

function countryAvailability(country: CountryDestination, input: PostageInput): { badge: string; disabledReason?: string; warning?: string } {
  const tariffs = country.tariffs;
  if (input.product === "ems") {
    return tariffs.emsZone
      ? {
          badge: country.availability.air === "unstable" ? `EMS ${tariffs.emsZone} 区 · 邮路不稳定` : `EMS ${tariffs.emsZone} 区`,
          warning: country.availability.air === "unstable" ? "朝鲜航空邮路在第三方 2025 年 11 月快照中标为不稳定，交寄前请向柜台确认。" : undefined,
        }
      : { badge: "EMS 需实时查询", disabledReason: "当前静态 EMS 价区表未列这个目的地" };
  }
  if (input.product === "aerogram" && input.transport !== "air") {
    return { badge: "仅限航空", disabledReason: "航空邮简不能选择 SAL 或水陆路" };
  }
  const routeStatus = country.availability[input.transport];
  if (routeStatus === "closed") {
    const modeLabel = input.transport === "sal" ? "SAL" : input.transport === "surface" ? "水陆路" : "航空";
    return {
      badge: `${modeLabel}未列为开通`,
      disabledReason: `第三方 2025 年 11 月邮路快照未把该目的地列入${modeLabel}开通范围`,
    };
  }
  const warning = routeStatus === "unstable"
    ? "朝鲜航空邮路在第三方 2025 年 11 月快照中标为不稳定，交寄前请向柜台确认。"
    : undefined;
  if (input.transport === "surface") {
    if (isLetterProduct(input.product)) {
      return { badge: tariffs.surfaceLetterDiscount ? "水陆路优惠路向" : "水陆路一般路向", warning };
    }
    return { badge: "水陆路统一资费", warning };
  }
  if (isLetterProduct(input.product)) {
    const zone = input.transport === "sal" ? tariffs.salLetterZone : tariffs.airLetterZone;
    return zone
      ? { badge: `${input.transport === "sal" ? "SAL" : "航空"}信函 ${zone} 区${warning ? " · 邮路不稳定" : ""}`, warning }
      : { badge: "SAL 未开放", disabledReason: "当前 SAL 信函目的地表未列这个国家／地区" };
  }
  const group = input.transport === "sal" ? tariffs.salOtherGroup : tariffs.airOtherGroup;
  return group
    ? { badge: `${input.transport === "sal" ? "SAL" : "航空"}其他函件 第 ${group} 组${warning ? " · 邮路不稳定" : ""}`, warning }
    : { badge: "SAL 未开放", disabledReason: "当前 SAL 其他函件目的地表未列这个国家／地区" };
}

function countryOption(country: CountryDestination, input: PostageInput): DestinationOption {
  const availability = countryAvailability(country, input);
  return {
    id: `country:${country.code}`,
    kind: "country",
    primary: country.zh,
    secondary: [country.en, country.iso2, country.iso3, country.callingCodes[0] ? `+${country.callingCodes[0]}` : ""]
      .filter(Boolean)
      .join(" · "),
    flag: country.flag,
    badge: availability.badge,
    disabled: Boolean(availability.disabledReason),
    disabledReason: availability.disabledReason,
    priority: country.priority,
    preferredTerms: country.preferredAliases,
    exactTerms: [country.zh, country.zhOfficial, country.en, country.enOfficial, country.iso2, country.iso3, country.pinyin, country.initials, ...country.aliases],
    terms: [country.pinyinSpaced, country.region, ...country.aliases],
    dialCodes: country.callingCodes,
    selection: { kind: "country", code: country.code },
  };
}

function parcelOption(route: ParcelDestination): DestinationOption {
  return {
    id: `parcel:${route.id}`,
    kind: "parcel",
    primary: route.destination,
    secondary: [route.en, route.iso2, route.iso3, route.callingCodes[0] ? `+${route.callingCodes[0]}` : ""]
      .filter(Boolean)
      .join(" · ") || "国际包裹逐路向表",
    flag: route.flag,
    badge: route.anomaly ? "源表异常" : `限重 ${route.limitKg} kg`,
    disabled: route.anomaly,
    disabledReason: route.anomaly ? "源表名称或限重存在异常，不能自动计算" : undefined,
    priority: route.priority,
    preferredTerms: route.preferredAliases,
    exactTerms: [route.destination, route.en, route.iso2, route.iso3, route.pinyin, route.initials, ...route.aliases],
    terms: [route.pinyinSpaced, ...route.aliases],
    dialCodes: route.callingCodes,
    // A country can have more than one historical parcel row (for example,
    // Spain and the Canary Islands). Keep the exact row the user picked.
    selection: { kind: "parcel", routeId: route.routeId, mode: route.id.split(":")[0] as Transport, label: route.destination },
  };
}

export function buildDestinationOptions(input: PostageInput): DestinationOption[] {
  if (input.region !== "international") return [];
  const zones = zoneOptions(input);
  if (input.product === "parcel") {
    return DESTINATION_DATA.parcelDestinations[input.transport].map(parcelOption);
  }
  return [...zones, ...DESTINATION_DATA.countries.map((country) => countryOption(country, input))];
}

export function normalizeDestinationQuery(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
}

function editDistance(left: string, right: string): number {
  if (left === right) return 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let northwest = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const north = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        northwest + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      northwest = north;
    }
  }
  return previous[right.length];
}

function optionScore(option: DestinationOption, rawQuery: string): number | null {
  const query = normalizeDestinationQuery(rawQuery);
  if (!query) return option.kind === "zone" ? -1000 - option.priority : -option.priority;
  const numeric = /^\d+$/.test(query);
  if (numeric) {
    const dialIndex = option.dialCodes.findIndex((code) => normalizeDestinationQuery(code) === query);
    if (dialIndex >= 0) return dialIndex * 2 - option.priority / 10000;
  }

  let best = Number.POSITIVE_INFINITY;
  const preferredTerms = option.preferredTerms.map(normalizeDestinationQuery).filter(Boolean);
  const exactTerms = option.exactTerms.map(normalizeDestinationQuery).filter(Boolean);
  const looseTerms = [...exactTerms, ...option.terms.map(normalizeDestinationQuery).filter(Boolean)];
  for (const term of preferredTerms) {
    if (term === query) best = Math.min(best, -2);
  }
  for (const term of exactTerms) {
    if (term === query) best = Math.min(best, option.kind === "zone" ? -5 : 0);
  }
  for (const term of looseTerms) {
    if (term.startsWith(query)) best = Math.min(best, 15 + Math.min(20, term.length - query.length));
    else if (term.includes(query)) best = Math.min(best, 45 + Math.min(20, term.length - query.length));
    else if (
      /^[a-z]+$/.test(query) &&
      query.length >= 4 &&
      Math.abs(term.length - query.length) <= 2
    ) {
      const distance = editDistance(term, query);
      if (distance <= (query.length >= 8 ? 2 : 1)) best = Math.min(best, 80 + distance * 5);
    }
  }
  if (!Number.isFinite(best)) return null;
  return best - option.priority / 10000;
}

export function searchDestinationOptions(
  options: DestinationOption[],
  query: string,
  limit = 14,
): DestinationOption[] {
  const normalized = normalizeDestinationQuery(query);
  if (!normalized) {
    const zones = options.filter((option) => option.kind === "zone").slice(0, 9);
    const enabled = options
      .filter((option) => option.kind !== "zone" && !option.disabled)
      .sort((left, right) => right.priority - left.priority || left.primary.localeCompare(right.primary, "zh-CN"))
      .slice(0, Math.max(0, limit - zones.length));
    return [...zones, ...enabled];
  }
  return options
    .map((option) => ({ option, score: optionScore(option, query) }))
    .filter((entry): entry is { option: DestinationOption; score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score || Number(left.option.disabled) - Number(right.option.disabled) || right.option.priority - left.option.priority)
    .slice(0, limit)
    .map((entry) => entry.option);
}

function countryByCode(code: string): CountryDestination | undefined {
  return DESTINATION_DATA.countries.find((country) => country.code === code);
}

export function resolveInternationalSelection(
  input: PostageInput,
  selection: DestinationSelection,
): DestinationResolution {
  if (input.region !== "international") return { input, label: "", badge: "" };

  if (input.product === "parcel") {
    const routes = DESTINATION_DATA.parcelDestinations[input.transport];
    const route = selection.kind === "country"
      ? routes.find((candidate) => candidate.countryCode === selection.code)
      : selection.kind === "parcel" && selection.mode === input.transport
        ? routes.find((candidate) => candidate.routeId === selection.routeId && candidate.destination === selection.label)
          ?? routes.find((candidate) => candidate.routeId === selection.routeId)
        : undefined;
    if (!route) {
      const country = selection.kind === "country" ? countryByCode(selection.code) : undefined;
      return {
        input: { ...input, parcelRouteId: -1 },
        label: country?.zh ?? (selection.kind === "parcel" ? selection.label : "所选目的地"),
        badge: "当前方式无参考路向",
        flag: country?.flag,
        error: `当前${input.transport === "air" ? "航空" : input.transport === "sal" ? "SAL" : "水陆路"}包裹参考表没有该目的地，请重新选择路向`,
      };
    }
    return {
      input: { ...input, parcelRouteId: route.routeId },
      label: route.destination,
      badge: route.anomaly ? "源表异常" : `国际包裹 · 限重 ${route.limitKg} kg`,
      flag: route.flag,
      error: route.anomaly ? "源表名称或限重存在异常，不能自动计算" : undefined,
    };
  }

  if (selection.kind === "zone") {
    const next = { ...input };
    if (input.product === "ems" || (isLetterProduct(input.product) && input.transport !== "surface")) {
      next.zone = selection.value;
    } else if (isOtherLetterProduct(input.product) && input.transport !== "surface") {
      next.group = selection.value;
    } else if (isLetterProduct(input.product) && input.transport === "surface") {
      next.surfaceDiscountRoute = Boolean(selection.surfaceDiscount);
    }
    const option = zoneOptions(input).find((candidate) =>
      candidate.selection.kind === "zone" &&
      candidate.selection.value === selection.value &&
      candidate.selection.surfaceDiscount === selection.surfaceDiscount,
    );
    return {
      input: next,
      label: option?.primary ?? "直接按价区计算",
      badge: option?.badge ?? `第 ${selection.value} 区`,
    };
  }

  if (selection.kind === "parcel") {
    return {
      input,
      label: selection.label,
      badge: "请重新选择目的地",
      error: "切换产品后需要重新选择国家／地区",
    };
  }

  const country = countryByCode(selection.code);
  if (!country) {
    return { input, label: "未知目的地", badge: "无法识别", error: "无法识别所选国家／地区" };
  }
  const availability = countryAvailability(country, input);
  if (availability.disabledReason) {
    return {
      input,
      label: country.zh,
      badge: availability.badge,
      flag: country.flag,
      error: availability.disabledReason,
      warning: availability.warning,
    };
  }
  const next = { ...input };
  if (input.product === "ems") next.zone = country.tariffs.emsZone ?? next.zone;
  else if (isLetterProduct(input.product) && input.transport === "air") next.zone = country.tariffs.airLetterZone;
  else if (isLetterProduct(input.product) && input.transport === "sal") next.zone = country.tariffs.salLetterZone ?? next.zone;
  else if (isLetterProduct(input.product) && input.transport === "surface") next.surfaceDiscountRoute = country.tariffs.surfaceLetterDiscount;
  else if (input.transport === "air") next.group = country.tariffs.airOtherGroup;
  else if (input.transport === "sal") next.group = country.tariffs.salOtherGroup ?? next.group;
  return {
    input: next,
    label: country.zh,
    badge: availability.badge,
    flag: country.flag,
    warning: availability.warning,
  };
}
