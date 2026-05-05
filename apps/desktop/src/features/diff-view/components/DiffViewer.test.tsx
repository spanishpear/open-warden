/// <reference types="@testing-library/jest-dom" />
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { DiffViewer } from "./DiffViewer";

const mocks = vi.hoisted(() => ({
  getDiffResultCache: vi.fn(),
  highlightDiffAST: vi.fn(),
  useAppSelector: vi.fn(),
  workerPool: {
    getDiffResultCache: vi.fn(),
    highlightDiffAST: vi.fn(),
  },
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("@/app/hooks", () => ({
  useAppSelector: mocks.useAppSelector,
}));

vi.mock("@/features/diff-view/diffRenderConfig", () => ({
  getDiffTheme: () => ({ dark: "github-dark", light: "github-light" }),
  getDiffThemeCacheSalt: () => "dark",
  getDiffThemeType: () => "dark",
}));

vi.mock("@/features/diff-view/hooks/useParsedDiff", () => ({
  useParsedDiff: () => ({
    currentFileDiff: null,
    diffRenderGate: "renderable",
    isParsingDiff: false,
  }),
}));

vi.mock("@/features/source-control/diffLineFocus", () => ({
  DIFF_LINE_FOCUS_CSS: "",
  useDiffLineFocus: vi.fn(),
}));

vi.mock("@pierre/diffs/react", () => ({
  FileDiff: ({ fileDiff }: { fileDiff: { name: string } }) => (
    <div data-testid="rendered-diff">{fileDiff.name}</div>
  ),
  Virtualizer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useWorkerPool: () => mocks.workerPool,
}));

describe("DiffViewer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    HTMLElement.prototype.scrollTo = vi.fn();
    mocks.useAppSelector.mockReturnValue("split");
    mocks.getDiffResultCache.mockReturnValue(null);
    mocks.workerPool.getDiffResultCache = mocks.getDiffResultCache;
    mocks.workerPool.highlightDiffAST = mocks.highlightDiffAST;
  });

  it("renders plain-text diffs immediately without waiting for highlight callbacks", () => {
    render(
      <DiffViewer
        oldFile={null}
        newFile={null}
        fileDiff={{ name: "yarn.lock", hunks: [] } as never}
        activePath="yarn.lock"
      />,
    );

    expect(screen.queryByText("Parsing diff...")).not.toBeInTheDocument();
    expect(mocks.highlightDiffAST).not.toHaveBeenCalled();
    expect(screen.getByTestId("rendered-diff")).toHaveTextContent("yarn.lock");
  });

  it("falls back to rendering highlighted diffs when callbacks never arrive", async () => {
    render(
      <DiffViewer
        oldFile={null}
        newFile={null}
        fileDiff={{ name: "file.ts", hunks: [] } as never}
        activePath="file.ts"
      />,
    );

    expect(screen.getByText("Parsing diff...")).toBeInTheDocument();
    expect(mocks.highlightDiffAST).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByText("Parsing diff...")).not.toBeInTheDocument();
    expect(screen.getByTestId("rendered-diff")).toHaveTextContent("file.ts");
  });
});
