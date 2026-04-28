import { GitCommitHorizontal } from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { Input } from "@/components/ui/input";
import { useGetGitSnapshotQuery } from "@/features/source-control/api";
import { commitAction, setCommitMessageValue } from "@/features/source-control/actions";
import {
  selectActiveRepo,
  selectCommitMessage,
  selectRunningAction,
} from "@/features/source-control/sourceControlSlice";

export function CommitBox() {
  const dispatch = useAppDispatch();
  const activeRepo = useAppSelector(selectActiveRepo);
  const runningAction = useAppSelector(selectRunningAction);
  const commitMessage = useAppSelector(selectCommitMessage);
  const { data: snapshotData } = useGetGitSnapshotQuery(activeRepo, {
    skip: !activeRepo,
  });
  const snapshot = activeRepo ? snapshotData : undefined;
  const stagedCount = snapshot?.staged?.length ?? 0;
  const canCommit = !!commitMessage.trim() && stagedCount > 0 && !runningAction;

  return (
    <div className="border-border border-b px-2 py-4">
      <Input
        value={commitMessage}
        onChange={(e) => dispatch(setCommitMessageValue(e.target.value))}
        placeholder="Message (Cmd+Enter to commit)"
        className="border-input bg-input h-7 text-xs"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            // oxlint-disable-next-line typescript-eslint(no-meaningless-void-operator)
            void dispatch(commitAction());
          }
        }}
      />
      <button
        type="button"
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 mt-1.5 flex w-full items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          // oxlint-disable-next-line typescript-eslint(no-meaningless-void-operator)
          void dispatch(commitAction());
        }}
        disabled={!canCommit}
      >
        <GitCommitHorizontal className="h-3.5 w-3.5" />
        {runningAction === "commit" ? "Committing..." : "Commit"}
      </button>
    </div>
  );
}
