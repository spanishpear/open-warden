import { useHotkey } from "@tanstack/react-hotkeys";
import { startTransition } from "react";

import { useAppDispatch } from "@/app/hooks";
import { setPullRequestPreviewActiveFilePath } from "@/features/pull-requests/pullRequestsSlice";
import { movePierreFileTreeFocusToFile } from "@/features/source-control/pierreFileTreeNavigation";
import { isTypingTarget } from "@/features/source-control/utils";

const REVIEW_HOTKEY_OPTIONS = {
  ignoreInputs: false,
  preventDefault: false,
  stopPropagation: false,
} as const;

/** Nav region id shared with the PR files sidebar (PullRequestFileList). */
const PR_FILES_REGION = "pull-request-files";

export type UsePullRequestReviewHotkeysOptions = {
  /** Return to the inbox (Escape). */
  onBack: () => void;
  /** Toggle the shortcuts help overlay (?). */
  onToggleHelp: () => void;
  enabled?: boolean;
};

/**
 * Keyboard shortcuts for the PR preview/review screen:
 * - `]` / `n` -> next changed file
 * - `[` / `p` -> previous changed file
 * - `Escape`  -> back to the inbox
 * - `?`       -> toggle the shortcuts help overlay
 *
 * File movement reuses the same Pierre file-tree focus traversal that the
 * `j`/`k` sidebar navigation uses, so all navigation stays in sync and selects
 * through the existing `pull-request-files` nav region.
 */
export function usePullRequestReviewHotkeys({
  onBack,
  onToggleHelp,
  enabled = true,
}: UsePullRequestReviewHotkeysOptions) {
  const dispatch = useAppDispatch();

  function moveFile(event: KeyboardEvent, next: boolean) {
    if (isTypingTarget(event.target)) {
      return;
    }
    const targetFile = movePierreFileTreeFocusToFile(PR_FILES_REGION, next);
    if (!targetFile) {
      return;
    }
    event.preventDefault();
    startTransition(() => {
      dispatch(setPullRequestPreviewActiveFilePath(targetFile.realPath ?? targetFile.path));
    });
  }

  useHotkey("]", (event) => moveFile(event, true), { ...REVIEW_HOTKEY_OPTIONS, enabled });
  useHotkey(
    "N",
    (event) => {
      if (event.shiftKey) return;
      moveFile(event, true);
    },
    { ...REVIEW_HOTKEY_OPTIONS, enabled },
  );

  useHotkey("[", (event) => moveFile(event, false), { ...REVIEW_HOTKEY_OPTIONS, enabled });
  useHotkey(
    "P",
    (event) => {
      if (event.shiftKey) return;
      moveFile(event, false);
    },
    { ...REVIEW_HOTKEY_OPTIONS, enabled },
  );

  useHotkey(
    "Escape",
    (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      onBack();
    },
    { ...REVIEW_HOTKEY_OPTIONS, enabled },
  );

  // Shift+/ is `?` on common layouts -> toggle the shortcuts help overlay.
  useHotkey(
    "/",
    (event) => {
      if (!event.shiftKey || isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      onToggleHelp();
    },
    { ...REVIEW_HOTKEY_OPTIONS, enabled },
  );
}
