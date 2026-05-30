export type ErrorCode = "INVALID_INPUT" | "INVALID_STATUS" | "BACKEND" | "UNAVAILABLE";

export type ApiError = {
  code: ErrorCode;
  message: string;
  details: string | null;
};

export type Bucket = "unstaged" | "staged" | "untracked";

export type FileStatus =
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed"
  | "unmerged"
  | "modified"
  | "untracked";

export type DiffFile = {
  name: string;
  contents: string;
};

export type FileItem = {
  path: string;
  previousPath: string | null;
  status: FileStatus;
};

export type RepoFileItem = {
  path: string;
};

export type FileVersions = {
  oldFile: DiffFile | null;
  newFile: DiffFile | null;
};

export type GitSnapshot = {
  repoRoot: string;
  branch: string;
  unstaged: FileItem[];
  staged: FileItem[];
  untracked: FileItem[];
};

export type HistoryCommit = {
  commitId: string;
  shortId: string;
  summary: string;
  author: string;
  relativeTime: string;
};

export type DiscardFileInput = {
  relPath: string;
  bucket: Bucket;
};

export type ConfirmOptions = {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
  cancelLabel?: string;
};

export type GitProviderId = "github" | "gitlab" | "bitbucket";

export type ProviderConnectionMethod = "pat";
export type ProviderAuthType = "basic" | "bearer";

export type ProviderConnection = {
  id: GitProviderId;
  providerId: GitProviderId;
  method: ProviderConnectionMethod;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export type ConnectProviderInput = {
  providerId: GitProviderId;
  method: ProviderConnectionMethod;
  token: string;
  identifier?: string | null;
  authType?: ProviderAuthType | "auto";
};

export type HostedRepoRef = {
  providerId: GitProviderId;
  owner: string;
  repo: string;
  remoteName: string;
  remoteUrl: string;
  webUrl: string;
};

export type PullRequestState = "open" | "closed" | "merged";

export type PullRequestParticipant = {
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "REVIEWER" | "PARTICIPANT";
  approved: boolean;
  state: "approved" | "changes_requested" | null;
};

export type BuildStatus = {
  state: "successful" | "failed" | "inprogress" | "stopped";
  name: string;
  url: string;
  key: string;
};

export type PullRequestChangeStats = {
  fileCount: number;
  additions: number;
  deletions: number;
};

export type PullRequestSummary = {
  id: string;
  providerId: GitProviderId;
  number: number;
  title: string;
  state: PullRequestState;
  isDraft: boolean;
  authorLogin: string;
  authorDisplayName: string | null;
  url: string;
  baseRef: string;
  headRef: string;
  headOwner: string;
  headRepo: string;
  updatedAt: string;
  participants?: PullRequestParticipant[];
  reviewers?: PullRequestParticipant[];
  authorUuid?: string | null;
  authorAccountId?: string | null;
  commentCount?: number;
  buildStatuses?: BuildStatus[];
  changeStats?: PullRequestChangeStats;
};

export type ListPullRequestsInput = {
  repoPath: string;
  page: number;
  perPage: number;
};

export type ListInboxPullRequestsInput = {
  repoPath: string;
};

export type ResolveActivePullRequestForBranchInput = {
  repoPath: string;
  branch: string;
};

export type PullRequestPage = {
  pullRequests: PullRequestSummary[];
  page: number;
  perPage: number;
  hasNextPage: boolean;
};

export type InboxCacheDataSource = "empty" | "cache" | "live";

export type InboxCacheScopeMetadata = {
  source: InboxCacheDataSource;
  fetchedAt: number | null;
  isStale: boolean;
  isPartial: boolean;
};

export type InboxBackgroundWorkMetadata = {
  openRefresh: boolean;
  mergedRefresh: boolean;
};

export type InboxPullRequestsResult = {
  sections: Record<string, PullRequestSummary[]>;
  userLogin: string | null;
  fetchedAt: number;
  isStale: boolean;
  cache: {
    open: InboxCacheScopeMetadata;
    merged: InboxCacheScopeMetadata;
  };
  background: InboxBackgroundWorkMetadata;
};

export type PullRequestPerson = {
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type PullRequestDetail = {
  id: string;
  providerId: GitProviderId;
  number: number;
  title: string;
  body: string;
  state: PullRequestState;
  isDraft: boolean;
  url: string;
  author: PullRequestPerson | null;
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  createdAt: string;
  updatedAt: string;
};

export type PullRequestIssueComment = {
  id: string;
  databaseId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: PullRequestPerson | null;
  url: string | null;
};

export type PullRequestReviewComment = {
  id: string;
  databaseId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: PullRequestPerson | null;
  path: string;
  line: number | null;
  startLine: number | null;
  url: string | null;
};

export type PullRequestReviewThread = {
  id: string;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: "LEFT" | "RIGHT";
  isResolved: boolean;
  isOutdated: boolean;
  resolvedBy: PullRequestPerson | null;
  comments: PullRequestReviewComment[];
};

export type PullRequestConversation = {
  detail: PullRequestDetail;
  issueComments: PullRequestIssueComment[];
  reviewThreads: PullRequestReviewThread[];
};

export type PullRequestChangedFile = {
  path: string;
  previousPath: string | null;
  status: Exclude<FileStatus, "untracked" | "type-changed" | "unmerged">;
  additions: number;
  deletions: number;
};

export type PullRequestOpenMode = "branch" | "worktree";

export type PullRequestCompareRefs = {
  providerId: GitProviderId;
  owner: string;
  repo: string;
  pullRequestNumber: number;
  baseRef: string;
  headRef: string;
  compareBaseRef: string;
  compareHeadRef: string;
  localBranch: string;
};

export type PreparePullRequestWorkspaceInput = {
  repoPath: string;
  pullRequestNumber: number;
  openMode?: PullRequestOpenMode;
};

export type PullRequestLocatorInput = {
  repoPath: string;
  pullRequestNumber: number;
};

export type AddPullRequestCommentInput = PullRequestLocatorInput & {
  body: string;
};

export type ReplyToPullRequestThreadInput = PullRequestLocatorInput & {
  threadId: string;
  body: string;
};

export type PullRequestReviewDraftCommentInput = {
  draftId: string;
  path: string;
  body: string;
  line: number;
  side: "LEFT" | "RIGHT";
  startLine?: number | null;
  startSide?: "LEFT" | "RIGHT" | null;
};

export type PullRequestReviewDecision = "APPROVE" | "REQUEST_CHANGES" | "UNAPPROVE";

export type SubmitPullRequestReviewCommentsInput = PullRequestLocatorInput & {
  comments: PullRequestReviewDraftCommentInput[];
  reviewDecision?: PullRequestReviewDecision | null;
};

export type SubmitPullRequestReviewCommentsResult = {
  submittedDraftIds: string[];
  failedDraftId: string | null;
  failedMessage: string | null;
  reviewDecision: PullRequestReviewDecision | null;
  reviewDecisionError: string | null;
};

export type SubmitPullRequestReviewDecisionInput = PullRequestLocatorInput & {
  decision: PullRequestReviewDecision;
  body?: string | null;
};

export type SubmitPullRequestReviewDecisionResult = {
  decision: PullRequestReviewDecision;
};

export type SetPullRequestThreadResolvedInput = PullRequestLocatorInput & {
  threadId: string;
  resolved: boolean;
};

export type PreparedPullRequestWorkspace = {
  providerId: GitProviderId;
  repoPath: string;
  worktreePath: string;
  owner: string;
  repo: string;
  pullRequestNumber: number;
  title: string;
  baseRef: string;
  headRef: string;
  compareBaseRef: string;
  compareHeadRef: string;
  localBranch: string;
  hostedRepo: HostedRepoRef;
};

export type WorkspaceSession = {
  openRepos: string[];
  activeRepo: string;
  recentRepos: string[];
};

export type FileTreeRenderMode = "tree" | "list";

export type AppSettings = {
  version: 1;
  sourceControl: {
    fileTreeRenderMode: FileTreeRenderMode;
  };
  inboxSectionVisibility?: Record<string, boolean>;
};

type GetRepoFileInput = {
  repoPath: string;
  relPath: string;
  revision?: string | null;
};

export type DesktopApi = {
  selectFolder(): Promise<string | null>;
  loadWorkspaceSession(): Promise<WorkspaceSession>;
  saveWorkspaceSession(session: WorkspaceSession): Promise<WorkspaceSession>;
  loadAppSettings(): Promise<AppSettings>;
  saveAppSettings(settings: AppSettings): Promise<AppSettings>;
  getAppSettingsPath(): Promise<string>;
  confirm(message: string, options?: ConfirmOptions): Promise<boolean>;
  checkAppExists(appName: string): Promise<boolean>;
  openPath(path: string, appName?: string | null): Promise<void>;
  listProviderConnections(): Promise<ProviderConnection[]>;
  connectProvider(input: ConnectProviderInput): Promise<ProviderConnection>;
  disconnectProvider(providerId: GitProviderId): Promise<void>;
  resolveHostedRepo(repoPath: string): Promise<HostedRepoRef | null>;
  listPullRequests(input: ListPullRequestsInput): Promise<PullRequestPage>;
  getInboxPullRequests(input: ListInboxPullRequestsInput): Promise<InboxPullRequestsResult>;
  refreshInboxPullRequests(input: ListInboxPullRequestsInput): Promise<InboxPullRequestsResult>;
  resolveActivePullRequestForBranch(
    input: ResolveActivePullRequestForBranchInput,
  ): Promise<PullRequestSummary | null>;
  getPullRequestConversation(input: PullRequestLocatorInput): Promise<PullRequestConversation>;
  getPullRequestFiles(input: PullRequestLocatorInput): Promise<PullRequestChangedFile[]>;
  getPullRequestPatch(input: PullRequestLocatorInput): Promise<string>;
  getPullRequestDiffCached(input: PullRequestLocatorInput): Promise<string>;
  addPullRequestComment(input: AddPullRequestCommentInput): Promise<PullRequestIssueComment>;
  replyToPullRequestThread(input: ReplyToPullRequestThreadInput): Promise<PullRequestReviewThread>;
  submitPullRequestReviewComments(
    input: SubmitPullRequestReviewCommentsInput,
  ): Promise<SubmitPullRequestReviewCommentsResult>;
  submitPullRequestReviewDecision(
    input: SubmitPullRequestReviewDecisionInput,
  ): Promise<SubmitPullRequestReviewDecisionResult>;
  setPullRequestThreadResolved(
    input: SetPullRequestThreadResolvedInput,
  ): Promise<PullRequestReviewThread>;
  preparePullRequestCompareRefs(input: PullRequestLocatorInput): Promise<PullRequestCompareRefs>;
  preparePullRequestWorkspace(
    input: PreparePullRequestWorkspaceInput,
  ): Promise<PreparedPullRequestWorkspace>;
  getGitSnapshot(repoPath: string): Promise<GitSnapshot>;
  getRepoFiles(repoPath: string): Promise<RepoFileItem[]>;
  getCommitHistory(repoPath: string, limit?: number): Promise<HistoryCommit[]>;
  getBranches(repoPath: string): Promise<string[]>;
  getBranchFiles(repoPath: string, baseRef: string, headRef: string): Promise<FileItem[]>;
  getCommitFiles(repoPath: string, commitId: string): Promise<FileItem[]>;
  getCommitFileVersions(
    repoPath: string,
    commitId: string,
    relPath: string,
    previousPath?: string,
  ): Promise<FileVersions>;
  getFileVersions(repoPath: string, relPath: string, bucket: Bucket): Promise<FileVersions>;
  getBranchFileVersions(
    repoPath: string,
    baseRef: string,
    headRef: string,
    relPath: string,
    previousPath?: string,
  ): Promise<FileVersions>;
  stageFile(repoPath: string, relPath: string): Promise<void>;
  unstageFile(repoPath: string, relPath: string): Promise<void>;
  stageAll(repoPath: string): Promise<void>;
  unstageAll(repoPath: string): Promise<void>;
  discardFile(repoPath: string, relPath: string, bucket: Bucket): Promise<void>;
  discardFiles(repoPath: string, files: DiscardFileInput[]): Promise<void>;
  discardAll(repoPath: string): Promise<void>;
  commitStaged(repoPath: string, message: string): Promise<string>;
  getRepoFile(input: GetRepoFileInput): Promise<DiffFile | null>;
};

type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export type DesktopUpdateErrorContext = "check" | "download" | "install" | null;

export type DesktopUpdateState = {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  checkedAt: string | null;
  downloadPercent: number | null;
  message: string | null;
  errorContext: DesktopUpdateErrorContext;
  canRetry: boolean;
  disabledReason: string | null;
};

export type DesktopUpdateActionResult = {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
};

type DesktopUpdateApi = {
  getUpdateState(): Promise<DesktopUpdateState>;
  checkForUpdates(): Promise<DesktopUpdateActionResult>;
  downloadUpdate(): Promise<DesktopUpdateActionResult>;
  installUpdate(): Promise<DesktopUpdateActionResult>;
  onUpdateState(listener: (state: DesktopUpdateState) => void): () => void;
};

type DesktopSettingsApi = {
  onAppSettingsChanged(listener: (settings: AppSettings) => void): () => void;
};

export type DesktopBridge = DesktopApi & DesktopUpdateApi & DesktopSettingsApi;
