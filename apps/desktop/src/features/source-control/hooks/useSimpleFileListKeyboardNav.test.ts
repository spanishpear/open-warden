vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    startTransition: mocks.startTransition,
  };
});

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useSimpleFileListKeyboardNav } from "./useSimpleFileListKeyboardNav";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  movePierreFileTreeFocusToFile: vi.fn(),
  startTransition: vi.fn((callback: () => void) => callback()),
  store: {
    getState: vi.fn(),
  },
  useHotkey:
    vi.fn<
      (
        key: string,
        handler: (event: KeyboardEvent) => void,
        options?: Record<string, unknown>,
      ) => void
    >(),
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useHotkey: mocks.useHotkey,
}));

vi.mock("react-redux", () => ({
  useStore: () => mocks.store,
}));

vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
}));

vi.mock("@/features/source-control/pierreFileTreeNavigation", () => ({
  movePierreFileTreeFocusToFile: mocks.movePierreFileTreeFocusToFile,
}));

function getHotkeyHandler(key: string) {
  const hotkeyCall = mocks.useHotkey.mock.calls.find((call) => call[0] === key);
  return hotkeyCall?.[1];
}

function mockKeyboardEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown");
  const preventDefault = overrides.preventDefault ?? vi.fn();
  Object.defineProperty(event, "preventDefault", {
    value: preventDefault,
    writable: true,
  });
  if (overrides.target) {
    Object.defineProperty(event, "target", { value: overrides.target, writable: true });
  }
  return event;
}

describe("useSimpleFileListKeyboardNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.getState.mockReturnValue({});
    mocks.movePierreFileTreeFocusToFile.mockReturnValue(null);
    mocks.startTransition.mockImplementation((callback: () => void) => callback());
  });

  it("selects the file real path when j moves to a file", () => {
    const onSelectPath = vi.fn();
    mocks.movePierreFileTreeFocusToFile.mockReturnValue({
      path: "tree/src/file.ts",
      realPath: "src/file.ts",
    });

    renderHook(() =>
      useSimpleFileListKeyboardNav({
        regionId: "review-files",
        getAllFilePaths: () => [],
        getActivePath: () => "",
        onSelectPath,
      }),
    );

    const preventDefault = vi.fn();
    getHotkeyHandler("J")?.(mockKeyboardEvent({ preventDefault, target: document.body }));

    expect(mocks.movePierreFileTreeFocusToFile).toHaveBeenCalledWith("review-files", true);
    expect(mocks.startTransition).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onSelectPath).toHaveBeenCalledWith("src/file.ts");
  });

  it("does nothing when j cannot move to a file", () => {
    const onSelectPath = vi.fn();

    renderHook(() =>
      useSimpleFileListKeyboardNav({
        regionId: "review-files",
        getAllFilePaths: () => [],
        getActivePath: () => "",
        onSelectPath,
      }),
    );

    const preventDefault = vi.fn();
    getHotkeyHandler("J")?.(mockKeyboardEvent({ preventDefault, target: document.body }));

    expect(mocks.movePierreFileTreeFocusToFile).toHaveBeenCalledWith("review-files", true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onSelectPath).not.toHaveBeenCalled();
  });

  it("falls back to path when realPath is unavailable", () => {
    const onSelectPath = vi.fn();
    mocks.movePierreFileTreeFocusToFile.mockReturnValue({
      path: "tree-only-path.ts",
    });

    renderHook(() =>
      useSimpleFileListKeyboardNav({
        regionId: "review-files",
        getAllFilePaths: () => [],
        getActivePath: () => "",
        onSelectPath,
      }),
    );

    getHotkeyHandler("J")?.(mockKeyboardEvent({ preventDefault: vi.fn(), target: document.body }));

    expect(onSelectPath).toHaveBeenCalledWith("tree-only-path.ts");
  });
});
