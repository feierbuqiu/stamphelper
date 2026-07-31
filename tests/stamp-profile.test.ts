import assert from "node:assert/strict";
import test from "node:test";
import {
  createStoredProfile,
  formatStampLabel,
  isStampStock,
  MAX_CUSTOM_STAMPS,
  MAX_FINITE_STAMP_STOCK,
  migrateLegacyStockArray,
  normalizeStoredProfile,
  parseCustomStampFen,
} from "../lib/stamp-profile";
import type { StampDenomination } from "../lib/stamp-solver";

const builtIns: StampDenomination[] = [
  { fen: 800, label: "8元", category: "commemorative", defaultStock: 0 },
  { fen: 280, label: "2.8元", category: "commemorative", defaultStock: null },
  { fen: 120, label: "1.2元", category: "ordinary", defaultStock: null },
  { fen: 5, label: "5分", category: "ordinary", defaultStock: 0 },
];

test("accepts only custom denominations from one fen through 200 yuan", () => {
  assert.equal(parseCustomStampFen("0.01"), 1);
  assert.equal(parseCustomStampFen(".5"), 50);
  assert.equal(parseCustomStampFen("2.80"), 280);
  assert.equal(parseCustomStampFen("200"), 20_000);
  assert.equal(parseCustomStampFen("0"), null);
  assert.equal(parseCustomStampFen("200.01"), null);
  assert.equal(parseCustomStampFen("1.234"), null);
  assert.equal(formatStampLabel(1), "1分");
  assert.equal(formatStampLabel(280), "2.8元");
});

test("round-trips a custom commemorative stamp and its stock", () => {
  const custom: StampDenomination[] = [
    { fen: 230, label: "2.3元", category: "custom", defaultStock: null },
  ];
  const stored = createStoredProfile(
    "device-profile-test",
    builtIns,
    custom,
    { "800": 0, "280": null, "120": 3, "5": 0, "230": 2 },
    1234,
    "dark",
  );
  const restored = normalizeStoredProfile(stored, builtIns);

  assert.ok(restored);
  assert.equal(restored.deviceId, "device-profile-test");
  assert.equal(restored.updatedAt, 1234);
  assert.equal(restored.theme, "dark");
  assert.equal(restored.stocksByFen["230"], 2);
  assert.deepEqual(restored.customStamps, [
    { fen: 230, label: "2.3元", category: "custom", defaultStock: null },
  ]);
});

test("filters invalid or duplicate saved custom denominations", () => {
  const restored = normalizeStoredProfile({
    version: 3,
    deviceId: "device-profile-test",
    updatedAt: 1234,
    builtInStocks: { "800": 0, "280": null, "120": null, "5": 0 },
    customStamps: [
      { fen: 230, stock: null },
      { fen: 230, stock: 2 },
      { fen: 280, stock: null },
      { fen: 20_001, stock: null },
    ],
  }, builtIns);

  assert.ok(restored);
  assert.equal(restored.customStamps.length, 1);
  assert.equal(restored.customStamps[0].fen, 230);
  assert.equal(restored.theme, "system");
});

test("bounds untrusted device-local profile data before it reaches the solver", () => {
  assert.equal(isStampStock(MAX_FINITE_STAMP_STOCK), true);
  assert.equal(isStampStock(MAX_FINITE_STAMP_STOCK + 1), false);
  const restored = normalizeStoredProfile({
    version: 3,
    deviceId: "device-profile-test",
    updatedAt: 1234,
    builtInStocks: { "120": MAX_FINITE_STAMP_STOCK + 1 },
    customStamps: Array.from({ length: MAX_CUSTOM_STAMPS + 8 }, (_, index) => ({
      fen: 1_000 + index,
      stock: null,
    })),
  }, builtIns);

  assert.ok(restored);
  assert.equal(restored.customStamps.length, MAX_CUSTOM_STAMPS);
  assert.equal(restored.stocksByFen["120"], null);
});

test("applies the new five-fen default while migrating v2 stock arrays", () => {
  const fullBuiltIns: StampDenomination[] = [
    { fen: 800, label: "8元", category: "commemorative", defaultStock: 0 },
    { fen: 600, label: "6元", category: "ordinary", defaultStock: null },
    { fen: 540, label: "5.4元", category: "ordinary", defaultStock: null },
    { fen: 500, label: "5元", category: "ordinary", defaultStock: null },
    { fen: 450, label: "4.5元", category: "ordinary", defaultStock: null },
    { fen: 420, label: "4.2元", category: "ordinary", defaultStock: null },
    { fen: 300, label: "3元", category: "ordinary", defaultStock: null },
    { fen: 280, label: "2.8元", category: "commemorative", defaultStock: null },
    { fen: 200, label: "2元", category: "ordinary", defaultStock: null },
    { fen: 150, label: "1.5元", category: "ordinary", defaultStock: null },
    { fen: 120, label: "1.2元", category: "ordinary", defaultStock: null },
    { fen: 100, label: "1元", category: "ordinary", defaultStock: null },
    { fen: 80, label: "80分", category: "ordinary", defaultStock: null },
    { fen: 60, label: "60分", category: "ordinary", defaultStock: null },
    { fen: 50, label: "50分", category: "ordinary", defaultStock: null },
    { fen: 40, label: "40分", category: "ordinary", defaultStock: null },
    { fen: 30, label: "30分", category: "ordinary", defaultStock: null },
    { fen: 10, label: "10分", category: "ordinary", defaultStock: null },
    { fen: 5, label: "5分", category: "ordinary", defaultStock: 0 },
  ];
  const legacy = Array.from({ length: 18 }, () => null);
  legacy[0] = 0;
  const migrated = migrateLegacyStockArray(legacy, 2, fullBuiltIns, "device-profile-test");

  assert.ok(migrated);
  assert.equal(migrated.stocksByFen["800"], 0);
  assert.equal(migrated.stocksByFen["280"], null);
  assert.equal(migrated.stocksByFen["5"], 0);
  assert.equal(migrated.theme, "system");
});
