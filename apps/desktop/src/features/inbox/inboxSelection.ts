export type InboxSelectionDirection = "next" | "previous";

/**
 * Computes the next selected PR id when moving a keyboard cursor across an
 * ordered, flat list of visible PR ids (spanning whatever rows are currently
 * rendered, across all sections).
 *
 * Rules:
 * - Empty list -> null.
 * - No current selection -> first id when moving next, last id when moving previous.
 * - Current selection not in the list (stale) -> first id when moving next,
 *   last id when moving previous.
 * - Movement clamps at the ends (does not wrap) so holding the key parks the
 *   cursor on the first/last row instead of cycling unexpectedly.
 */
export function nextInboxSelection(
  orderedIds: readonly string[],
  currentId: string | null,
  direction: InboxSelectionDirection,
): string | null {
  if (orderedIds.length === 0) {
    return null;
  }

  const currentIndex = currentId === null ? -1 : orderedIds.indexOf(currentId);

  if (currentIndex === -1) {
    return direction === "next" ? orderedIds[0] : orderedIds[orderedIds.length - 1];
  }

  const delta = direction === "next" ? 1 : -1;
  const nextIndex = Math.min(orderedIds.length - 1, Math.max(0, currentIndex + delta));

  return orderedIds[nextIndex];
}
