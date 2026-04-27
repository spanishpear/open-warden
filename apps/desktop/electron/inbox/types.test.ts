import { describe, expect, expectTypeOf, it } from "vitest";

import type { PullRequestSummary } from "../../src/platform/desktop/contracts";

import {
  InboxSection,
  InboxSectionPriority,
  type InboxParticipant,
  type InboxProvider,
  type InboxPullRequest,
  type InboxResult,
  type UserIdentity,
} from "./types";

describe("electron inbox types", () => {
  it("defines the expected inbox sections and priorities", () => {
    expect(Object.values(InboxSection)).toEqual([
      "NEEDS_REVIEW",
      "WAITING_FOR_REVIEW",
      "RETURNED_TO_YOU",
      "DRAFTS",
      "APPROVED",
      "MERGING_AND_MERGED",
    ]);

    expectTypeOf(InboxSectionPriority).toMatchTypeOf<Record<InboxSection, "HIGH" | "LOW">>();
    expect(InboxSectionPriority).toEqual({
      [InboxSection.NEEDS_REVIEW]: "HIGH",
      [InboxSection.WAITING_FOR_REVIEW]: "HIGH",
      [InboxSection.RETURNED_TO_YOU]: "HIGH",
      [InboxSection.DRAFTS]: "HIGH",
      [InboxSection.APPROVED]: "LOW",
      [InboxSection.MERGING_AND_MERGED]: "LOW",
    });
  });

  it("defines a provider-generic participant type", () => {
    expectTypeOf<InboxParticipant>().toEqualTypeOf<{
      login: string;
      displayName: string | null;
      avatarUrl: string | null;
      uuid: string | null;
      accountId: string | null;
      role: "REVIEWER" | "PARTICIPANT";
      approved: boolean;
      state: "approved" | "changes_requested" | null;
    }>();
  });

  it("extends PullRequestSummary for inbox pull requests", () => {
    type ExtendsPullRequestSummary = InboxPullRequest extends PullRequestSummary ? true : false;

    expectTypeOf<ExtendsPullRequestSummary>().toEqualTypeOf<true>();
    expectTypeOf<InboxPullRequest>().toMatchTypeOf<PullRequestSummary>();
    expectTypeOf<InboxPullRequest>().toMatchTypeOf<{
      authorUuid: string | null;
      authorAccountId: string | null;
      participants: InboxParticipant[];
      reviewers: InboxParticipant[];
      section: InboxSection;
    }>();
  });

  it("defines the inbox result payload shape", () => {
    expectTypeOf<InboxResult>().toEqualTypeOf<{
      sections: Record<InboxSection, InboxPullRequest[]>;
      userIdentity: { uuid: string; login: string } | null;
      fetchedAt: number;
      isStale: boolean;
    }>();
  });

  it("defines the shared user identity and provider contract", () => {
    expectTypeOf<UserIdentity>().toEqualTypeOf<{
      uuid: string;
      accountId: string;
      login: string;
      displayName: string | null;
      providerId: string;
    }>();

    expectTypeOf<keyof InboxProvider>().toEqualTypeOf<
      "resolveUserIdentity" | "fetchInboxPullRequests"
    >();
    expectTypeOf<InboxProvider["resolveUserIdentity"]>().toEqualTypeOf<
      () => Promise<UserIdentity>
    >();
    expectTypeOf<InboxProvider["fetchInboxPullRequests"]>().toEqualTypeOf<
      (repoPath: string, userIdentity: UserIdentity) => Promise<InboxPullRequest[]>
    >();
  });
});
