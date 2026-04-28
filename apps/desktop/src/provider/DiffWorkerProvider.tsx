import { WorkerPoolContextProvider } from "@pierre/diffs/react";
import DiffsWorker from "@pierre/diffs/worker/worker.js?worker";
import { useMemo, type ReactNode } from "react";

import { getDiffTheme } from "@/features/diff-view/diffRenderConfig";

// Module-level constants — created once, never recreated on render
const WORKER_FACTORY = () => new DiffsWorker();
const TOTAL_AST_LRU_CACHE_SIZE = 240;
const HIGHLIGHTER_OPTIONS = {
  useTokenTransformer: true,
  tokenizeMaxLineLength: 1_000,
  theme: getDiffTheme(),
  langs: ["rust", "typescript", "tsx", "javascript", "jsx"],
};

export function DiffWorkerPoolProvider({ children }: { children?: ReactNode }) {
  const workerPoolSize = useMemo(() => {
    const cores =
      typeof navigator === "undefined" ? 4 : Math.max(1, navigator.hardwareConcurrency || 4);
    return Math.max(2, Math.min(6, Math.floor(cores / 2)));
  }, []);

  return (
    <WorkerPoolContextProvider
      poolOptions={{
        workerFactory: WORKER_FACTORY,
        poolSize: workerPoolSize,
        totalASTLRUCacheSize: TOTAL_AST_LRU_CACHE_SIZE,
      }}
      highlighterOptions={HIGHLIGHTER_OPTIONS}
    >
      {children}
    </WorkerPoolContextProvider>
  );
}
