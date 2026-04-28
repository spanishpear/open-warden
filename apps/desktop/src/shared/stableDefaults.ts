// Typed, frozen empty defaults used by RTK Query selectFromResult consumers
import type {
  PullRequestChangedFile,
  ProviderConnection,
  HistoryCommit,
  FileItem,
} from "@/platform/desktop";

export const EMPTY_ARRAY: readonly never[] = Object.freeze([]) as readonly never[];

export const EMPTY_FILES: PullRequestChangedFile[] = [];
export const EMPTY_CONNECTIONS: ProviderConnection[] = [];
export const EMPTY_COMMITS: HistoryCommit[] = [];
export const EMPTY_FILE_ITEMS: FileItem[] = [];
