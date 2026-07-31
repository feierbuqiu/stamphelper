import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the completed Chinese calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-CN"/i);
  assert.match(html, /<title>贴票助手/);
  assert.match(html, /按业务计算/);
  assert.match(html, /17 种普通面额 \+ 纪特与自定义票/);
  assert.match(html, /添加自定义纪特邮票/);
  assert.match(html, /跟随系统/);
  assert.match(html, /role="tab"[^>]+aria-controls="mode-business-panel"/);
  assert.match(html, /role="tabpanel"[^>]+aria-labelledby="mode-business-tab"/);
  assert.match(html, /物品类默认使用 kg/);
  assert.match(html, /第三方参考快照/);
  assert.match(html, /全部设为用完/);
  assert.match(html, /邮票库存/);
  assert.match(html, /不是贪心，是可验证的全局最优/);
  assert.match(html, /e 邮宝、e 特快等独立渠道产品/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
  assert.doesNotMatch(html, /value="(?:ePacket|eExpress|e邮宝|e特快)"/i);
});

test("generated static data has all validated route dimensions", async () => {
  const data = JSON.parse(await readFile(new URL("../app/postage-data.json", import.meta.url), "utf8"));
  assert.equal(data.stampDenominations.length, 19);
  assert.equal(data.stampDenominations.filter((stamp) => stamp.category === "ordinary").length, 17);
  assert.deepEqual(
    data.stampDenominations.find((stamp) => stamp.fen === 800),
    { fen: 800, label: "8元", category: "commemorative", defaultStock: 0 },
  );
  assert.deepEqual(
    data.stampDenominations.find((stamp) => stamp.fen === 280),
    { fen: 280, label: "2.8元", category: "commemorative", defaultStock: null },
  );
  assert.deepEqual(
    data.stampDenominations.find((stamp) => stamp.fen === 5),
    { fen: 5, label: "5分", category: "ordinary", defaultStock: 0 },
  );
  assert.equal(data.domesticParcel.provinces.length, 31);
  assert.equal(Object.keys(data.domesticParcel.matrix).length, 31);
  assert.equal(data.internationalParcels.air.length, 230);
  assert.equal(data.internationalParcels.surface.length, 134);
  assert.equal(data.internationalParcels.sal.length, 116);
});
