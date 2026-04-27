import { desktop } from "@/platform/desktop";

import type {
  AddPullRequestCommentInput,
  ConnectProviderInput,
  HostedRepoRef,
  InboxPullRequestsResult,
  PreparedPullRequestWorkspace,
  PreparePullRequestWorkspaceInput,
  ProviderConnection,
  ResolveActivePullRequestForBranchInput,
  ListPullRequestsInput,
  PullRequestChangedFile,
  PullRequestCompareRefs,
  PullRequestConversation,
  PullRequestIssueComment,
  PullRequestLocatorInput,
  PullRequestPage,
  PullRequestReviewThread,
  ReplyToPullRequestThreadInput,
  SetPullRequestThreadResolvedInput,
  SubmitPullRequestReviewCommentsInput,
  SubmitPullRequestReviewCommentsResult,
} from "@/platform/desktop";

export async function listProviderConnections() {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.listProviderConnections() as Promise<ProviderConnection[]>;
}

export async function connectProvider(input: ConnectProviderInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.connectProvider(input) as Promise<ProviderConnection>;
}

export async function disconnectProvider(providerId: ProviderConnection["providerId"]) {
  await desktop.disconnectProvider(providerId);
}

export async function resolveHostedRepo(repoPath: string) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.resolveHostedRepo(repoPath) as Promise<HostedRepoRef | null>;
}

export async function listPullRequests(input: ListPullRequestsInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.listPullRequests(input) as Promise<PullRequestPage>;
}

export async function getInboxPullRequests(repoPath: string): Promise<InboxPullRequestsResult> {
  return desktop.getInboxPullRequests({ repoPath }) as Promise<InboxPullRequestsResult>;
}

export async function refreshInboxPullRequests(repoPath: string): Promise<InboxPullRequestsResult> {
  return desktop.refreshInboxPullRequests({ repoPath }) as Promise<InboxPullRequestsResult>;
}

export async function resolveActivePullRequestForBranch(
  input: ResolveActivePullRequestForBranchInput,
) {
  return desktop.resolveActivePullRequestForBranch(input);
}

export async function getPullRequestConversation(input: PullRequestLocatorInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.getPullRequestConversation(input) as Promise<PullRequestConversation>;
}

export async function getPullRequestFiles(input: PullRequestLocatorInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.getPullRequestFiles(input) as Promise<PullRequestChangedFile[]>;
}

export async function getPullRequestPatch(input: PullRequestLocatorInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.getPullRequestPatch(input) as Promise<string>;
}

export async function addPullRequestComment(input: AddPullRequestCommentInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.addPullRequestComment(input) as Promise<PullRequestIssueComment>;
}

export async function replyToPullRequestThread(input: ReplyToPullRequestThreadInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.replyToPullRequestThread(input) as Promise<PullRequestReviewThread>;
}

export async function submitPullRequestReviewComments(input: SubmitPullRequestReviewCommentsInput) {
  return desktop.submitPullRequestReviewComments(
    input,
    // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  ) as Promise<SubmitPullRequestReviewCommentsResult>;
}

export async function setPullRequestThreadResolved(input: SetPullRequestThreadResolvedInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.setPullRequestThreadResolved(input) as Promise<PullRequestReviewThread>;
}

export async function preparePullRequestCompareRefs(input: PullRequestLocatorInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.preparePullRequestCompareRefs(input) as Promise<PullRequestCompareRefs>;
}

export async function preparePullRequestWorkspace(input: PreparePullRequestWorkspaceInput) {
  // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
  return desktop.preparePullRequestWorkspace(input) as Promise<PreparedPullRequestWorkspace>;
}
