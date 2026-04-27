import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

// @ts-expect-error -- oxlint typescript
import { FEATURE_SIDEBARS } from "@/app/featureNavigation";

import { useSidebarToggleHotkeys } from "./useSidebarToggleHotkeys";

const mocks = vi.hoisted(() => ({
  useHotkey: vi.fn(),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useHotkey: mocks.useHotkey,
}));

describe("useSidebarToggleHotkeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("binds both sidebar shortcuts on history and toggles the correct panels", () => {
    const toggle = vi.fn();

    renderHook(() => useSidebarToggleHotkeys({ sidebars: FEATURE_SIDEBARS.history, toggle }));

    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      1,
      "Mod+S",
      expect.any(Function),
      expect.objectContaining({ enabled: true, ignoreInputs: false }),
    );
    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      2,
      "Mod+Shift+S",
      expect.any(Function),
      expect.objectContaining({ enabled: true, ignoreInputs: false }),
    );

    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const leftHandler = mocks.useHotkey.mock.calls[0]?.[1] as (event: KeyboardEvent) => void;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const rightHandler = mocks.useHotkey.mock.calls[1]?.[1] as (event: KeyboardEvent) => void;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const leftEvent = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const rightEvent = { preventDefault: vi.fn() } as unknown as KeyboardEvent;

    leftHandler(leftEvent);
    rightHandler(rightEvent);

    // oxlint-disable-next-line typescript-eslint(unbound-method)
    expect(leftEvent.preventDefault).toHaveBeenCalledOnce();
    // oxlint-disable-next-line typescript-eslint(unbound-method)
    expect(rightEvent.preventDefault).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenNthCalledWith(1, "primary");
    expect(toggle).toHaveBeenNthCalledWith(2, "history-files");
  });

  test("disables the right-sidebar shortcut when the current tab only has one sidebar", () => {
    const toggle = vi.fn();

    renderHook(() => useSidebarToggleHotkeys({ sidebars: FEATURE_SIDEBARS.review, toggle }));

    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      1,
      "Mod+S",
      expect.any(Function),
      expect.objectContaining({ enabled: true }),
    );
    expect(mocks.useHotkey).toHaveBeenNthCalledWith(
      2,
      "Mod+Shift+S",
      expect.any(Function),
      expect.objectContaining({ enabled: false }),
    );

    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const leftHandler = mocks.useHotkey.mock.calls[0]?.[1] as (event: KeyboardEvent) => void;
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const leftEvent = { preventDefault: vi.fn() } as unknown as KeyboardEvent;

    leftHandler(leftEvent);

    // oxlint-disable-next-line typescript-eslint(unbound-method)
    expect(leftEvent.preventDefault).toHaveBeenCalledOnce();
    expect(toggle).toHaveBeenCalledWith("review");
  });
});
