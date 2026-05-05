import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuestionnaireAnswers } from "@multica/core/onboarding";
import { StepQuestionnaire } from "./step-questionnaire";

const EMPTY_ANSWERS: QuestionnaireAnswers = {
  team_size: null,
  team_size_other: null,
  role: null,
  role_other: null,
  use_case: null,
  use_case_other: null,
};

function renderStep(initial: Partial<QuestionnaireAnswers> = {}) {
  const onSubmit = vi.fn();
  const onBack = vi.fn();
  render(
    <StepQuestionnaire
      initial={{ ...EMPTY_ANSWERS, ...initial }}
      onSubmit={onSubmit}
      onBack={onBack}
    />,
  );
  return { onSubmit, onBack };
}

const Q1_HEADING = /who will use this workspace/i;
const Q2_HEADING = /what best describes you/i;
const Q3_HEADING = /what do you want to do with agenthost/i;

/**
 * Wizard-style questionnaire: one question per screen, concrete picks
 * auto-advance after a short delay, "Other" reveals a manual Continue,
 * and Q3's concrete pick (or Other-then-Finish) submits.
 *
 * These tests lock down the navigation and submission semantics so a
 * future refactor can't silently regress to the old single-page model.
 */
describe("StepQuestionnaire (wizard)", () => {
  it("renders only Q1 on mount", () => {
    renderStep();
    expect(
      screen.getByRole("heading", { name: Q1_HEADING }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: Q2_HEADING })).toBeNull();
    expect(screen.queryByRole("heading", { name: Q3_HEADING })).toBeNull();
  });

  it("auto-advances Q1 → Q2 after a concrete pick", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("radio", { name: /just me/i }));
    expect(
      await screen.findByRole("heading", { name: Q2_HEADING }),
    ).toBeInTheDocument();
  });

  it("auto-advances Q2 → Q3 after a concrete pick", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("radio", { name: /just me/i }));
    await screen.findByRole("heading", { name: Q2_HEADING });
    await user.click(screen.getByRole("radio", { name: /software developer/i }));
    expect(
      await screen.findByRole("heading", { name: Q3_HEADING }),
    ).toBeInTheDocument();
  });

  it("Q3 concrete pick auto-submits the full payload", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderStep();

    await user.click(screen.getByRole("radio", { name: /just me/i }));
    await screen.findByRole("heading", { name: Q2_HEADING });
    await user.click(screen.getByRole("radio", { name: /software developer/i }));
    await screen.findByRole("heading", { name: Q3_HEADING });
    await user.click(screen.getByRole("radio", { name: /write and ship code/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      team_size: "solo",
      team_size_other: null,
      role: "developer",
      role_other: null,
      use_case: "coding",
      use_case_other: null,
    });
  });

  it("Q1 Other shows Continue, disabled until text is typed", async () => {
    const user = userEvent.setup();
    renderStep();
    await user.click(screen.getByRole("radio", { name: /^other$/i }));
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(/small community i help run/i),
      "a community",
    );
    expect(continueBtn).toBeEnabled();

    await user.click(continueBtn);
    expect(
      await screen.findByRole("heading", { name: Q2_HEADING }),
    ).toBeInTheDocument();
  });

  it("Q3 Other submits via Finish button with the typed text", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderStep({ team_size: "solo", role: "developer" });

    // initial pre-fills earlier answers; navigate to Q3.
    await user.click(screen.getByRole("radio", { name: /just me/i }));
    await screen.findByRole("heading", { name: Q2_HEADING });
    await user.click(screen.getByRole("radio", { name: /software developer/i }));
    await screen.findByRole("heading", { name: Q3_HEADING });

    await user.click(screen.getByRole("radio", { name: /^other$/i }));
    const finishBtn = screen.getByRole("button", { name: /finish/i });
    expect(finishBtn).toBeDisabled();

    await user.type(
      screen.getByPlaceholderText(/automate my weekly reports/i),
      "Teach me the system",
    );
    expect(finishBtn).toBeEnabled();
    await user.click(finishBtn);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        use_case: "other",
        use_case_other: "Teach me the system",
      }),
    );
  });

  it("Back from Q2 returns to Q1 and preserves the prior selection", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole("radio", { name: /just me/i }));
    await screen.findByRole("heading", { name: Q2_HEADING });

    await user.click(screen.getByRole("button", { name: /back/i }));
    await screen.findByRole("heading", { name: Q1_HEADING });

    // Selection persists across back navigation.
    expect(screen.getByRole("radio", { name: /just me/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("Back from Q1 calls the parent onBack", async () => {
    const user = userEvent.setup();
    const { onBack } = renderStep();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("clears Other text when the user switches to a concrete option", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderStep();

    // Q1 → Other → type → switch to Just me; auto-advance to Q2/Q3 → submit.
    await user.click(screen.getByRole("radio", { name: /^other$/i }));
    await user.type(
      screen.getByPlaceholderText(/small community i help run/i),
      "large enterprise",
    );
    await user.click(screen.getByRole("radio", { name: /just me/i }));

    await screen.findByRole("heading", { name: Q2_HEADING });
    await user.click(screen.getByRole("radio", { name: /software developer/i }));
    await screen.findByRole("heading", { name: Q3_HEADING });
    await user.click(screen.getByRole("radio", { name: /write and ship code/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        team_size: "solo",
        team_size_other: null,
      }),
    );
  });

  it("respects the initial prop when revisiting via Back", async () => {
    // Resume scenario: user already answered Q1 + Q2 in a prior session.
    // The wizard always starts at Q1, but Back navigation shows the
    // previously-stored answer pre-selected.
    const user = userEvent.setup();
    renderStep({ team_size: "team", role: "developer" });

    expect(screen.getByRole("radio", { name: /my team/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(screen.getByRole("radio", { name: /my team/i }));
    expect(
      await screen.findByRole("heading", { name: Q2_HEADING }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("radio", { name: /software developer/i }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
