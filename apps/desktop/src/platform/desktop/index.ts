import { createDesktopApiForwarder } from "./createDesktopApi";
import type { DesktopBridge } from "./contracts";
import { browserDesktopApi } from "./browser";

function hasElectronRuntime() {
  if (typeof window === "undefined") return false;

  return (
    (typeof window.desktopBridge === "object" && window.desktopBridge !== null) ||
    (typeof window.openWarden === "object" && window.openWarden !== null)
  );
}

function getElectronRuntime(): DesktopBridge | null {
  if (!hasElectronRuntime()) return null;
  return window.desktopBridge ?? window.openWarden ?? null;
}

function resolveDesktopApi(): DesktopBridge {
  const electronRuntime = getElectronRuntime();
  if (electronRuntime) {
    return electronRuntime;
  }

  return browserDesktopApi;
}

const desktopApi = createDesktopApiForwarder(() => resolveDesktopApi());

export const desktop: DesktopBridge = {
  ...desktopApi,
  getUpdateState: () => resolveDesktopApi().getUpdateState(),
  checkForUpdates: () => resolveDesktopApi().checkForUpdates(),
  downloadUpdate: () => resolveDesktopApi().downloadUpdate(),
  installUpdate: () => resolveDesktopApi().installUpdate(),
  onUpdateState: (listener) => resolveDesktopApi().onUpdateState(listener),
  onLspDiagnostics: (listener) => resolveDesktopApi().onLspDiagnostics(listener),
  onAppSettingsChanged: (listener) => resolveDesktopApi().onAppSettingsChanged(listener),
};

export type {
  AppSettings,
  AddPullRequestCommentInput,
  Bucket,
  ConnectProviderInput,
  DesktopUpdateState,
  DiffFile,
  FileItem,
  FileStatus,
  FileVersions,
  GitProviderId,
  RepoFileItem,
  GitSnapshot,
  HostedRepoRef,
  InboxPullRequestsResult,
  HistoryCommit,
  LspDiagnostic,
  LspDiagnosticsEvent,
  FileTreeRenderMode,
  LspLocation,
  PreparedPullRequestWorkspace,
  PreparePullRequestWorkspaceInput,
  ProviderConnection,
  PullRequestChangedFile,
  PullRequestChangeStats,
  PullRequestCompareRefs,
  PullRequestConversation,
  PullRequestDetail,
  PullRequestIssueComment,
  PullRequestLocatorInput,
  PullRequestOpenMode,
  PullRequestPerson,
  PullRequestReviewComment,
  PullRequestReviewDraftCommentInput,
  PullRequestReviewThread,
  ListPullRequestsInput,
  ResolveActivePullRequestForBranchInput,
  PullRequestPage,
  PullRequestSummary,
  ReplyToPullRequestThreadInput,
  SetPullRequestThreadResolvedInput,
  SubmitPullRequestReviewCommentsInput,
  SubmitPullRequestReviewCommentsResult,
  WorkspaceSession,
} from "./contracts";
