import { skipToken } from "@reduxjs/toolkit/query";
import { useEffect, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  useGetInboxPullRequestsQuery,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import { prefetchPullRequestDetail } from "@/features/inbox/hooks/useInboxNavigation";
import { selectActiveRepo } from "@/features/source-control/sourceControlSlice";

const BACKGROUND_PREFETCH_DELAY_MS = 150;

export function useBackgroundInboxPrefetch() {
  const dispatch = useAppDispatch();
  const activeRepo = useAppSelector(selectActiveRepo);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPrefetchRunRef = useRef<string | null>(null);

  const activeRepoArg = activeRepo ? activeRepo : skipToken;
  const { data: hostedRepo } = useResolveHostedRepoQuery(activeRepoArg);

  const inboxRepoArg =
    activeRepo && hostedRepo?.providerId === "bitbucket" ? activeRepo : skipToken;
  const { data: inboxData } = useGetInboxPullRequestsQuery(inboxRepoArg);

  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const clearPrefetchTimer = () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };

    if (!activeRepo || !inboxData) {
      lastPrefetchRunRef.current = null;
      return clearPrefetchTimer;
    }

    const prefetchRunKey = `${activeRepo}:${String(inboxData.fetchedAt)}`;
    if (lastPrefetchRunRef.current === prefetchRunKey) {
      return clearPrefetchTimer;
    }

    const seenIds = new Set<string>();
    const prefetchQueue = Object.values(inboxData.sections)
      .flat()
      .filter((pr) => {
        if (seenIds.has(pr.id)) {
          return false;
        }

        seenIds.add(pr.id);
        return true;
      })
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (prefetchQueue.length === 0) {
      lastPrefetchRunRef.current = prefetchRunKey;
      return clearPrefetchTimer;
    }

    lastPrefetchRunRef.current = prefetchRunKey;
    let nextIndex = 0;

    clearPrefetchTimer();

    const scheduleNextPrefetch = () => {
      if (cancelled) {
        prefetchTimerRef.current = null;
        return;
      }

      const nextPullRequest = prefetchQueue[nextIndex];
      if (!nextPullRequest) {
        prefetchTimerRef.current = null;
        return;
      }

      nextIndex += 1;
      prefetchPullRequestDetail(dispatch, activeRepo, nextPullRequest);
      prefetchTimerRef.current = setTimeout(scheduleNextPrefetch, BACKGROUND_PREFETCH_DELAY_MS);
    };

    prefetchTimerRef.current = setTimeout(scheduleNextPrefetch, 0);

    return () => {
      cancelled = true;
      clearPrefetchTimer();
    };
  }, [activeRepo, dispatch, inboxData]);
}
