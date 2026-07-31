export type StampStock = number | null;

export interface StampDenomination {
  fen: number;
  label: string;
  category?: "ordinary" | "commemorative" | "custom";
  defaultStock?: StampStock;
}

export interface StampPlanItem extends StampDenomination {
  count: number;
  subtotalFen: number;
}

export interface StampPlan {
  status: "exact" | "overpay" | "insufficient";
  targetFen: number;
  totalFen: number;
  overpayFen: number;
  stampCount: number;
  counts: number[];
  items: StampPlanItem[];
  availableTotalFen: number | null;
}

const INF = 0x3fffffff;
const MAX_CACHE_ENTRIES = 160;
const planCache = new Map<string, StampPlan>();

function gcd(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left;
}

function cacheKey(
  targetFen: number,
  denominations: StampDenomination[],
  stocks: StampStock[],
): string {
  return `${targetFen}|${denominations.map((stamp) => stamp.fen).join(",")}|${stocks
    .map((stock) => (stock === null ? "*" : stock))
    .join(",")}`;
}

function remember(key: string, plan: StampPlan): StampPlan {
  // Re-inserting an existing key refreshes its recency without growing the map.
  if (planCache.has(key)) planCache.delete(key);
  if (planCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = planCache.keys().next().value;
    if (oldest !== undefined) planCache.delete(oldest);
  }
  planCache.set(key, plan);
  return plan;
}

/**
 * Solve the bounded stamp problem with an exact lexicographic objective:
 * 1. smallest total not below the target;
 * 2. fewest stamps at that total.
 *
 * Values are integer fen. A null stock means unlimited for this calculation.
 * The dynamic programme uses a monotone queue for each bounded denomination,
 * so its runtime is O(number of denominations × searched amount).
 */
export function solveStampPlan(
  rawTargetFen: number,
  denominations: StampDenomination[],
  stocks: StampStock[],
): StampPlan {
  const targetFen = Math.max(0, Math.round(rawTargetFen));
  if (denominations.length !== stocks.length) {
    throw new Error("邮票面额与库存数组长度不一致");
  }

  const key = cacheKey(targetFen, denominations, stocks);
  const cached = planCache.get(key);
  if (cached) {
    // Map preserves insertion order; refresh on every hit so eviction is LRU,
    // not FIFO.
    planCache.delete(key);
    planCache.set(key, cached);
    return cached;
  }

  const active = denominations
    .map((stamp, originalIndex) => ({
      ...stamp,
      originalIndex,
      stock: stocks[originalIndex],
    }))
    .filter((stamp) => stamp.fen > 0 && (stamp.stock === null || stamp.stock > 0))
    .sort((a, b) => a.fen - b.fen);

  const counts = denominations.map(() => 0);
  const finiteTotal = active.every((stamp) => stamp.stock !== null)
    ? active.reduce((sum, stamp) => sum + stamp.fen * (stamp.stock ?? 0), 0)
    : null;

  if (targetFen === 0) {
    return remember(key, {
      status: "exact",
      targetFen,
      totalFen: 0,
      overpayFen: 0,
      stampCount: 0,
      counts,
      items: [],
      availableTotalFen: finiteTotal,
    });
  }

  if (!active.length || (finiteTotal !== null && finiteTotal < targetFen)) {
    const totalFen = finiteTotal ?? 0;
    return remember(key, {
      status: "insufficient",
      targetFen,
      totalFen,
      overpayFen: 0,
      stampCount: 0,
      counts,
      items: [],
      availableTotalFen: finiteTotal,
    });
  }

  const unitFen = active.reduce((value, stamp) => gcd(value, stamp.fen), 0);
  const maxStampFen = active.at(-1)?.fen ?? unitFen;
  const searchCeilingFen = Math.min(
    targetFen + maxStampFen - 1,
    finiteTotal ?? Number.POSITIVE_INFINITY,
  );
  const limit = Math.floor(searchCeilingFen / unitFen);
  const start = Math.ceil(targetFen / unitFen);

  let previous = new Int32Array(limit + 1);
  previous.fill(INF);
  previous[0] = 0;
  const choices: Uint32Array[] = [];

  for (const stamp of active) {
    const value = stamp.fen / unitFen;
    const cap = stamp.stock === null ? Number.POSITIVE_INFINITY : stamp.stock;
    const next = new Int32Array(limit + 1);
    next.fill(INF);
    const selected = new Uint32Array(limit + 1);

    for (let residue = 0; residue < value && residue <= limit; residue += 1) {
      const sequenceLength = Math.floor((limit - residue) / value) + 1;
      const queueIndices = new Int32Array(sequenceLength);
      const queueScores = new Int32Array(sequenceLength);
      let head = 0;
      let tail = 0;

      for (
        let sequenceIndex = 0, amount = residue;
        amount <= limit;
        sequenceIndex += 1, amount += value
      ) {
        const minimumIndex = Number.isFinite(cap) ? sequenceIndex - cap : 0;
        while (head < tail && queueIndices[head] < minimumIndex) head += 1;

        const priorCount = previous[amount];
        if (priorCount < INF) {
          const score = priorCount - sequenceIndex;
          // Keep the older entry on ties: it uses more of the current
          // denomination. Denominations are processed low-to-high, giving a
          // deterministic larger-denomination preference after stamp count.
          while (head < tail && queueScores[tail - 1] > score) tail -= 1;
          queueIndices[tail] = sequenceIndex;
          queueScores[tail] = score;
          tail += 1;
        }

        if (head < tail) {
          const sourceIndex = queueIndices[head];
          const used = sequenceIndex - sourceIndex;
          next[amount] = previous[residue + sourceIndex * value] + used;
          selected[amount] = used;
        }
      }
    }

    choices.push(selected);
    previous = next;
  }

  let bestAmount = -1;
  for (let amount = start; amount <= limit; amount += 1) {
    if (previous[amount] < INF) {
      bestAmount = amount;
      break;
    }
  }

  if (bestAmount < 0) {
    return remember(key, {
      status: "insufficient",
      targetFen,
      totalFen: finiteTotal ?? 0,
      overpayFen: 0,
      stampCount: 0,
      counts,
      items: [],
      availableTotalFen: finiteTotal,
    });
  }

  let remainder = bestAmount;
  for (let index = active.length - 1; index >= 0; index -= 1) {
    const stamp = active[index];
    const used = choices[index][remainder];
    counts[stamp.originalIndex] = used;
    remainder -= used * (stamp.fen / unitFen);
  }

  const totalFen = bestAmount * unitFen;
  const items = denominations
    .map((stamp, index) => ({
      ...stamp,
      count: counts[index],
      subtotalFen: stamp.fen * counts[index],
    }))
    .filter((stamp) => stamp.count > 0);

  return remember(key, {
    status: totalFen === targetFen ? "exact" : "overpay",
    targetFen,
    totalFen,
    overpayFen: totalFen - targetFen,
    stampCount: previous[bestAmount],
    counts,
    items,
    availableTotalFen: finiteTotal,
  });
}

/**
 * For each denomination, return the exact conditional stock boundary for the
 * current target and all other stock settings. At that count, making only this
 * denomination unlimited cannot improve the plan any further.
 */
export function deriveAmpleThresholds(
  targetFen: number,
  denominations: StampDenomination[],
  stocks: StampStock[],
): number[] {
  const baseline = solveStampPlan(targetFen, denominations, stocks);
  return denominations.map((_, index) => {
    const unlimitedPlan =
      stocks[index] === null
        ? baseline
        : solveStampPlan(
            targetFen,
            denominations,
            stocks.map((stock, stockIndex) => (stockIndex === index ? null : stock)),
          );
    return Math.max(1, unlimitedPlan.counts[index] ?? 0);
  });
}

export function clearStampPlanCache(): void {
  planCache.clear();
}
