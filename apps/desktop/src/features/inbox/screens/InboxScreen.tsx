import { skipToken } from "@reduxjs/toolkit/query";
import { useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";
import { selectActiveRepo } from "@/features/source-control/sourceControlSlice";
import { Button } from "@/components/ui/button";
import {
  useGetInboxPullRequestsQuery,
  useRefreshInboxPullRequestsMutation,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import { InboxPRRow } from "@/features/inbox/components/InboxPRRow";
import { Virtualizer } from "@pierre/diffs/react";
import { InboxQuickFilters, type InboxFilter } from "@/features/inbox/components/InboxQuickFilters";
import { InboxSectionSidebar } from "@/features/inbox/components/InboxSectionSidebar";
import { useInboxNavigation } from "@/features/inbox/hooks/useInboxNavigation";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import { updateInboxSectionVisibility } from "@/features/settings/actions";

const ORDERED_SECTIONS = [
  "NEEDS_REVIEW",
  "WAITING_FOR_REVIEW",
  "RETURNED_TO_YOU",
  "APPROVED",
  "DRAFTS",
  "MERGING_AND_MERGED",
];

export function InboxScreen() {
  const activeRepo = useAppSelector(selectActiveRepo);
  const dispatch = useAppDispatch();
  const inboxSectionVisibility = useAppSelector(
    (state) => state.settings.appSettings.inboxSectionVisibility,
  );
  const activeRepoArg = activeRepo ? activeRepo : skipToken;
  const { data: hostedRepo, isLoading: resolvingRepo } = useResolveHostedRepoQuery(activeRepoArg);
  const inboxRepoArg =
    activeRepo && hostedRepo?.providerId === "bitbucket" ? activeRepo : skipToken;
  const {
    data: inboxData,
    error: inboxError,
    isLoading,
    isFetching,
  } = useGetInboxPullRequestsQuery(inboxRepoArg, {
    selectFromResult: ({ data, error, isLoading, isFetching }) => ({
      data,
      error,
      isLoading,
      isFetching,
    }),
  });
  const [refreshInbox, { isLoading: isRefreshing }] = useRefreshInboxPullRequestsMutation();

  const { navigateToPreview, prefetchPRDetail } = useInboxNavigation();

  const [activeSection, setActiveSection] = useState<string>("NEEDS_REVIEW");
  const [searchText, setSearchText] = useState("");
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");

  if (!activeRepo) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No active repository selected.
      </div>
    );
  }

  if (resolvingRepo) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        Resolving repository…
      </div>
    );
  }

  if (hostedRepo?.providerId !== "bitbucket") {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        Inbox currently supports Bitbucket repos only.
      </div>
    );
  }

  if (isLoading && !inboxData) {
    return (
      <div className="space-y-2 p-4">
        <div className="bg-background/80 h-16 animate-pulse rounded-lg border border-border/70" />
        <div className="bg-background/80 h-16 animate-pulse rounded-lg border border-border/70" />
        <div className="bg-background/80 h-16 animate-pulse rounded-lg border border-border/70" />
      </div>
    );
  }

  const errorMessage = inboxError
    ? errorMessageFrom(inboxError, "Unable to load inbox pull requests.")
    : "";

  if (errorMessage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        <div className="text-destructive text-sm">{errorMessage}</div>
        <Button
          size="sm"
          onClick={() => {
            void refreshInbox(activeRepo);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const sectionCounts = ORDERED_SECTIONS.map((key) => ({
    key,
    count: inboxData?.sections[key]?.length ?? 0,
  }));

  const rawPRs = inboxData?.sections[activeSection] ?? [];
  const filteredPRs = rawPRs.filter((pr) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const matchesTitle = pr.title.toLowerCase().includes(q);
      const matchesAuthor =
        pr.authorLogin.toLowerCase().includes(q) ||
        (pr.authorDisplayName?.toLowerCase().includes(q) ?? false);
      if (!matchesTitle && !matchesAuthor) {
        return false;
      }
    }

    if (activeFilter === "open") return pr.state === "open" && !pr.isDraft;
    if (activeFilter === "draft") return pr.isDraft;
    if (activeFilter === "merged") return pr.state === "merged";
    if (activeFilter === "mine") return pr.authorLogin === inboxData?.userLogin;
    return true;
  });

  return (
    <ResizableSidebarLayout
      panelId="inbox"
      sidebarDefaultSize={22}
      sidebarMinSize={14}
      sidebarMaxSize={34}
      sidebar={
        <InboxSectionSidebar
          sections={sectionCounts}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onRefresh={() => {
            void refreshInbox(activeRepo);
          }}
          isRefreshing={isRefreshing || isFetching}
          sectionVisibility={inboxSectionVisibility}
          onToggleVisibility={(key, visible) => {
            void dispatch(updateInboxSectionVisibility(key, visible));
          }}
        />
      }
      content={
        <div className="flex h-full flex-col">
          <div className="border-border/70 border-b px-4 py-3">
            <InboxQuickFilters
              searchText={searchText}
              onSearchChange={setSearchText}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
          </div>

          {activeSection === "MERGING_AND_MERGED" && inboxData?.isStale ? (
            <div className="px-4 py-1 text-xs text-muted-foreground">Loading more data…</div>
          ) : null}

          {filteredPRs.length === 0 && !isLoading ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              No pull requests in this section.
            </div>
          ) : null}

          <Virtualizer
            config={{ overscrollSize: 400, intersectionObserverMargin: 800 }}
            className="flex-1 overflow-y-auto px-2 py-2"
          >
            {filteredPRs.map((pr) => (
              <InboxPRRow
                key={pr.id}
                pr={pr}
                onClick={navigateToPreview}
                onMouseEnter={prefetchPRDetail}
              />
            ))}
          </Virtualizer>
        </div>
      }
    />
  );
}
