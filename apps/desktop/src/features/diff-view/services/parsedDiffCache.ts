import type { ParsePriority } from "@/features/diff-view/services/parseDiffInWorker";
import { getDiffRenderGate } from "@/features/diff-view/services/diffRenderLimits";
import {
  parseDiffInWorker,
  parsePatchInWorker,
} from "@/features/diff-view/services/parseDiffInWorker";
import type { DiffFile } from "@/features/source-control/types";

export type ParsedDiff = Awaited<ReturnType<typeof parseDiffInWorker>>;
export type ParsedPatch = Awaited<ReturnType<typeof parsePatchInWorker>>;

type ParseWorkerFile = DiffFile & { cacheKey?: string };

type ParsedDiffRequest = {
  key: string;
  oldFile: ParseWorkerFile;
  newFile: ParseWorkerFile;
};

type ParsedPatchRequest = {
  key: string;
  patchText: string;
  cacheKeyPrefix?: string;
};

const MAX_PARSED_DIFF_CACHE_SIZE = 64;

const parsedDiffCache = new Map<string, ParsedDiff | null>();
const parsedPatchCache = new Map<string, ParsedPatch | null>();

type InFlightParse = {
  promise: Promise<ParsedDiff | null>;
  priority: ParsePriority;
  controller: AbortController;
};

const inFlightParses = new Map<string, InFlightParse>();

type InFlightPatchParse = {
  promise: Promise<ParsedPatch | null>;
  priority: ParsePriority;
  controller: AbortController;
};

const inFlightPatchParses = new Map<string, InFlightPatchParse>();

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function hashStringFNV1a(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function getFileCacheKey(file: DiffFile): string {
  const nameHash = hashStringFNV1a(file.name);
  const contentsHash = hashStringFNV1a(file.contents);

  return `f-${nameHash}-${file.contents.length}-${contentsHash}`;
}

function withCacheKey(file: DiffFile, salt = ""): ParseWorkerFile {
  const baseCacheKey = getFileCacheKey(file);
  return {
    ...file,
    cacheKey: salt ? `${baseCacheKey}:${salt}` : baseCacheKey,
  };
}

function touchParsedDiff(key: string, diff: ParsedDiff | null) {
  parsedDiffCache.delete(key);
  parsedDiffCache.set(key, diff);

  while (parsedDiffCache.size > MAX_PARSED_DIFF_CACHE_SIZE) {
    const oldestKey = parsedDiffCache.keys().next().value;
    if (!oldestKey) break;
    parsedDiffCache.delete(oldestKey);
  }
}

function touchParsedPatch(key: string, patch: ParsedPatch | null) {
  parsedPatchCache.delete(key);
  parsedPatchCache.set(key, patch);

  while (parsedPatchCache.size > MAX_PARSED_DIFF_CACHE_SIZE) {
    const oldestKey = parsedPatchCache.keys().next().value;
    if (!oldestKey) break;
    parsedPatchCache.delete(oldestKey);
  }
}

function getCachedParsedPatch(key: string): ParsedPatch | null | undefined {
  if (!parsedPatchCache.has(key)) return undefined;

  const patch = parsedPatchCache.get(key) ?? null;
  touchParsedPatch(key, patch);
  return patch;
}

export function getParsedDiffRequest(
  activePath: string | null,
  oldFile: DiffFile | null,
  newFile: DiffFile | null,
  cacheSalt = "",
  options: { allowLargeDiff?: boolean } = {},
): ParsedDiffRequest | null {
  const diffRenderGate = getDiffRenderGate(activePath, oldFile, newFile);
  if (!diffRenderGate || diffRenderGate === "unrenderable") return null;
  if (diffRenderGate === "large" && !options.allowLargeDiff) return null;

  const fallbackPath = activePath ?? "";
  const oldTargetFile = oldFile ?? { name: fallbackPath, contents: "" };
  const newTargetFile = newFile ?? { name: fallbackPath, contents: "" };
  const oldFileWithCacheKey = withCacheKey(oldTargetFile, cacheSalt);
  const newFileWithCacheKey = withCacheKey(newTargetFile, cacheSalt);

  return {
    key: `${oldFileWithCacheKey.cacheKey}:${newFileWithCacheKey.cacheKey}`,
    oldFile: oldFileWithCacheKey,
    newFile: newFileWithCacheKey,
  };
}

export function getCachedParsedDiff(key: string): ParsedDiff | null | undefined {
  if (!parsedDiffCache.has(key)) return undefined;

  const diff = parsedDiffCache.get(key) ?? null;
  touchParsedDiff(key, diff);
  return diff;
}

export function getParsedPatchRequest(
  activePath: string | null,
  patchText: string | null,
  cacheSalt = "",
  options: { allowLargeDiff?: boolean; cacheKeyPrefix?: string } = {},
): ParsedPatchRequest | null {
  if (!activePath || patchText == null) return null;

  const diffRenderGate = getDiffRenderGate(activePath, null, {
    name: activePath,
    contents: patchText,
  });
  if (!diffRenderGate || diffRenderGate === "unrenderable") return null;
  if (diffRenderGate === "large" && !options.allowLargeDiff) return null;

  const patchHash = hashStringFNV1a(patchText + cacheSalt);
  const key = `p-${patchHash}:${patchText.length}`;

  return { key, patchText, cacheKeyPrefix: options.cacheKeyPrefix };
}

export function peekCachedParsedDiff(key: string): ParsedDiff | null | undefined {
  if (!parsedDiffCache.has(key)) return undefined;
  return parsedDiffCache.get(key) ?? null;
}

export function isParsedDiffInFlight(key: string): boolean {
  return inFlightParses.has(key);
}

export async function loadParsedDiff(
  request: ParsedDiffRequest,
  priority: ParsePriority = "high",
): Promise<ParsedDiff | null> {
  const cached = getCachedParsedDiff(request.key);
  if (cached !== undefined) return cached;

  const inFlight = inFlightParses.get(request.key);
  if (inFlight && (priority === "low" || inFlight.priority === "high")) {
    return inFlight.promise;
  }

  inFlight?.controller.abort();

  const controller = new AbortController();

  const parsePromise = parseDiffInWorker(
    request.oldFile,
    request.newFile,
    controller.signal,
    priority,
  )
    .then((parsedDiff) => {
      touchParsedDiff(request.key, parsedDiff);
      return parsedDiff;
    })
    .catch((error) => {
      if (isAbortError(error)) {
        return null;
      }
      return null;
    })
    .finally(() => {
      const currentInFlight = inFlightParses.get(request.key);
      if (currentInFlight?.promise === parsePromise) {
        inFlightParses.delete(request.key);
      }
    });

  inFlightParses.set(request.key, { promise: parsePromise, priority, controller });
  return parsePromise;
}

export async function loadParsedPatch(
  request: ParsedPatchRequest,
  priority: ParsePriority = "high",
): Promise<ParsedPatch | null> {
  const cached = getCachedParsedPatch(request.key);
  if (cached !== undefined) return cached;

  const inFlight = inFlightPatchParses.get(request.key);
  if (inFlight && (priority === "low" || inFlight.priority === "high")) {
    return inFlight.promise;
  }

  inFlight?.controller.abort();

  const controller = new AbortController();

  const parsePromise = parsePatchInWorker(
    request.patchText,
    request.cacheKeyPrefix,
    controller.signal,
  )
    .then((parsedPatches) => {
      touchParsedPatch(request.key, parsedPatches);
      return parsedPatches;
    })
    .catch((error) => {
      if (isAbortError(error)) {
        return null;
      }
      return null;
    })
    .finally(() => {
      const currentInFlight = inFlightPatchParses.get(request.key);
      if (currentInFlight?.promise === parsePromise) {
        inFlightPatchParses.delete(request.key);
      }
    });

  inFlightPatchParses.set(request.key, { promise: parsePromise, priority, controller });
  return parsePromise;
}

type PrefetchParsedDiffArgs = {
  activePath: string | null;
  oldFile: DiffFile | null;
  newFile: DiffFile | null;
  cacheSalt?: string;
  priority?: ParsePriority;
};

// @ts-expect-error -- oxlint typescript
// oxlint-disable-next-line eslint(no-unused-vars)
async function prefetchParsedDiff({
  activePath,
  oldFile,
  newFile,
  cacheSalt = "",
  priority = "low",
}: PrefetchParsedDiffArgs): Promise<void> {
  const request = getParsedDiffRequest(activePath, oldFile, newFile, cacheSalt);
  if (!request) return;

  await loadParsedDiff(request, priority);
}
