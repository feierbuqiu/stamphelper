import postageData from "@/app/postage-data.json";

export type Region = "domestic" | "hmt" | "international";
export type Transport = "air" | "sal" | "surface";
export type EvidenceLevel = "A" | "B" | "C" | "D";

export interface PostageInput {
  region: Region;
  product: string;
  weightG: number;
  local: boolean;
  transport: Transport;
  group: number;
  zone: number;
  origin: string;
  destination: string;
  parcelRouteId: number;
  contents: "document" | "goods";
  quoteFen: number;
  registered: boolean;
  appointment: boolean;
  receipt: boolean;
  insured: boolean;
  insuredValueYuan: number;
  taiwan: boolean;
  surfaceDiscountRoute: boolean;
}

export interface PostageResult {
  ok: boolean;
  totalFen: number;
  baseFen: number;
  extrasFen: number;
  title: string;
  formula: string;
  breakdown: string[];
  evidence: EvidenceLevel;
  warning?: string;
  error?: string;
}

type ParcelRow = {
  id: number;
  destination: string;
  firstFen: number;
  nextFen: number;
  limitKg: number;
  anomaly: boolean;
};

type ParcelData = {
  stampDenominations: {
    fen: number;
    label: string;
    category: "ordinary" | "commemorative" | "custom";
    defaultStock: number | null;
  }[];
  domesticParcel: {
    provinces: string[];
    bands: Record<string, { firstFen: number; nextFen: number }>;
    matrix: Record<string, Record<string, number>>;
  };
  internationalParcels: Record<Transport, ParcelRow[]>;
};

export const STATIC_POSTAGE_DATA = postageData as unknown as ParcelData;

export const REGION_LABELS: Record<Region, string> = {
  domestic: "中国大陆内地",
  hmt: "香港、澳门、台湾",
  international: "国际",
};

export const PRODUCTS: Record<Region, { value: string; label: string; kind?: string }[]> = {
  domestic: [
    { value: "letter", label: "信函（平信／可转挂号）" },
    { value: "postcard", label: "明信片" },
    { value: "printed", label: "印刷品" },
    { value: "mailgram", label: "邮简" },
    { value: "blind", label: "盲人读物（合资格）" },
    { value: "conscript", label: "义务兵免费信件（合资格）" },
    { value: "parcel", label: "普通包裹（指导价上限）" },
    { value: "domesticEms", label: "国内特快专递 EMS（柜台报价）", kind: "quote" },
    { value: "sameDay", label: "即日专递（柜台报价）", kind: "quote" },
    { value: "standardExpress", label: "标准快递（柜台报价）", kind: "quote" },
    { value: "expressParcel", label: "快递包裹（柜台报价）", kind: "quote" },
  ],
  hmt: [
    { value: "letter", label: "信函" },
    { value: "postcard", label: "明信片" },
    { value: "aerogram", label: "航空邮简" },
    { value: "printed", label: "印刷品" },
    { value: "blind", label: "盲人邮件" },
    { value: "smallPacket", label: "小包" },
    { value: "mbag", label: "印刷品专袋（M 袋）" },
    { value: "parcel", label: "普通包裹（2021 参考）" },
    { value: "ems", label: "港澳台 EMS（标准价字段）" },
  ],
  international: [
    { value: "letter", label: "信函" },
    { value: "postcard", label: "明信片" },
    { value: "aerogram", label: "航空邮简" },
    { value: "printed", label: "印刷品" },
    { value: "blind", label: "盲人邮件" },
    { value: "smallPacket", label: "平常小包（不可人工加挂号）" },
    { value: "mbag", label: "印刷品专袋（M 袋）" },
    { value: "parcel", label: "国际包裹（2021 逐路向参考）" },
    { value: "ems", label: "国际标准快递 EMS（标准价字段）" },
  ],
};

export const EMS_ZONES = [
  { zone: 1, label: "一区 · 港澳台", document: 9000, goods: 13000, next: 3000 },
  { zone: 2, label: "二区 · 日韩朝鲜", document: 11500, goods: 18000, next: 4000 },
  { zone: 3, label: "三区 · 东南亚／蒙古", document: 13000, goods: 19000, next: 4500 },
  { zone: 4, label: "四区 · 澳新等", document: 16000, goods: 21000, next: 5500 },
  { zone: 5, label: "五区 · 美国", document: 32000, goods: 32000, next: 7500 },
  { zone: 6, label: "六区 · 加拿大／西欧等", document: 22000, goods: 28000, next: 7500 },
  { zone: 7, label: "七区 · 南亚／土耳其等", document: 24000, goods: 30000, next: 8000 },
  { zone: 8, label: "八区 · 拉美／东欧／中东部分", document: 26000, goods: 33500, next: 10000 },
  { zone: 9, label: "九区 · 非洲／中东／中亚部分", document: 37000, goods: 44500, next: 12000 },
];

export const HMT_PARCEL_RATES = {
  香港: {
    surface: { firstFen: 6070, nextFen: 480, limitKg: 30 },
    air: { firstFen: 7690, nextFen: 2100, limitKg: 30 },
  },
  澳门: {
    surface: { firstFen: 9020, nextFen: 1000, limitKg: 31.5 },
    air: { firstFen: 10890, nextFen: 2870, limitKg: 31.5 },
  },
  台湾: {
    surface: { firstFen: 8950, nextFen: 500, limitKg: 30 },
    air: { firstFen: 9950, nextFen: 2100, limitKg: 30 },
  },
} as const;

export function formatYuan(fen: number): string {
  return `¥${(fen / 100).toFixed(2)}`;
}

function fail(title: string, error: string): PostageResult {
  return {
    ok: false,
    totalFen: 0,
    baseFen: 0,
    extrasFen: 0,
    title,
    formula: "",
    breakdown: [],
    evidence: "A",
    error,
  };
}

function stepsBeyond(weightG: number, firstG: number, stepG: number): number {
  return Math.max(0, Math.ceil((weightG - firstG) / stepG));
}

function domesticBase(input: PostageInput): PostageResult {
  const weight = Math.ceil(input.weightG);
  const scope = input.local ? "本埠" : "外埠";
  const title = `${scope}${PRODUCTS.domestic.find((item) => item.value === input.product)?.label ?? "邮件"}`;

  if (["domesticEms", "sameDay", "standardExpress", "expressParcel"].includes(input.product)) {
    if (input.quoteFen <= 0) return fail(title, "请填入普遍服务柜台给出的应付总邮资");
    if (input.quoteFen > 2_000_000) return fail(title, "贴票求解器单件金额上限为 20,000 元");
    return {
      ok: true,
      totalFen: input.quoteFen,
      baseFen: input.quoteFen,
      extrasFen: 0,
      title,
      formula: "采用营业系统／柜台本次报价",
      breakdown: [`柜台应付总邮资 ${formatYuan(input.quoteFen)}`],
      evidence: "C",
      warning: "市场定价产品没有一张全国永久统一价表；请录入普遍服务柜台本次显示的含附加项总额。",
    };
  }

  if (weight <= 0) return fail(title, "重量必须大于 0 g");
  let baseFen = 0;
  let formula = "";
  let evidence: EvidenceLevel = "A";
  let warning: string | undefined;

  switch (input.product) {
    case "letter":
      if (weight > 2000) return fail(title, "国内信函限重 2,000 g");
      if (weight <= 100) {
        const unit = input.local ? 80 : 120;
        baseFen = unit * Math.ceil(weight / 20);
        formula = `${formatYuan(unit)} × ceil(${weight}/20)`;
      } else {
        const first = input.local ? 400 : 600;
        const next = input.local ? 120 : 200;
        baseFen = first + next * Math.ceil((weight - 100) / 100);
        formula = `${formatYuan(first)} + ${formatYuan(next)} × ceil((${weight}−100)/100)`;
      }
      break;
    case "printed": {
      if (weight > 35000) return fail(title, "国内印刷品限重 35,000 g");
      const first = input.local ? 80 : 120;
      const next = input.local ? 20 : 40;
      baseFen = first + next * stepsBeyond(weight, 100, 100);
      formula = `${formatYuan(first)} + ${formatYuan(next)} × ceil(max(0, ${weight}−100)/100)`;
      break;
    }
    case "postcard":
      baseFen = 80;
      formula = "每件 ¥0.80";
      break;
    case "mailgram":
      baseFen = input.local ? 80 : 120;
      formula = `每件 ${formatYuan(baseFen)}`;
      break;
    case "blind":
      baseFen = 0;
      formula = "符合资格的盲人读物基础资费免收";
      warning = "免费资格、内容、封装须由柜台核验；不能据此推导附加服务也免费。";
      break;
    case "conscript":
      if (weight > 20) return fail(title, "义务兵免费信件每件不得超过 20 g");
      baseFen = 0;
      formula = "符合资格的国内平常信函／明信片基础资费免收";
      warning = "须为现役义务兵从部队发寄的私人通信，并由柜台核验。";
      break;
    case "parcel": {
      if (weight > 10000) return fail(title, "普通包裹政府指导价适用范围为单件不超过 10 kg");
      const band = STATIC_POSTAGE_DATA.domesticParcel.matrix[input.origin]?.[input.destination];
      const rate = band ? STATIC_POSTAGE_DATA.domesticParcel.bands[String(band)] : undefined;
      if (!rate) return fail(title, "请选择有效的寄出地和寄达地");
      baseFen = rate.firstFen + rate.nextFen * stepsBeyond(weight, 1000, 1000);
      formula = `${band} 档：${formatYuan(rate.firstFen)} + ${formatYuan(rate.nextFen)} × ceil(max(0, ${weight}−1000)/1000)`;
      evidence = "B";
      warning = "这是政府指导价上限；营业企业可以下浮。普通包裹本身已给据，不再加 3 元函件挂号费。";
      break;
    }
    default:
      return fail(title, "暂不支持该国内产品");
  }

  return withExtras({
    input,
    title,
    baseFen,
    formula,
    evidence,
    warning,
  });
}

function hmtLetterBase(weight: number): number | null {
  const bands = [
    [20, 150],
    [50, 280],
    [100, 400],
    [250, 850],
    [500, 1670],
    [1000, 3170],
    [2000, 5580],
  ];
  return bands.find(([limit]) => weight <= limit)?.[1] ?? null;
}

function hmtBase(input: PostageInput): PostageResult {
  const weight = Math.ceil(input.weightG);
  const productLabel = PRODUCTS.hmt.find((item) => item.value === input.product)?.label ?? "邮件";
  const title = `港澳台${productLabel}`;
  if (weight <= 0) return fail(title, "重量必须大于 0 g");
  if (input.transport === "sal") return fail(title, "港澳台函件价表不提供 SAL 选项；请选择航空或非航空");

  let baseFen = 0;
  let formula = "";
  let evidence: EvidenceLevel = "A";
  let warning: string | undefined;
  const airFee = input.transport === "air" ? 50 * Math.ceil(weight / 10) : 0;

  switch (input.product) {
    case "letter": {
      const surface = hmtLetterBase(weight);
      if (surface === null) return fail(title, "港澳台信函限重 2,000 g");
      baseFen = surface + airFee;
      formula = input.transport === "air"
        ? `非航空分档 ${formatYuan(surface)} + ¥0.50 × ceil(${weight}/10)`
        : `非航空重量分档 ${formatYuan(surface)}`;
      break;
    }
    case "postcard":
      baseFen = 350 + (input.transport === "air" ? 50 : 0);
      formula = input.transport === "air" ? "¥3.50 + 航空费 ¥0.50/件" : "每件 ¥3.50";
      break;
    case "aerogram":
      if (input.transport !== "air") return fail(title, "航空邮简本身即为航空形态");
      baseFen = 180;
      formula = "每件 ¥1.80；不重复加航空费";
      break;
    case "printed": {
      if (weight > 2000) return fail(title, "本计算器按函件常用 2 kg 上限校验印刷品");
      const surface = 350 + 130 * stepsBeyond(weight, 20, 10);
      baseFen = surface + airFee;
      formula = `${formatYuan(surface)}${airFee ? ` + 航空费 ${formatYuan(airFee)}` : ""}`;
      break;
    }
    case "blind":
      if (weight > 7000) return fail(title, "盲人邮件按 7 kg 常用上限校验");
      baseFen = airFee;
      formula = airFee ? `基本资费免收 + 航空费 ${formatYuan(airFee)}` : "基本资费免收";
      break;
    case "smallPacket": {
      if (weight > 2000) return fail(title, "港澳台小包限重 2,000 g");
      const surface = 1500 + 1300 * stepsBeyond(weight, 100, 100);
      baseFen = surface + airFee;
      formula = `${formatYuan(surface)}${airFee ? ` + 航空费 ${formatYuan(airFee)}` : ""}`;
      break;
    }
    case "mbag": {
      if (weight > 30000) return fail(title, "M 袋按 30 kg 常用上限校验");
      const surface = 18000 + 4500 * stepsBeyond(weight, 5000, 1000);
      baseFen = surface + airFee;
      formula = `${formatYuan(surface)}${airFee ? ` + 航空费 ${formatYuan(airFee)}` : ""}`;
      warning = "M 袋仅用于寄给同一收件人的印刷品集合。";
      break;
    }
    case "parcel": {
      const destination = input.destination as keyof typeof HMT_PARCEL_RATES;
      const mode = input.transport as "surface" | "air";
      const rate = HMT_PARCEL_RATES[destination]?.[mode];
      if (!rate) return fail(title, "请选择香港、澳门或台湾及有效运输方式");
      if (weight > rate.limitKg * 1000) return fail(title, `该参考路向限重 ${rate.limitKg} kg`);
      baseFen = rate.firstFen + rate.nextFen * stepsBeyond(weight, 1000, 1000);
      formula = `${formatYuan(rate.firstFen)} + ${formatYuan(rate.nextFen)} × ceil(max(0, ${weight}−1000)/1000)`;
      evidence = "D";
      warning = destination === "香港" && mode === "surface"
        ? "中国邮政 11185 目前不提供香港水陆路包裹预估报价；这里保留 2021 官方附件参考价，请在交寄前向柜台确认是否受理及实际金额。"
        : "这是 2021 官方附件参考价；公告要求最终以当地协议和实际收取为准。";
      break;
    }
    case "ems":
      return emsBase({ ...input, zone: 1 }, title);
    default:
      return fail(title, "暂不支持该港澳台产品");
  }

  return withExtras({ input, title, baseFen, formula, evidence, warning });
}

function internationalBase(input: PostageInput): PostageResult {
  const weight = Math.ceil(input.weightG);
  const productLabel = PRODUCTS.international.find((item) => item.value === input.product)?.label ?? "邮件";
  const title = `国际${productLabel}`;
  if (weight <= 0) return fail(title, "重量必须大于 0 g");
  if (input.product === "ems") return emsBase(input, title);

  if (input.product === "parcel") {
    const rows = STATIC_POSTAGE_DATA.internationalParcels[input.transport] ?? [];
    const row = rows.find((candidate) => candidate.id === input.parcelRouteId);
    if (!row) return fail(title, "所选运输方式下没有这个路向");
    if (row.anomaly) return fail(title, "源表路向名称或限重存在异常，不能自动给出可交寄结论");
    if (weight > row.limitKg * 1000) return fail(title, `该参考路向限重 ${row.limitKg} kg`);
    const baseFen = row.firstFen + row.nextFen * stepsBeyond(weight, 1000, 1000);
    return withExtras({
      input,
      title: `${title} · ${row.destination}`,
      baseFen,
      formula: `${formatYuan(row.firstFen)} + ${formatYuan(row.nextFen)} × ceil(max(0, ${weight}−1000)/1000)`,
      evidence: "D",
      warning: "这是 2021 官方逐路向参考价；目的地开放、限重与实收价必须在交寄前用官方报价工具或柜台复核。",
    });
  }

  let baseFen = 0;
  let formula = "";
  const groupIndex = Math.min(2, Math.max(0, input.group - 1));
  const zoneIndex = Math.min(3, Math.max(0, input.zone - 1));

  if (input.transport === "surface") {
    switch (input.product) {
      case "letter": {
        if (weight > 2000) return fail(title, "国际信函限重 2,000 g");
        const first = input.surfaceDiscountRoute ? 350 : 400;
        const next = input.surfaceDiscountRoute ? 40 : 50;
        baseFen = first + next * stepsBeyond(weight, 20, 10);
        formula = `${formatYuan(first)} + ${formatYuan(next)} × ceil(max(0, ${weight}−20)/10)`;
        break;
      }
      case "postcard":
        baseFen = 350;
        formula = "每件 ¥3.50";
        break;
      case "aerogram":
        return fail(title, "航空邮简不能选择水陆路");
      case "printed":
        if (weight > 2000) return fail(title, "国际印刷品按 2 kg 常用上限校验");
        baseFen = 400 + 180 * stepsBeyond(weight, 20, 10);
        formula = `¥4.00 + ¥1.80 × ceil(max(0, ${weight}−20)/10)`;
        break;
      case "blind":
        if (weight > 7000) return fail(title, "盲人邮件按 7 kg 常用上限校验");
        baseFen = 0;
        formula = "水陆路盲人邮件基本资费免收";
        break;
      case "smallPacket":
        if (weight > 2000) return fail(title, "国际小包限重 2,000 g");
        baseFen = 1800 + 1300 * stepsBeyond(weight, 100, 100);
        formula = `¥18.00 + ¥13.00 × ceil(max(0, ${weight}−100)/100)`;
        break;
      case "mbag":
        if (weight > 30000) return fail(title, "M 袋按 30 kg 常用上限校验");
        baseFen = 20000 + 5000 * stepsBeyond(weight, 5000, 1000);
        formula = `¥200.00 + ¥50.00 × ceil(max(0, ${weight}−5000)/1000)`;
        break;
      default:
        return fail(title, "该产品不支持水陆路计算");
    }
  } else {
    const isAir = input.transport === "air";
    const letterFirst = isAir ? [500, 550, 600, 700] : [450, 500, 550, 650];
    const letterNext = isAir ? [100, 150, 180, 230] : [50, 60, 70, 80];
    const printedFirst = isAir ? [450, 500, 600] : [400, 450, 500];
    const printedNext = isAir ? [220, 250, 280] : [190, 220, 250];
    const blindNext = isAir ? [60, 80, 100] : [30, 30, 40];
    const packetFirst = isAir ? [2500, 3000, 3500] : [2200, 2700, 3200];
    const packetNext = isAir ? [2300, 2700, 3300] : [1800, 2300, 2800];
    const mbagFirst = isAir ? [48500, 61000, 73000] : [45500, 60000, 73000];
    const mbagNext = [10000, 12000, 14500];

    switch (input.product) {
      case "letter":
        if (weight > 2000) return fail(title, "国际信函限重 2,000 g");
        baseFen = letterFirst[zoneIndex] + letterNext[zoneIndex] * stepsBeyond(weight, 20, 10);
        formula = `${formatYuan(letterFirst[zoneIndex])} + ${formatYuan(letterNext[zoneIndex])} × ceil(max(0, ${weight}−20)/10)`;
        break;
      case "postcard":
        baseFen = isAir ? 500 : 450;
        formula = `每件 ${formatYuan(baseFen)}`;
        break;
      case "aerogram":
        if (!isAir) return fail(title, "SAL 价表未列航空邮简；请选择航空");
        baseFen = 550;
        formula = "每件 ¥5.50";
        break;
      case "printed":
        if (weight > 2000) return fail(title, "国际印刷品按 2 kg 常用上限校验");
        baseFen = printedFirst[groupIndex] + printedNext[groupIndex] * stepsBeyond(weight, 20, 10);
        formula = `${formatYuan(printedFirst[groupIndex])} + ${formatYuan(printedNext[groupIndex])} × ceil(max(0, ${weight}−20)/10)`;
        break;
      case "blind":
        if (weight > 7000) return fail(title, "盲人邮件按 7 kg 常用上限校验");
        baseFen = blindNext[groupIndex] * Math.ceil(weight / 10);
        formula = `基本资费免收 + ${formatYuan(blindNext[groupIndex])} × ceil(${weight}/10)`;
        break;
      case "smallPacket":
        if (weight > 2000) return fail(title, "国际小包限重 2,000 g");
        baseFen = packetFirst[groupIndex] + packetNext[groupIndex] * stepsBeyond(weight, 100, 100);
        formula = `${formatYuan(packetFirst[groupIndex])} + ${formatYuan(packetNext[groupIndex])} × ceil(max(0, ${weight}−100)/100)`;
        break;
      case "mbag":
        if (weight > 30000) return fail(title, "M 袋按 30 kg 常用上限校验");
        baseFen = mbagFirst[groupIndex] + mbagNext[groupIndex] * stepsBeyond(weight, 5000, 1000);
        formula = `${formatYuan(mbagFirst[groupIndex])} + ${formatYuan(mbagNext[groupIndex])} × ceil(max(0, ${weight}−5000)/1000)`;
        break;
      default:
        return fail(title, "暂不支持该国际产品");
    }
  }

  return withExtras({ input, title, baseFen, formula, evidence: "A" });
}

function emsBase(input: PostageInput, title: string): PostageResult {
  const weight = Math.ceil(input.weightG);
  const rate = EMS_ZONES.find((item) => item.zone === input.zone) ?? EMS_ZONES[0];
  const first = input.contents === "document" ? rate.document : rate.goods;
  const baseFen = first + rate.next * stepsBeyond(weight, 500, 500);
  let extrasFen = 0;
  const breakdown = [`EMS 标准价字段 ${formatYuan(baseFen)}`];
  if (input.insured) {
    if (input.insuredValueYuan <= 0 || input.insuredValueYuan > 20000) {
      return fail(title, "EMS 保价声明价值须大于 0 且不超过 20,000 元");
    }
    const insurance = Math.max(100, Math.ceil(input.insuredValueYuan * 0.8));
    extrasFen += insurance;
    breakdown.push(`条件性保价费 ${formatYuan(insurance)}`);
  }
  return {
    ok: true,
    totalFen: baseFen + extrasFen,
    baseFen,
    extrasFen,
    title,
    formula: `${formatYuan(first)} + ${formatYuan(rate.next)} × ceil(max(0, ${weight}−500)/500)`,
    breakdown,
    evidence: "C",
    warning: "采用 2026-07-30 官方报价工具的标准字段快照；地区服务费、折扣、临时可达性和其他延伸费用须以普遍服务柜台本次结算为准。EMS 已给据，不叠加函件挂号或回执。",
  };
}

function withExtras({
  input,
  title,
  baseFen,
  formula,
  evidence,
  warning,
}: {
  input: PostageInput;
  title: string;
  baseFen: number;
  formula: string;
  evidence: EvidenceLevel;
  warning?: string;
}): PostageResult {
  let extrasFen = 0;
  const breakdown = [`基础资费 ${formatYuan(baseFen)}`];
  const isParcel = input.product === "parcel";
  const isMbag = input.product === "mbag";
  const isFree = ["blind", "conscript"].includes(input.product);

  if (isFree && (input.registered || input.appointment || input.receipt || input.insured)) {
    return fail(title, "免费基础业务的给据／附加资格不能自动推导，请改用柜台总价输入");
  }

  if (input.region === "domestic") {
    if (input.insured) {
      if (input.insuredValueYuan <= 0 || input.insuredValueYuan > 100000) {
        return fail(title, "国内保价声明价值须大于 0 且不超过 100,000 元");
      }
      const insurance = Math.max(100, Math.ceil(input.insuredValueYuan) * 1);
      if (!isParcel) {
        extrasFen += 300;
        breakdown.push("保价函件所需给据／挂号构成 ¥3.00");
      }
      extrasFen += insurance;
      breakdown.push(`保价费 ${formatYuan(insurance)}`);
    } else if (!isParcel && (input.registered || input.appointment || input.receipt)) {
      extrasFen += 300;
      breakdown.push("挂号 ¥3.00");
    }
    if (input.appointment) {
      if (isParcel) return fail(title, "约投是函件挂号基础上的服务，不能套到普通包裹");
      extrasFen += 200;
      breakdown.push("约投 ¥2.00");
    }
    if (input.receipt) {
      if (isParcel) return fail(title, "本计算器不把函件回执费套到普通包裹");
      extrasFen += 300;
      breakdown.push("回执 ¥3.00");
    }
  } else {
    if (input.registered && input.product === "smallPacket" && input.contents === "goods") {
      return fail(title, "2026-01-01 起物品类国际挂号邮件停办；不能用平常小包 +16 元拼成挂号小包");
    }

    const ordinaryRegistration = input.region === "hmt" ? 1600 : 1600;
    const receiptFee = input.region === "hmt" ? 300 : 500;
    if (input.receipt && input.region === "hmt" && input.taiwan) {
      return fail(title, "台湾路向不办理回执");
    }

    if (input.insured) {
      if (input.insuredValueYuan <= 0) return fail(title, "请输入大于 0 的声明价值");
      if (isParcel) {
        const insurance = input.region === "hmt"
          ? 300 * Math.ceil(input.insuredValueYuan / 200) + 300
          : 100 * Math.ceil(input.insuredValueYuan / 100) + 800;
        extrasFen += insurance;
        breakdown.push(`保价包裹费 ${formatYuan(insurance)}`);
      } else {
        const insurance = input.region === "hmt"
          ? 300 * Math.ceil(input.insuredValueYuan / 200) + 1800
          : 100 * Math.ceil(input.insuredValueYuan / 100) + 1800;
        extrasFen += insurance;
        breakdown.push(`保价函件费（已含挂号与处理费）${formatYuan(insurance)}`);
      }
    } else if (input.registered) {
      const registration = isMbag ? 8000 : ordinaryRegistration;
      extrasFen += registration;
      breakdown.push(`${isMbag ? "M 袋挂号" : "挂号"} ${formatYuan(registration)}`);
    }
    if (input.receipt) {
      if (!(input.registered || input.insured)) return fail(title, "回执须依附于给据／挂号邮件");
      extrasFen += receiptFee;
      breakdown.push(`回执 ${formatYuan(receiptFee)}`);
    }
  }

  return {
    ok: true,
    totalFen: baseFen + extrasFen,
    baseFen,
    extrasFen,
    title,
    formula,
    breakdown,
    evidence,
    warning,
  };
}

export function calculatePostage(input: PostageInput): PostageResult {
  if (!Number.isFinite(input.weightG) || !Number.isFinite(input.quoteFen)) {
    return fail("邮资计算", "输入中包含无效数值");
  }
  switch (input.region) {
    case "domestic":
      return domesticBase(input);
    case "hmt":
      return hmtBase(input);
    case "international":
      return internationalBase(input);
  }
}
