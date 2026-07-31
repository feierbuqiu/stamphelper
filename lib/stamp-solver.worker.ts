import {
  calculateStampRequest,
  type StampCalculationRequest,
  type StampCalculationResponse,
} from "./stamp-calculation";

// Kept in the emitted Worker payload so this repair receives a new immutable
// asset URL instead of reusing the previously poisoned CDN/browser cache key.
const WORKER_ASSET_REVISION = "2026-07-31-worker-redeploy-1";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<StampCalculationRequest>) => void) | null;
  postMessage(message: StampCalculationResponse): void;
};

workerScope.onmessage = (event) => {
  workerScope.postMessage({
    ...calculateStampRequest(event.data),
    workerRevision: WORKER_ASSET_REVISION,
  });
};
