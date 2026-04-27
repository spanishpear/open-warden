/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vite-plus/test";
import { InboxSectionSidebar, SECTION_LABELS } from "./InboxSectionSidebar";

const MOCK_SECTIONS = [
  { key: "NEEDS_REVIEW", count: 3 },
  { key: "DRAFTS", count: 1 },
  { key: "APPROVED", count: 0 },
];

describe("InboxSectionSidebar", () => {
  it("renders all section labels", () => {
    render(
      <InboxSectionSidebar
        sections={MOCK_SECTIONS}
        activeSection={"DRAFTS"}
        onSectionChange={() => {}}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    );

    for (const s of MOCK_SECTIONS) {
      const label = SECTION_LABELS[s.key] ?? s.key;
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders PR count next to each section", () => {
    render(
      <InboxSectionSidebar
        sections={MOCK_SECTIONS}
        activeSection={"DRAFTS"}
        onSectionChange={() => {}}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    );

    for (const s of MOCK_SECTIONS) {
      expect(screen.getByText(String(s.count))).toBeInTheDocument();
    }
  });

  it("highlights the active section", () => {
    render(
      <InboxSectionSidebar
        sections={MOCK_SECTIONS}
        activeSection={"DRAFTS"}
        onSectionChange={() => {}}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    );

    const activeLabel = SECTION_LABELS["DRAFTS"];
    const activeButton = screen.getByText(activeLabel).closest("button");
    expect(activeButton).toHaveClass("bg-accent");
  });

  it("calls onSectionChange with correct key when section clicked", async () => {
    const onSectionChange = vi.fn();
    render(
      <InboxSectionSidebar
        sections={MOCK_SECTIONS}
        activeSection={"DRAFTS"}
        onSectionChange={onSectionChange}
        onRefresh={() => {}}
        isRefreshing={false}
      />,
    );

    const needsReviewButton = screen.getByText(SECTION_LABELS["NEEDS_REVIEW"]).closest("button");
    expect(needsReviewButton).not.toBeNull();
    fireEvent.click(needsReviewButton!);
    expect(onSectionChange).toHaveBeenCalledWith("NEEDS_REVIEW");
  });

  it("renders refresh button and calls onRefresh when clicked", () => {
    const onRefresh = vi.fn();
    render(
      <InboxSectionSidebar
        sections={MOCK_SECTIONS}
        activeSection={"DRAFTS"}
        onSectionChange={() => {}}
        onRefresh={onRefresh}
        isRefreshing={false}
      />,
    );

    const refreshButton = screen.getByRole("button", { name: /refresh inbox/i });
    fireEvent.click(refreshButton);
    expect(onRefresh).toHaveBeenCalled();
  });

  it("shows loading state on refresh button when isRefreshing=true", () => {
    const onRefresh = vi.fn();
    render(
      <InboxSectionSidebar
        sections={MOCK_SECTIONS}
        activeSection={"DRAFTS"}
        onSectionChange={() => {}}
        onRefresh={onRefresh}
        isRefreshing={true}
      />,
    );

    const refreshIcon = screen.getByRole("button", { name: /refresh inbox/i }).querySelector("svg");
    expect(refreshIcon).toBeInTheDocument();
    // class applied to icon when spinning
    expect(refreshIcon).toHaveClass("animate-spin");
  });
});
