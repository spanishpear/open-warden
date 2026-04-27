// TEMPORARY: Debug screen for inbox feature testing. Remove before release.
import { skipToken } from "@reduxjs/toolkit/query";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useAppSelector } from "@/app/hooks";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  useGetInboxPullRequestsQuery,
  useRefreshInboxPullRequestsMutation,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";

const SECTION_KEYS = [
  "NEEDS_REVIEW",
  "WAITING_FOR_REVIEW",
  "RETURNED_TO_YOU",
  "DRAFTS",
  "APPROVED",
  "MERGING_AND_MERGED",
] as const;

const DEFAULT_COLLAPSE_THRESHOLD = 25;
const COLLAPSED_PREVIEW_COUNT = 3;

function defaultOpenSections(inboxData: Record<string, { length: number }> | undefined): string[] {
  if (!inboxData) {
    return [];
  }

  return SECTION_KEYS.filter((sectionKey) => {
    const count = inboxData[sectionKey]?.length ?? 0;
    return count > 0 && count <= DEFAULT_COLLAPSE_THRESHOLD;
  });
}

export function InboxDebugScreen() {
  const activeRepo = useAppSelector((state) => state.sourceControl.activeRepo);
  const [openSections, setOpenSections] = useState<string[]>([]);

  const activeRepoArg = activeRepo ? activeRepo : skipToken;

  const { data: hostedRepo, isLoading: resolvingRepo } = useResolveHostedRepoQuery(activeRepoArg);

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

  if (resolvingRepo) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Resolving repository...
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

  if (hostedRepo.providerId !== "bitbucket") {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Inbox Debug currently supports Bitbucket repos only. Current provider:{" "}
        <strong className="ml-1">{hostedRepo.providerId}</strong>.
      </div>
    );
  }

  const errorMsg = errorMessageFrom(inboxError, "");

  useEffect(() => {
    setOpenSections(defaultOpenSections(inboxData?.sections));
  }, [inboxData?.fetchedAt, inboxData?.sections]);

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
            disabled={isRefreshing || isLoading || isFetching}
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

        {(isLoading || isFetching) && !inboxData && (
          <div className="text-muted-foreground text-sm">Loading inbox data...</div>
        )}

        {inboxData && (
          <div className="flex flex-col gap-6">
            <div className="text-muted-foreground text-xs">
              Sections with more than {DEFAULT_COLLAPSE_THRESHOLD} PRs start collapsed to keep this
              debug view usable.
            </div>

            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
              {SECTION_KEYS.map((sectionKey) => {
                const prs = inboxData.sections[sectionKey] || [];
                const collapsedPreview = prs
                  .slice(0, COLLAPSED_PREVIEW_COUNT)
                  .map((pr) => `#${pr.number}`);
                const hiddenCount = Math.max(prs.length - COLLAPSED_PREVIEW_COUNT, 0);

                return (
                  <AccordionItem
                    key={sectionKey}
                    value={sectionKey}
                    className="rounded-lg border border-border/70 bg-surface-0 px-4"
                  >
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold">{sectionKey}</span>
                          <span className="text-muted-foreground text-xs">({prs.length})</span>
                        </div>

                        {prs.length > DEFAULT_COLLAPSE_THRESHOLD ? (
                          <div className="text-muted-foreground text-xs">
                            Large section — collapsed by default. Preview:{" "}
                            {collapsedPreview.join(", ")}
                            {hiddenCount > 0 ? ` +${hiddenCount} more` : ""}
                          </div>
                        ) : prs.length === 0 ? (
                          <div className="text-muted-foreground text-xs">
                            No pull requests in this section.
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-xs">
                            Click to inspect this section.
                          </div>
                        )}
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-4">
                      {prs.length === 0 ? null : (
                        <ul className="flex flex-col gap-2">
                          {prs.map((pr) => (
                            <li key={pr.id} className="text-sm">
                              <span className="text-muted-foreground mr-2">#{pr.number}</span>
                              <span className="font-medium">{pr.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </div>
  );
}
