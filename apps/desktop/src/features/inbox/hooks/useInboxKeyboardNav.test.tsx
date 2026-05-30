import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  useHotkey: vi.fn(),
  dispatch: vi.fn(),
  getState: vi.fn(),
  focusInputById: vi.fn(() => true),
}));

vi.mock("@tanstack/react-hotkeys", () => ({ useHotkey: mocks.useHotkey }));
vi.mock("react-redux", () => ({
  useStore: () => ({ getState: mocks.getState }),
}));
vi.mock("@/app/hooks", () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock("@/features/source-control/hooks/keyboardNavigation", () => ({
  focusInputById: mocks.focusInputById,
}));

import { clearInboxSelection, setInboxSelectedPRId } from "../inboxSlice";

import { useInboxKeyboardNav } from "./useInboxKeyboardNav";

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

function setSelectedId(id: string | null) {
  mocks.getState.mockReturnValue({ inbox: { selectedPRId: id } });
}

const baseOptions = {
  orderedIds: ["a", "b", "c"],
  onOpen: vi.fn(),
  searchInputId: "inbox-search",
  onClearSearch: vi.fn(),
  hasSearchText: false,
  onToggleHelp: vi.fn(),
};

describe("useInboxKeyboardNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.focusInputById.mockReturnValue(true);
    setSelectedId(null);
  });

  test("J / ArrowDown move the cursor to the next row", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));

    setSelectedId("a");
    handlerFor("J")(fakeEvent());
    expect(mocks.dispatch).toHaveBeenCalledWith(setInboxSelectedPRId("b"));

    mocks.dispatch.mockClear();
    setSelectedId("b");
    handlerFor("ArrowDown")(fakeEvent());
    expect(mocks.dispatch).toHaveBeenCalledWith(setInboxSelectedPRId("c"));
  });

  test("K / ArrowUp move the cursor to the previous row", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));

    setSelectedId("c");
    handlerFor("K")(fakeEvent());
    expect(mocks.dispatch).toHaveBeenCalledWith(setInboxSelectedPRId("b"));
  });

  test("J with no selection selects the first row", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));
    setSelectedId(null);
    handlerFor("J")(fakeEvent());
    expect(mocks.dispatch).toHaveBeenCalledWith(setInboxSelectedPRId("a"));
  });

  test("ignores shift-modified J/K (reserved for range selection)", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));
    setSelectedId("a");
    handlerFor("J")(fakeEvent({ shiftKey: true }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("does not navigate while typing in an input", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));
    setSelectedId("a");
    const input = document.createElement("input");
    handlerFor("J")(fakeEvent({ target: input }));
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("Enter / O open the selected PR", () => {
    const onOpen = vi.fn();
    renderHook(() => useInboxKeyboardNav({ ...baseOptions, onOpen }));
    setSelectedId("b");
    handlerFor("Enter")(fakeEvent());
    expect(onOpen).toHaveBeenCalledWith("b");

    onOpen.mockClear();
    handlerFor("O")(fakeEvent());
    expect(onOpen).toHaveBeenCalledWith("b");
  });

  test("Enter does nothing without a valid selection", () => {
    const onOpen = vi.fn();
    renderHook(() => useInboxKeyboardNav({ ...baseOptions, onOpen }));
    setSelectedId(null);
    handlerFor("Enter")(fakeEvent());
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("/ focuses the search input", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));
    const event = fakeEvent();
    handlerFor("/")(event);
    expect(mocks.focusInputById).toHaveBeenCalledWith("inbox-search");
    // oxlint-disable-next-line typescript-eslint(unbound-method)
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test("Shift+/ ( ? ) toggles the help overlay", () => {
    const onToggleHelp = vi.fn();
    renderHook(() => useInboxKeyboardNav({ ...baseOptions, onToggleHelp }));
    handlerFor("/")(fakeEvent({ shiftKey: true }));
    expect(onToggleHelp).toHaveBeenCalled();
    expect(mocks.focusInputById).not.toHaveBeenCalled();
  });

  test("Escape clears search text first when present", () => {
    const onClearSearch = vi.fn();
    renderHook(() => useInboxKeyboardNav({ ...baseOptions, hasSearchText: true, onClearSearch }));
    handlerFor("Escape")(fakeEvent());
    expect(onClearSearch).toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  test("Escape clears the selection when no search text", () => {
    renderHook(() => useInboxKeyboardNav(baseOptions));
    setSelectedId("b");
    handlerFor("Escape")(fakeEvent());
    expect(mocks.dispatch).toHaveBeenCalledWith(clearInboxSelection());
  });
});
