// TEMPORARY: Debug screen for inbox feature testing. Remove before release.
import { skipToken } from "@reduxjs/toolkit/query";
import { RefreshCw } from "lucide-react";

import { useAppSelector } from "@/app/hooks";
import { Button } from "@/components/ui/button";
import {
  useGetInboxPullRequestsQuery,
  useRefreshInboxPullRequestsMutation,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";

export function InboxDebugScreen() {
  const activeRepo = useAppSelector((state) => state.sourceControl.activeRepo);

  const activeRepoArg = activeRepo ? activeRepo : skipToken;

  const { data: hostedRepo } = useResolveHostedRepoQuery(activeRepoArg);

  const inboxRepoArg =
    activeRepo && hostedRepo?.providerId === "bitbucket" ? activeRepo : skipToken;

  const {
    data: inboxData,
    error: inboxError,
    isLoading,
    isFetching,
  } = useGetInboxPullRequestsQuery(inboxRepoArg);

  const [refreshInbox, { isLoading: isRefreshing }] = useRefreshInboxPullRequestsMutation();

  if (!activeRepo) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No active repository selected.
      </div>
    );
  }

  if (hostedRepo && hostedRepo.providerId !== "bitbucket") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Inbox Debug currently supports Bitbucket repos only. Current provider:{" "}
        <strong className="ml-1">{hostedRepo.providerId}</strong>.
      </div>
    );
  }

  if (!hostedRepo) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Could not resolve hosted repo for this path.
      </div>
    );
  }

  const errorMsg = errorMessageFrom(inboxError, "");

  const sections = [
    "NEEDS_REVIEW",
    "WAITING_FOR_REVIEW",
    "RETURNED_TO_YOU",
    "DRAFTS",
    "APPROVED",
    "MERGING_AND_MERGED",
  ];

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
        <header className="border-border/70 flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Inbox Debug</h1>
            <div className="text-muted-foreground mt-1 text-xs">
              {inboxData ? (
                <>
                  Fetched at: {new Date(inboxData.fetchedAt).toLocaleString()} | Stale:{" "}
                  {inboxData.isStale ? "Yes" : "No"} | User: {inboxData.userLogin ?? "Unknown"}
                </>
              ) : (
                "Loading or no data..."
              )}
            </div>
          </div>

          <Button
            size="sm"
            disabled={isRefreshing || isLoading || isFetching || hostedRepo.providerId !== "bitbucket"}
            onClick={() => {
              void refreshInbox(activeRepo);
            }}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Force Refresh
          </Button>
        </header>

        {errorMsg && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {isLoading && !inboxData && (
          <div className="text-muted-foreground text-sm">Loading inbox data...</div>
        )}

        {inboxData && (
          <div className="flex flex-col gap-6">
            {sections.map((sectionKey) => {
              const prs = inboxData.sections[sectionKey] || [];
              return (
                <section key={sectionKey} className="rounded-lg border border-border/70 bg-surface-0 p-4">
                  <h2 className="mb-3 text-sm font-semibold">
                    {sectionKey} <span className="text-muted-foreground ml-2">({prs.length})</span>
                  </h2>
                  {prs.length === 0 ? (
                    <div className="text-muted-foreground text-xs">No pull requests in this section.</div>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {prs.map((pr) => (
                        <li key={pr.id} className="text-sm">
                          <span className="text-muted-foreground mr-2">#{pr.number}</span>
                          <span className="font-medium">{pr.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
