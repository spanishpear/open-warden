/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  usePullRequestPendingReviewActions: vi.fn(),
  submitReviewDecision: vi.fn(),
  publishAllPendingDrafts: vi.fn(),
}));

vi.mock("@/features/pull-requests/hooks/usePullRequestPendingReviewActions", () => ({
  usePullRequestPendingReviewActions: mocks.usePullRequestPendingReviewActions,
}));

import { PullRequestReviewDecisionButtons } from "./PullRequestReviewDecisionButtons";

function defaultActions(overrides: Record<string, unknown> = {}) {
  return {
    pendingDrafts: [],
    pendingDraftCount: 0,
    allPendingPayload: "",
    isSubmittingReviewComments: false,
    isSubmittingReviewDecision: false,
    isSubmittingReview: false,
    submitReviewDecision: mocks.submitReviewDecision,
    publishAllPendingDrafts: mocks.publishAllPendingDrafts,
    getPendingDraftsForFile: () => [],
    getPendingPayloadForFile: () => "",
    copyAllPendingDrafts: vi.fn(),
    copyAnchorPendingDrafts: vi.fn(),
    clearAllPendingDrafts: vi.fn(),
    clearAnchorPendingDrafts: vi.fn(),
    publishAnchorPendingDrafts: vi.fn(),
    ...overrides,
  };
}

function renderButtons(overrides: Record<string, unknown> = {}) {
  mocks.usePullRequestPendingReviewActions.mockReturnValue(defaultActions(overrides));
  return render(
    <PullRequestReviewDecisionButtons
      repoPath="/repo/a"
      pullRequestNumber={42}
      compareBaseRef="main"
      compareHeadRef="feature"
    />,
  );
}

describe("PullRequestReviewDecisionButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.submitReviewDecision.mockResolvedValue(undefined);
  });

  it("renders Approve and Request changes buttons", () => {
    renderButtons();
    expect(screen.getByRole("button", { name: /approve pull request/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request changes/i })).toBeInTheDocument();
  });

  it("invokes submitReviewDecision with APPROVE when Approve clicked", () => {
    renderButtons();
    fireEvent.click(screen.getByRole("button", { name: /approve pull request/i }));
    expect(mocks.submitReviewDecision).toHaveBeenCalledWith("APPROVE");
  });

  it("invokes submitReviewDecision with REQUEST_CHANGES when Request changes clicked", () => {
    renderButtons();
    fireEvent.click(screen.getByRole("button", { name: /request changes/i }));
    expect(mocks.submitReviewDecision).toHaveBeenCalledWith("REQUEST_CHANGES");
  });

  it("uses a pending-aware aria-label when there are pending drafts", () => {
    renderButtons({ pendingDraftCount: 3 });
    expect(
      screen.getByRole("button", {
        name: /approve pull request and publish pending comments/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /request changes and publish pending comments/i }),
    ).toBeInTheDocument();
  });

  it("disables buttons while a review submission is in flight", () => {
    renderButtons({ isSubmittingReview: true });
    expect(screen.getByRole("button", { name: /approve pull request/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /request changes/i })).toBeDisabled();
  });

  it("disables buttons when repo path is empty", () => {
    mocks.usePullRequestPendingReviewActions.mockReturnValue(defaultActions());
    render(
      <PullRequestReviewDecisionButtons
        repoPath=""
        pullRequestNumber={42}
        compareBaseRef="main"
        compareHeadRef="feature"
      />,
    );
    expect(screen.getByRole("button", { name: /approve pull request/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /request changes/i })).toBeDisabled();
  });

  it("disables buttons when pull request number is invalid", () => {
    mocks.usePullRequestPendingReviewActions.mockReturnValue(defaultActions());
    render(
      <PullRequestReviewDecisionButtons
        repoPath="/repo/a"
        pullRequestNumber={0}
        compareBaseRef="main"
        compareHeadRef="feature"
      />,
    );
    expect(screen.getByRole("button", { name: /approve pull request/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /request changes/i })).toBeDisabled();
  });
});
