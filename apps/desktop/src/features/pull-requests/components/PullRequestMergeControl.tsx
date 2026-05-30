import { GitMerge, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { useMergePullRequestMutation } from "@/features/hosted-repos/api";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
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
};

export function PullRequestMergeControl({
  repoPath,
  pullRequestNumber,
  detail,
  providerId,
}: PullRequestMergeControlProps) {
  const [strategy, setStrategy] = useState<PullRequestMergeStrategy>("merge_commit");
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [mergePullRequest, { isLoading }] = useMergePullRequestMutation();

  // Bitbucket Cloud is the only provider with a merge action in this build.
  if (providerId && providerId !== "bitbucket") {
    return null;
  }

  const isOpen = detail.state === "open";
  const mergeable =
    isOpen && !detail.isDraft && Boolean(repoPath) && Number.isFinite(pullRequestNumber);

  const disabledReason = !isOpen
    ? `This pull request is ${detail.state}.`
    : detail.isDraft
      ? "Draft pull requests cannot be merged."
      : null;

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
    <section className="rounded-lg border bg-surface-0 p-4">
      <div className="text-muted-foreground text-xs font-semibold tracking-[0.12em] uppercase">
        Merge
      </div>

      {disabledReason ? (
        <div className="text-muted-foreground mt-3 text-sm">{disabledReason}</div>
      ) : (
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
                <Button
                  size="sm"
                  disabled={isLoading || !mergeable}
                  onClick={() => void handleMerge()}
                >
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
      )}
    </section>
  );
}
