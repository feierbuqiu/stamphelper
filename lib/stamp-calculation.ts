import {
  deriveAmpleThresholds,
  solveStampPlan,
  type StampDenomination,
  type StampPlan,
  type StampStock,
} from "./stamp-solver";

export type StampCalculationRequest = {
  id: number;
  targetFen: number;
  denominations: StampDenomination[];
  stocks: StampStock[];
  includeThresholds: boolean;
};

export type StampCalculationResponse = {
  id: number;
  plan: StampPlan;
  thresholds: number[];
  elapsedMs: number;
  workerRevision?: string;
};

export function calculateStampRequest(request: StampCalculationRequest): StampCalculationResponse {
  const startedAt = performance.now();
  const plan = solveStampPlan(request.targetFen, request.denominations, request.stocks);
  const thresholds = request.includeThresholds
    ? deriveAmpleThresholds(request.targetFen, request.denominations, request.stocks)
    : request.denominations.map(() => 1);
  return {
    id: request.id,
    plan,
    thresholds,
    elapsedMs: performance.now() - startedAt,
  };
}
