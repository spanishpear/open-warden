import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { buildPullRequestPreviewPath } from "../../pull-requests/utils";
import { buildPreviewTabPath } from "../../pull-requests/screens/PullRequestPreviewLayout";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => "repo-path",
}));

vi.mock("@/features/hosted-repos/actions", () => ({
  openPullRequestReview: vi.fn(() => ({ type: "mock-action" })),
}));

vi.mock("@/features/hosted-repos/api", () => ({
  hostedReposApi: { util: { prefetch: vi.fn(() => ({ type: "prefetch" })) } },
}));

// Import after mocks
import { useInboxNavigation } from "./useInboxNavigation";

describe("useInboxNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pr: any = {
    providerId: "github",
    headOwner: "alice",
    headRepo: "wonderland",
    number: 123,
  };

  it("navigateToPreview calls navigate with correct PR preview path", () => {
    const { result } = renderHook(() => useInboxNavigation());

    result.current.navigateToPreview(pr);

    expect(mocks.navigate).toHaveBeenCalledWith(
      buildPullRequestPreviewPath({
        providerId: pr.providerId,
        owner: pr.headOwner,
        repo: pr.headRepo,
        pullRequestNumber: pr.number,
      }),
    );
  });

  it("navigateToDiff calls navigate with PR files tab path", () => {
    const { result } = renderHook(() => useInboxNavigation());

    result.current.navigateToDiff(pr);

    expect(mocks.navigate).toHaveBeenCalledWith(
      buildPreviewTabPath({
        providerId: pr.providerId,
        owner: pr.headOwner,
        repo: pr.headRepo,
        pullRequestNumber: pr.number,
        tab: "files",
      }),
    );
  });

  it("launchReviewer dispatches openPullRequestReview and navigates to /changes/pull-request/files", () => {
    const { result } = renderHook(() => useInboxNavigation());

    result.current.launchReviewer(pr);

    expect(mocks.dispatch).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/changes/pull-request/files");
  });

  it("prefetchPRDetail dispatches prefetch for PR conversation", () => {
    const { result } = renderHook(() => useInboxNavigation());

    result.current.prefetchPRDetail(pr);

    // hostedReposApi.util.prefetch is mocked to return an action; assert dispatch was called
    expect(mocks.dispatch).toHaveBeenCalled();
  });
});
