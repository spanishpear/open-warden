import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type InboxFilter = "all" | "open" | "draft" | "merged" | "mine";

type InboxQuickFiltersProps = {
  searchText: string;
  onSearchChange: (text: string) => void;
  activeFilter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
};

const FILTER_BUTTONS: { label: string; value: InboxFilter }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Draft", value: "draft" },
  { label: "Merged", value: "merged" },
  { label: "My PRs", value: "mine" },
];

export function InboxQuickFilters({
  searchText,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: InboxQuickFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center" style={{ minWidth: 200 }}>
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search className="size-4" />
        </div>
        <Input
          value={searchText}
          onChange={(e) => onSearchChange((e.target as HTMLInputElement).value)}
          placeholder="Filter PRs…"
          className="pl-8 h-8 text-sm"
          data-testid="inbox-search-input"
        />
      </div>

      <div className="flex items-center gap-1">
        {FILTER_BUTTONS.map((btn) => {
          const isActive = activeFilter === btn.value;
          return (
            <Button
              key={btn.value}
              size="sm"
              variant={isActive ? "secondary" : "ghost"}
              onClick={() => onFilterChange(btn.value)}
              data-testid={`filter-button-${btn.value}`}
            >
              {btn.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export default InboxQuickFilters;
