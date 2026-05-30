import { GitMerge, Loader2, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAppSelector } from "@/app/hooks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useMergePullRequestMutation,
  useRunLandCommandMutation,
} from "@/features/hosted-repos/api";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import { landCommandRepoKey, resolveLandCommandTemplate } from "@/platform/desktop/landCommand";
import type {
  GitProviderId,
  PullRequestDetail,
  PullRequestMergeStrategy,
} from "@/platform/desktop";

const STRATEGY_OPTIONS: { value: PullRequestMergeStrategy; label: string }[] = [
  { value: "merge_commit", label: "Merge commit" },
  { value: "squash", label: "Squash" },
  { value: "fast_forward", label: "Fast forward" },
];

type PullRequestMergeControlProps = {
  repoPath: string;
  pullRequestNumber: number;
  detail: PullRequestDetail;
  providerId?: GitProviderId;
  owner?: string;
  repo?: string;
};

export function PullRequestMergeControl({
  repoPath,
  pullRequestNumber,
  detail,
  providerId,
  owner,
  repo,
}: PullRequestMergeControlProps) {
  const appSettings = useAppSelector((state) => state.settings.appSettings);
  const landCommand =
    owner && repo ? resolveLandCommandTemplate(appSettings, landCommandRepoKey(owner, repo)) : null;

  // Bitbucket Cloud is the only provider with a merge action in this build. A
  // configured land command works regardless of provider (it runs locally).
  if (providerId && providerId !== "bitbucket" && !landCommand) {
    return null;
  }

  const isOpen = detail.state === "open";
  const actionable =
    isOpen && !detail.isDraft && Boolean(repoPath) && Number.isFinite(pullRequestNumber);
  const disabledReason = !isOpen
    ? `This pull request is ${detail.state}.`
    : detail.isDraft
      ? "Draft pull requests cannot be merged."
      : null;

  return (
    <section className="rounded-lg border bg-surface-0 p-4">
      <div className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
        {landCommand ? "Land" : "Merge"}
      </div>

      {disabledReason ? (
        <div className="text-muted-foreground mt-3 text-sm">{disabledReason}</div>
      ) : landCommand ? (
        <LandPanel
          command={landCommand}
          repoPath={repoPath}
          actionable={actionable}
          context={{
            number: pullRequestNumber,
            workspace: owner ?? "",
            repo: repo ?? "",
            sourceBranch: detail.headRef,
            targetBranch: detail.baseRef,
            url: detail.url,
          }}
        />
      ) : (
        <MergePanel
          repoPath={repoPath}
          pullRequestNumber={pullRequestNumber}
          mergeable={actionable}
        />
      )}
    </section>
  );
}

function LandPanel({
  command,
  repoPath,
  actionable,
  context,
}: {
  command: string;
  repoPath: string;
  actionable: boolean;
  context: {
    number: number;
    workspace: string;
    repo: string;
    sourceBranch: string;
    targetBranch: string;
    url: string;
  };
}) {
  const [confirming, setConfirming] = useState(false);
  const [runLandCommand, { isLoading }] = useRunLandCommandMutation();

  async function handleLand() {
    try {
      const result = await runLandCommand({
        command,
        cwd: repoPath || null,
        context,
      }).unwrap();
      setConfirming(false);
      if (result.ok) {
        toast.success(result.stdout.trim().split("\n").at(-1) || "Land command finished");
      } else {
        toast.error(
          result.stderr.trim() ||
            result.stdout.trim() ||
            `Land command exited with code ${String(result.exitCode)}`,
        );
      }
    } catch (error) {
      toast.error(errorMessageFrom(error, "Failed to run land command"));
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        This repo lands via a configured command instead of the merge API.
      </p>
      <code className="bg-surface-1 text-foreground/80 rounded px-2 py-1.5 font-mono text-xs break-all">
        {command}
      </code>
      {confirming ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={isLoading}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={isLoading || !actionable} onClick={() => void handleLand()}>
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <TerminalSquare className="h-3.5 w-3.5" />
            )}
            Run land
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          disabled={!actionable}
          onClick={() => setConfirming(true)}
          className="w-full"
        >
          <TerminalSquare className="h-3.5 w-3.5" />
          Land pull request
        </Button>
      )}
    </div>
  );
}

function MergePanel({
  repoPath,
  pullRequestNumber,
  mergeable,
}: {
  repoPath: string;
  pullRequestNumber: number;
  mergeable: boolean;
}) {
  const [strategy, setStrategy] = useState<PullRequestMergeStrategy>("merge_commit");
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [mergePullRequest, { isLoading }] = useMergePullRequestMutation();

  async function handleMerge() {
    try {
      const result = await mergePullRequest({
        repoPath,
        pullRequestNumber,
        mergeStrategy: strategy,
        closeSourceBranch,
        message: message.trim() ? message.trim() : undefined,
      }).unwrap();
      setConfirming(false);
      setMessage("");
      toast.success(result.state === "merged" ? "Pull request merged" : "Merge requested");
    } catch (error) {
      toast.error(errorMessageFrom(error, "Failed to merge pull request"));
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs">Strategy</span>
        <Select
          value={strategy}
          onValueChange={(value) => {
            // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
            setStrategy(value as PullRequestMergeStrategy);
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={closeSourceBranch}
          onCheckedChange={(checked) => setCloseSourceBranch(checked === true)}
        />
        <span>Close source branch</span>
      </label>

      {confirming ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Commit message (optional)</span>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Merge commit message…"
              rows={3}
              className="text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={isLoading || !mergeable} onClick={() => void handleMerge()}>
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitMerge className="h-3.5 w-3.5" />
              )}
              Confirm merge
            </Button>
          </div>
        </>
      ) : (
        <Button
          size="sm"
          disabled={!mergeable}
          onClick={() => setConfirming(true)}
          className="w-full"
        >
          <GitMerge className="h-3.5 w-3.5" />
          Merge pull request
        </Button>
      )}
    </div>
  );
}
