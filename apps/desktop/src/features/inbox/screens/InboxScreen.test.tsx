/// <reference types="@testing-library/jest-dom" />

import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MemoryRouter } from "react-router";

import type {
  InboxPullRequestsResult,
  PullRequestSummary,
} from "../../../platform/desktop/contracts";

import { InboxScreen } from "./InboxScreen";

const mocks = vi.hoisted(() => ({
  activeRepo: "/tmp/repo" as string | null,
  isRefreshing: false,
  refreshInbox: vi.fn(),
  useGetInboxPullRequestsQuery: vi.fn(),
  useResolveHostedRepoQuery: vi.fn(),
  navigateToPreview: vi.fn(),
  prefetchPRDetail: vi.fn(),
  backgroundPrefetchPRDetail: vi.fn(),
}));

vi.mock("@/app/hooks", () => ({
  useAppSelector: (
    selector: (state: {
      sourceControl: { activeRepo: string | null };
      settings: { appSettings: { inboxSectionVisibility?: Record<string, boolean> } };
    }) => unknown,
  ) =>
    selector({
      sourceControl: {
        activeRepo: mocks.activeRepo,
      },
      settings: {
        appSettings: {
          inboxSectionVisibility: undefined,
        },
      },
    }),
  useAppDispatch: () => vi.fn(),
}));

vi.mock("@/components/layout/ResizableSidebarLayout", () => ({
  ResizableSidebarLayout: ({ sidebar, content }: { sidebar: ReactNode; content: ReactNode }) => (
    <div data-testid="resizable-sidebar-layout">
      <div data-testid="sidebar">{sidebar}</div>
      <div data-testid="content">{content}</div>
    </div>
  ),
}));

vi.mock("@/features/hosted-repos/api", () => ({
  useResolveHostedRepoQuery: mocks.useResolveHostedRepoQuery,
  useGetInboxPullRequestsQuery: mocks.useGetInboxPullRequestsQuery,
  useRefreshInboxPullRequestsMutation: () => [
    mocks.refreshInbox,
    { isLoading: mocks.isRefreshing },
  ],
}));

vi.mock("@/features/inbox/hooks/useInboxNavigation", () => ({
  prefetchPullRequestDetail: mocks.backgroundPrefetchPRDetail,
  useInboxNavigation: () => ({
    navigateToPreview: mocks.navigateToPreview,
    navigateToDiff: vi.fn(),
    launchReviewer: vi.fn(),
    prefetchPRDetail: mocks.prefetchPRDetail,
  }),
}));

function createPullRequest(overrides: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    id: overrides.id ?? `pr-${Math.random().toString(36).slice(2)}`,
    providerId: overrides.providerId ?? "bitbucket",
    number: overrides.number ?? 101,
    title: overrides.title ?? "Fix login flow",
    state: overrides.state ?? "open",
    isDraft: overrides.isDraft ?? false,
    authorLogin: overrides.authorLogin ?? "alice",
    authorDisplayName: overrides.authorDisplayName ?? "Alice",
    url: overrides.url ?? "https://example.com/pr/101",
    baseRef: overrides.baseRef ?? "main",
    headRef: overrides.headRef ?? "feature/login",
    headOwner: overrides.headOwner ?? "acme",
    headRepo: overrides.headRepo ?? "repo",
    updatedAt: overrides.updatedAt ?? "2024-01-01T12:00:00.000Z",
    participants: overrides.participants,
    reviewers: overrides.reviewers,
    authorUuid: overrides.authorUuid,
    authorAccountId: overrides.authorAccountId,
    commentCount: overrides.commentCount,
    buildStatuses: overrides.buildStatuses,
  };
}

function createInboxData(
  overrides: Partial<InboxPullRequestsResult> = {},
): InboxPullRequestsResult {
  const needsReviewFirst = createPullRequest({
    id: "needs-1",
    number: 101,
    title: "Fix login flow",
  });
  const needsReviewSecond = createPullRequest({
    id: "needs-2",
    number: 102,
    title: "Update docs",
    authorLogin: "bob",
    authorDisplayName: "Bob",
  });
  const waiting = createPullRequest({
    id: "waiting-1",
    number: 201,
    title: "Waiting on reviews",
    authorLogin: "carol",
  });
  const merging = createPullRequest({
    id: "merged-1",
    number: 301,
    title: "Ship release branch",
    state: "merged",
    authorLogin: "me",
  });

  return {
    sections: {
      NEEDS_REVIEW: [needsReviewFirst, needsReviewSecond],
      WAITING_FOR_REVIEW: [waiting],
      RETURNED_TO_YOU: [],
      APPROVED: [],
      DRAFTS: [],
      MERGING_AND_MERGED: [merging],
      ...overrides.sections,
    },
    userLogin: overrides.userLogin ?? "me",
    fetchedAt: overrides.fetchedAt ?? 1710000000000,
    isStale: overrides.isStale ?? false,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <InboxScreen />
    </MemoryRouter>,
  );
}

describe("InboxScreen", () => {
  beforeEach(() => {
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
    Object.defineProperty(window, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    });
    mocks.activeRepo = "/tmp/repo";
    mocks.isRefreshing = false;
    mocks.refreshInbox.mockReset();
    mocks.refreshInbox.mockResolvedValue(undefined);
    mocks.useResolveHostedRepoQuery.mockReset();
    mocks.useGetInboxPullRequestsQuery.mockReset();
    mocks.navigateToPreview.mockReset();
    mocks.prefetchPRDetail.mockReset();
    mocks.backgroundPrefetchPRDetail.mockReset();

    mocks.useResolveHostedRepoQuery.mockReturnValue({
      data: { providerId: "bitbucket" },
      isLoading: false,
    });

    mocks.useGetInboxPullRequestsQuery.mockReturnValue({
      data: createInboxData(),
      error: undefined,
      isLoading: false,
      isFetching: false,
    });
  });

  it("shows no active repository when no activeRepo exists", () => {
    mocks.activeRepo = null;

    renderScreen();

    expect(screen.getByText("No active repository selected.")).toBeInTheDocument();
  });

  it("shows resolving repository while hosted repo is loading", () => {
    mocks.useResolveHostedRepoQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderScreen();

    expect(screen.getByText("Resolving repository…")).toBeInTheDocument();
  });

  it("shows a Bitbucket-only message when the provider is not bitbucket", () => {
    mocks.useResolveHostedRepoQuery.mockReturnValue({
      data: { providerId: "github" },
      isLoading: false,
    });

    renderScreen();

    expect(screen.getByText("Inbox currently supports Bitbucket repos only.")).toBeInTheDocument();
  });

  it("shows a loading skeleton when loading with no data", () => {
    mocks.useGetInboxPullRequestsQuery.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isFetching: false,
    });

    const { container } = renderScreen();

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("shows an error message when inbox loading fails", () => {
    mocks.useGetInboxPullRequestsQuery.mockReturnValue({
      data: undefined,
      error: { message: "Inbox failed to load" },
      isLoading: false,
      isFetching: false,
    });

    renderScreen();

    expect(screen.getByText("Inbox failed to load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders inbox section counts from fetched data", () => {
    renderScreen();

    const needsReviewButton = screen.getByRole("button", { name: /Needs your review/i });
    const waitingButton = screen.getByRole("button", { name: /Waiting for review/i });

    expect(within(needsReviewButton).getByText("2")).toBeInTheDocument();
    expect(within(waitingButton).getByText("1")).toBeInTheDocument();
  });

  it("renders inbox pull request rows for the active section", () => {
    renderScreen();

    expect(screen.getByRole("button", { name: /Fix login flow/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update docs/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Waiting on reviews/i })).not.toBeInTheDocument();
  });

  it("filters pull requests by title using the search box", () => {
    renderScreen();

    fireEvent.change(screen.getByTestId("inbox-search-input"), {
      target: { value: "docs" },
    });

    expect(screen.getByRole("button", { name: /Update docs/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fix login flow/i })).not.toBeInTheDocument();
  });

  it("changes the displayed pull requests when a sidebar section is clicked", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /Waiting for review/i }));

    expect(screen.getByRole("button", { name: /Waiting on reviews/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fix login flow/i })).not.toBeInTheDocument();
  });

  it("shows the stale data indicator for the merging section", () => {
    mocks.useGetInboxPullRequestsQuery.mockReturnValue({
      data: createInboxData({ isStale: true }),
      error: undefined,
      isLoading: false,
      isFetching: false,
    });

    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /Merging \/ recently merged/i }));

    expect(screen.getByText("Loading more data…")).toBeInTheDocument();
  });

  it("uses the shared PR detail prefetch helper for background hydration", () => {
    vi.useFakeTimers();

    try {
      renderScreen();

      act(() => {
        vi.runOnlyPendingTimers();
      });

      expect(mocks.backgroundPrefetchPRDetail).toHaveBeenNthCalledWith(
        1,
        expect.any(Function),
        "/tmp/repo",
        expect.objectContaining({ id: "needs-1", number: 101 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
