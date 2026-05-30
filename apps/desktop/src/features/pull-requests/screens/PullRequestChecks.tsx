import { skipToken } from "@reduxjs/toolkit/query";
import {
  CheckCircle2,
  CircleSlash,
  ExternalLink,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useParams } from "react-router";

import { useAppSelector } from "@/app/hooks";
import { PreviewPlaceholder } from "@/features/pull-requests/components/PreviewPlaceholder";
import {
  useGetPullRequestBuildStatusesQuery,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import { selectActiveRepo } from "@/features/source-control/sourceControlSlice";
import type { BuildStatus } from "@/platform/desktop";

const STATE_META: Record<
  BuildStatus["state"],
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  successful: { label: "Successful", icon: CheckCircle2, className: "text-green-400" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-400" },
  inprogress: { label: "In progress", icon: Loader2, className: "text-yellow-400" },
  stopped: { label: "Stopped", icon: CircleSlash, className: "text-muted-foreground" },
};

function BuildStatusRow({ status }: { status: BuildStatus }) {
  const meta = STATE_META[status.state];
  const Icon = meta.icon;
  const hasUrl = status.url.trim().length > 0;

  return (
    <li className="border-border/70 flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className} ${
          status.state === "inprogress" ? "animate-spin" : ""
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-sm font-medium">{status.name || status.key}</span>
          <span className={`text-xs ${meta.className}`}>{meta.label}</span>
        </div>
        {status.description ? (
          <div className="text-muted-foreground mt-0.5 text-xs leading-5">{status.description}</div>
        ) : null}
      </div>
      {hasUrl ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs"
          onClick={() => {
            window.open(status.url, "_blank", "noopener,noreferrer");
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </button>
      ) : null}
    </li>
  );
}

export const PullRequestChecks = () => {
  const activeRepo = useAppSelector(selectActiveRepo);
  const { providerId, owner, repo, pullRequestNumber } = useParams();
  const parsedPullRequestNumber = Number.parseInt(pullRequestNumber ?? "", 10);

  const { hostedRepo } = useResolveHostedRepoQuery(activeRepo, {
    skip: !activeRepo,
    selectFromResult: ({ data }) => ({ hostedRepo: data ?? null }),
  });

  const routeMatchesActiveRepo = Boolean(
    hostedRepo &&
      providerId &&
      owner &&
      repo &&
      hostedRepo.providerId === providerId &&
      hostedRepo.owner === owner &&
      hostedRepo.repo === repo,
  );

  const hasValidRoute = Boolean(
    providerId && owner && repo && Number.isFinite(parsedPullRequestNumber) && parsedPullRequestNumber > 0,
  );

  const { statuses, isLoading, isError } = useGetPullRequestBuildStatusesQuery(
    activeRepo && hasValidRoute && routeMatchesActiveRepo
      ? { repoPath: activeRepo, pullRequestNumber: parsedPullRequestNumber }
      : skipToken,
    {
      selectFromResult: ({ data, isLoading: loading, isError: errored }) => ({
        statuses: data ?? null,
        isLoading: loading,
        isError: errored,
      }),
      pollingInterval: 30_000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col">
          {isLoading && !statuses ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading checks…
            </div>
          ) : isError ? (
            <PreviewPlaceholder
              icon={ShieldCheck}
              title="Could not load checks"
              description="Bitbucket did not return build statuses for this pull request. Try refreshing."
            />
          ) : statuses && statuses.length > 0 ? (
            <section className="rounded-lg border bg-surface-0">
              <div className="border-border/70 flex items-center justify-between border-b px-4 py-3">
                <div className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
                  Build checks
                </div>
                <div className="text-muted-foreground text-xs">{statuses.length}</div>
              </div>
              <ul>
                {statuses.map((status) => (
                  <BuildStatusRow key={`${status.key}:${status.name}`} status={status} />
                ))}
              </ul>
            </section>
          ) : (
            <PreviewPlaceholder
              icon={ShieldCheck}
              title="No checks reported"
              description="No build statuses are attached to this pull request's latest commit."
            />
          )}
        </div>
      </div>
    </div>
  );
};
