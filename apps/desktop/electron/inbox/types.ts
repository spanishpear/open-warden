import type { PullRequestSummary } from "../../src/platform/desktop/contracts";

export enum InboxSection {
  NEEDS_REVIEW = "NEEDS_REVIEW",
  WAITING_FOR_REVIEW = "WAITING_FOR_REVIEW",
  RETURNED_TO_YOU = "RETURNED_TO_YOU",
  DRAFTS = "DRAFTS",
  APPROVED = "APPROVED",
  MERGING_AND_MERGED = "MERGING_AND_MERGED",
}

export const InboxSectionPriority = {
  [InboxSection.NEEDS_REVIEW]: "HIGH",
  [InboxSection.WAITING_FOR_REVIEW]: "HIGH",
  [InboxSection.RETURNED_TO_YOU]: "HIGH",
  [InboxSection.DRAFTS]: "HIGH",
  [InboxSection.APPROVED]: "LOW",
  [InboxSection.MERGING_AND_MERGED]: "LOW",
} as const satisfies Record<InboxSection, "HIGH" | "LOW">;

export type InboxParticipant = {
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
  uuid: string | null;
  accountId: string | null;
  role: "REVIEWER" | "PARTICIPANT";
  approved: boolean;
  state: "approved" | "changes_requested" | null;
};

export type InboxPullRequest = PullRequestSummary & {
  authorUuid: string | null;
  authorAccountId: string | null;
  participants: InboxParticipant[];
  reviewers: InboxParticipant[];
  section: InboxSection;
};

export type InboxResult = {
  sections: Record<InboxSection, InboxPullRequest[]>;
  userIdentity: { uuid: string; login: string } | null;
  fetchedAt: number;
  isStale: boolean;
};

export type UserIdentity = {
  uuid: string;
  accountId: string;
  login: string;
  displayName: string | null;
  providerId: string;
};

export interface InboxProvider {
  resolveUserIdentity(): Promise<UserIdentity>;
  fetchInboxPullRequests(repoPath: string, userIdentity: UserIdentity): Promise<InboxPullRequest[]>;
}
