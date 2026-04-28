/// <reference types="@testing-library/jest-dom" />
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

// @ts-expect-error -- oxlint typescript
import { HistoryScreen } from "@/features/source-control/screens/HistoryScreen";
import {
  setActivePath,
  setActiveRepo,
  setHistoryCommitId,
  sourceControlReducer,
} from "../sourceControlSlice";

const mocks = vi.hoisted(() => ({
  useHotkey: vi.fn(),
  useHistoryKeyboardNav: vi.fn(),
  useHistorySync: vi.fn(),
  useThrottledDiffSelection: vi.fn(),
  useGetCommitFilesQuery: vi.fn().mockReturnValue({ data: undefined }),
  useGetCommitFileVersionsQuery: vi.fn().mockReturnValue({
    data: undefined,
    currentData: undefined,
    isFetching: false,
    error: undefined,
  }),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useHotkey: mocks.useHotkey,
}));

vi.mock("@/features/source-control/hooks/useHistoryKeyboardNav", () => ({
  useHistoryKeyboardNav: mocks.useHistoryKeyboardNav,
}));

vi.mock("@/features/source-control/hooks/useHistorySync", () => ({
  useHistorySync: mocks.useHistorySync,
}));

vi.mock("@/features/source-control/hooks/useThrottledDiffSelection", () => ({
  useThrottledDiffSelection: mocks.useThrottledDiffSelection,
}));

vi.mock("@/features/source-control/api", () => ({
  useGetCommitFilesQuery: mocks.useGetCommitFilesQuery,
  useGetCommitFileVersionsQuery: mocks.useGetCommitFileVersionsQuery,
}));

vi.mock("@/components/layout/ResizableSidebarLayout", () => ({
  ResizableSidebarLayout: ({
    sidebar,
    content,
  }: {
    sidebar: React.ReactNode;
    content: React.ReactNode;
  }) => (
    <div>
      {sidebar}
      {content}
    </div>
  ),
}));

vi.mock("@/features/diff-view/DiffWorkspace", () => ({
  DiffWorkspace: () => <div data-testid="diff-workspace" />,
}));

vi.mock("@/features/source-control/components/HistoryFilesPane", () => ({
  HistoryFilesPane: () => <div data-testid="history-files-pane" />,
}));

function createStore() {
  return configureStore({
    reducer: {
      sourceControl: sourceControlReducer,
    },
  });
}

function renderScreen() {
  const store = createStore();
  store.dispatch(setActiveRepo("/repo"));
  store.dispatch(setHistoryCommitId("commit-1"));

  render(
    <Provider store={store}>
      <HistoryScreen />
    </Provider>,
  );

  return store;
}

describe("HistoryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useThrottledDiffSelection.mockReturnValue(null);
    mocks.useGetCommitFilesQuery.mockReturnValue({ data: undefined });
    mocks.useGetCommitFileVersionsQuery.mockReturnValue({
      data: undefined,
      currentData: undefined,
      isFetching: false,
      error: undefined,
    });
  });

  it("renders the empty state when no history file is selected", () => {
    renderScreen();

    expect(screen.getByText("Select a commit file to view diff.")).toBeInTheDocument();
  });

  it("renders the loading message when the selected diff is still fetching", () => {
    mocks.useGetCommitFilesQuery.mockReturnValue({
      data: [{ path: "src/history.ts", previousPath: undefined }],
    });
    mocks.useThrottledDiffSelection.mockReturnValue({
      commitId: "commit-1",
      path: "src/history.ts",
      previousPath: undefined,
    });
    mocks.useGetCommitFileVersionsQuery.mockReturnValue({
      data: undefined,
      currentData: undefined,
      isFetching: true,
      error: undefined,
    });

    const store = renderScreen();
    store.dispatch(setActivePath("src/history.ts"));

    expect(screen.getByText("Loading diff...")).toBeInTheDocument();
  });
});
