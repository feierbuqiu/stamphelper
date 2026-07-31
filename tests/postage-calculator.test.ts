import assert from "node:assert/strict";
import test from "node:test";
import { calculatePostage, PRODUCTS, type PostageInput } from "../lib/postage-calculator";

const base: PostageInput = {
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

test("calculates a 101 g non-local registered letter with receipt", () => {
  const result = calculatePostage({ ...base, weightG: 101, registered: true, receipt: true });
  assert.equal(result.ok, true);
  assert.equal(result.totalFen, 1400);
});

test("matches the China Post domestic letter tariff table published on 2026-05-22", () => {
  assert.equal(calculatePostage({ ...base, local: true, weightG: 100 }).totalFen, 400);
  assert.equal(calculatePostage({ ...base, local: false, weightG: 100 }).totalFen, 600);
  assert.equal(calculatePostage({ ...base, local: true, weightG: 101 }).totalFen, 520);
  assert.equal(calculatePostage({ ...base, local: false, weightG: 101 }).totalFen, 800);
  assert.equal(calculatePostage({ ...base, local: true, weightG: 2000 }).totalFen, 2680);
  assert.equal(calculatePostage({ ...base, local: false, weightG: 2000 }).totalFen, 4400);

  assert.equal(calculatePostage({ ...base, product: "postcard", weightG: 1 }).totalFen, 80);
  assert.equal(calculatePostage({ ...base, product: "mailgram", local: true, weightG: 1 }).totalFen, 80);
  assert.equal(calculatePostage({ ...base, product: "mailgram", local: false, weightG: 1 }).totalFen, 120);
  assert.equal(calculatePostage({ ...base, product: "printed", local: true, weightG: 101 }).totalFen, 100);
  assert.equal(calculatePostage({ ...base, product: "printed", local: false, weightG: 101 }).totalFen, 160);
});

test("calculates the Beijing to Xinjiang 10 kg parcel ceiling", () => {
  const result = calculatePostage({ ...base, product: "parcel", contents: "goods", weightG: 10000, origin: "北京", destination: "新疆" });
  assert.equal(result.ok, true);
  assert.equal(result.totalFen, 5500);
  assert.equal(result.evidence, "B");
});

test("blocks Taiwan receipt and the discontinued goods registration combination", () => {
  const taiwan = calculatePostage({ ...base, region: "hmt", product: "letter", destination: "台湾", taiwan: true, weightG: 45, registered: true, receipt: true });
  assert.equal(taiwan.ok, false);
  assert.match(taiwan.error ?? "", /台湾路向不办理回执/);

  const packet = calculatePostage({ ...base, region: "international", product: "smallPacket", contents: "goods", weightG: 300, registered: true });
  assert.equal(packet.ok, false);
  assert.match(packet.error ?? "", /2026-01-01/);
});

test("reproduces the published Japan letter and US EMS examples", () => {
  const japan = calculatePostage({ ...base, region: "international", product: "letter", weightG: 25, zone: 1, registered: true, receipt: true });
  assert.equal(japan.totalFen, 2700);

  const usa = calculatePostage({ ...base, region: "international", product: "ems", weightG: 750, zone: 5, contents: "document" });
  assert.equal(usa.totalFen, 39500);
});

test("keeps exact kilogram-to-gram estimates instead of discarding a decimal fraction", () => {
  const atHalfKilogram = calculatePostage({
    ...base,
    region: "international",
    product: "ems",
    contents: "document",
    zone: 2,
    weightG: 500,
  });
  const atPointFiveFiveKilograms = calculatePostage({
    ...base,
    region: "international",
    product: "ems",
    contents: "document",
    zone: 2,
    weightG: 550,
  });
  assert.equal(atHalfKilogram.totalFen, 11500);
  assert.equal(atPointFiveFiveKilograms.totalFen, 15500);
});

test("retains the Hong Kong surface-parcel reference rate but marks it as unquoted by 11185", () => {
  const result = calculatePostage({
    ...base,
    region: "hmt",
    product: "parcel",
    contents: "goods",
    destination: "香港",
    transport: "surface",
    weightG: 1000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.totalFen, 6070);
  assert.match(result.warning ?? "", /11185 目前不提供香港水陆路包裹预估报价/);
});

test("keeps excluded channel products out of every business picker", () => {
  const labels = Object.values(PRODUCTS).flat().map((product) => `${product.value} ${product.label}`).join("\n");
  assert.doesNotMatch(labels, /e\s*邮宝|e\s*特快|ePacket|eExpress/i);
  assert.doesNotMatch(labels, /回音卡|replyCard/i);
});
