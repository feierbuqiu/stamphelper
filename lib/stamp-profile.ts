import type { StampDenomination, StampStock } from "./stamp-solver";

export const STAMP_PROFILE_STORAGE_KEY = "tie-piao-profile-v3";
const LEGACY_STAMP_PROFILE_COOKIE_KEY = "tie_piao_profile_v3";

const LEGACY_V2_STORAGE_KEY = "tie-piao-stocks-v2";
const LEGACY_V1_STORAGE_KEY = "tie-piao-stocks-v1";
const PROFILE_DATABASE_NAME = "tie-piao-assistant";
const PROFILE_STORE_NAME = "device-profile";
const PROFILE_RECORD_KEY = "current";
const MAX_STORED_CUSTOM_RECORDS_TO_SCAN = 100;
export const MAX_CUSTOM_STAMPS = 20;
export const MAX_FINITE_STAMP_STOCK = 2_000_000;

const LEGACY_V2_FEN = [800, 600, 540, 500, 450, 420, 300, 200, 150, 120, 100, 80, 60, 50, 40, 30, 10, 5];
const LEGACY_V1_FEN = [600, 540, 500, 450, 420, 300, 200, 150, 120, 100, 80, 60, 50, 40, 30, 10, 5];

type StoredCustomStamp = {
  fen: number;
  stock: StampStock;
};

export type ThemePreference = "system" | "light" | "dark";

export type StoredStampProfile = {
  version: 3;
  deviceId: string;
  updatedAt: number;
  builtInStocks: Record<string, StampStock>;
  customStamps: StoredCustomStamp[];
  theme: ThemePreference;
};

export type RestoredStampProfile = {
  deviceId: string;
  updatedAt: number;
  stocksByFen: Record<string, StampStock>;
  customStamps: StampDenomination[];
  theme: ThemePreference;
};

export function isStampStock(value: unknown): value is StampStock {
  return value === null || (
    Number.isInteger(value)
    && Number(value) >= 0
    && Number(value) <= MAX_FINITE_STAMP_STOCK
  );
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function formatStampLabel(fen: number): string {
  if (fen < 100) return `${fen}分`;
  return `${Number((fen / 100).toFixed(2))}元`;
}

export function parseCustomStampFen(value: string): number | null {
  const normalized = value.trim().replace(/[¥￥,，\s]/g, "");
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const fen = Math.round(Number(normalized) * 100);
  return Number.isInteger(fen) && fen >= 1 && fen <= 20_000 ? fen : null;
}

function defaultStock(stamp: StampDenomination): StampStock {
  return stamp.defaultStock === undefined ? null : stamp.defaultStock;
}

export function createDefaultStockRecord(
  denominations: StampDenomination[],
): Record<string, StampStock> {
  return Object.fromEntries(denominations.map((stamp) => [String(stamp.fen), defaultStock(stamp)]));
}

export function createDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizeStoredProfile(
  value: unknown,
  builtInDenominations: StampDenomination[],
): RestoredStampProfile | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StoredStampProfile>;
  if (
    candidate.version !== 3
    || typeof candidate.deviceId !== "string"
    || candidate.deviceId.length < 8
    || candidate.deviceId.length > 120
    || !Number.isFinite(candidate.updatedAt)
    || !candidate.builtInStocks
    || typeof candidate.builtInStocks !== "object"
    || !Array.isArray(candidate.customStamps)
  ) {
    return null;
  }

  const stocksByFen = createDefaultStockRecord(builtInDenominations);
  const builtInFen = new Set(builtInDenominations.map((stamp) => stamp.fen));
  for (const stamp of builtInDenominations) {
    const saved = candidate.builtInStocks[String(stamp.fen)];
    if (isStampStock(saved)) stocksByFen[String(stamp.fen)] = saved;
  }

  const customStamps: StampDenomination[] = [];
  const seen = new Set(builtInFen);
  for (const rawStamp of candidate.customStamps.slice(0, MAX_STORED_CUSTOM_RECORDS_TO_SCAN)) {
    if (customStamps.length >= MAX_CUSTOM_STAMPS) break;
    if (!rawStamp || typeof rawStamp !== "object") continue;
    const fen = Number((rawStamp as StoredCustomStamp).fen);
    const stock = (rawStamp as StoredCustomStamp).stock;
    if (!Number.isInteger(fen) || fen < 1 || fen > 20_000 || seen.has(fen) || !isStampStock(stock)) continue;
    seen.add(fen);
    customStamps.push({
      fen,
      label: formatStampLabel(fen),
      category: "custom",
      defaultStock: null,
    });
    stocksByFen[String(fen)] = stock;
  }

  customStamps.sort((left, right) => right.fen - left.fen);
  return {
    deviceId: candidate.deviceId,
    updatedAt: Number(candidate.updatedAt),
    stocksByFen,
    customStamps,
    theme: normalizeThemePreference(candidate.theme),
  };
}

export function migrateLegacyStockArray(
  value: unknown,
  version: 1 | 2,
  builtInDenominations: StampDenomination[],
  deviceId = createDeviceId(),
): RestoredStampProfile | null {
  const legacyFen = version === 2 ? LEGACY_V2_FEN : LEGACY_V1_FEN;
  if (!Array.isArray(value) || value.length !== legacyFen.length || !value.every(isStampStock)) return null;

  const stocksByFen = createDefaultStockRecord(builtInDenominations);
  legacyFen.forEach((fen, index) => {
    // Five-fen stock used to default to unlimited, so the v3 migration applies
    // the new product default instead of carrying that indistinguishable value.
    if (fen !== 5 && String(fen) in stocksByFen) stocksByFen[String(fen)] = value[index];
  });
  return { deviceId, updatedAt: 0, stocksByFen, customStamps: [], theme: "system" };
}

export function createStoredProfile(
  deviceId: string,
  builtInDenominations: StampDenomination[],
  customStamps: StampDenomination[],
  stocksByFen: Record<string, StampStock>,
  updatedAt = Date.now(),
  theme: ThemePreference = "system",
): StoredStampProfile {
  const builtInStocks = Object.fromEntries(
    builtInDenominations.map((stamp) => [
      String(stamp.fen),
      isStampStock(stocksByFen[String(stamp.fen)])
        ? stocksByFen[String(stamp.fen)]
        : defaultStock(stamp),
    ]),
  );
  return {
    version: 3,
    deviceId,
    updatedAt,
    builtInStocks,
    theme,
    customStamps: customStamps.slice(0, MAX_CUSTOM_STAMPS).map((stamp) => ({
      fen: stamp.fen,
      stock: isStampStock(stocksByFen[String(stamp.fen)]) ? stocksByFen[String(stamp.fen)] : null,
    })),
  };
}

function readJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readLegacyProfileCookie(): unknown {
  const prefix = `${LEGACY_STAMP_PROFILE_COOKIE_KEY}=`;
  const raw = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!raw) return null;
  try {
    return readJson(decodeURIComponent(raw.slice(prefix.length)));
  } catch {
    return null;
  }
}

function clearLegacyProfileCookie(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LEGACY_STAMP_PROFILE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function openProfileDatabase(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(PROFILE_DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROFILE_STORE_NAME)) database.createObjectStore(PROFILE_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIndexedProfile(): Promise<unknown> {
  const database = await openProfileDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(PROFILE_STORE_NAME, "readonly");
      const request = transaction.objectStore(PROFILE_STORE_NAME).get(PROFILE_RECORD_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
    } catch {
      database.close();
      resolve(null);
    }
  });
}

async function writeIndexedProfile(profile: StoredStampProfile): Promise<void> {
  const database = await openProfileDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(PROFILE_STORE_NAME, "readwrite");
      transaction.objectStore(PROFILE_STORE_NAME).put(profile, PROFILE_RECORD_KEY);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        resolve();
      };
      transaction.onabort = () => {
        database.close();
        resolve();
      };
    } catch {
      database.close();
      resolve();
    }
  });
}

export async function loadStampProfile(
  builtInDenominations: StampDenomination[],
): Promise<RestoredStampProfile> {
  const candidates: RestoredStampProfile[] = [];
  try {
    const local = normalizeStoredProfile(readJson(window.localStorage.getItem(STAMP_PROFILE_STORAGE_KEY)), builtInDenominations);
    if (local) candidates.push(local);
  } catch {
    // Browser storage can be disabled independently.
  }

  try {
    const cookie = normalizeStoredProfile(readLegacyProfileCookie(), builtInDenominations);
    if (cookie) candidates.push(cookie);
  } catch {
    // Cookie access can be disabled independently of the other stores.
  }
  try {
    // v3 originally duplicated the profile into a long-lived root cookie. Migrate
    // it once, then remove it so preferences are never attached to asset requests.
    clearLegacyProfileCookie();
  } catch {
    // A blocked cookie must not prevent localStorage or IndexedDB restoration.
  }
  const indexed = normalizeStoredProfile(await readIndexedProfile(), builtInDenominations);
  if (indexed) candidates.push(indexed);
  if (candidates.length) return candidates.sort((left, right) => right.updatedAt - left.updatedAt)[0];

  try {
    const legacyV2 = migrateLegacyStockArray(
      readJson(window.localStorage.getItem(LEGACY_V2_STORAGE_KEY)),
      2,
      builtInDenominations,
    );
    if (legacyV2) return legacyV2;
    const legacyV1 = migrateLegacyStockArray(
      readJson(window.localStorage.getItem(LEGACY_V1_STORAGE_KEY)),
      1,
      builtInDenominations,
    );
    if (legacyV1) return legacyV1;
  } catch {
    // Fall through to a fresh device-local profile.
  }

  return {
    deviceId: createDeviceId(),
    updatedAt: 0,
    stocksByFen: createDefaultStockRecord(builtInDenominations),
    customStamps: [],
    theme: "system",
  };
}

export async function persistStampProfile(profile: StoredStampProfile): Promise<void> {
  try {
    window.localStorage.setItem(STAMP_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // The IndexedDB copy can still succeed.
  }
  await writeIndexedProfile(profile);
}
