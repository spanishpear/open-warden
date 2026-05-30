import { useHotkey } from "@tanstack/react-hotkeys";
import { useStore } from "react-redux";

import { useAppDispatch } from "@/app/hooks";
import type { RootState } from "@/app/store";
import { clearInboxSelection, setInboxSelectedPRId } from "@/features/inbox/inboxSlice";
import { nextInboxSelection } from "@/features/inbox/inboxSelection";
import { focusInputById } from "@/features/source-control/hooks/keyboardNavigation";
import { isTypingTarget } from "@/features/source-control/utils";

const INBOX_HOTKEY_OPTIONS = {
  ignoreInputs: false,
  preventDefault: false,
  stopPropagation: false,
} as const;

export type UseInboxKeyboardNavOptions = {
  /** Flat, ordered list of ids for every row currently rendered (all sections). */
  orderedIds: readonly string[];
  /** Open the row with this id (Enter / o). */
  onOpen: (prId: string) => void;
  /** Focus the search input (/). */
  searchInputId: string;
  /** Clear the current search text (Escape, when search is non-empty). */
  onClearSearch: () => void;
  /** True when there is search text to clear. */
  hasSearchText: boolean;
  /** Toggle the shortcuts help overlay (?). */
  onToggleHelp: () => void;
  enabled?: boolean;
};

/**
 * Keyboard navigation for the inbox PR list.
 *
 * Selection state lives in the narrow `inbox` slice; this hook reads the
 * current selection imperatively from the store (via `useStore`) inside each
 * handler so the hook itself does not re-render — and therefore does not
 * re-bind hotkeys — every time the cursor moves.
 */
export function useInboxKeyboardNav({
  orderedIds,
  onOpen,
  searchInputId,
  onClearSearch,
  hasSearchText,
  onToggleHelp,
  enabled = true,
}: UseInboxKeyboardNavOptions) {
  const store = useStore<RootState>();
  const dispatch = useAppDispatch();

  function move(event: KeyboardEvent, direction: "next" | "previous") {
    if (isTypingTarget(event.target)) {
      return;
    }
    event.preventDefault();
    const currentId = store.getState().inbox.selectedPRId;
    const nextId = nextInboxSelection(orderedIds, currentId, direction);
    if (nextId !== null) {
      dispatch(setInboxSelectedPRId(nextId));
    }
  }

  function open(event: KeyboardEvent) {
    if (isTypingTarget(event.target)) {
      return;
    }
    const currentId = store.getState().inbox.selectedPRId;
    if (currentId === null || !orderedIds.includes(currentId)) {
      return;
    }
    event.preventDefault();
    onOpen(currentId);
  }

  useHotkey(
    "J",
    (event) => {
      if (event.shiftKey) return;
      move(event, "next");
    },
    { ...INBOX_HOTKEY_OPTIONS, enabled },
  );

  useHotkey(
    "ArrowDown",
    (event) => {
      if (event.shiftKey) return;
      move(event, "next");
    },
    { ...INBOX_HOTKEY_OPTIONS, enabled },
  );

  useHotkey(
    "K",
    (event) => {
      if (event.shiftKey) return;
      move(event, "previous");
    },
    { ...INBOX_HOTKEY_OPTIONS, enabled },
  );

  useHotkey(
    "ArrowUp",
    (event) => {
      if (event.shiftKey) return;
      move(event, "previous");
    },
    { ...INBOX_HOTKEY_OPTIONS, enabled },
  );

  useHotkey("Enter", open, { ...INBOX_HOTKEY_OPTIONS, enabled });
  useHotkey("O", open, { ...INBOX_HOTKEY_OPTIONS, enabled });

  useHotkey(
    "/",
    (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      // Shift+/ is `?` on common layouts -> toggle the shortcuts help overlay.
      if (event.shiftKey) {
        event.preventDefault();
        onToggleHelp();
        return;
      }
      if (focusInputById(searchInputId)) {
        event.preventDefault();
      }
    },
    { ...INBOX_HOTKEY_OPTIONS, enabled },
  );

  useHotkey(
    "Escape",
    (event) => {
      // Escape clears the search first (whether focused in it or not), then
      // falls back to clearing the row selection.
      if (hasSearchText) {
        event.preventDefault();
        onClearSearch();
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      if (store.getState().inbox.selectedPRId !== null) {
        event.preventDefault();
        dispatch(clearInboxSelection());
      }
    },
    { ...INBOX_HOTKEY_OPTIONS, enabled },
  );
}
