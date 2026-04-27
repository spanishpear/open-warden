/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vite-plus/test";
import { MemoryRouter } from "react-router";
import { InboxScreen } from "./InboxScreen";

// Mock ResizableSidebarLayout — it's a presentational wrapper, not what we're testing
vi.mock("@/components/layout/ResizableSidebarLayout", () => ({
  ResizableSidebarLayout: ({
    sidebar,
    content,
  }: {
    sidebar: React.ReactNode;
    content: React.ReactNode;
  }) => (
    <div data-testid="resizable-sidebar-layout">
      <div data-testid="sidebar">{sidebar}</div>
      <div data-testid="content">{content}</div>
    </div>
  ),
}));

describe("InboxScreen", () => {
  it("renders within a ResizableSidebarLayout", () => {
    render(
      <MemoryRouter>
        <InboxScreen />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("resizable-sidebar-layout")).toBeInTheDocument();
  });

  it("renders sidebar and content areas", () => {
    render(
      <MemoryRouter>
        <InboxScreen />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
