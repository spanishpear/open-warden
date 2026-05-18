import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  selectedDrafts: [] as Array<Record<string, unknown>>,
  submitComments: vi.fn(),
  submitDecision: vi.fn(),
  submitCommentsUnwrap: vi.fn(),
  submitDecisionUnwrap: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: () => unknown) => selector(),
}));

vi.mock("@/features/comments/memoizedSelectors", () => ({
  selectPendingDrafts: () => () => mocks.selectedDrafts,
}));

vi.mock("@/features/comments/commentsSlice", () => ({
  removeCommentsByIds: (ids: string[]) => ({ type: "remove", payload: ids }),
}));

vi.mock("@/features/hosted-repos/api", () => ({
  useSubmitPullRequestReviewCommentsMutation: () => [
    (...args: unknown[]) => {
      mocks.submitComments(...args);
      return { unwrap: mocks.submitCommentsUnwrap };
    },
    { isLoading: false },
  ],
  useSubmitPullRequestReviewDecisionMutation: () => [
    (...args: unknown[]) => {
      mocks.submitDecision(...args);
      return { unwrap: mocks.submitDecisionUnwrap };
    },
    { isLoading: false },
  ],
}));

import { usePullRequestPendingReviewActions } from "./usePullRequestPendingReviewActions";

const HOOK_ARGS = {
  repoPath: "/repo/a",
  pullRequestNumber: 42,
  compareBaseRef: "main",
  compareHeadRef: "feature",
};

function createDraft(overrides: Record<string, unknown> = {}) {
  return {
    type: "annotation",
    id: "draft-1",
    repoPath: "/repo/a",
    filePath: "src/file.ts",
    bucket: "unstaged",
    startLine: 1,
    endLine: 1,
    side: "additions",
    endSide: undefined,
    text: "needs work",
    contextKind: "review",
    baseRef: "main",
    headRef: "feature",
    ...overrides,
  };
}

describe("usePullRequestPendingReviewActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedDrafts = [];
  });

  it("submitReviewDecision calls decision-only mutation when no pending drafts", async () => {
    mocks.submitDecisionUnwrap.mockResolvedValue({ decision: "APPROVE" });

    const { result } = renderHook(() => usePullRequestPendingReviewActions(HOOK_ARGS));

    await act(async () => {
      await result.current.submitReviewDecision("APPROVE");
    });

    expect(mocks.submitDecision).toHaveBeenCalledWith({
      repoPath: "/repo/a",
      pullRequestNumber: 42,
      decision: "APPROVE",
    });
    expect(mocks.submitComments).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Approved pull request");
  });

  it("submitReviewDecision publishes pending drafts together with REQUEST_CHANGES", async () => {
    mocks.selectedDrafts = [createDraft({ id: "draft-1" })];
    mocks.submitCommentsUnwrap.mockResolvedValue({
      submittedDraftIds: ["draft-1"],
      failedDraftId: null,
      failedMessage: null,
      reviewDecision: "REQUEST_CHANGES",
      reviewDecisionError: null,
    });

    const { result } = renderHook(() => usePullRequestPendingReviewActions(HOOK_ARGS));

    await act(async () => {
      await result.current.submitReviewDecision("REQUEST_CHANGES");
    });

    expect(mocks.submitComments).toHaveBeenCalledTimes(1);
    expect(mocks.submitComments.mock.calls[0][0]).toMatchObject({
      repoPath: "/repo/a",
      pullRequestNumber: 42,
      reviewDecision: "REQUEST_CHANGES",
    });
    expect(mocks.submitDecision).not.toHaveBeenCalled();
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: "remove", payload: ["draft-1"] });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Requested changes on pull request");
  });

  it("publishAllPendingDrafts does not include a review decision", async () => {
    mocks.selectedDrafts = [createDraft({ id: "draft-9" })];
    mocks.submitCommentsUnwrap.mockResolvedValue({
      submittedDraftIds: ["draft-9"],
      failedDraftId: null,
      failedMessage: null,
      reviewDecision: null,
      reviewDecisionError: null,
    });

    const { result } = renderHook(() => usePullRequestPendingReviewActions(HOOK_ARGS));

    await act(async () => {
      await result.current.publishAllPendingDrafts();
    });

    expect(mocks.submitComments).toHaveBeenCalledTimes(1);
    expect(mocks.submitComments.mock.calls[0][0]).not.toHaveProperty("reviewDecision");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("surfaces a decision error toast when the comments succeed but decision fails", async () => {
    mocks.selectedDrafts = [createDraft({ id: "draft-2" })];
    mocks.submitCommentsUnwrap.mockResolvedValue({
      submittedDraftIds: ["draft-2"],
      failedDraftId: null,
      failedMessage: null,
      reviewDecision: null,
      reviewDecisionError: "Unable to approve",
    });

    const { result } = renderHook(() => usePullRequestPendingReviewActions(HOOK_ARGS));

    await act(async () => {
      await result.current.submitReviewDecision("APPROVE");
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Unable to approve");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("toasts an error when decision-only submission rejects", async () => {
    mocks.submitDecisionUnwrap.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => usePullRequestPendingReviewActions(HOOK_ARGS));

    await act(async () => {
      await result.current.submitReviewDecision("APPROVE");
    });

    expect(mocks.toastError).toHaveBeenCalledWith("boom");
  });

  it("does nothing when repoPath is empty", async () => {
    const { result } = renderHook(() =>
      usePullRequestPendingReviewActions({ ...HOOK_ARGS, repoPath: "" }),
    );

    await act(async () => {
      await result.current.submitReviewDecision("APPROVE");
    });

    expect(mocks.submitComments).not.toHaveBeenCalled();
    expect(mocks.submitDecision).not.toHaveBeenCalled();
  });
});
