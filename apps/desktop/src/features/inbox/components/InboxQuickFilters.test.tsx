/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vite-plus/test";
import { InboxQuickFilters } from "./InboxQuickFilters";

describe("InboxQuickFilters", () => {
  it("renders search input with placeholder", () => {
    render(
      <InboxQuickFilters
        searchText=""
        onSearchChange={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("Filter PRs...");
    expect(input).toBeInTheDocument();
  });

  it("calls onSearchChange when text is typed", () => {
    const onSearchChange = vi.fn();
    render(
      <InboxQuickFilters
        searchText=""
        onSearchChange={onSearchChange}
        activeFilter="all"
        onFilterChange={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("Filter PRs...");
    fireEvent.change(input, { target: { value: "bug" } });
    expect(onSearchChange).toHaveBeenCalledWith("bug");
  });

  it("renders all 5 filter buttons", () => {
    render(
      <InboxQuickFilters
        searchText=""
        onSearchChange={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
      />,
    );

    const buttons = ["all", "open", "draft", "merged", "mine"].map((v) =>
      screen.getByTestId(`filter-button-${v}`),
    );
    expect(buttons).toHaveLength(5);
  });

  it("highlights the active filter button", () => {
    render(
      <InboxQuickFilters
        searchText=""
        onSearchChange={() => {}}
        activeFilter="draft"
        onFilterChange={() => {}}
      />,
    );

    const active = screen.getByTestId("filter-button-draft");
    expect(active).toHaveAttribute("data-variant", "secondary");
  });

  it("calls onFilterChange with correct value when button clicked", () => {
    const onFilterChange = vi.fn();
    render(
      <InboxQuickFilters
        searchText=""
        onSearchChange={() => {}}
        activeFilter="all"
        onFilterChange={onFilterChange}
      />,
    );

    const btn = screen.getByTestId("filter-button-open");
    fireEvent.click(btn);
    expect(onFilterChange).toHaveBeenCalledWith("open");
  });

  it("All is the default active filter when activeFilter='all'", () => {
    render(
      <InboxQuickFilters
        searchText=""
        onSearchChange={() => {}}
        activeFilter="all"
        onFilterChange={() => {}}
      />,
    );

    const allBtn = screen.getByTestId("filter-button-all");
    expect(allBtn).toHaveAttribute("data-variant", "secondary");
  });
});
