import { describe, it, expectTypeOf } from "vitest";
import type { PullRequestSummary, BuildStatus } from "./contracts";

describe("contracts types", () => {
  it("BuildStatus has required shape", () => {
    expectTypeOf<BuildStatus>().toMatchTypeOf<{
      state: "successful" | "failed" | "inprogress" | "stopped";
      name: string;
      url: string;
      key: string;
    }>();
  });

  it("PullRequestSummary has commentCount field", () => {
    expectTypeOf<PullRequestSummary>().toHaveProperty("commentCount");
  });

  it("PullRequestSummary has buildStatuses field", () => {
    expectTypeOf<PullRequestSummary>().toHaveProperty("buildStatuses");
  });
});
