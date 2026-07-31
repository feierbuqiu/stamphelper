"use client";

import { useEffect, useRef, useState } from "react";
import type { StampCalculationRequest, StampCalculationResponse } from "./stamp-calculation";
import type { StampDenomination, StampPlan, StampStock } from "./stamp-solver";

type InternalCalculationState = {
  plan: StampPlan;
  thresholds: number[];
  ready: boolean;
  pending: boolean;
  elapsedMs: number | null;
  background: boolean;
  completedKey: string;
};

type CalculationState = Omit<InternalCalculationState, "completedKey"> & { updating: boolean };

export const PENDING_DISPLAY_DELAY_MS = 200;
const REQUEST_DEBOUNCE_MS = 45;

function waitingPlan(targetFen: number, denominations: StampDenomination[]): StampPlan {
  return {
    status: targetFen === 0 ? "exact" : "insufficient",
    targetFen,
    totalFen: 0,
    overpayFen: 0,
    stampCount: 0,
    counts: denominations.map(() => 0),
    items: [],
    availableTotalFen: null,
  };
}

export function useStampCalculation(
  targetFen: number,
  denominations: StampDenomination[],
  stocks: StampStock[],
  includeThresholds: boolean,
): CalculationState {
  const requestKey = `${targetFen}|${includeThresholds ? 1 : 0}|${denominations
    .map((stamp) => `${stamp.fen}:${stamp.category ?? "ordinary"}`)
    .join(",")}|${stocks.map((stock) => (stock === null ? "*" : stock)).join(",")}`;
  const [state, setState] = useState<InternalCalculationState>(() => ({
    plan: waitingPlan(targetFen, denominations),
    thresholds: denominations.map(() => 1),
    ready: false,
    pending: true,
    elapsedMs: null,
    completedKey: "",
    // Keep the server and first client render identical. The effect upgrades
    // this flag after hydration when Worker support is known.
    background: false,
  }));
  const workerRef = useRef<Worker | null>(null);
  const workerBusyRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const id = ++requestIdRef.current;
    let settled = false;
    const pendingTimer = window.setTimeout(() => {
      if (settled || requestIdRef.current !== id) return;
      setState((current) => ({
        ...current,
        pending: true,
        background: typeof Worker !== "undefined",
      }));
    }, PENDING_DISPLAY_DELAY_MS);

    const settle = (response: StampCalculationResponse, background: boolean) => {
      if (requestIdRef.current !== id) return;
      settled = true;
      window.clearTimeout(pendingTimer);
      setState({
        ...response,
        ready: true,
        pending: false,
        background,
        completedKey: requestKey,
      });
    };

    const timer = window.setTimeout(() => {
      const request: StampCalculationRequest = {
        id,
        targetFen,
        denominations,
        stocks,
        includeThresholds,
      };

      if (typeof Worker === "undefined") {
        void import("./stamp-calculation").then(({ calculateStampRequest }) => {
          if (requestIdRef.current !== id) return;
          const response = calculateStampRequest(request);
          settle(response, false);
        });
        return;
      }

      if (workerRef.current && workerBusyRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("./stamp-solver.worker.ts", import.meta.url), { type: "module" });
      }
      const worker = workerRef.current;
      workerBusyRef.current = true;
      worker.onmessage = (event: MessageEvent<StampCalculationResponse>) => {
        if (event.data.id !== requestIdRef.current) return;
        workerBusyRef.current = false;
        settle(event.data, true);
      };
      worker.onerror = () => {
        if (id !== requestIdRef.current) return;
        workerBusyRef.current = false;
        worker.terminate();
        workerRef.current = null;
        void import("./stamp-calculation").then(({ calculateStampRequest }) => {
          if (requestIdRef.current !== id) return;
          const response = calculateStampRequest(request);
          settle(response, false);
        });
      };
      worker.postMessage(request);
    }, REQUEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(pendingTimer);
      window.clearTimeout(timer);
    };
  }, [denominations, includeThresholds, requestKey, stocks, targetFen]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const { completedKey, ...visibleState } = state;
  return {
    ...visibleState,
    updating: !state.ready || completedKey !== requestKey,
  };
}
