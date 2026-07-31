import assert from "node:assert/strict";
import test from "node:test";
import { clearStampPlanCache, deriveAmpleThresholds, solveStampPlan } from "../lib/stamp-solver";

const stamps = [
  { fen: 600, label: "6元" },
  { fen: 120, label: "1.2元" },
  { fen: 80, label: "80分" },
  { fen: 5, label: "5分" },
];

test("prefers an exact plan and minimizes stamp count", () => {
  const plan = solveStampPlan(680, stamps, [null, null, null, null]);
  assert.equal(plan.status, "exact");
  assert.equal(plan.totalFen, 680);
  assert.equal(plan.stampCount, 2);
  assert.deepEqual(plan.counts, [1, 0, 1, 0]);
});

test("minimizes overpayment before stamp count", () => {
  const plan = solveStampPlan(683, stamps, [null, null, null, null]);
  assert.equal(plan.status, "overpay");
  assert.equal(plan.totalFen, 685);
  assert.equal(plan.overpayFen, 2);
  assert.equal(plan.stampCount, 3);
});

test("honors bounded stock and reports an insufficient total", () => {
  const plan = solveStampPlan(1200, stamps, [1, 4, 0, 0]);
  assert.equal(plan.status, "insufficient");
  assert.equal(plan.availableTotalFen, 1080);
});

test("derives conditional ample boundaries from the optimal plans", () => {
  const thresholds = deriveAmpleThresholds(680, stamps, [null, null, null, null]);
  assert.deepEqual(thresholds, [1, 1, 1, 1]);

  const constrained = deriveAmpleThresholds(680, stamps, [0, null, null, null]);
  assert.equal(constrained[1], 5);
  assert.equal(constrained[2], 1);
});

test("treats the optional 8 yuan commemorative stamp as a normal bounded denomination", () => {
  const optional = [
    { fen: 800, label: "8元", category: "commemorative" as const, defaultStock: 0 },
    { fen: 300, label: "3元", category: "ordinary" as const, defaultStock: null },
  ];

  const disabled = solveStampPlan(1600, optional, [0, null]);
  assert.equal(disabled.totalFen, 1800);
  assert.deepEqual(disabled.counts, [0, 6]);

  const enabled = solveStampPlan(1600, optional, [null, null]);
  assert.equal(enabled.status, "exact");
  assert.equal(enabled.stampCount, 2);
  assert.deepEqual(enabled.counts, [2, 0]);
});

test("uses built-in 2.8 yuan and custom commemorative denominations normally", () => {
  const extended = [
    { fen: 280, label: "2.8元", category: "commemorative" as const, defaultStock: null },
    { fen: 230, label: "2.3元", category: "custom" as const, defaultStock: null },
    { fen: 5, label: "5分", category: "ordinary" as const, defaultStock: 0 },
  ];

  const plan = solveStampPlan(510, extended, [null, null, 0]);
  assert.equal(plan.status, "exact");
  assert.equal(plan.stampCount, 2);
  assert.deepEqual(plan.counts, [1, 1, 0]);
  assert.equal(plan.items[1].category, "custom");
});

test("matches exhaustive search for deterministic bounded cases", () => {
  const denominations = [1, 3, 4, 7].map((fen) => ({ fen, label: String(fen) }));
  let seed = 0x51f15e;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };

  function brute(target: number, stocks: (number | null)[]) {
    let best: { total: number; count: number } | null = null;
    const maxValue = Math.max(...denominations.map((stamp) => stamp.fen));
    const visit = (index: number, total: number, count: number) => {
      if (index === denominations.length) {
        if (total >= target && (!best || total < best.total || (total === best.total && count < best.count))) {
          best = { total, count };
        }
        return;
      }
      const cap = stocks[index] ?? Math.ceil((target + maxValue - 1) / denominations[index].fen);
      for (let used = 0; used <= cap; used += 1) {
        const nextTotal = total + used * denominations[index].fen;
        if (best && nextTotal > best.total) break;
        visit(index + 1, nextTotal, count + used);
      }
    };
    visit(0, 0, 0);
    return best;
  }

  for (let target = 1; target <= 80; target += 1) {
    for (let sample = 0; sample < 24; sample += 1) {
      const stocks = denominations.map(() => (random() < 0.2 ? null : Math.floor(random() * 5)));
      clearStampPlanCache();
      const actual = solveStampPlan(target, denominations, stocks);
      const expected = brute(target, stocks);
      if (!expected) {
        assert.equal(actual.status, "insufficient");
      } else {
        assert.equal(actual.totalFen, expected.total);
        assert.equal(actual.stampCount, expected.count);
      }
    }
  }
});
