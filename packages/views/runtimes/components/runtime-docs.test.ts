// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  customRuntimeDocsHref,
  daemonRuntimesDocsHref,
} from "./runtime-docs";

describe("runtime docs links", () => {
  it.each([
    ["en", "https://agenthost.pro/docs/daemon-runtimes"],
    ["zh-Hans", "https://agenthost.pro/docs/zh/daemon-runtimes"],
    ["ja", "https://agenthost.pro/docs/ja/daemon-runtimes"],
    ["ko", "https://agenthost.pro/docs/ko/daemon-runtimes"],
    ["fr", "https://agenthost.pro/docs/fr/daemon-runtimes"],
  ])("localizes the daemon guide for %s", (language, expected) => {
    expect(daemonRuntimesDocsHref(language)).toBe(expected);
  });

  it("adds the localized custom runtime section", () => {
    expect(customRuntimeDocsHref("zh-Hans")).toBe(
      `https://agenthost.pro/docs/zh/daemon-runtimes#${encodeURIComponent("自定义运行时配置")}`,
    );
    expect(customRuntimeDocsHref("fr")).toBe(
      `https://agenthost.pro/docs/fr/daemon-runtimes#${encodeURIComponent("profils-de-runtime-personnalisés")}`,
    );
  });
});
