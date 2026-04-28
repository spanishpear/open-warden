/// <reference types="@testing-library/jest-dom" />
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// @ts-expect-error -- oxlint typescript
import { DiffWorkerPoolProvider } from "@/provider/DiffWorkerProvider";

const mocks = vi.hoisted(() => ({
  WorkerPoolContextProvider: vi.fn(({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  )),
}));

vi.mock("@pierre/diffs/react", () => ({
  WorkerPoolContextProvider: mocks.WorkerPoolContextProvider,
}));

vi.mock("@pierre/diffs/worker/worker.js?worker", () => ({
  default: class MockWorker {
    postMessage = vi.fn();
    terminate = vi.fn();
  },
}));

describe("DiffWorkerPoolProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the expected worker pool and highlighter configuration", () => {
    render(<DiffWorkerPoolProvider />);

    expect(mocks.WorkerPoolContextProvider).toHaveBeenCalledOnce();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const props = mocks.WorkerPoolContextProvider.mock.calls[0]?.[0] as any;

    expect(props).toEqual(
      expect.objectContaining({
        highlighterOptions: expect.objectContaining({
          theme: {
            dark: "github-dark",
            light: "github-light",
          },
          langs: expect.arrayContaining(["rust", "typescript", "tsx", "javascript", "jsx"]),
          useTokenTransformer: true,
        }),
        poolOptions: expect.objectContaining({
          totalASTLRUCacheSize: 240,
          poolSize: expect.any(Number),
        }),
      }),
    );

    expect(props?.poolOptions.poolSize).toBeGreaterThanOrEqual(2);
    expect(props?.poolOptions.poolSize).toBeLessThanOrEqual(6);
  });
});
