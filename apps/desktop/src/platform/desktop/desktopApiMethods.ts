import type { DesktopApi } from "./contracts";

export type DesktopApiMethod = keyof DesktopApi;

export const DESKTOP_API_METHODS = [
  "selectFolder",
  "loadWorkspaceSession",
  "saveWorkspaceSession",
  "loadAppSettings",
  "saveAppSettings",
  "getAppSettingsPath",
  "confirm",
  "checkAppExists",
  "openPath",
  "listProviderConnections",
  "connectProvider",
  "disconnectProvider",
  "resolveHostedRepo",
  "listPullRequests",
  "getInboxPullRequests",
  "refreshInboxPullRequests",
  "resolveActivePullRequestForBranch",
  "getPullRequestConversation",
  "getPullRequestFiles",
  "getPullRequestPatch",
  "getPullRequestDiffCached",
  "addPullRequestComment",
  "replyToPullRequestThread",
  "submitPullRequestReviewComments",
  "setPullRequestThreadResolved",
  "preparePullRequestCompareRefs",
  "preparePullRequestWorkspace",
  "getGitSnapshot",
  "getRepoFiles",
  "getCommitHistory",
  "getBranches",
  "getBranchFiles",
  "getCommitFiles",
  "getCommitFileVersions",
  "getFileVersions",
  "getBranchFileVersions",
  "stageFile",
  "unstageFile",
  "stageAll",
  "unstageAll",
  "discardFile",
  "discardFiles",
  "discardAll",
  "commitStaged",
  "getRepoFile",
  "syncLspDocument",
  "closeLspDocument",
  "getLspHover",
  "getLspDefinition",
  "getLspReferences",
] as const satisfies readonly DesktopApiMethod[];

type RegisteredDesktopApiMethod = (typeof DESKTOP_API_METHODS)[number];
type MissingDesktopApiMethod = Exclude<DesktopApiMethod, RegisteredDesktopApiMethod>;
type ExtraDesktopApiMethod = Exclude<RegisteredDesktopApiMethod, DesktopApiMethod>;

// oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
const missingDesktopApiMethodCheck: never = null as unknown as MissingDesktopApiMethod;
// oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
const extraDesktopApiMethodCheck: never = null as unknown as ExtraDesktopApiMethod;

void missingDesktopApiMethodCheck;
void extraDesktopApiMethodCheck;
