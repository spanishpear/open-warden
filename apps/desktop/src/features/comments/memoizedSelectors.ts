import { createSelector } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";
import type { CommentContext, CommentItem } from "@/features/source-control/types";

const selectComments = (state: RootState) => state.comments;

type RootSelector<TResult> = (state: RootState) => TResult;

function commentMatchesContext(comment: CommentItem, context?: CommentContext): boolean {
  if (!context) return true;

  const kind = comment.contextKind ?? "changes";
  if (kind !== context.kind) return false;

  if (context.kind === "review") {
    return comment.baseRef === context.baseRef && comment.headRef === context.headRef;
  }

  return true;
}

function createSelectorCache<TSelector>() {
  return new Map<string, TSelector>();
}

function selectorCacheKey(args: { repoPath: string; context?: CommentContext; filePath?: string }) {
  return JSON.stringify(args);
}

const commentCountByFileCache = createSelectorCache<RootSelector<Record<string, number>>>();
const pendingDraftsCache = createSelectorCache<RootSelector<CommentItem[]>>();
const pendingDraftCountCache = createSelectorCache<RootSelector<number>>();
const repoCommentCountCache = createSelectorCache<RootSelector<number>>();
const commentsForPathCache = createSelectorCache<RootSelector<CommentItem[]>>();

export const selectCommentCountByFile = (repoPath: string, context?: CommentContext) => {
  const key = selectorCacheKey({ repoPath, context });
  const cached = commentCountByFileCache.get(key);
  if (cached) {
    return cached;
  }

  const selector = createSelector([selectComments], (comments) => {
    const counts: Record<string, number> = {};
    if (!repoPath) {
      return counts;
    }

    for (const comment of comments) {
      if (comment.repoPath !== repoPath) continue;
      if (!commentMatchesContext(comment, context)) continue;
      counts[comment.filePath] = (counts[comment.filePath] ?? 0) + 1;
    }

    return counts;
  });

  commentCountByFileCache.set(key, selector);
  return selector;
};

export const selectPendingDrafts = (repoPath: string, context?: CommentContext) => {
  const key = selectorCacheKey({ repoPath, context });
  const cached = pendingDraftsCache.get(key);
  if (cached) {
    return cached;
  }

  const selector = createSelector([selectComments], (comments) => {
    if (!repoPath) {
      return [] as CommentItem[];
    }

    return comments.filter(
      (comment) => comment.repoPath === repoPath && commentMatchesContext(comment, context),
    );
  });

  pendingDraftsCache.set(key, selector);
  return selector;
};

export const selectPendingDraftCount = (repoPath: string, context?: CommentContext) => {
  const key = selectorCacheKey({ repoPath, context });
  const cached = pendingDraftCountCache.get(key);
  if (cached) {
    return cached;
  }

  const selector = createSelector([selectPendingDrafts(repoPath, context)], (pendingDrafts) => {
    return pendingDrafts.length;
  });

  pendingDraftCountCache.set(key, selector);
  return selector;
};

export const selectRepoCommentCount = (repoPath: string) => {
  const key = selectorCacheKey({ repoPath });
  const cached = repoCommentCountCache.get(key);
  if (cached) {
    return cached;
  }

  const selector = createSelector([selectComments], (comments) => {
    if (!repoPath) {
      return 0;
    }

    let count = 0;
    for (const comment of comments) {
      if (comment.repoPath === repoPath) {
        count += 1;
      }
    }

    return count;
  });

  repoCommentCountCache.set(key, selector);
  return selector;
};

export const selectCommentsForPath = (
  repoPath: string,
  filePath: string,
  context?: CommentContext,
) => {
  const key = selectorCacheKey({ repoPath, filePath, context });
  const cached = commentsForPathCache.get(key);
  if (cached) {
    return cached;
  }

  const selector = createSelector([selectComments], (comments) => {
    if (!repoPath || !filePath) {
      return [] as CommentItem[];
    }

    return comments.filter(
      (comment) =>
        comment.repoPath === repoPath &&
        comment.filePath === filePath &&
        commentMatchesContext(comment, context),
    );
  });

  commentsForPathCache.set(key, selector);
  return selector;
};
