import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithI18n } from "../../test/i18n";
import { StepWelcome } from "./step-welcome";

// The welcome illustration's mock cards carry issue statuses, and the status
// label used to come from `STATUS_CONFIG.label` — the server's English seed —
// while every other string on the screen went through `useT` (MUL-6850). A
// non-English member met the product on a line that read half in each
// language. These assert against the REAL locale bundles, so a regression that
// re-introduces the English seed fails here rather than in a screenshot.
describe("StepWelcome status labels", () => {
  it("renders the built-in status labels in English", () => {
    renderWithI18n(<StepWelcome onNext={vi.fn()} />);

    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.getAllByText("Done")).toHaveLength(2);
  });

  it("localizes them rather than rendering the English seed", () => {
    renderWithI18n(<StepWelcome onNext={vi.fn()} />, { locale: "zh-Hans" });

    expect(screen.getByText("进行中")).toBeInTheDocument();
    expect(screen.getByText("审核中")).toBeInTheDocument();
    expect(screen.getAllByText("已完成")).toHaveLength(2);
    expect(screen.queryByText("In Progress")).not.toBeInTheDocument();
  });
});

// Kensink: the fork's welcome copy (roadmap, tagline, CTAs) goes through the
// locale bundles too, not just the status labels.
describe("StepWelcome copy", () => {
  it("renders the roadmap and CTA from the active locale", () => {
    renderWithI18n(<StepWelcome onNext={vi.fn()} onSkip={vi.fn()} />, { locale: "zh-Hans" });

    expect(screen.getByText("连接运行时")).toBeInTheDocument();
    expect(screen.getByText("开始探索")).toBeInTheDocument();
    expect(screen.queryByText("Connect a runtime")).not.toBeInTheDocument();
  });
});
