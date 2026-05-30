import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  useHotkey: vi.fn(),
  dispatch: vi.fn(),
  moveFocus: vi.fn(),
}));

vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: mocks.useHotkey }));
vi.mock("@/app/hooks", () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock("@/features/source-control/pierreFileTreeNavigation", () => ({
  movePierreFileTreeFocusToFile: mocks.moveFocus,
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, startTransition: (fn: () => void) => fn() };
});

import { setPullRequestPreviewActiveFilePath } from "@/features/pull-requests/pullRequestsSlice";

import { usePullRequestReviewHotkeys } from "./usePullRequestReviewHotkeys";

function handlerFor(key: string): (event: KeyboardEvent) => void {
  const call = mocks.useHotkey.mock.calls.find((c) => c[0] === key);
  if (!call) throw new Error(`no hotkey bound for ${key}`);
  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  return call[1] as (event: KeyboardEvent) => void;
}

function fakeEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  return {
    preventDefault: vi.fn(),
    shiftKey: false,
    target: document.body,
    ...overrides,
  } as unknown as KeyboardEvent;
}

const baseOptions = {
  onBack: vi.fn(),
  onToggleHelp: vi.fn(),
};

describe("usePullRequestReviewHotkeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.moveFocus.mockReturnValue({ path: "next.ts", realPath: "next.ts" });
  });

  test("] and n move to the next file", () => {
    renderHook(() => usePullRequestReviewHotkeys(baseOptions));

    handlerFor("]")(fakeEvent());
    expect(mocks.moveFocus).toHaveBeenCalledWith("pull-request-files", true);
    expect(mocks.dispatch).toHaveBeenCalledWith(setPullRequestPreviewActiveFilePath("next.ts"));

    mocks.dispatch.mockClear();
    handlerFor("N")(fakeEvent());
    expect(mocks.dispatch).toHaveBeenCalledWith(setPullRequestPreviewActiveFilePath("next.ts"));
  });

  test("[ and p move to the previous file", () => {
    renderHook(() => usePullRequestReviewHotkeys(baseOptions));

    handlerFor("[")(fakeEvent());
    expect(mocks.moveFocus).toHaveBeenCalledWith("pull-request-files", false);

    handlerFor("P")(fakeEvent());
    expect(mocks.moveFocus).toHaveBeenLastCalledWith("pull-request-files", false);
  });

  test("does not move file when no target is found", () => {
    mocks.moveFocus.mockReturnValue(null);
    renderHook(() => usePullRequestReviewHotkeys(baseOptions));
    handlerFor("]")(fakeEvent());
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("ignores file nav while typing", () => {
    renderHook(() => usePullRequestReviewHotkeys(baseOptions));
    const input = document.createElement("textarea");
    handlerFor("]")(fakeEvent({ target: input }));
    expect(mocks.moveFocus).not.toHaveBeenCalled();
  });

  test("Escape returns to the inbox", () => {
    const onBack = vi.fn();
    renderHook(() => usePullRequestReviewHotkeys({ ...baseOptions, onBack }));
    handlerFor("Escape")(fakeEvent());
    expect(onBack).toHaveBeenCalled();
  });

  test("Escape is ignored while typing", () => {
    const onBack = vi.fn();
    renderHook(() => usePullRequestReviewHotkeys({ ...baseOptions, onBack }));
    const input = document.createElement("input");
    handlerFor("Escape")(fakeEvent({ target: input }));
    expect(onBack).not.toHaveBeenCalled();
  });

  test("Shift+/ ( ? ) toggles help", () => {
    const onToggleHelp = vi.fn();
    renderHook(() => usePullRequestReviewHotkeys({ ...baseOptions, onToggleHelp }));
    handlerFor("/")(fakeEvent({ shiftKey: true }));
    expect(onToggleHelp).toHaveBeenCalled();
  });

  test("plain / does not toggle help", () => {
    const onToggleHelp = vi.fn();
    renderHook(() => usePullRequestReviewHotkeys({ ...baseOptions, onToggleHelp }));
    handlerFor("/")(fakeEvent({ shiftKey: false }));
    expect(onToggleHelp).not.toHaveBeenCalled();
  });
});
