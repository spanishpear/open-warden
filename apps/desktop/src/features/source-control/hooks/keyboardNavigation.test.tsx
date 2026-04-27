import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  focusInputById,
  getVisibleBucketedFiles,
  getVisibleFilePaths,
  SOURCE_CONTROL_HOTKEY_OPTIONS,
  useVerticalNavigationHotkeys,
} from "./keyboardNavigation";

const mocks = vi.hoisted(() => ({
  useHotkey: vi.fn(),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useHotkey: mocks.useHotkey,
}));

describe("keyboardNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  test("reads visible nav rows in nav-index order", () => {
    document.body.innerHTML = `
      <div data-nav-region="review-files">
        <div data-tree-file-row="true" data-nav-index="2" data-file-path="b.ts" data-bucket="unstaged"></div>
        <div data-tree-file-row="true" data-nav-index="0" data-file-path="a.ts" data-bucket="staged"></div>
        <div data-tree-file-row="true" data-nav-index="1" data-file-path="c.ts"></div>
      </div>
    `;

    expect(getVisibleFilePaths("review-files")).toEqual(["a.ts", "c.ts", "b.ts"]);
    expect(getVisibleBucketedFiles("review-files")).toEqual([
      { path: "a.ts", bucket: "staged" },
      { path: "b.ts", bucket: "unstaged" },
    ]);
  });

  test("focuses and selects an input by id", () => {
    const input = document.createElement("input");
    input.id = "history-filter";
    document.body.appendChild(input);
    const selectSpy = vi.spyOn(input, "select");

    expect(focusInputById("history-filter")).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(selectSpy).toHaveBeenCalledOnce();
    expect(focusInputById("missing-filter")).toBe(false);
  });

  test("binds shared vertical navigation hotkeys", () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onExtendNext = vi.fn();
    const onExtendPrevious = vi.fn();

    renderHook(() =>
      useVerticalNavigationHotkeys({
        onNext,
        onPrevious,
        onExtendNext,
        onExtendPrevious,
      }),
    );

    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      1,
      "ArrowDown",
      expect.any(Function),
      SOURCE_CONTROL_HOTKEY_OPTIONS,
    );
    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      2,
      "J",
      expect.any(Function),
      SOURCE_CONTROL_HOTKEY_OPTIONS,
    );
    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      3,
      "Shift+ArrowDown",
      expect.any(Function),
      expect.objectContaining({ enabled: true }),
    );
    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      7,
      "Shift+ArrowUp",
      expect.any(Function),
      expect.objectContaining({ enabled: true }),
    );

    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const arrowDown = mocks.useHotkey.mock.calls[0]?.[1] as (event: KeyboardEvent) => void;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const shiftArrowDown = mocks.useHotkey.mock.calls[2]?.[1] as (event: KeyboardEvent) => void;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const arrowUp = mocks.useHotkey.mock.calls[4]?.[1] as (event: KeyboardEvent) => void;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const shiftArrowUp = mocks.useHotkey.mock.calls[6]?.[1] as (event: KeyboardEvent) => void;

    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    arrowDown({ shiftKey: false } as KeyboardEvent);
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    arrowDown({ shiftKey: true } as KeyboardEvent);
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    shiftArrowDown({} as KeyboardEvent);
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    arrowUp({ shiftKey: false } as KeyboardEvent);
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    shiftArrowUp({} as KeyboardEvent);

    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onExtendNext).toHaveBeenCalledOnce();
    expect(onExtendPrevious).toHaveBeenCalledOnce();
  });

  test("disables extend bindings when range handlers are omitted", () => {
    renderHook(() =>
      useVerticalNavigationHotkeys({
        onNext: vi.fn(),
        onPrevious: vi.fn(),
      }),
    );

    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      3,
      "Shift+ArrowDown",
      expect.any(Function),
      expect.objectContaining({ enabled: false }),
    );
    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      7,
      "Shift+ArrowUp",
      expect.any(Function),
      expect.objectContaining({ enabled: false }),
    );
  });
});
