import { useEffect, useState } from "react";
import { useWorkerPool } from "@pierre/diffs/react";

interface WorkerStats {
  managerState: "waiting" | "initializing" | "initialized";
  workersFailed: boolean;
  totalWorkers: number;
  busyWorkers: number;
  queuedTasks: number;
  pendingTasks: number;
  themeSubscribers: number;
  fileCacheSize: number;
  diffCacheSize: number;
}

export function WorkerPoolDevObserver() {
  if (!import.meta.env.DEV) {
    return null;
  }

  return <WorkerPoolDevObserverInner />;
}

function WorkerPoolDevObserverInner() {
  const manager = useWorkerPool();
  const [stats, setStats] = useState<WorkerStats | null>(null);

  useEffect(() => {
    if (!manager) return undefined;
    setStats(manager.getStats() as WorkerStats);
    const unsub = manager.subscribeToStatChanges((s) => {
      setStats(s as WorkerStats);
    });
    return unsub;
  }, [manager]);

  if (!stats) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 11,
        padding: "6px 10px",
        borderRadius: 4,
        zIndex: 9999,
        pointerEvents: "none",
        lineHeight: 1.5,
      }}
    >
      <div>
        <strong>WorkerPool</strong> [{stats.managerState}]
      </div>
      <div>
        busy: {stats.busyWorkers}/{stats.totalWorkers} | queued: {stats.queuedTasks} | pending:{" "}
        {stats.pendingTasks}
      </div>
      <div>
        fileCache: {stats.fileCacheSize} | diffCache: {stats.diffCacheSize}
      </div>
    </div>
  );
}
