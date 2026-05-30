export type ShortcutEntry = {
  /** One or more key combos that trigger the action (shown as alternatives). */
  keys: string[];
  description: string;
};

export type ShortcutGroup = {
  title: string;
  shortcuts: ShortcutEntry[];
};

export const INBOX_SHORTCUTS: ShortcutGroup = {
  title: "Inbox",
  shortcuts: [
    { keys: ["j", "↓"], description: "Move selection down" },
    { keys: ["k", "↑"], description: "Move selection up" },
    { keys: ["Enter", "o"], description: "Open selected pull request" },
    { keys: ["/"], description: "Focus search" },
    { keys: ["Esc"], description: "Clear search / selection" },
  ],
};

export const REVIEW_SHORTCUTS: ShortcutGroup = {
  title: "Pull request review",
  shortcuts: [
    { keys: ["]", "n"], description: "Next changed file" },
    { keys: ["[", "p"], description: "Previous changed file" },
    { keys: ["j", "k"], description: "Move through file list" },
    { keys: ["Esc"], description: "Back to inbox" },
  ],
};

export const GLOBAL_SHORTCUTS: ShortcutGroup = {
  title: "General",
  shortcuts: [{ keys: ["?"], description: "Toggle this help" }],
};

export const ALL_SHORTCUT_GROUPS: ShortcutGroup[] = [
  INBOX_SHORTCUTS,
  REVIEW_SHORTCUTS,
  GLOBAL_SHORTCUTS,
];
