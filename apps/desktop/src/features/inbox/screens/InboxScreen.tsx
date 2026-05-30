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
import {
  INBOX_SEARCH_INPUT_ID,
  InboxQuickFilters,
  type InboxFilter,
} from "@/features/inbox/components/InboxQuickFilters";
import { InboxSectionSidebar } from "@/features/inbox/components/InboxSectionSidebar";
import { useInboxNavigation } from "@/features/inbox/hooks/useInboxNavigation";
import { useInboxKeyboardNav } from "@/features/inbox/hooks/useInboxKeyboardNav";
import { useBackgroundInboxPrefetch } from "@/features/inbox/hooks/useBackgroundInboxPrefetch";
import { ShortcutsHelpOverlay } from "@/features/shortcuts/ShortcutsHelpOverlay";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import { updateInboxSectionVisibility } from "@/features/settings/actions";
import type {
  InboxBackgroundWorkMetadata,
  InboxCacheScopeMetadata,
  PullRequestSummary,
} from "@/platform/desktop";

const ORDERED_SECTIONS = [
  "NEEDS_REVIEW",
  "WAITING_FOR_REVIEW",
  "RETURNED_TO_YOU",
  "APPROVED",
  "DRAFTS",
  "MERGING_AND_MERGED",
];

function formatCacheAge(fetchedAt: number | null) {
  if (fetchedAt === null) {
    return "not cached";
  }

  const elapsedMs = Math.max(0, Date.now() - fetchedAt);
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${String(elapsedMinutes)}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${String(elapsedHours)}h ago`;
  }

  return `${String(Math.floor(elapsedHours / 24))}d ago`;
}

function formatCacheScope(label: string, cache: InboxCacheScopeMetadata) {
  if (cache.source === "empty") {
    return `${label}: not cached`;
  }

  const source = cache.source === "live" ? "live" : "cached";
  const qualifiers = [cache.isStale ? "stale" : null, cache.isPartial ? "partial" : null].filter(
    Boolean,
  );
  const suffix = qualifiers.length > 0 ? ` (${qualifiers.join(", ")})` : "";
  return `${label}: ${source} ${formatCacheAge(cache.fetchedAt)}${suffix}`;
}

function formatBackgroundWork(background: InboxBackgroundWorkMetadata) {
  if (background.openRefresh && background.mergedRefresh) {
    return "Refreshing open and merged PRs in the background";
  }

  if (background.openRefresh) {
    return "Refreshing open PRs in the background";
  }

  if (background.mergedRefresh) {
    return "Warming merged PR cache in the background";
  }

  return null;
}

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
  useBackgroundInboxPrefetch();

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
  const backgroundWorkLabel = inboxData ? formatBackgroundWork(inboxData.background) : null;
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
            {inboxData ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{formatCacheScope("Open", inboxData.cache.open)}</span>
                <span>{formatCacheScope("Merged", inboxData.cache.merged)}</span>
                {backgroundWorkLabel ? <span>{backgroundWorkLabel}</span> : null}
              </div>
            ) : null}
          </div>

          {activeSection === "MERGING_AND_MERGED" && inboxData?.isStale ? (
            <div className="px-4 py-1 text-xs text-muted-foreground">Loading more data…</div>
          ) : null}

          {filteredPRs.length === 0 && !isLoading ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              No pull requests in this section.
            </div>
          ) : null}

          <InboxList
            prs={filteredPRs}
            searchText={searchText}
            onClearSearch={() => setSearchText("")}
            onOpen={navigateToPreview}
            onMouseEnter={prefetchPRDetail}
          />
        </div>
      }
    />
  );
}

type InboxListProps = {
  prs: PullRequestSummary[];
  searchText: string;
  onClearSearch: () => void;
  onOpen: (pr: PullRequestSummary) => void;
  onMouseEnter: (pr: PullRequestSummary) => void;
};

function InboxList({ prs, searchText, onClearSearch, onOpen, onMouseEnter }: InboxListProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  useInboxKeyboardNav({
    orderedIds: prs.map((pr) => pr.id),
    onOpen: (prId) => {
      const pr = prs.find((candidate) => candidate.id === prId);
      if (pr) {
        onOpen(pr);
      }
    },
    searchInputId: INBOX_SEARCH_INPUT_ID,
    onClearSearch,
    hasSearchText: searchText.length > 0,
    onToggleHelp: () => setHelpOpen((open) => !open),
  });

  return (
    <>
      <Virtualizer
        config={{ overscrollSize: 400, intersectionObserverMargin: 800 }}
        className="flex-1 overflow-y-auto px-2 py-2"
      >
        {prs.map((pr) => (
          <InboxPRRow key={pr.id} pr={pr} onClick={onOpen} onMouseEnter={onMouseEnter} />
        ))}
      </Virtualizer>
      <ShortcutsHelpOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
