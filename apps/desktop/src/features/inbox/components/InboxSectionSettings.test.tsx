/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vite-plus/test";
import { InboxSectionSidebar, SECTION_LABELS } from "./InboxSectionSidebar";

const ALL_SECTIONS = [
  { key: "NEEDS_REVIEW", count: 3 },
  { key: "WAITING_FOR_REVIEW", count: 2 },
  { key: "RETURNED_TO_YOU", count: 1 },
  { key: "APPROVED", count: 0 },
  { key: "DRAFTS", count: 1 },
  { key: "MERGING_AND_MERGED", count: 4 },
];

function renderSidebar(overrides: Partial<Parameters<typeof InboxSectionSidebar>[0]> = {}) {
  const defaults = {
    sections: ALL_SECTIONS,
    activeSection: "NEEDS_REVIEW",
    onSectionChange: vi.fn(),
    onRefresh: vi.fn(),
    isRefreshing: false,
    ...overrides,
  };
  return { ...render(<InboxSectionSidebar {...defaults} />), props: defaults };
}

describe("InboxSectionSidebar visibility", () => {
  it("shows all sections when sectionVisibility is undefined", () => {
    renderSidebar();

    for (const s of ALL_SECTIONS) {
      const label = SECTION_LABELS[s.key] ?? s.key;
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("hides sections marked as not visible", () => {
    renderSidebar({
      sectionVisibility: {
        NEEDS_REVIEW: true,
        WAITING_FOR_REVIEW: true,
        RETURNED_TO_YOU: true,
        APPROVED: false,
        DRAFTS: false,
        MERGING_AND_MERGED: true,
      },
    });

    expect(screen.getByText(SECTION_LABELS["NEEDS_REVIEW"])).toBeInTheDocument();
    expect(screen.getByText(SECTION_LABELS["WAITING_FOR_REVIEW"])).toBeInTheDocument();
    expect(screen.queryByText(SECTION_LABELS["APPROVED"])).not.toBeInTheDocument();
    expect(screen.queryByText(SECTION_LABELS["DRAFTS"])).not.toBeInTheDocument();
  });

  it("renders the gear icon button for section settings", () => {
    renderSidebar();

    const gearButton = screen.getByRole("button", { name: /section visibility settings/i });
    expect(gearButton).toBeInTheDocument();
  });

  it("opens popover with checkboxes when gear icon is clicked", () => {
    renderSidebar();

    const gearButton = screen.getByRole("button", { name: /section visibility settings/i });
    fireEvent.click(gearButton);

    expect(screen.getByText("Show sections")).toBeInTheDocument();
    // Every section should have a checkbox in the popover
    for (const key of Object.keys(SECTION_LABELS)) {
      const label = SECTION_LABELS[key];
      expect(screen.getByLabelText(`Show ${label}`)).toBeInTheDocument();
    }
  });

  it("calls onToggleVisibility when a checkbox is toggled", () => {
    const onToggleVisibility = vi.fn();
    renderSidebar({
      sectionVisibility: {
        NEEDS_REVIEW: true,
        WAITING_FOR_REVIEW: true,
        RETURNED_TO_YOU: true,
        APPROVED: true,
        DRAFTS: true,
        MERGING_AND_MERGED: true,
      },
      onToggleVisibility,
    });

    // Open popover
    const gearButton = screen.getByRole("button", { name: /section visibility settings/i });
    fireEvent.click(gearButton);

    // Click the Approved checkbox to hide it
    const approvedCheckbox = screen.getByLabelText(`Show ${SECTION_LABELS["APPROVED"]}`);
    fireEvent.click(approvedCheckbox);

    expect(onToggleVisibility).toHaveBeenCalledWith("APPROVED", false);
  });

  it("shows all sections when sectionVisibility has all true", () => {
    renderSidebar({
      sectionVisibility: {
        NEEDS_REVIEW: true,
        WAITING_FOR_REVIEW: true,
        RETURNED_TO_YOU: true,
        APPROVED: true,
        DRAFTS: true,
        MERGING_AND_MERGED: true,
      },
    });

    for (const s of ALL_SECTIONS) {
      const label = SECTION_LABELS[s.key] ?? s.key;
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
