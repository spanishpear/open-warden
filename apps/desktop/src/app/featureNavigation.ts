import { GitBranch, GitPullRequest, GitPullRequestArrow, History, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FeatureKey = "changes" | "history" | "review" | "pull-requests" | "inbox";

type FeatureNavItem = {
  key: FeatureKey;
  path: `/${FeatureKey}`;
  label: string;
  icon: LucideIcon;
};

export const FEATURE_NAV_ITEMS: FeatureNavItem[] = [
  { key: "inbox", path: "/inbox", label: "Inbox", icon: Inbox },
  { key: "changes", path: "/changes", label: "Changes", icon: GitPullRequestArrow },
  { key: "pull-requests", path: "/pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { key: "history", path: "/history", label: "History", icon: History },
  { key: "review", path: "/review", label: "Review", icon: GitBranch },
];

export function featureKeyFromPath(pathname: string): FeatureKey {
  if (pathname.startsWith("/inbox")) return "inbox";
  if (pathname.startsWith("/pull-requests")) return "pull-requests";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/review")) return "review";
  return "changes";
}

export type SidebarConfig = {
  panelId: string;
  icon: "left" | "right";
};

export const FEATURE_SIDEBARS: Record<FeatureKey, SidebarConfig[]> = {
  inbox: [],
  changes: [{ panelId: "primary", icon: "left" }],
  "pull-requests": [],
  history: [
    { panelId: "primary", icon: "left" },
    { panelId: "history-files", icon: "right" },
  ],
  review: [{ panelId: "review", icon: "left" }],
};
