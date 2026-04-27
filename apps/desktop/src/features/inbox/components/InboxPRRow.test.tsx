/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vite-plus/test";
import { InboxPRRow } from "./InboxPRRow";
// @ts-expect-error -- oxlint typescript
import type { PullRequestSummary } from "@/platform/desktop";

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
    render(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(screen.getByText("#42 Fix auth bug")).toBeInTheDocument();
  });

  it("renders author name", () => {
    render(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(screen.getByText("jdoe")).toBeInTheDocument();
  });

  it("renders Open lozenge for open non-draft PR", () => {
    render(<InboxPRRow pr={{ ...BASE_PR, state: "open", isDraft: false }} onClick={() => {}} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders Draft lozenge for draft PR", () => {
    render(<InboxPRRow pr={{ ...BASE_PR, state: "open", isDraft: true }} onClick={() => {}} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders Merged lozenge for merged PR", () => {
    render(<InboxPRRow pr={{ ...BASE_PR, state: "merged", isDraft: false }} onClick={() => {}} />);
    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("renders Closed lozenge for closed PR", () => {
    render(<InboxPRRow pr={{ ...BASE_PR, state: "closed", isDraft: false }} onClick={() => {}} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders comment count", () => {
    render(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders successful build indicator", () => {
    const { container } = render(<InboxPRRow pr={BASE_PR} onClick={() => {}} />);
    expect(container.querySelector(".text-green-400")).toBeInTheDocument();
  });

  it("renders failed build indicator when any build failed", () => {
    const { container } = render(
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
    const { container } = render(
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
    const { container } = render(
      <InboxPRRow pr={{ ...BASE_PR, buildStatuses: [] }} onClick={() => {}} />,
    );
    expect(container.querySelector(".lucide-check-circle-2")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-x-circle")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-loader-2")).not.toBeInTheDocument();
  });

  it("calls onClick when row is clicked", () => {
    const onClick = vi.fn();
    render(<InboxPRRow pr={BASE_PR} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(BASE_PR);
  });
});
