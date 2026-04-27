import { getDb, getInboxSnapshot, setInboxSnapshot } from "./cache";
import type { InboxParticipant, InboxPullRequest } from "./types";

export type CacheScope = "open" | "merged";

export const OPEN_CACHE_TTL_MS = 2 * 60_000;
export const MERGED_CACHE_TTL_MS = 10 * 60_000;

type CachedInboxSnapshot = {
  prs: InboxPullRequest[];
  fetchedAt: number;
  isPartial: boolean;
};

type SerializedInboxParticipant = Pick<
  InboxParticipant,
  "login" | "displayName" | "avatarUrl" | "uuid" | "accountId" | "role" | "approved" | "state"
>;

type SerializedInboxPullRequest = Pick<
  InboxPullRequest,
  | "id"
  | "providerId"
  | "number"
  | "title"
  | "state"
  | "isDraft"
  | "authorLogin"
  | "authorDisplayName"
  | "authorUuid"
  | "authorAccountId"
  | "url"
  | "baseRef"
  | "headRef"
  | "headOwner"
  | "headRepo"
  | "updatedAt"
  | "section"
> & {
  participants: SerializedInboxParticipant[];
  reviewers: SerializedInboxParticipant[];
};

function serializeParticipant(participant: InboxParticipant): SerializedInboxParticipant {
  return {
    login: participant.login,
    displayName: participant.displayName,
    avatarUrl: participant.avatarUrl,
    uuid: participant.uuid,
    accountId: participant.accountId,
    role: participant.role,
    approved: participant.approved,
    state: participant.state,
  };
}

function serializePullRequest(pr: InboxPullRequest): SerializedInboxPullRequest {
  return {
    id: pr.id,
    providerId: pr.providerId,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.isDraft,
    authorLogin: pr.authorLogin,
    authorDisplayName: pr.authorDisplayName,
    authorUuid: pr.authorUuid,
    authorAccountId: pr.authorAccountId,
    url: pr.url,
    baseRef: pr.baseRef,
    headRef: pr.headRef,
    headOwner: pr.headOwner,
    headRepo: pr.headRepo,
    updatedAt: pr.updatedAt,
    participants: pr.participants.map(serializeParticipant),
    reviewers: pr.reviewers.map(serializeParticipant),
    section: pr.section,
  };
}

function deserializeSnapshot(dataJson: string): InboxPullRequest[] | null {
  const parsed = JSON.parse(dataJson) as unknown;

  if (!Array.isArray(parsed)) {
    return null;
  }

  // Map serialized snapshot back to strongly-typed InboxPullRequest objects
  const mapped = parsed.map((item) => {
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const pr = item as unknown as SerializedInboxPullRequest;
    return {
      id: pr.id,
      providerId: pr.providerId,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      isDraft: pr.isDraft,
      authorLogin: pr.authorLogin,
      authorDisplayName: pr.authorDisplayName,
      authorUuid: pr.authorUuid,
      authorAccountId: pr.authorAccountId,
      url: pr.url,
      baseRef: pr.baseRef,
      headRef: pr.headRef,
      headOwner: pr.headOwner,
      headRepo: pr.headRepo,
      updatedAt: pr.updatedAt,
      participants: pr.participants.map((p) => ({
        login: p.login,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        uuid: p.uuid,
        accountId: p.accountId,
        role: p.role,
        approved: p.approved,
        state: p.state,
      })),
      reviewers: pr.reviewers.map((r) => ({
        login: r.login,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        uuid: r.uuid,
        accountId: r.accountId,
        role: r.role,
        approved: r.approved,
        state: r.state,
      })),
      section: pr.section,
    } as InboxPullRequest;
  });

  return mapped;
}

export function cacheInboxSnapshot(
  repoPath: string,
  scope: CacheScope,
  prs: InboxPullRequest[],
  isPartial: boolean,
): void {
  setInboxSnapshot({
    repoPath,
    scope,
    dataJson: JSON.stringify(prs.map(serializePullRequest)),
    fetchedAt: Date.now(),
    isPartial,
  });
}

export function getCachedInboxSnapshot(
  repoPath: string,
  scope: CacheScope,
): CachedInboxSnapshot | null {
  const snapshot = getInboxSnapshot(repoPath, scope);

  if (!snapshot) {
    return null;
  }

  const prs = deserializeSnapshot(snapshot.dataJson);
  if (!prs) {
    return null;
  }

  return {
    prs,
    fetchedAt: snapshot.fetchedAt,
    isPartial: snapshot.isPartial,
  };
}

export function isCacheStale(fetchedAt: number | null, ttlMs: number): boolean {
  if (fetchedAt === null) {
    return true;
  }

  return Date.now() - fetchedAt > ttlMs;
}

export function clearInboxCache(repoPath?: string): void {
  if (repoPath) {
    getDb().prepare("DELETE FROM inbox_snapshots WHERE repo_path = ?").run(repoPath);
    return;
  }

  getDb().prepare("DELETE FROM inbox_snapshots").run();
}
