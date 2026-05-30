import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

import type {
  AddPullRequestCommentInput,
  BuildStatus,
  ConnectProviderInput,
  HostedRepoRef,
  LandCommandResult,
  LikePullRequestCommentInput,
  LikePullRequestCommentResult,
  ListPullRequestsInput,
  MergePullRequestInput,
  MergePullRequestResult,
  RunLandCommandInput,
  ProviderConnection,
  PullRequestChangedFile,
  PullRequestCompareRefs,
  PullRequestConversation,
  PullRequestDiffResult,
  PullRequestLocatorInput,
  PullRequestPage,
  PullRequestReviewThread,
  PullRequestSummary,
  ReplyToPullRequestThreadInput,
  ResolveActivePullRequestForBranchInput,
  SetPullRequestThreadResolvedInput,
  SubmitPullRequestReviewCommentsInput,
  SubmitPullRequestReviewCommentsResult,
  SubmitPullRequestReviewDecisionInput,
  SubmitPullRequestReviewDecisionResult,
  InboxPullRequestsResult,
} from "@/platform/desktop";
import {
  addPullRequestComment,
  connectProvider,
  disconnectProvider,
  getPullRequestBuildStatuses,
  getPullRequestConversation,
  getPullRequestFiles,
  getPullRequestPatch,
  getPullRequestDiffCached,
  getInboxPullRequests,
  likePullRequestComment,
  refreshInboxPullRequests,
  listProviderConnections,
  listPullRequests,
  mergePullRequest,
  runLandCommand,
  resolveActivePullRequestForBranch,
  preparePullRequestCompareRefs,
  replyToPullRequestThread,
  resolveHostedRepo,
  setPullRequestThreadResolved,
  submitPullRequestReviewComments,
  submitPullRequestReviewDecision,
} from "./services/hostedRepos";

type ErrorResult = { message: string };

function toErrorResult(error: unknown): ErrorResult {
  return { message: error instanceof Error ? error.message : String(error) };
}

export const hostedReposApi = createApi({
  reducerPath: "hostedReposApi",
  baseQuery: fakeBaseQuery<ErrorResult>(),
  tagTypes: [
    "ProviderConnections",
    "HostedRepo",
    "PullRequests",
    "InboxPullRequests",
    "PullRequestConversation",
    "PullRequestBuildStatuses",
    "PullRequestFiles",
    "PullRequestPatch",
    "PullRequestCompareRefs",
  ],
  endpoints: (builder) => ({
    listProviderConnections: builder.query<ProviderConnection[], void>({
      async queryFn() {
        try {
          return { data: await listProviderConnections() };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: ["ProviderConnections"],
    }),
    connectProvider: builder.mutation<ProviderConnection, ConnectProviderInput>({
      async queryFn(input) {
        try {
          return { data: await connectProvider(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: ["ProviderConnections", "PullRequests"],
    }),
    disconnectProvider: builder.mutation<void, ProviderConnection["providerId"]>({
      async queryFn(providerId) {
        try {
          await disconnectProvider(providerId);
          return { data: undefined };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: ["ProviderConnections", "PullRequests"],
    }),
    resolveHostedRepo: builder.query<HostedRepoRef | null, string>({
      async queryFn(repoPath) {
        try {
          return { data: await resolveHostedRepo(repoPath) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, repoPath) => [{ type: "HostedRepo", id: repoPath }],
    }),
    listPullRequests: builder.query<PullRequestPage, ListPullRequestsInput>({
      async queryFn(input) {
        try {
          return { data: await listPullRequests(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
    }),
    getInboxPullRequests: builder.query<InboxPullRequestsResult, string>({
      async queryFn(repoPath) {
        try {
          return { data: await getInboxPullRequests(repoPath) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, repoPath) => [{ type: "InboxPullRequests", id: repoPath }],
    }),
    refreshInboxPullRequests: builder.mutation<InboxPullRequestsResult, string>({
      async queryFn(repoPath) {
        try {
          return { data: await refreshInboxPullRequests(repoPath) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, repoPath) => [{ type: "InboxPullRequests", id: repoPath }],
    }),
    resolveActivePullRequestForBranch: builder.query<
      PullRequestSummary | null,
      ResolveActivePullRequestForBranchInput
    >({
      async queryFn(input) {
        try {
          return { data: await resolveActivePullRequestForBranch(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, branch }) => [
        { type: "PullRequests", id: `${repoPath}:active:${branch}` },
      ],
    }),
    getPullRequestConversation: builder.query<PullRequestConversation, PullRequestLocatorInput>({
      async queryFn(input) {
        try {
          return { data: await getPullRequestConversation(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
      keepUnusedDataFor: 300,
    }),
    getPullRequestBuildStatuses: builder.query<BuildStatus[], PullRequestLocatorInput>({
      async queryFn(input) {
        try {
          return { data: await getPullRequestBuildStatuses(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestBuildStatuses", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
      keepUnusedDataFor: 60,
    }),
    getPullRequestFiles: builder.query<PullRequestChangedFile[], PullRequestLocatorInput>({
      async queryFn(input) {
        try {
          return { data: await getPullRequestFiles(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestFiles", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
      keepUnusedDataFor: 300,
    }),
    getPullRequestPatch: builder.query<string, PullRequestLocatorInput>({
      async queryFn(input) {
        try {
          return { data: await getPullRequestPatch(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestPatch", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
      keepUnusedDataFor: 300,
    }),
    getPullRequestDiffCached: builder.query<PullRequestDiffResult, PullRequestLocatorInput>({
      async queryFn(input) {
        try {
          return { data: await getPullRequestDiffCached(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestPatch", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
      keepUnusedDataFor: 300,
    }),

    preparePullRequestCompareRefs: builder.query<PullRequestCompareRefs, PullRequestLocatorInput>({
      async queryFn(input) {
        try {
          return { data: await preparePullRequestCompareRefs(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      providesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestCompareRefs", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
    }),
    addPullRequestComment: builder.mutation<void, AddPullRequestCommentInput>({
      async queryFn(input) {
        try {
          await addPullRequestComment(input);
          return { data: undefined };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
    }),
    replyToPullRequestThread: builder.mutation<
      PullRequestReviewThread,
      ReplyToPullRequestThreadInput
    >({
      async queryFn(input) {
        try {
          return { data: await replyToPullRequestThread(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
    }),
    submitPullRequestReviewComments: builder.mutation<
      SubmitPullRequestReviewCommentsResult,
      SubmitPullRequestReviewCommentsInput
    >({
      async queryFn(input) {
        try {
          return { data: await submitPullRequestReviewComments(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
        { type: "InboxPullRequests", id: repoPath },
      ],
    }),
    submitPullRequestReviewDecision: builder.mutation<
      SubmitPullRequestReviewDecisionResult,
      SubmitPullRequestReviewDecisionInput
    >({
      async queryFn(input) {
        try {
          return { data: await submitPullRequestReviewDecision(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
        { type: "InboxPullRequests", id: repoPath },
      ],
    }),
    setPullRequestThreadResolved: builder.mutation<
      PullRequestReviewThread,
      SetPullRequestThreadResolvedInput
    >({
      async queryFn(input) {
        try {
          return { data: await setPullRequestThreadResolved(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
      ],
    }),
    likePullRequestComment: builder.mutation<
      LikePullRequestCommentResult,
      LikePullRequestCommentInput
    >({
      async queryFn(input) {
        try {
          return { data: await likePullRequestComment(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      async onQueryStarted(
        { repoPath, pullRequestNumber, commentId, liked },
        { dispatch, queryFulfilled },
      ) {
        const patch = dispatch(
          hostedReposApi.util.updateQueryData(
            "getPullRequestConversation",
            { repoPath, pullRequestNumber },
            (draft) => {
              applyCommentLike(draft, commentId, liked, null);
            },
          ),
        );

        try {
          const { data } = await queryFulfilled;
          dispatch(
            hostedReposApi.util.updateQueryData(
              "getPullRequestConversation",
              { repoPath, pullRequestNumber },
              (draft) => {
                applyCommentLike(draft, commentId, data.liked, data.likeCount);
              },
            ),
          );
        } catch {
          patch.undo();
        }
      },
    }),
    mergePullRequest: builder.mutation<MergePullRequestResult, MergePullRequestInput>({
      async queryFn(input) {
        try {
          return { data: await mergePullRequest(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
      invalidatesTags: (_result, _error, { repoPath, pullRequestNumber }) => [
        { type: "PullRequestConversation", id: `${repoPath}:${String(pullRequestNumber)}` },
        { type: "InboxPullRequests", id: repoPath },
      ],
    }),
    runLandCommand: builder.mutation<LandCommandResult, RunLandCommandInput>({
      async queryFn(input) {
        try {
          return { data: await runLandCommand(input) };
        } catch (error) {
          return { error: toErrorResult(error) };
        }
      },
    }),
  }),
});

function applyCommentLike(
  draft: PullRequestConversation,
  commentId: number,
  liked: boolean,
  likeCount: number | null,
) {
  const updateComment = (comment: {
    databaseId: number;
    likeCount?: number;
    viewerHasLiked?: boolean;
  }) => {
    if (comment.databaseId !== commentId) {
      return;
    }

    const previousCount = comment.likeCount ?? 0;
    const previouslyLiked = comment.viewerHasLiked ?? false;
    comment.viewerHasLiked = liked;
    if (likeCount !== null) {
      comment.likeCount = likeCount;
    } else if (liked && !previouslyLiked) {
      comment.likeCount = previousCount + 1;
    } else if (!liked && previouslyLiked) {
      comment.likeCount = Math.max(0, previousCount - 1);
    }
  };

  for (const comment of draft.issueComments) {
    updateComment(comment);
  }
  for (const thread of draft.reviewThreads) {
    for (const comment of thread.comments) {
      updateComment(comment);
    }
  }
}

export const {
  useConnectProviderMutation,
  useAddPullRequestCommentMutation,
  useDisconnectProviderMutation,
  useGetPullRequestBuildStatusesQuery,
  useGetPullRequestConversationQuery,
  useGetPullRequestFilesQuery,
  useGetPullRequestDiffCachedQuery,
  useGetInboxPullRequestsQuery,
  useLikePullRequestCommentMutation,
  useMergePullRequestMutation,
  useRunLandCommandMutation,
  useRefreshInboxPullRequestsMutation,
  useListProviderConnectionsQuery,
  useListPullRequestsQuery,
  usePreparePullRequestCompareRefsQuery,
  useReplyToPullRequestThreadMutation,
  useResolveHostedRepoQuery,
  useResolveActivePullRequestForBranchQuery,
  useSetPullRequestThreadResolvedMutation,
  useSubmitPullRequestReviewCommentsMutation,
  useSubmitPullRequestReviewDecisionMutation,
} = hostedReposApi;
