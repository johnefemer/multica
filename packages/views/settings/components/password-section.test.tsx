import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSetPassword = vi.hoisted(() => vi.fn());
const mockSetUser = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockUser = vi.hoisted(() => ({
  current: { id: "u1", name: "Alice", has_password: false } as {
    id: string;
    name: string;
    has_password: boolean;
  },
}));

vi.mock("@multica/core/auth", () => ({
  useAuthStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { user: mockUser.current, setUser: mockSetUser };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ user: mockUser.current, setUser: mockSetUser }) },
  ),
  PASSWORD_MIN_LENGTH: 10,
}));

vi.mock("@multica/core/api", () => ({
  api: { setPassword: mockSetPassword },
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { PasswordSection } from "./password-section";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { id: "u1", name: "Alice", has_password: false };
  });

  it("offers to set a first password without asking for a current one", () => {
    render(<PasswordSection />);

    expect(
      screen.getByRole("button", { name: /set password/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
  });

  it("asks for the current password once the account has one", () => {
    mockUser.current = { id: "u1", name: "Alice", has_password: true };
    render(<PasswordSection />);

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /change password/i }),
    ).toBeInTheDocument();
  });

  it("sets a first password and publishes the refreshed user", async () => {
    const updated = { id: "u1", name: "Alice", has_password: true };
    mockSetPassword.mockResolvedValueOnce(updated);
    render(<PasswordSection />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), "a good password");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "a good password",
    );
    await user.click(screen.getByRole("button", { name: /set password/i }));

    await waitFor(() => {
      expect(mockSetPassword).toHaveBeenCalledWith({
        current_password: undefined,
        new_password: "a good password",
      });
      expect(mockSetUser).toHaveBeenCalledWith(updated);
      expect(mockToastSuccess).toHaveBeenCalledWith("Password set");
    });
  });

  it("sends the current password when changing an existing one", async () => {
    mockUser.current = { id: "u1", name: "Alice", has_password: true };
    mockSetPassword.mockResolvedValueOnce(mockUser.current);
    render(<PasswordSection />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "old password!");
    await user.type(screen.getByLabelText(/^new password$/i), "new password!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "new password!",
    );
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockSetPassword).toHaveBeenCalledWith({
        current_password: "old password!",
        new_password: "new password!",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Password changed");
    });
  });

  it("refuses a mismatched confirmation without calling the API", async () => {
    render(<PasswordSection />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), "a good password");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "a different one",
    );
    await user.click(screen.getByRole("button", { name: /set password/i }));

    expect(mockToastError).toHaveBeenCalledWith("Passwords do not match");
    expect(mockSetPassword).not.toHaveBeenCalled();
  });

  it("refuses a too-short password without calling the API", async () => {
    render(<PasswordSection />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), "short");
    await user.type(screen.getByLabelText(/confirm new password/i), "short");
    await user.click(screen.getByRole("button", { name: /set password/i }));

    expect(mockToastError).toHaveBeenCalledWith(
      "Password must be at least 10 characters",
    );
    expect(mockSetPassword).not.toHaveBeenCalled();
  });

  it("surfaces the server error and keeps the entered values", async () => {
    mockUser.current = { id: "u1", name: "Alice", has_password: true };
    mockSetPassword.mockRejectedValueOnce(
      new Error("current password is incorrect"),
    );
    render(<PasswordSection />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/current password/i), "wrong guess!");
    await user.type(screen.getByLabelText(/^new password$/i), "new password!");
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "new password!",
    );
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "current password is incorrect",
      );
    });
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText(/^new password$/i) as HTMLInputElement).value,
    ).toBe("new password!");
  });

  it("masks each field until its reveal toggle is used", async () => {
    render(<PasswordSection />);

    const field = screen.getByLabelText(/^new password$/i) as HTMLInputElement;
    expect(field.type).toBe("password");

    const user = userEvent.setup();
    // Two fields render when no password is set: new + confirm.
    const toggles = screen.getAllByRole("button", { name: /show password/i });
    expect(toggles).toHaveLength(2);

    await user.click(toggles[0]!);
    expect(field.type).toBe("text");
  });
});
