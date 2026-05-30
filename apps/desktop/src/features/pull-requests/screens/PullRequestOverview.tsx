import { skipToken } from "@reduxjs/toolkit/query";
import { Copy, MessageSquarePlus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectActiveRepo } from "@/features/source-control/sourceControlSlice";
import { Button } from "@/components/ui/button";
import { openPullRequestReview } from "@/features/hosted-repos/actions";
import {
  hostedReposApi,
  useGetInboxPullRequestsQuery,
  useGetPullRequestConversationQuery,
  useGetPullRequestFilesQuery,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import {
  CommentBody,
  copyToClipboard,
} from "@/features/pull-requests/components/pullRequestCommentParts";
import { PullRequestDiscussionSection } from "@/features/pull-requests/components/PullRequestDiscussionSection";
import { PullRequestMergeControl } from "@/features/pull-requests/components/PullRequestMergeControl";
import { PullRequestOverviewAnchorCard } from "@/features/pull-requests/components/PullRequestOverviewAnchorCard";
import { PullRequestPreviewHeader } from "@/features/pull-requests/components/PullRequestPreviewHeader";
import { usePullRequestMentionCandidates } from "@/features/pull-requests/hooks/usePullRequestMentionCandidates";
import { usePullRequestPendingReviewActions } from "@/features/pull-requests/hooks/usePullRequestPendingReviewActions";
import { usePullRequestReviewAnchors } from "@/features/pull-requests/hooks/usePullRequestReviewAnchors";
import {
  buildPreviewTabPath,
  type PreviewTab,
} from "@/features/pull-requests/screens/PullRequestPreviewLayout";
import {
  setPullRequestPreviewActiveFilePath,
  setPullRequestPreviewFileJumpTarget,
} from "@/features/pull-requests/pullRequestsSlice";
import { resolvePullRequestChangeStats } from "@/platform/desktop/pullRequestChangeStats";
import { EMPTY_FILES } from "@/shared/stableDefaults";
import { buildPullRequestsInboxPath } from "@/features/pull-requests/utils";
import type { PullRequestReviewAnchor } from "@/features/source-control/types";
import type { PullRequestChangedFile, PullRequestConversation } from "@/platform/desktop";
import type {
  GitProviderId,
  PullRequestChangeStats,
  PullRequestOpenMode,
} from "@/platform/desktop/contracts";

type PullRequestQueryArg =
  | {
      repoPath: string;
      pullRequestNumber: number;
    }
  | typeof skipToken;

function providerTitle(providerId: string) {
  if (providerId === "github") return "GitHub";
  if (providerId === "gitlab") return "GitLab";
  return "Bitbucket";
}

function OverviewDetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  actions,
}: {
  title: string;
  count?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
          {title}
        </div>
        {typeof count === "number" ? (
          <div className="text-muted-foreground rounded-full border border-border/70 px-2 py-0.5 text-[11px]">
            {count}
          </div>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

function PullRequestSummarySection({ body }: { body: string }) {
  return (
    <section className="rounded-lg border bg-surface-0 p-5">
      <div className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
        Summary
      </div>
      <div className="mt-3 text-sm leading-6">
        {body.trim() ? (
          <div className="min-w-0 max-w-none">
            <CommentBody body={body} />
          </div>
        ) : (
          <div className="text-muted-foreground italic">No description provided.</div>
        )}
      </div>
    </section>
  );
}

type PullRequestOverviewReviewSectionsProps = {
  activeRepo: string;
  pullRequestNumber: number;
  providerId?: GitProviderId;
  files: PullRequestChangedFile[];
  conversation: PullRequestConversation;
  onOpenAnchorInFiles: (anchor: PullRequestReviewAnchor) => void;
  compareBaseRef: string;
  compareHeadRef: string;
};

function PullRequestOverviewReviewSections({
  activeRepo,
  pullRequestNumber,
  providerId,
  files,
  conversation,
  onOpenAnchorInFiles,
  compareBaseRef,
  compareHeadRef,
}: PullRequestOverviewReviewSectionsProps) {
  const commentMentions = usePullRequestMentionCandidates(conversation);
  const pendingActions = usePullRequestPendingReviewActions({
    repoPath: activeRepo,
    pullRequestNumber,
    compareBaseRef,
    compareHeadRef,
  });
  const { pendingAnchors, remoteAnchors } = usePullRequestReviewAnchors({
    repoPath: activeRepo,
    compareBaseRef,
    compareHeadRef,
    files,
    reviewThreads: conversation.reviewThreads,
  });

  return (
    <>
      {pendingAnchors.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Pending review drafts"
            count={pendingAnchors.length}
            actions={
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  size="sm"
                  className="h-7 px-2"
                  disabled={pendingActions.isSubmittingReviewComments}
                  onClick={() => {
                    void pendingActions.publishAllPendingDrafts();
                  }}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Publish all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    void pendingActions.copyAllPendingDrafts();
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    pendingActions.clearAllPendingDrafts();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              </div>
            }
          />

          <div className="flex flex-col gap-3">
            {pendingAnchors.map((anchor) => (
              <PullRequestOverviewAnchorCard
                key={anchor.key}
                providerId={providerId}
                repoPath={activeRepo}
                pullRequestNumber={pullRequestNumber}
                compareBaseRef={compareBaseRef}
                compareHeadRef={compareHeadRef}
                anchor={anchor}
                onOpenFile={() => onOpenAnchorInFiles(anchor)}
                onPublishPending={() => {
                  void pendingActions.publishAnchorPendingDrafts(anchor);
                }}
                onCopyPending={() => {
                  void pendingActions.copyAnchorPendingDrafts(anchor);
                }}
                onClearPending={() => {
                  pendingActions.clearAnchorPendingDrafts(anchor);
                }}
                commentMentions={commentMentions}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <SectionHeader title="Commented code" count={remoteAnchors.length} />
        {remoteAnchors.length > 0 ? (
          <div className="flex flex-col gap-3">
            {remoteAnchors.map((anchor) => (
              <PullRequestOverviewAnchorCard
                key={anchor.key}
                providerId={providerId}
                repoPath={activeRepo}
                pullRequestNumber={pullRequestNumber}
                compareBaseRef={compareBaseRef}
                compareHeadRef={compareHeadRef}
                anchor={anchor}
                onOpenFile={() => onOpenAnchorInFiles(anchor)}
                commentMentions={commentMentions}
              />
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground rounded-lg border border-border/70 bg-surface-0 px-4 py-3 text-sm">
            No inline review threads yet.
          </div>
        )}
      </section>
    </>
  );
}

type PullRequestOverviewDetailsSidebarProps = {
  activeRepo: string;
  pullRequestNumber: number;
  detail: PullRequestConversation["detail"];
  changeStats: PullRequestChangeStats | null;
  issueCommentCount: number;
  reviewThreadCount: number;
  compareBaseRef: string;
  compareHeadRef: string;
};

function PullRequestOverviewDetailsSidebar({
  activeRepo,
  pullRequestNumber,
  detail,
  changeStats,
  issueCommentCount,
  reviewThreadCount,
  compareBaseRef,
  compareHeadRef,
}: PullRequestOverviewDetailsSidebarProps) {
  const { owner, repo } = useParams();
  const pendingActions = usePullRequestPendingReviewActions({
    repoPath: activeRepo,
    pullRequestNumber,
    compareBaseRef,
    compareHeadRef,
  });

  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
      <PullRequestMergeControl
        repoPath={activeRepo}
        pullRequestNumber={pullRequestNumber}
        detail={detail}
        // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
        providerId={detail.providerId as GitProviderId}
        owner={owner}
        repo={repo}
      />
      <section className="rounded-lg border bg-surface-0 p-4">
        <div className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
          Details
        </div>
        <dl className="mt-2 divide-y divide-border/70">
          <OverviewDetailRow label="Provider" value={providerTitle(detail.providerId)} />
          <OverviewDetailRow
            label="Conversation"
            value={`${issueCommentCount} comments · ${reviewThreadCount} threads`}
          />
          <OverviewDetailRow
            label="Changes"
            value={
              changeStats ? (
                <span>
                  {changeStats.fileCount} files{" "}
                  <span className="text-emerald-500">+{changeStats.additions}</span>{" "}
                  <span className="text-red-500">-{changeStats.deletions}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">Loading…</span>
              )
            }
          />
          <OverviewDetailRow label="Pending drafts" value={pendingActions.pendingDraftCount} />
          <OverviewDetailRow label="Base" value={detail.baseRef} />
          <OverviewDetailRow label="Head" value={detail.headRef} />
        </dl>
      </section>
    </aside>
  );
}

export const PullRequestOverview = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activeRepo = useAppSelector(selectActiveRepo);
  const activePreviewFilePath = useAppSelector((state) => state.pullRequests.previewActiveFilePath);
  const { providerId, owner, repo, pullRequestNumber } = useParams();
  const [openingMode, setOpeningMode] = useState<PullRequestOpenMode | null>(null);
  const [openError, setOpenError] = useState("");

  const { hostedRepo } = useResolveHostedRepoQuery(activeRepo, {
    skip: !activeRepo,
    selectFromResult: ({ data }) => ({
      hostedRepo: data ?? null,
    }),
  });

  const routeMatchesActiveRepo = Boolean(
    hostedRepo &&
    providerId &&
    owner &&
    repo &&
    hostedRepo.providerId === providerId &&
    hostedRepo.owner === owner &&
    hostedRepo.repo === repo,
  );

  const parsedPullRequestNumber = Number.parseInt(pullRequestNumber ?? "", 10);
  const hasValidRoute = Boolean(
    providerId &&
    owner &&
    repo &&
    Number.isFinite(parsedPullRequestNumber) &&
    parsedPullRequestNumber > 0,
  );

  const queryArg: PullRequestQueryArg =
    activeRepo && hasValidRoute && routeMatchesActiveRepo
      ? {
          repoPath: activeRepo,
          pullRequestNumber: parsedPullRequestNumber,
        }
      : skipToken;

  const {
    conversation,
    loadingConversation,
    refetch: refetchConversation,
  } = useGetPullRequestConversationQuery(queryArg, {
    selectFromResult: ({ data, isLoading, isFetching }) => ({
      conversation: data ?? null,
      loadingConversation: isLoading || isFetching,
    }),
    pollingInterval: 30_000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const { files, hasLoadedFiles } = useGetPullRequestFilesQuery(queryArg, {
    selectFromResult: ({ data }) => ({
      files: data ?? EMPTY_FILES,
      hasLoadedFiles: data !== undefined,
    }),
  });
  const { cachedChangeStats } = useGetInboxPullRequestsQuery(
    activeRepo && hostedRepo?.providerId === "bitbucket" && hasValidRoute && routeMatchesActiveRepo
      ? activeRepo
      : skipToken,
    {
      selectFromResult: ({ data }) => ({
        cachedChangeStats:
          Object.values(data?.sections ?? {})
            .flat()
            .find((pr) => pr.number === parsedPullRequestNumber)?.changeStats ?? null,
      }),
    },
  );
  // single selector for currentReview used by child subtrees
  const currentReview = useAppSelector((state) => state.pullRequests.currentReview);
  const compareBaseRef =
    currentReview?.repoPath === activeRepo &&
    currentReview.pullRequestNumber === parsedPullRequestNumber
      ? currentReview.compareBaseRef
      : "";
  const compareHeadRef =
    currentReview?.repoPath === activeRepo &&
    currentReview.pullRequestNumber === parsedPullRequestNumber
      ? currentReview.compareHeadRef
      : "";

  async function handleOpen(mode: PullRequestOpenMode) {
    if (!Number.isFinite(parsedPullRequestNumber)) {
      return;
    }

    setOpenError("");
    setOpeningMode(mode);
    const result = await dispatch(openPullRequestReview(parsedPullRequestNumber, mode));
    setOpeningMode(null);

    if (!result.errorMessage) {
      // oxlint-disable-next-line typescript-eslint(no-floating-promises)
      navigate("/changes/pull-request/files");
      return;
    }

    setOpenError(result.errorMessage);
    toast.error(result.errorMessage);
  }

  async function handleCopyPullRequestLink() {
    const url = conversation?.detail.url;
    if (!url) {
      toast.error("PR link is not available yet.");
      return;
    }

    await copyToClipboard(url, "PR link copied");
  }

  async function handleCopyBranchName() {
    const branchName = conversation?.detail.headRef;
    if (!branchName) {
      toast.error("Branch name is not available yet.");
      return;
    }

    await copyToClipboard(branchName, "Branch name copied");
  }

  function handleRefresh() {
    if (activeRepo && hasValidRoute && routeMatchesActiveRepo) {
      void refetchConversation();
      dispatch(hostedReposApi.util.invalidateTags([{ type: "HostedRepo", id: activeRepo }]));
    }
  }

  function handleTabChange(tab: PreviewTab) {
    if (!hasValidRoute || !providerId || !owner || !repo) {
      return;
    }

    const nextPath = buildPreviewTabPath({
      // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
      providerId: providerId as GitProviderId,
      owner,
      repo,
      pullRequestNumber: parsedPullRequestNumber,
      tab,
    });

    if (tab === "files" && files.length > 0) {
      const hasMatchingActiveFile = files.some((file) => file.path === activePreviewFilePath);
      if (!hasMatchingActiveFile) {
        dispatch(setPullRequestPreviewActiveFilePath(files[0].path));
      }
    }

    // oxlint-disable-next-line typescript-eslint(no-floating-promises)
    navigate(nextPath);
  }

  function openAnchorInFiles(anchor: PullRequestReviewAnchor) {
    if (!hasValidRoute || !providerId || !owner || !repo) {
      return;
    }

    dispatch(setPullRequestPreviewActiveFilePath(anchor.path));
    dispatch(
      setPullRequestPreviewFileJumpTarget({
        path: anchor.path,
        lineNumber: anchor.endLine,
        lineIndex: null,
        focusKey: Date.now(),
      }),
    );

    // oxlint-disable-next-line typescript-eslint(no-floating-promises)
    navigate(
      buildPreviewTabPath({
        // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
        providerId: providerId as GitProviderId,
        owner,
        repo,
        pullRequestNumber: parsedPullRequestNumber,
        tab: "files",
      }),
    );
  }

  if (!conversation) {
    return null;
  }

  const { detail } = conversation;
  const changeStats = resolvePullRequestChangeStats({
    files,
    hasLoadedFiles,
    cachedChangeStats,
  });
  const issueCommentCount = conversation.issueComments.length;
  const reviewThreadCount = conversation.reviewThreads.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PullRequestPreviewHeader
        owner={hostedRepo?.owner ?? owner ?? ""}
        repo={hostedRepo?.repo ?? repo ?? ""}
        detail={detail}
        openingMode={openingMode}
        isRefreshing={loadingConversation && !!conversation}
        changedFilesCount={changeStats?.fileCount}
        additions={changeStats?.additions}
        deletions={changeStats?.deletions}
        onBack={() => navigate(buildPullRequestsInboxPath())}
        onOpen={(mode) => {
          void handleOpen(mode);
        }}
        onOpenInBrowser={() => {
          window.open(detail.url, "_blank", "noopener,noreferrer");
        }}
        onCopyLink={() => {
          void handleCopyPullRequestLink();
        }}
        onCopyBranch={() => {
          void handleCopyBranchName();
        }}
        onRefresh={handleRefresh}
        onToggleFilesView={() => handleTabChange("files")}
      />

      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6">
          {openError ? (
            <div className="text-destructive rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-sm">
              {openError}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <PullRequestSummarySection body={detail.body} />
              <PullRequestDiscussionSection
                conversation={conversation}
                repoPath={activeRepo ?? ""}
                pullRequestNumber={parsedPullRequestNumber}
                // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
                providerId={detail.providerId as GitProviderId}
              />
              <PullRequestOverviewReviewSections
                activeRepo={activeRepo ?? ""}
                pullRequestNumber={parsedPullRequestNumber}
                // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
                providerId={detail.providerId as GitProviderId}
                files={files}
                conversation={conversation}
                onOpenAnchorInFiles={openAnchorInFiles}
                compareBaseRef={compareBaseRef}
                compareHeadRef={compareHeadRef}
              />
            </div>

            <PullRequestOverviewDetailsSidebar
              activeRepo={activeRepo ?? ""}
              pullRequestNumber={parsedPullRequestNumber}
              detail={detail}
              changeStats={changeStats}
              issueCommentCount={issueCommentCount}
              reviewThreadCount={reviewThreadCount}
              compareBaseRef={compareBaseRef}
              compareHeadRef={compareHeadRef}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
