import { RefreshCw } from "lucide-react";

export const SECTION_LABELS: Record<string, string> = {
  NEEDS_REVIEW: "Needs your review",
  WAITING_FOR_REVIEW: "Waiting for review",
  RETURNED_TO_YOU: "Returned to you",
  APPROVED: "Approved",
  DRAFTS: "Drafts",
  MERGING_AND_MERGED: "Merging / recently merged",
};

type InboxSectionSidebarProps = {
  sections: { key: string; count: number }[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export function InboxSectionSidebar({
  sections,
  activeSection,
  onSectionChange,
  onRefresh,
  isRefreshing,
}: InboxSectionSidebarProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-3 pb-3">
        <h3 className="text-sm font-semibold">Sections</h3>
        <button
          type="button"
          aria-label="Refresh inbox"
          title="Refresh"
          onClick={onRefresh}
          className="border-input bg-background inline-flex h-7 w-7 items-center justify-center rounded-md border"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <nav aria-label="Inbox sections">
        <ul className="flex w-full flex-col gap-1 px-2">
          {sections.map((s) => {
            const label = SECTION_LABELS[s.key] ?? s.key;
            const isActive = s.key === activeSection;

            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onSectionChange(s.key)}
                  className={`w-full flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-surface-2 focus:outline-none ${
                    isActive ? "bg-accent text-accent-foreground" : "text-foreground"
                  }`}
                >
                  <span className="min-w-0 truncate text-left">{label}</span>
                  <span className="ml-2 inline-flex items-center rounded-full bg-transparent px-2 py-0.5 text-muted-foreground text-xs">
                    {s.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default InboxSectionSidebar;
