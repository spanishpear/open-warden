import {
  CheckCircle2,
  GitBranch,
  GitPullRequest,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";

import type { PullRequestSummary } from "@/platform/desktop";

type InboxPRRowProps = {
  pr: PullRequestSummary;
  isSelected?: boolean;
  onClick: (pr: PullRequestSummary) => void;
  onMouseEnter?: (pr: PullRequestSummary) => void;
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

export function InboxPRRow({ pr, isSelected, onClick, onMouseEnter }: InboxPRRowProps) {
  const hasFailedBuild = pr.buildStatuses?.some((b) => b.state === "failed");
  const hasInProgressBuild = pr.buildStatuses?.some((b) => b.state === "inprogress");
  const hasSuccessfulBuild = pr.buildStatuses?.some((b) => b.state === "successful");
  const hasBuilds = pr.buildStatuses && pr.buildStatuses.length > 0;

  return (
    <button
      type="button"
      className={`hover:bg-surface-1 block w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
        isSelected ? "bg-surface-1" : ""
      }`}
      onClick={() => {
        onClick(pr);
      }}
      onMouseEnter={() => {
        onMouseEnter?.(pr);
      }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-muted-foreground">
          <GitPullRequest className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-medium">
              #{pr.number} {pr.title}
            </div>
            {pr.isDraft ? (
              <div className="bg-zinc-500/15 text-zinc-400 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                Draft
              </div>
            ) : pr.state === "open" ? (
              <div className="bg-green-500/15 text-green-400 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                Open
              </div>
            ) : pr.state === "merged" ? (
              <div className="bg-purple-500/15 text-purple-400 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                Merged
              </div>
            ) : pr.state === "closed" ? (
              <div className="bg-red-500/15 text-red-400 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                Closed
              </div>
            ) : null}
          </div>

          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-5">
            <span>{pr.authorLogin}</span>
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {pr.baseRef} ← {pr.headRef}
            </span>
            <span>{formatRelativeTime(pr.updatedAt)}</span>

            <div className="ml-auto flex items-center gap-3">
              {hasBuilds ? (
                <div className="flex items-center">
                  {hasFailedBuild ? (
                    <XCircle className="text-red-400 h-3.5 w-3.5" />
                  ) : hasInProgressBuild ? (
                    <Loader2 className="text-yellow-400 h-3.5 w-3.5 animate-spin" />
                  ) : hasSuccessfulBuild ? (
                    <CheckCircle2 className="text-green-400 h-3.5 w-3.5" />
                  ) : null}
                </div>
              ) : null}

              {pr.commentCount !== undefined && pr.commentCount > 0 ? (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{pr.commentCount}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
