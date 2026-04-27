import { describe, expect, it } from "vitest";

import { InboxSection, type InboxParticipant, type InboxPullRequest } from "./types";
import { classifyPullRequest, classifyPullRequests } from "./sections";

const USER_ACCOUNT_ID = "user-account-id";
const USER_UUID = "{user-uuid}";
const OTHER_UUID = "{other-uuid}";
const USER_IDENTITY = {
  accountId: USER_ACCOUNT_ID,
  uuid: USER_UUID,
};

function reviewer(overrides: Partial<InboxParticipant> = {}): InboxParticipant {
  return {
    login: overrides.login ?? "reviewer",
    displayName: overrides.displayName ?? "Reviewer",
    avatarUrl: overrides.avatarUrl ?? null,
    uuid: overrides.uuid ?? "{reviewer-uuid}",
    accountId: overrides.accountId ?? "reviewer-account",
    role: overrides.role ?? "REVIEWER",
    approved: overrides.approved ?? false,
    state: overrides.state ?? null,
  };
}

function createPullRequest(overrides: Partial<InboxPullRequest> = {}): InboxPullRequest {
  return {
    id: overrides.id ?? "pr-1",
    providerId: overrides.providerId ?? "bitbucket",
    number: overrides.number ?? 1,
    title: overrides.title ?? "Test pull request",
    state: overrides.state ?? "open",
    isDraft: overrides.isDraft ?? false,
    authorLogin: overrides.authorLogin ?? "author",
    authorDisplayName: overrides.authorDisplayName ?? "Author",
    url: overrides.url ?? "https://example.test/pr/1",
    baseRef: overrides.baseRef ?? "main",
    headRef: overrides.headRef ?? "feature/test",
    headOwner: overrides.headOwner ?? "example",
    headRepo: overrides.headRepo ?? "repo",
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    authorUuid: overrides.authorUuid ?? USER_UUID,
    authorAccountId: overrides.authorAccountId ?? "author-account",
    participants: overrides.participants ?? [],
    reviewers: overrides.reviewers ?? [],
    section: overrides.section ?? InboxSection.NEEDS_REVIEW,
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("electron inbox section classification", () => {
  it("classifies my draft pull request into DRAFTS", () => {
    const pr = createPullRequest({
      isDraft: true,
      authorUuid: USER_UUID,
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.DRAFTS);
  });

  it("classifies my pull request as authored by me when authorAccountId matches", () => {
    const pr = createPullRequest({
      isDraft: true,
      authorUuid: OTHER_UUID,
      authorAccountId: USER_ACCOUNT_ID,
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.DRAFTS);
  });

  it("classifies recently merged pull requests into MERGING_AND_MERGED", () => {
    const pr = createPullRequest({
      state: "merged",
      updatedAt: daysAgo(2),
      authorUuid: OTHER_UUID,
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.MERGING_AND_MERGED);
  });

  it("classifies my recently merged pull request into MERGING_AND_MERGED before author waiting logic", () => {
    const pr = createPullRequest({
      state: "merged",
      updatedAt: daysAgo(1),
      authorUuid: USER_UUID,
      authorAccountId: USER_ACCOUNT_ID,
      reviewers: [reviewer({ uuid: "{reviewer-1}", approved: false })],
      participants: [reviewer({ uuid: "{reviewer-1}", approved: false })],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.MERGING_AND_MERGED);
  });

  it("does not classify old merged pull requests into the recent merged section", () => {
    const pr = createPullRequest({
      state: "merged",
      updatedAt: daysAgo(8),
      authorUuid: OTHER_UUID,
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBeNull();
  });

  it("classifies my pull request with reviewer changes requested into RETURNED_TO_YOU", () => {
    const pr = createPullRequest({
      authorUuid: USER_UUID,
      participants: [reviewer({ state: "changes_requested" })],
      reviewers: [reviewer()],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.RETURNED_TO_YOU);
  });

  it("classifies my non-draft pull request with pending reviewers into WAITING_FOR_REVIEW", () => {
    const pr = createPullRequest({
      authorUuid: USER_UUID,
      reviewers: [reviewer({ uuid: "{reviewer-1}" }), reviewer({ uuid: "{reviewer-2}" })],
      participants: [reviewer({ uuid: "{reviewer-1}" }), reviewer({ uuid: "{reviewer-2}" })],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.WAITING_FOR_REVIEW);
  });

  it("does not classify my pull request as waiting when any reviewer has approved", () => {
    const pr = createPullRequest({
      authorUuid: USER_UUID,
      reviewers: [reviewer({ uuid: "{reviewer-1}", approved: true, state: "approved" })],
      participants: [reviewer({ uuid: "{reviewer-1}", approved: true, state: "approved" })],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBeNull();
  });

  it("classifies someone else's pull request into NEEDS_REVIEW when I am a requested reviewer without approval yet", () => {
    const pr = createPullRequest({
      authorUuid: OTHER_UUID,
      reviewers: [reviewer({ uuid: USER_UUID, approved: false })],
      participants: [],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.NEEDS_REVIEW);
  });

  it("classifies someone else's pull request into NEEDS_REVIEW when reviewer accountId matches", () => {
    const pr = createPullRequest({
      authorUuid: OTHER_UUID,
      reviewers: [
        reviewer({ uuid: "{different-reviewer}", accountId: USER_ACCOUNT_ID, approved: false }),
      ],
      participants: [],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.NEEDS_REVIEW);
  });

  it("classifies someone else's pull request into APPROVED when my reviewer entry is approved", () => {
    const pr = createPullRequest({
      authorUuid: OTHER_UUID,
      reviewers: [reviewer({ uuid: USER_UUID, approved: true, state: "approved" })],
      participants: [reviewer({ uuid: USER_UUID, approved: true, state: "approved" })],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.APPROVED);
  });

  it("lets author sections win when I am both the author and a reviewer", () => {
    const pr = createPullRequest({
      isDraft: true,
      authorUuid: USER_UUID,
      reviewers: [reviewer({ uuid: USER_UUID })],
      participants: [reviewer({ uuid: USER_UUID })],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBe(InboxSection.DRAFTS);
  });

  it("excludes pull requests where I am neither author nor reviewer", () => {
    const pr = createPullRequest({
      authorUuid: OTHER_UUID,
      reviewers: [reviewer({ uuid: "{different-reviewer}" })],
      participants: [reviewer({ uuid: "{different-reviewer}" })],
    });

    expect(classifyPullRequest(pr, USER_IDENTITY)).toBeNull();
  });

  it("groups pull requests by section and excludes unrelated ones", () => {
    const drafts = createPullRequest({ id: "drafts", isDraft: true, authorUuid: USER_UUID });
    const waiting = createPullRequest({
      id: "waiting",
      authorUuid: USER_UUID,
      reviewers: [reviewer({ uuid: "{reviewer-1}" })],
      participants: [reviewer({ uuid: "{reviewer-1}" })],
    });
    const returned = createPullRequest({
      id: "returned",
      authorUuid: USER_UUID,
      participants: [reviewer({ uuid: "{reviewer-2}", state: "changes_requested" })],
      reviewers: [reviewer({ uuid: "{reviewer-2}" })],
    });
    const needsReview = createPullRequest({
      id: "needs-review",
      authorUuid: OTHER_UUID,
      reviewers: [reviewer({ uuid: USER_UUID, approved: false })],
      participants: [],
    });
    const approved = createPullRequest({
      id: "approved",
      authorUuid: OTHER_UUID,
      reviewers: [reviewer({ uuid: USER_UUID, approved: true, state: "approved" })],
      participants: [reviewer({ uuid: USER_UUID, approved: true, state: "approved" })],
    });
    const merged = createPullRequest({
      id: "merged",
      state: "merged",
      updatedAt: daysAgo(1),
      authorUuid: OTHER_UUID,
    });
    const excluded = createPullRequest({
      id: "excluded",
      authorUuid: OTHER_UUID,
      reviewers: [reviewer({ uuid: "{different-reviewer}" })],
      participants: [],
    });

    expect(
      classifyPullRequests(
        [drafts, waiting, returned, needsReview, approved, merged, excluded],
        USER_IDENTITY,
      ),
    ).toEqual({
      [InboxSection.NEEDS_REVIEW]: [needsReview],
      [InboxSection.WAITING_FOR_REVIEW]: [waiting],
      [InboxSection.RETURNED_TO_YOU]: [returned],
      [InboxSection.DRAFTS]: [drafts],
      [InboxSection.APPROVED]: [approved],
      [InboxSection.MERGING_AND_MERGED]: [merged],
    });
  });

  it("returns empty arrays for every section when given no pull requests", () => {
    expect(classifyPullRequests([], USER_IDENTITY)).toEqual({
      [InboxSection.NEEDS_REVIEW]: [],
      [InboxSection.WAITING_FOR_REVIEW]: [],
      [InboxSection.RETURNED_TO_YOU]: [],
      [InboxSection.DRAFTS]: [],
      [InboxSection.APPROVED]: [],
      [InboxSection.MERGING_AND_MERGED]: [],
    });
  });
});
