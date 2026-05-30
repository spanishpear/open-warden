/// <reference types="@testing-library/jest-dom" />
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { describe, it, expect, vi } from "vite-plus/test";
import { InboxPRRow } from "./InboxPRRow";
import { inboxReducer, setInboxSelectedPRId } from "../inboxSlice";
// @ts-expect-error -- oxlint typescript
import type { PullRequestSummary } from "@/platform/desktop";

function renderRow(ui: ReactElement, selectedPRId: string | null = null) {
  const store = configureStore({ reducer: { inbox: inboxReducer } });
  if (selectedPRId) {
    store.dispatch(setInboxSelectedPRId(selectedPRId));
  }
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}

const BASE_PR: PullRequestSummary = {
  id: "1",
  providerId: "bitbucket",
  number: 42,
  title: "Fix auth bug",
  state: "open",
  isDraft: false,
  authorLogin: "jdoe",
  authorDisplayName: "Jane Doe",
  url: "https://bitbucket.org/...",
  baseRef: "main",
  headRef: "fix/auth",
  headOwner: "myorg",
  headRepo: "myrepo",
  updatedAt: new Date().toISOString(),
  commentCount: 5,
  buildStatuses: [{ state: "successful", name: "CI", url: "", key: "ci" }],
};

describe("InboxPRRow", () => {
  it("renders PR title", () => {
    renderRow(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(screen.getByText("#42 Fix auth bug")).toBeInTheDocument();
  });

  it("renders author name", () => {
    renderRow(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(screen.getByText("jdoe")).toBeInTheDocument();
  });

  it("renders Open lozenge for open non-draft PR", () => {
    renderRow(<InboxPRRow pr={{ ...BASE_PR, state: "open", isDraft: false }} onClick={() => {}} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders Draft lozenge for draft PR", () => {
    renderRow(<InboxPRRow pr={{ ...BASE_PR, state: "open", isDraft: true }} onClick={() => {}} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders Merged lozenge for merged PR", () => {
    renderRow(
      <InboxPRRow pr={{ ...BASE_PR, state: "merged", isDraft: false }} onClick={() => {}} />,
    );
    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("renders Closed lozenge for closed PR", () => {
    renderRow(
      <InboxPRRow pr={{ ...BASE_PR, state: "closed", isDraft: false }} onClick={() => {}} />,
    );
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders comment count", () => {
    renderRow(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders successful build indicator", () => {
    const { container } = renderRow(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(container.querySelector(".text-green-400")).toBeInTheDocument();
  });

  it("renders failed build indicator when any build failed", () => {
    const { container } = renderRow(
      <InboxPRRow
        pr={{
          ...BASE_PR,
          buildStatuses: [
            { state: "successful", name: "CI", url: "", key: "ci" },
            { state: "failed", name: "Lint", url: "", key: "lint" },
          ],
        }}
        onClick={() => {}}
      />,
    );
    expect(container.querySelector(".text-red-400")).toBeInTheDocument();
  });

  it("renders in-progress build indicator when any build is in progress and none failed", () => {
    const { container } = renderRow(
      <InboxPRRow
        pr={{
          ...BASE_PR,
          buildStatuses: [
            { state: "successful", name: "CI", url: "", key: "ci" },
            { state: "inprogress", name: "Lint", url: "", key: "lint" },
          ],
        }}
        onClick={() => {}}
      />,
    );
    expect(container.querySelector(".text-yellow-400")).toBeInTheDocument();
  });

  it("renders no build indicator when buildStatuses is empty", () => {
    const { container } = renderRow(
      <InboxPRRow pr={{ ...BASE_PR, buildStatuses: [] }} onClick={() => {}} />,
    );
    expect(container.querySelector(".lucide-check-circle-2")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-x-circle")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-loader-2")).not.toBeInTheDocument();
  });

  it("calls onClick and selects the row when clicked", () => {
    const onClick = vi.fn();
    const { store } = renderRow(<InboxPRRow pr={BASE_PR} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(BASE_PR);
    expect(store.getState().inbox.selectedPRId).toBe(BASE_PR.id);
  });

  it("marks the row as selected when it is the selected PR", () => {
    renderRow(<InboxPRRow pr={BASE_PR} onClick={() => {}} />, BASE_PR.id);
    expect(screen.getByRole("button")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button")).toHaveAttribute("data-selected", "true");
  });

  it("is not selected when a different PR is selected", () => {
    renderRow(<InboxPRRow pr={BASE_PR} onClick={() => {}} />, "other-id");
    expect(screen.getByRole("button")).toHaveAttribute("aria-selected", "false");
  });
});
