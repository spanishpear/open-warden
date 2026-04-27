import { bitbucketRequest, type BitbucketUserResponse } from "../bitbucket-repo";
import type { ProviderConnectionSecret } from "../providerConnections";

import { IDENTITY_CACHE_TTL_MS, getUserIdentity, setUserIdentity } from "./cache";

type ResolvedUserIdentity = {
  providerId: string;
  uuid: string | null;
  accountId: string | null;
  login: string | null;
  displayName: string | null;
};

function stripFetchedAt(
  identity: ReturnType<typeof getUserIdentity> | null,
): ResolvedUserIdentity | null {
  if (!identity) {
    return null;
  }

  return {
    providerId: identity.providerId,
    uuid: identity.uuid,
    accountId: identity.accountId,
    login: identity.login,
    displayName: identity.displayName,
  };
}

export function isStale(fetchedAt: number | null | undefined, ttlMs: number): boolean {
  return typeof fetchedAt !== "number" || Date.now() - fetchedAt >= ttlMs;
}

export function getCachedUserIdentity(providerId: string): ResolvedUserIdentity | null {
  return stripFetchedAt(getUserIdentity(providerId));
}

export function cacheUserIdentity(identity: ResolvedUserIdentity): void {
  setUserIdentity({
    ...identity,
    fetchedAt: Date.now(),
  });
}

export async function resolveUserIdentity(
  providerId: string,
  connection: ProviderConnectionSecret,
): Promise<ResolvedUserIdentity | null> {
  if (providerId !== "bitbucket") {
    return null;
  }

  try {
    const response = await bitbucketRequest<BitbucketUserResponse>("/user", connection);

    return {
      providerId,
      uuid: response.data.uuid ?? null,
      accountId: response.data.account_id ?? null,
      login: response.data.nickname ?? null,
      displayName: response.data.display_name ?? null,
    };
  } catch {
    return null;
  }
}

export async function getOrResolveUserIdentity(
  providerId: string,
  connection: ProviderConnectionSecret,
): Promise<ResolvedUserIdentity | null> {
  const cached = getUserIdentity(providerId);

  if (cached && !isStale(cached.fetchedAt, IDENTITY_CACHE_TTL_MS)) {
    return stripFetchedAt(cached);
  }

  if (cached) {
    void resolveUserIdentity(providerId, connection).then((resolvedIdentity) => {
      if (resolvedIdentity) {
        cacheUserIdentity(resolvedIdentity);
      }
    });

    return stripFetchedAt(cached);
  }

  const resolvedIdentity = await resolveUserIdentity(providerId, connection);

  if (!resolvedIdentity) {
    return null;
  }

  cacheUserIdentity(resolvedIdentity);

  return resolvedIdentity;
}
