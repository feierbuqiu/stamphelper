"use client";

import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Equal,
  Info,
  LoaderCircle,
  Minus,
  Monitor,
  Moon,
  PackageCheck,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Stamp,
  Sun,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { DestinationCombobox } from "@/components/DestinationCombobox";
import {
  buildDestinationOptions,
  ROUTE_AVAILABILITY_NOTE,
  resolveInternationalSelection,
  type DestinationSelection,
} from "@/lib/destination-search";
import {
  calculatePostage,
  formatYuan,
  PRODUCTS,
  REGION_LABELS,
  STATIC_POSTAGE_DATA,
  type PostageInput,
  type Region,
  type Transport,
} from "@/lib/postage-calculator";
import {
  createDefaultStockRecord,
  createStoredProfile,
  formatStampLabel,
  isStampStock,
  loadStampProfile,
  MAX_CUSTOM_STAMPS,
  parseCustomStampFen,
  persistStampProfile,
  type ThemePreference,
} from "@/lib/stamp-profile";
import type { StampDenomination, StampStock } from "@/lib/stamp-solver";
import { useStampCalculation } from "@/lib/use-stamp-calculation";

const DEFAULT_INPUT: PostageInput = {
  region: "domestic",
  product: "letter",
  weightG: 20,
  local: false,
  transport: "air",
  group: 2,
  zone: 3,
  origin: "北京",
  destination: "上海",
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

const EVIDENCE = {
  A: { label: "现行公开价", tone: "solid" },
  B: { label: "指导价上限", tone: "limit" },
  C: { label: "柜台／快照价", tone: "quote" },
  D: { label: "历史参考价", tone: "reference" },
} as const;

const QUOTE_PRODUCTS = new Set([
  "domesticEms",
  "sameDay",
  "standardExpress",
  "expressParcel",
]);

const MAX_CALCULATOR_FEN = 2_000_000;
const BUILT_IN_DENOMINATIONS: StampDenomination[] = STATIC_POSTAGE_DATA.stampDenominations;

function yuanInputToFen(value: string): number {
  const normalized = value.trim().replace(/[¥￥,，\s]/g, "");
  if (!/^\d*(?:\.\d{0,2})?$/.test(normalized) || !normalized) return 0;
  return Math.round(Number(normalized) * 100);
}

function isFixedPieceProduct(product: string): boolean {
  return ["postcard", "mailgram", "aerogram"].includes(product);
}

type WeightUnit = "g" | "kg";

function formatWeightInput(weightG: number, unit: WeightUnit): string {
  if (!weightG) return "";
  return unit === "kg" ? String(Number((weightG / 1000).toFixed(3))) : String(weightG);
}

function isGoodsProduct(product: string, contents: PostageInput["contents"]): boolean {
  return ["smallPacket", "parcel"].includes(product) || (product === "ems" && contents === "goods");
}

const THEME_SEQUENCE: ThemePreference[] = ["system", "light", "dark"];
const THEME_LABELS: Record<ThemePreference, string> = {
  system: "跟随系统",
  light: "浅色模式",
  dark: "深色模式",
};

export default function Home() {
  const [customStamps, setCustomStamps] = useState<StampDenomination[]>([]);
  const denominations = useMemo(
    () => [...BUILT_IN_DENOMINATIONS, ...customStamps].sort((left, right) => right.fen - left.fen),
    [customStamps],
  );
  const [stocksByFen, setStocksByFen] = useState<Record<string, StampStock>>(
    () => createDefaultStockRecord(BUILT_IN_DENOMINATIONS),
  );
  const stocks = useMemo(
    () => denominations.map((stamp) => {
      const saved = stocksByFen[String(stamp.fen)];
      return isStampStock(saved) ? saved : stamp.defaultStock ?? null;
    }),
    [denominations, stocksByFen],
  );
  const [mode, setMode] = useState<"business" | "manual">("business");
  const [input, setInput] = useState<PostageInput>(DEFAULT_INPUT);
  const [manualYuan, setManualYuan] = useState("1.20");
  const [internationalDestination, setInternationalDestination] = useState<DestinationSelection>({ kind: "country", code: "AUS" });
  const [copied, setCopied] = useState(false);
  const [inventoryReady, setInventoryReady] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [customYuan, setCustomYuan] = useState("");
  const [customFeedback, setCustomFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const themeTouchedRef = useRef(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("g");
  const [weightText, setWeightText] = useState("20");

  useEffect(() => {
    let cancelled = false;
    void loadStampProfile(BUILT_IN_DENOMINATIONS).then((profile) => {
      if (cancelled) return;
      setCustomStamps(profile.customStamps);
      setStocksByFen(profile.stocksByFen);
      setDeviceId(profile.deviceId);
      if (!themeTouchedRef.current) setTheme(profile.theme);
      setInventoryReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!inventoryReady || !deviceId) return;
    const saveTask = window.setTimeout(() => {
      const profile = createStoredProfile(
        deviceId,
        BUILT_IN_DENOMINATIONS,
        customStamps,
        stocksByFen,
        Date.now(),
        theme,
      );
      void persistStampProfile(profile);
    }, 120);
    return () => window.clearTimeout(saveTask);
  }, [customStamps, deviceId, inventoryReady, stocksByFen, theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const applyColorScheme = () => {
      document.documentElement.dataset.colorScheme = theme === "system"
        ? (preference.matches ? "dark" : "light")
        : theme;
    };
    applyColorScheme();
    if (theme !== "system") return;
    preference.addEventListener("change", applyColorScheme);
    return () => preference.removeEventListener("change", applyColorScheme);
  }, [theme]);

  const destinationOptions = useMemo(
    () => buildDestinationOptions(input),
    [input],
  );
  const destinationResolution = useMemo(
    () => resolveInternationalSelection(input, internationalDestination),
    [input, internationalDestination],
  );
  const businessResult = useMemo(() => {
    if (input.region === "international" && destinationResolution.error) {
      return {
        ok: false as const,
        totalFen: 0,
        baseFen: 0,
        extrasFen: 0,
        title: "国际邮件",
        formula: "",
        breakdown: [],
        evidence: "A" as const,
        error: destinationResolution.error,
      };
    }
    const calculated = calculatePostage(destinationResolution.input);
    if (input.region !== "international" || !calculated.ok) return calculated;
    return {
      ...calculated,
      title: `${calculated.title} · ${destinationResolution.label}`,
    };
  }, [destinationResolution, input.region]);
  const manualFen = yuanInputToFen(manualYuan);
  const manualValid = manualFen > 0 && manualFen <= MAX_CALCULATOR_FEN;
  const businessValid = businessResult.ok && businessResult.totalFen <= MAX_CALCULATOR_FEN;
  const showHongKongSurfaceParcelWarning = businessResult.ok
    && input.region === "hmt"
    && input.product === "parcel"
    && input.destination === "香港"
    && input.transport === "surface";
  const targetFen = mode === "manual" ? (manualValid ? manualFen : 0) : businessValid ? businessResult.totalFen : 0;
  const hasTarget = mode === "manual" ? manualValid : businessValid;

  const {
    plan: stampPlan,
    thresholds,
    ready: solverReady,
    updating: solverUpdating,
    pending: solverPending,
    elapsedMs: solverElapsedMs,
    background: solverInWorker,
  } = useStampCalculation(targetFen, denominations, stocks, hasTarget);

  const updateInput = <K extends keyof PostageInput>(key: K, value: PostageInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const selectWeightUnit = (unit: WeightUnit, weightG = input.weightG) => {
    setWeightUnit(unit);
    setWeightText(formatWeightInput(weightG, unit));
  };

  const updateWeightText = (value: string) => {
    const validShape = weightUnit === "g"
      ? /^\d*$/.test(value)
      : /^\d*(?:\.\d{0,3})?$/.test(value);
    if (!validShape) return;
    setWeightText(value);
    if (!value || value === ".") {
      updateInput("weightG", 0);
      return;
    }
    const numeric = Number(value);
    updateInput("weightG", Number.isFinite(numeric) ? Math.round(numeric * (weightUnit === "kg" ? 1000 : 1)) : 0);
  };

  const selectContents = (contents: PostageInput["contents"]) => {
    updateInput("contents", contents);
    selectWeightUnit(contents === "goods" ? "kg" : "g");
  };

  const cycleTheme = () => {
    themeTouchedRef.current = true;
    setTheme((current) => THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(current) + 1) % THEME_SEQUENCE.length]);
  };

  const handleModeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = mode === "business" ? 0 : 1;
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % 2;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index + 1) % 2;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = 1;
    else return;
    event.preventDefault();
    const nextMode = nextIndex === 0 ? "business" : "manual";
    setMode(nextMode);
    window.requestAnimationFrame(() => document.getElementById(`mode-${nextMode}-tab`)?.focus());
  };

  const selectRegion = (region: Region) => {
    if (region === "international" && internationalDestination.kind === "parcel") {
      setInternationalDestination({ kind: "country", code: "AUS" });
    }
    const defaults: Record<Region, Partial<PostageInput>> = {
      domestic: { product: "letter", weightG: 20, contents: "document", destination: "上海" },
      hmt: { product: "letter", weightG: 20, transport: "air", contents: "document", destination: "香港", taiwan: false },
      international: { product: "letter", weightG: 20, transport: "air", contents: "document", zone: 3, group: 2, parcelRouteId: 1 },
    };
    setInput((current) => ({
      ...current,
      ...defaults[region],
      region,
      registered: false,
      appointment: false,
      receipt: false,
      insured: false,
    }));
    selectWeightUnit("g", 20);
  };

  const selectProduct = (product: string) => {
    const goods = isGoodsProduct(product, input.contents);
    if (internationalDestination.kind !== "country") {
      setInternationalDestination({ kind: "country", code: "AUS" });
    }
    setInput((current) => ({
      ...current,
      product,
      transport: product === "aerogram" ? "air" : current.transport,
      contents: goods ? "goods" : current.contents,
      registered: false,
      appointment: false,
      receipt: false,
      insured: false,
    }));
    selectWeightUnit(goods ? "kg" : "g");
  };

  const selectTransport = (transport: Transport) => {
    if (internationalDestination.kind === "parcel") {
      setInternationalDestination({ kind: "country", code: "AUS" });
    }
    updateInput("transport", transport);
  };

  const toggleExtra = (key: "registered" | "appointment" | "receipt" | "insured") => {
    setInput((current) => {
      const checked = !current[key];
      if (key === "registered" && !checked) {
        return { ...current, registered: false, appointment: false, receipt: false };
      }
      if ((key === "appointment" || key === "receipt") && checked) {
        return { ...current, [key]: true, registered: true };
      }
      return { ...current, [key]: checked };
    });
  };

  const setStock = (fen: number, next: StampStock) => {
    setStocksByFen((current) => ({ ...current, [String(fen)]: next }));
  };

  const decrementStock = (index: number) => {
    const stamp = denominations[index];
    if (!stamp) return;
    const current = stocks[index];
    const threshold = thresholds[index] ?? 1;
    setStock(stamp.fen, current === null ? Math.max(0, threshold - 1) : Math.max(0, current - 1));
  };

  const incrementStock = (index: number) => {
    const stamp = denominations[index];
    if (!stamp) return;
    const current = stocks[index];
    if (current === null) return;
    const next = current + 1;
    setStock(stamp.fen, next >= (thresholds[index] ?? 1) ? null : next);
  };

  const resetStocks = () => setStocksByFen(createDefaultStockRecord(denominations));
  const clearAllStocks = () => setStocksByFen(
    Object.fromEntries(denominations.map((stamp) => [String(stamp.fen), 0])),
  );
  const rejectDenomination = (fen: number) => setStock(fen, 0);

  const addCustomStamp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (customStamps.length >= MAX_CUSTOM_STAMPS) {
      setCustomFeedback({ tone: "error", text: `为保证求解性能，每台设备最多保存 ${MAX_CUSTOM_STAMPS} 种自定义面额。` });
      return;
    }
    const fen = parseCustomStampFen(customYuan);
    if (fen === null) {
      setCustomFeedback({ tone: "error", text: "请输入 0.01 元至 200 元之间、最多两位小数的面额。" });
      return;
    }
    if (denominations.some((stamp) => stamp.fen === fen)) {
      setCustomFeedback({ tone: "error", text: `${formatStampLabel(fen)} 已经存在，请直接调整该面额的库存。` });
      return;
    }

    const customStamp: StampDenomination = {
      fen,
      label: formatStampLabel(fen),
      category: "custom",
      defaultStock: null,
    };
    setCustomStamps((current) => [...current, customStamp].sort((left, right) => right.fen - left.fen));
    setStocksByFen((current) => ({ ...current, [String(fen)]: null }));
    setCustomYuan("");
    setCustomFeedback({ tone: "success", text: `已添加 ${customStamp.label} 自定义纪特邮票，并设为足量。` });
  };

  const removeCustomStamp = (fen: number) => {
    setCustomStamps((current) => current.filter((stamp) => stamp.fen !== fen));
    setStocksByFen((current) => {
      const next = { ...current };
      delete next[String(fen)];
      return next;
    });
    setCustomFeedback({ tone: "success", text: `已移除 ${formatStampLabel(fen)} 自定义纪特邮票。` });
  };

  const copyPlan = async () => {
    if (!hasTarget || solverUpdating || stampPlan.status === "insufficient") return;
    const items = stampPlan.items.map((item) => `${item.label}×${item.count}`).join(" + ");
    const overpay = stampPlan.overpayFen ? `，多贴 ${formatYuan(stampPlan.overpayFen)}` : "，正好贴满";
    await navigator.clipboard.writeText(
      `应付 ${formatYuan(stampPlan.targetFen)}；贴法：${items || "无需贴票"}；合计 ${formatYuan(stampPlan.totalFen)}${overpay}`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const isQuoteProduct = QUOTE_PRODUCTS.has(input.product);
  const isEms = input.product === "ems";
  const isParcel = input.product === "parcel";
  const allowsTransport = input.region !== "domestic" && !isEms;
  const allowsRegistered = ![
    "parcel",
    "ems",
    "blind",
    "conscript",
    "domesticEms",
    "sameDay",
    "standardExpress",
    "expressParcel",
    "smallPacket",
  ].includes(input.product);
  const allowsInsurance = ["letter", "parcel", "ems"].includes(input.product);
  const showsDomesticScope = input.region === "domestic" && !["postcard", "blind", "conscript", "parcel"].includes(input.product) && !isQuoteProduct;
  const nextTheme = THEME_SEQUENCE[(THEME_SEQUENCE.indexOf(theme) + 1) % THEME_SEQUENCE.length];

  return (
    <main>
      <header className="masthead">
        <a className="brand" href="#top" aria-label="贴票助手首页">
          <span className="brand-mark" aria-hidden="true"><Stamp size={22} /></span>
          <span>贴票助手</span>
        </a>
        <nav className="top-nav" aria-label="页面导航">
          <a href="#calculator">计算</a>
          <a href="#inventory">库存</a>
          <a href="#scope">业务边界</a>
          <a href="#sources">来源</a>
        </nav>
        <div className="header-actions">
          <span className="version-pill"><span className="pulse-dot" />静态资费 · 2026-07-31</span>
          <button
            type="button"
            className="theme-toggle"
            onClick={cycleTheme}
            aria-label={`当前${THEME_LABELS[theme]}，切换到${THEME_LABELS[nextTheme]}`}
            title={`当前：${THEME_LABELS[theme]}；点击切换到${THEME_LABELS[nextTheme]}`}
          >
            {theme === "system" ? <Monitor size={17} /> : theme === "light" ? <Sun size={17} /> : <Moon size={17} />}
            <span>{THEME_LABELS[theme]}</span>
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={15} /> 普通邮票，也能贴得刚刚好</p>
          <h1>先算邮资，<span>再把每一枚邮票用在刀刃上。</span></h1>
          <p className="hero-lede">
            覆盖提供国际业务的普遍服务柜台可受理的贴票业务。精确匹配优先；无法正好贴满时，只向上取最小溢价。
          </p>
          <div className="hero-facts" aria-label="计算器特点">
            <span><CheckCircle2 size={17} /> 17 种普通面额 + 纪特与自定义票</span>
            <span><Scale size={17} /> 有限库存全局最优</span>
            <span><ShieldCheck size={17} /> 非法组合即时拦截</span>
          </div>
        </div>
        <div className="hero-stamp" aria-hidden="true">
          <div className="hero-stamp-inner">
            <span>CHINA POST</span>
            <strong>¥1.20</strong>
            <small>普通邮票</small>
          </div>
        </div>
      </section>

      <section className="calculator-shell" id="calculator">
        <div className="calculator-card input-card">
          <div className="card-heading">
            <div>
              <p className="step-kicker">01 · 确定应付邮资</p>
              <h2>这件邮件要寄到哪里？</h2>
            </div>
            <CircleHelp className="muted-icon" size={21} aria-hidden="true" />
          </div>

          <div className="mode-switch" role="tablist" aria-label="邮资输入方式">
            <button id="mode-business-tab" type="button" className={mode === "business" ? "active" : ""} onClick={() => setMode("business")} onKeyDown={handleModeKeyDown} role="tab" aria-selected={mode === "business"} aria-controls="mode-business-panel" tabIndex={mode === "business" ? 0 : -1}>
              按业务计算
            </button>
            <button id="mode-manual-tab" type="button" className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")} onKeyDown={handleModeKeyDown} role="tab" aria-selected={mode === "manual"} aria-controls="mode-manual-panel" tabIndex={mode === "manual" ? 0 : -1}>
              直接输入总额
            </button>
          </div>

          {mode === "manual" ? (
            <div className="manual-panel" id="mode-manual-panel" role="tabpanel" aria-labelledby="mode-manual-tab" tabIndex={0}>
              <label className="field-label" htmlFor="manual-yuan">柜台确认的应付总邮资</label>
              <div className="money-input-wrap">
                <span>¥</span>
                <input
                  id="manual-yuan"
                  inputMode="decimal"
                  value={manualYuan}
                  onChange={(event) => setManualYuan(event.target.value)}
                  placeholder="0.00"
                  aria-describedby="manual-help"
                />
              </div>
              <p className="field-help" id="manual-help">
                适合 EMS、即日专递、标准快递等营业系统动态报价，也可用于任何已确认可在普遍服务柜台贴票的业务；支持最高 ¥20,000.00。
              </p>
              {manualYuan.trim() && !manualValid && <div className="form-error"><AlertTriangle size={18} /><span>请输入大于 ¥0.00 且不超过 ¥20,000.00 的金额，最多保留两位小数。</span></div>}
              <div className="guardrail-note"><ShieldCheck size={18} /><span>请填柜台显示的最终总额；不要把协议客户产品或线上专线报价搬到普遍服务柜台。</span></div>
            </div>
          ) : (
            <div className="business-panel" id="mode-business-panel" role="tabpanel" aria-labelledby="mode-business-tab" tabIndex={0}>
              <fieldset className="region-fieldset">
                <legend className="field-label">寄递范围</legend>
                <div className="segmented-options">
                  {(Object.keys(REGION_LABELS) as Region[]).map((region) => (
                    <button key={region} className={input.region === region ? "selected" : ""} onClick={() => selectRegion(region)} type="button">
                      {REGION_LABELS[region]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="field-grid">
                <label className="field full-field">
                  <span className="field-label">基础产品</span>
                  <span className="select-wrap">
                    <select value={input.product} onChange={(event) => selectProduct(event.target.value)}>
                      {PRODUCTS[input.region].map((product) => (
                        <option key={product.value} value={product.value}>{product.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={17} aria-hidden="true" />
                  </span>
                </label>

                {isQuoteProduct ? (
                  <label className="field full-field">
                    <span className="field-label">普遍服务柜台本次总价</span>
                    <span className="inline-money-input"><span>¥</span><input type="number" min="0.01" max="20000" step="0.01" value={input.quoteFen ? input.quoteFen / 100 : ""} onChange={(event) => updateInput("quoteFen", Math.round(Number(event.target.value) * 100))} placeholder="例如 23.00" /></span>
                    <small>已包含营业系统列出的服务费、保价或其他本次费用后再填写。</small>
                  </label>
                ) : (
                  <>
                    {!isFixedPieceProduct(input.product) && (
                      <div className="field weight-field">
                        <label className="field-label" htmlFor="actual-weight">实际重量</label>
                        <div className="weight-input-row">
                          <span className="unit-input">
                            <input
                              id="actual-weight"
                              type="text"
                              inputMode={weightUnit === "kg" ? "decimal" : "numeric"}
                              autoComplete="off"
                              value={weightText}
                              onChange={(event) => updateWeightText(event.target.value)}
                              aria-invalid={input.weightG <= 0 || input.weightG > 50_000}
                              aria-describedby="weight-help"
                              placeholder={weightUnit === "kg" ? "例如 1.25" : "例如 20"}
                            />
                            <span>{weightUnit}</span>
                          </span>
                          <span className="weight-unit-switch" role="group" aria-label="重量单位">
                            <button type="button" className={weightUnit === "g" ? "selected" : ""} aria-pressed={weightUnit === "g"} onClick={() => selectWeightUnit("g")}>g</button>
                            <button type="button" className={weightUnit === "kg" ? "selected" : ""} aria-pressed={weightUnit === "kg"} onClick={() => selectWeightUnit("kg")}>kg</button>
                          </span>
                        </div>
                        <small id="weight-help">可清空后重输；物品类默认使用 kg，内部仍按克精确计费。</small>
                      </div>
                    )}

                    {showsDomesticScope && (
                      <label className="field">
                        <span className="field-label">本埠／外埠</span>
                        <span className="select-wrap"><select value={input.local ? "local" : "nonlocal"} onChange={(event) => updateInput("local", event.target.value === "local")}><option value="local">本埠／本县</option><option value="nonlocal">外埠</option></select><ChevronDown size={17} /></span>
                      </label>
                    )}

                    {allowsTransport && (
                      <label className="field">
                        <span className="field-label">运输方式</span>
                        <span className="select-wrap">
                          <select value={input.transport} onChange={(event) => selectTransport(event.target.value as Transport)}>
                            <option value="air">航空</option>
                            {input.region === "international" && input.product !== "aerogram" && <option value="sal">SAL</option>}
                            {input.product !== "aerogram" && <option value="surface">水陆路／非航空</option>}
                          </select>
                          <ChevronDown size={17} />
                        </span>
                      </label>
                    )}

                    {input.region === "domestic" && isParcel && (
                      <>
                        <SelectField label="寄出省级地区" value={input.origin} options={STATIC_POSTAGE_DATA.domesticParcel.provinces} onChange={(value) => updateInput("origin", value)} />
                        <SelectField label="寄达省级地区" value={input.destination} options={STATIC_POSTAGE_DATA.domesticParcel.provinces} onChange={(value) => updateInput("destination", value)} />
                      </>
                    )}

                    {input.region === "hmt" && (
                      <SelectField label="寄达地区" value={input.destination} options={["香港", "澳门", "台湾"]} onChange={(value) => setInput((current) => ({ ...current, destination: value, taiwan: value === "台湾" }))} />
                    )}

                    {input.region === "international" && (
                      <div className="field full-field">
                        <DestinationCombobox
                          options={destinationOptions}
                          selection={internationalDestination}
                          selectedLabel={destinationResolution.label}
                          selectedBadge={destinationResolution.badge}
                          selectedFlag={destinationResolution.flag}
                          onSelect={setInternationalDestination}
                        />
                        <p className={`route-availability-note ${destinationResolution.warning ? "is-warning" : ""}`} aria-live="polite">
                          <Info size={14} aria-hidden="true" />
                          {destinationResolution.warning ?? ROUTE_AVAILABILITY_NOTE}
                        </p>
                      </div>
                    )}

                    {isEms && (
                      <>
                        <fieldset className="field full-field">
                          <legend className="field-label">邮件类型</legend>
                          <div className="small-segments"><button type="button" className={input.contents === "document" ? "selected" : ""} onClick={() => selectContents("document")}>文件</button><button type="button" className={input.contents === "goods" ? "selected" : ""} onClick={() => selectContents("goods")}>物品</button></div>
                        </fieldset>
                      </>
                    )}
                  </>
                )}
              </div>

              {!isQuoteProduct && (allowsRegistered || allowsInsurance) && (
                <fieldset className="extras-fieldset">
                  <legend><span className="field-label">附加业务</span><small>只显示可用于该基础产品的项目</small></legend>
                  <div className="extras-grid">
                    {allowsRegistered && <ExtraCheck label={input.region === "domestic" ? "挂号 · +¥3" : input.product === "mbag" ? "M 袋挂号 · +¥80" : "挂号 · +¥16"} checked={input.registered} onChange={() => toggleExtra("registered")} />}
                    {allowsRegistered && input.region === "domestic" && <ExtraCheck label="约投 · +¥2" checked={input.appointment} onChange={() => toggleExtra("appointment")} />}
                    {allowsRegistered && <ExtraCheck label={`回执 · +${input.region === "international" ? "¥5" : "¥3"}`} checked={input.receipt} disabled={input.region === "hmt" && input.taiwan} onChange={() => toggleExtra("receipt")} />}
                    {allowsInsurance && <ExtraCheck label="保价（条件性）" checked={input.insured} onChange={() => toggleExtra("insured")} />}
                  </div>
                  {input.insured && (
                    <label className="field insured-value"><span className="field-label">声明价值</span><span className="inline-money-input"><span>¥</span><input type="number" min="1" step="1" value={input.insuredValueYuan} onChange={(event) => updateInput("insuredValueYuan", Number(event.target.value))} /></span></label>
                  )}
                </fieldset>
              )}

              {businessResult.ok ? (
                <div className={`calculation-strip evidence-${EVIDENCE[businessResult.evidence].tone}`}>
                  <div><span className="evidence-label">{EVIDENCE[businessResult.evidence].label}</span><strong>{businessResult.title}</strong></div>
                  <span className="strip-arrow"><ArrowRight size={18} /></span>
                  <strong className="calculated-total">{formatYuan(businessResult.totalFen)}</strong>
                </div>
              ) : (
                <div className="form-error"><AlertTriangle size={18} /><span>{businessResult.error}</span></div>
              )}

              {businessResult.ok && showHongKongSurfaceParcelWarning && (
                <div className="form-warning" role="note">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>{businessResult.warning}</span>
                </div>
              )}

              {businessResult.ok && (
                <details className="formula-details">
                  <summary>查看计价依据与拆分 <ChevronDown size={16} /></summary>
                  <div><code>{businessResult.formula}</code>{businessResult.breakdown.map((line) => <span key={line}>{line}</span>)}{businessResult.warning && <p><Info size={15} />{businessResult.warning}</p>}</div>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="calculator-card result-card" aria-busy={solverUpdating}>
          <div className="card-heading result-heading">
            <div>
              <p className="step-kicker">02 · 生成贴票方案</p>
              <h2>{!hasTarget ? "等待邮资" : !solverReady ? "正在后台求解" : stampPlan.status === "exact" ? "正好贴满" : stampPlan.status === "overpay" ? "最小溢价方案" : "库存不足"}</h2>
            </div>
            <span className="result-heading-status">
              {!solverReady && hasTarget ? (
                <LoaderCircle className="solver-spinner" size={25} />
              ) : solverPending && hasTarget ? (
                <span className="solver-update-badge" role="status" aria-live="polite"><LoaderCircle size={13} />更新中</span>
              ) : hasTarget && stampPlan.status !== "insufficient" ? (
                <CheckCircle2 className="result-status-icon" size={27} />
              ) : (
                <PackageCheck className="muted-icon" size={25} />
              )}
            </span>
          </div>

          {!hasTarget ? (
            <div className="empty-result">
              <div className="empty-orbit"><Stamp size={31} /></div>
              <strong>先在左侧确认业务和邮资</strong>
              <p>方案会立即按当前库存重新计算。</p>
            </div>
          ) : !solverReady ? (
            <div className="solver-pending" role="status" aria-live="polite">
              <span className="solver-orbit"><LoaderCircle size={30} /></span>
              <strong>正在计算最优贴法与足量边界</strong>
              <p>页面仍可继续操作；如果你改变金额或库存，旧任务会自动取消。</p>
            </div>
          ) : stampPlan.status === "insufficient" ? (
            <div className="insufficient-result">
              <XCircle size={42} />
              <strong>现有邮票总额不足</strong>
              <p>需要 {formatYuan(targetFen)}，有限库存最多只有 {formatYuan(stampPlan.availableTotalFen ?? 0)}。</p>
              <button type="button" onClick={resetStocks}><RotateCcw size={16} />恢复默认库存</button>
            </div>
          ) : (
            <>
              <div className="amount-summary">
                <div><span>应付邮资</span><strong>{formatYuan(stampPlan.targetFen)}</strong></div>
                <Equal size={22} />
                <div><span>邮票合计</span><strong>{formatYuan(stampPlan.totalFen)}</strong></div>
              </div>

              <div className="plan-meta">
                <span className={stampPlan.overpayFen ? "overpay-badge" : "exact-badge"}>{stampPlan.overpayFen ? `多贴 ${formatYuan(stampPlan.overpayFen)}` : "零溢价"}</span>
                <span>共 {stampPlan.stampCount} 枚</span>
                <span>{solverInWorker ? "后台线程全局最优" : "兼容模式全局最优"}{solverElapsedMs !== null && solverElapsedMs >= 10 ? ` · ${solverElapsedMs < 1000 ? `${Math.round(solverElapsedMs)} ms` : `${(solverElapsedMs / 1000).toFixed(1)} s`}` : ""}</span>
              </div>

              <div className="stamp-plan" aria-label="推荐贴票方案">
                {stampPlan.items.length ? stampPlan.items.map((item) => (
                  <div className="plan-stamp" key={item.fen}>
                    <div className="stamp-edge" aria-hidden="true" />
                    <button
                      type="button"
                      className="reject-stamp-button"
                      onClick={() => rejectDenomination(item.fen)}
                      aria-label={`暂不使用 ${item.label} 面额，并把库存设为零`}
                      title={`暂不使用 ${item.label}`}
                    >
                      <Ban size={16} aria-hidden="true" />
                    </button>
                    <span className="stamp-country">{item.category === "custom" ? "自定义纪特邮票" : item.category === "commemorative" ? "纪特邮票" : "中国邮政"}</span>
                    <strong>{item.label}</strong>
                    <span className="stamp-count">× {item.count}</span>
                    <small>{formatYuan(item.subtotalFen)}</small>
                  </div>
                )) : (
                  <div className="no-stamps-needed"><Check size={24} /><strong>基础资费为零，无需贴票</strong></div>
                )}
              </div>

              <p className="plan-reject-hint"><Ban size={14} />不想使用某种票？点票面右上角的禁止符号，该面额库存会立即清零并重新计算。</p>

              <button type="button" className="copy-button" onClick={copyPlan} disabled={solverUpdating || !stampPlan.items.length}>
                {copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "已复制" : "复制贴法"}
              </button>
              <p className="result-footnote"><Info size={14} />2.8 元纪特票默认足量；8 元纪特票与 5 分普通邮票默认停用；自定义面额会正常参与最优解。</p>
            </>
          )}
        </div>
      </section>

      <section className="inventory-section" id="inventory">
        <div className="section-heading-row">
          <div>
            <p className="step-kicker">03 · 告诉助手你手上有什么</p>
            <h2>邮票库存</h2>
            <p>少量时逐枚调节；达到当前场景的精确边界后，自动折叠为“足量”。</p>
          </div>
          <div className="inventory-actions">
            <button className="secondary-button" type="button" onClick={resetStocks}><RotateCcw size={16} />恢复默认库存</button>
            <button className="clear-inventory-button" type="button" onClick={clearAllStocks}><Trash2 size={16} />全部设为用完</button>
          </div>
        </div>

        <div className="inventory-explainer">
          <Sparkles size={18} />
          <p><strong>“足量”不是固定的 10 枚。</strong>助手会把某面额单独视为无限库存并重新求一次最优解；新最优解实际需要的枚数，就是该面额在当前邮资与其他库存下的足量边界。{solverPending && hasTarget ? " 当前边界正在后台更新。" : ""}</p>
        </div>

        <form className="custom-stamp-panel" onSubmit={addCustomStamp}>
          <div className="custom-stamp-copy">
            <span className="custom-stamp-icon"><Stamp size={20} /></span>
            <div>
              <h3>添加自定义纪特邮票</h3>
              <p id="custom-stamp-help">输入 0.01–200 元，最多两位小数；最多保存 {MAX_CUSTOM_STAMPS} 种，添加后默认足量并立即参与计算。</p>
            </div>
          </div>
          <div className="custom-stamp-form-row">
            <label htmlFor="custom-stamp-yuan">自定义面额</label>
            <div className="custom-stamp-input">
              <span aria-hidden="true">¥</span>
              <input
                id="custom-stamp-yuan"
                name="custom-stamp-yuan"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="例如 2.30"
                value={customYuan}
                onChange={(event) => {
                  setCustomYuan(event.target.value);
                  setCustomFeedback(null);
                }}
                aria-describedby="custom-stamp-help custom-stamp-feedback"
              />
              <span aria-hidden="true">元</span>
            </div>
            <button type="submit"><Plus size={17} />添加并设为足量</button>
          </div>
          <p
            className={`custom-stamp-feedback ${customFeedback?.tone === "error" ? "is-error" : ""}`}
            id="custom-stamp-feedback"
            role={customFeedback?.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {customFeedback?.text ?? `已添加 ${customStamps.length} 种自定义面额`}
          </p>
        </form>

        <div className="inventory-grid">
          {denominations.map((stamp, index) => {
            const stock = stocks[index];
            const threshold = thresholds[index] ?? 1;
            const categoryLabel = stamp.category === "custom"
              ? "自定义纪特邮票"
              : stamp.category === "commemorative"
                ? `纪特邮票 · ${stamp.defaultStock === 0 ? "默认停用" : "默认足量"}`
                : stamp.defaultStock === 0
                  ? "普通邮票 · 默认停用"
                  : "普通邮票";
            return (
              <article className={`inventory-card ${stock === 0 ? "is-empty" : ""} ${stamp.category === "commemorative" ? "is-commemorative" : ""} ${stamp.category === "custom" ? "is-custom" : ""}`} key={stamp.fen}>
                <div className="inventory-denom"><span>{categoryLabel}</span><strong>{stamp.label}</strong></div>
                <div className="inventory-controls">
                  <button type="button" onClick={() => decrementStock(index)} aria-label={`减少 ${stamp.label} 库存`} title="减少一枚"><Minus size={15} /></button>
                  <div className="stock-value"><strong>{stock === null ? "足量" : stock}</strong><span>{stock === null ? `≥ ${threshold} 枚` : "枚"}</span></div>
                  <button type="button" onClick={() => incrementStock(index)} disabled={stock === null} aria-label={`增加 ${stamp.label} 库存`} title={stock === null ? "当前已足量" : "增加一枚"}><Plus size={15} /></button>
                </div>
                <div className="inventory-card-footer">
                  <span>{stock === 0 ? "已用完／已停用" : stock === null ? "不会限制本次最优解" : stock >= threshold ? "本次已足量" : `再有 ${threshold - stock} 枚即足量`}</span>
                  <div className="inventory-card-actions">
                    {stock !== 0 && <button className="stock-clear-button" type="button" onClick={() => setStock(stamp.fen, 0)}>设为用完</button>}
                    {stock !== null && <button type="button" onClick={() => setStock(stamp.fen, null)}>{stock === 0 ? "启用并设为足量" : "设为足量"}</button>}
                    {stamp.category === "custom" && <button className="remove-custom-stamp" type="button" onClick={() => removeCustomStamp(stamp.fen)} aria-label={`移除 ${stamp.label} 自定义纪特邮票`}><Trash2 size={13} />移除</button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="storage-note"><ShieldCheck size={15} />本机邮票档案会同时保存在浏览器数据库、本地存储与长效 Cookie 中，不会上传；清除站点数据、更换浏览器或更换域名仍会丢失。</p>
      </section>

      <section className="scope-section" id="scope">
        <div className="scope-intro">
          <p className="step-kicker">严格按柜台可贴票边界筛选</p>
          <h2>能查到价格，不等于能拿邮票办理。</h2>
          <p>计算器只把“可在中国邮政普遍服务柜台受理并允许贴票”作为入口条件。独立渠道、协议代码和线上专线，即使同属邮政体系，也不会拿来凑邮票。</p>
        </div>
        <div className="scope-grid">
          <article className="scope-card allowed-card">
            <div className="scope-card-icon"><CheckCircle2 size={22} /></div>
            <p className="scope-label">纳入</p>
            <h3>普遍服务柜台可受理</h3>
            <ul>
              <li>信函、明信片、印刷品与合法附加业务</li>
              <li>国内、港澳台及国际普通包裹</li>
              <li>EMS、即日专递、标准快递等柜台本次报价</li>
              <li>合资格的盲人邮件与免费邮件</li>
            </ul>
          </article>
          <article className="scope-card excluded-card">
            <div className="scope-card-icon"><XCircle size={22} /></div>
            <p className="scope-label">排除</p>
            <h3>不能在普遍柜台靠贴票办理</h3>
            <ul>
              <li>e 邮宝、e 特快等独立渠道产品</li>
              <li>协议客户代码、线上专线与平台专享价</li>
              <li>2026 年起停办的物品类国际挂号邮件</li>
              <li>“小包基础价 +16 元”伪造的挂号组合</li>
            </ul>
          </article>
          <article className="scope-card rule-card">
            <div className="scope-card-icon"><AlertTriangle size={22} /></div>
            <p className="scope-label">防重复</p>
            <h3>已有给据属性就不再叠加</h3>
            <ul>
              <li>EMS／包裹不再加函件挂号费</li>
              <li>保价函件费用已含挂号与处理构成</li>
              <li>航空、SAL、水陆路只能三选一</li>
              <li>台湾给据函件不能办理回执</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="algorithm-section">
        <div>
          <p className="step-kicker">算法承诺</p>
          <h2>不是贪心，是可验证的全局最优。</h2>
        </div>
        <ol className="priority-list">
          <li><span>1</span><div><strong>先找最低可付总额</strong><p>若能精确贴满，总额就是应付邮资；否则只向上寻找，不允许欠资。</p></div></li>
          <li><span>2</span><div><strong>再让邮票枚数最少</strong><p>在相同总额下求最少枚数，不会被“先拿大面额”的局部贪心误导。</p></div></li>
          <li><span>3</span><div><strong>每次库存变化都重算</strong><p>有限库存采用有界动态规划；金额全程使用整数分，避免小数误差。</p></div></li>
        </ol>
      </section>

      <section className="sources-section" id="sources">
        <div>
          <p className="step-kicker">可追溯数据</p>
          <h2>资费来源与时点</h2>
          <p>稳定公开价直接计算；普通包裹标作上限；市场产品与旧附件数据始终保留醒目标记。</p>
        </div>
        <div className="source-links">
          <SourceLink href="https://www.chinapost.com.cn/cn/report/2605/7535-1.html" title="国内邮件（函件）资费简表" meta="中国邮政 · 2026-05-22 现行表" />
          <SourceLink href="https://www.ndrc.gov.cn/xxgk/zcfb/ghxwj/201704/t20170412_960915.html" title="普通包裹资费体系" meta="国家发展改革委 · 指导价上限" />
          <SourceLink href="https://www.chinapost.com.cn/html1/report/19101/1784-1.htm" title="港澳台函件资费表" meta="中国邮政 · 公开价" />
          <SourceLink href="https://www.chinapost.com.cn/html1/report/19101/1959-1.htm" title="国际函件资费表" meta="中国邮政 · 航空／SAL／水陆路" />
          <SourceLink href="https://my.ems.com.cn/pcp-web/intl/shipping/product/product_1.html" title="国际及港澳台 EMS" meta="中国邮政 EMS · 分区／限重／计泡" />
          <SourceLink href="https://my.ems.com.cn/pcp-web/f/pcp/indexController/tonoticeindex?ntificationId=ed1b26214e87131cf95e4230426c7801" title="物品类国际挂号停办公告" meta="中国邮政 EMS · 2026-01-01 生效" />
          <div className="source-note-card">
            <span><strong>国际邮路开通状态</strong><small>第三方参考快照 · 截至 2025-11</small></span>
            <p>航空除朝鲜邮路不稳定外，其余所列地区开通；SAL 与水陆路仅开放名单内目的地。状态可能变化，收寄当日以营业系统或柜台查询为准。</p>
          </div>
        </div>
      </section>

      <footer>
        <div><strong>贴票助手</strong><span>静态、离线优先、无账号</span></div>
        <p>结果用于备票与柜台沟通；市场产品、参考价和条件性费用以收寄当日营业系统为准。</p>
        <a href="#top">回到顶部 ↑</a>
      </footer>
    </main>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabel?: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{optionLabel ? optionLabel(option) : option}</option>)}</select>
        <ChevronDown size={17} aria-hidden="true" />
      </span>
    </label>
  );
}

function ExtraCheck({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <label className={`extra-check ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="custom-check">{checked && <Check size={13} />}</span>
      <span>{label}</span>
    </label>
  );
}

function SourceLink({ href, title, meta }: { href: string; title: string; meta: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <span><strong>{title}</strong><small>{meta}</small></span>
      <ArrowRight size={17} aria-hidden="true" />
    </a>
  );
}
