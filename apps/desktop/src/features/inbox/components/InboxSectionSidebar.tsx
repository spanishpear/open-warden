import { useState } from "react";
import { RefreshCw, Settings } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const SECTION_LABELS: Record<string, string> = {
  NEEDS_REVIEW: "Needs your review",
  WAITING_FOR_REVIEW: "Waiting for review",
  RETURNED_TO_YOU: "Returned to you",
  APPROVED: "Approved",
  DRAFTS: "Drafts",
  MERGING_AND_MERGED: "Merging / recently merged",
};

const ALL_SECTION_KEYS = Object.keys(SECTION_LABELS);

type InboxSectionSidebarProps = {
  sections: { key: string; count: number }[];
  activeSection: string;
  onSectionChange: (key: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  sectionVisibility?: Record<string, boolean>;
  onToggleVisibility?: (key: string, visible: boolean) => void;
};

export function InboxSectionSidebar({
  sections,
  activeSection,
  onSectionChange,
  onRefresh,
  isRefreshing,
  sectionVisibility,
  onToggleVisibility,
}: InboxSectionSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleSections = sections.filter((s) => sectionVisibility?.[s.key] !== false);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-3 pb-3">
        <h3 className="text-sm font-semibold">Sections</h3>
        <div className="flex items-center gap-1">
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Section visibility settings"
                title="Section visibility"
                className="border-input bg-background inline-flex h-7 w-7 items-center justify-center rounded-md border"
              >
                <Settings className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Show sections</h4>
              <ul className="flex flex-col gap-2">
                {ALL_SECTION_KEYS.map((key) => {
                  const label = SECTION_LABELS[key] ?? key;
                  const visible = sectionVisibility?.[key] !== false;

                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={visible}
                          onCheckedChange={(checked) => {
                            onToggleVisibility?.(key, checked === true);
                          }}
                          aria-label={`Show ${label}`}
                        />
                        <span>{label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>

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
      </div>

      <nav aria-label="Inbox sections">
        <ul className="flex w-full flex-col gap-1 px-2">
          {visibleSections.map((s) => {
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
