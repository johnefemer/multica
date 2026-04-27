import { describe, it, expect } from "vitest";
import { workspaceRepoDedupeKey } from "./repositories-tab";

describe("workspaceRepoDedupeKey", () => {
  it("treats https github URLs with or without .git as the same", () => {
    const a = workspaceRepoDedupeKey("https://github.com/Org/Repo.git");
    const b = workspaceRepoDedupeKey("https://github.com/org/repo");
    expect(a).toBe(b);
    expect(a).toBe("github.com/org/repo");
  });

  it("handles invalid URLs as opaque lowercased strings", () => {
    expect(workspaceRepoDedupeKey("  LocalPath/Only  ")).toBe("localpath/only");
  });
});
