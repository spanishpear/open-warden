/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// @ts-expect-error -- oxlint typescript
import { WorkerPoolDevObserver } from "@/provider/WorkerPoolDevObserver";

const mocks = vi.hoisted(() => ({
  useWorkerPool: vi.fn(),
}));

vi.mock("@pierre/diffs/react", () => ({
  useWorkerPool: mocks.useWorkerPool,
}));

describe("WorkerPoolDevObserver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the initial stats, subscribes to updates, and renders the manager state", () => {
    const unsubscribe = vi.fn();
    const stats = {
      managerState: "initialized",
      workersFailed: false,
      totalWorkers: 4,
      busyWorkers: 1,
      queuedTasks: 2,
      pendingTasks: 3,
      themeSubscribers: 1,
      fileCacheSize: 5,
      diffCacheSize: 6,
    };
    const getStats = vi.fn().mockReturnValue(stats);
    const subscribeToStatChanges = vi.fn().mockReturnValue(unsubscribe);

    mocks.useWorkerPool.mockReturnValue({
      getStats,
      subscribeToStatChanges,
    });

    render(<WorkerPoolDevObserver />);

    expect(getStats).toHaveBeenCalledOnce();
    expect(subscribeToStatChanges).toHaveBeenCalledOnce();
    expect(subscribeToStatChanges).toHaveBeenCalledWith(expect.any(Function));
    expect(screen.getByText(/initialized/i)).toBeInTheDocument();
  });

  it("unsubscribes from stat updates on unmount", () => {
    const unsubscribe = vi.fn();

    mocks.useWorkerPool.mockReturnValue({
      getStats: vi.fn().mockReturnValue({
        managerState: "waiting",
        workersFailed: false,
        totalWorkers: 2,
        busyWorkers: 0,
        queuedTasks: 0,
        pendingTasks: 0,
        themeSubscribers: 0,
        fileCacheSize: 0,
        diffCacheSize: 0,
      }),
      subscribeToStatChanges: vi.fn().mockReturnValue(unsubscribe),
    });

    const { unmount } = render(<WorkerPoolDevObserver />);

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
