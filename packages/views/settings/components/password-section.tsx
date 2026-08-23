"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Input } from "@multica/ui/components/ui/input";
import { Label } from "@multica/ui/components/ui/label";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import { toast } from "sonner";
import { useAuthStore, PASSWORD_MIN_LENGTH } from "@multica/core/auth";
import { api } from "@multica/core/api";

/** Password input with a reveal toggle. */
function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative mt-1">
      <Input
        id={id}
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        {revealed ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/**
 * Set or change the account password.
 *
 * Accounts created through the email-code or Google flow start without one:
 * the session itself is proof of identity, so the first password is set
 * without a current-password challenge. Every later change needs it.
 */
export function PasswordSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const hasPassword = user?.has_password ?? false;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit =
    !saving &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    (!hasPassword || currentPassword.length > 0);

  const handleSave = async () => {
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(
        `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.setPassword({
        current_password: hasPassword ? currentPassword : undefined,
        new_password: newPassword,
      });
      setUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(hasPassword ? "Password changed" : "Password set");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold">Password</h2>

      <Card>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {hasPassword
              ? "Sign in with your email and password, or keep using one-time email codes."
              : "You sign in with one-time email codes. Set a password to sign in with it instead."}
          </p>

          {hasPassword && (
            <div>
              <Label
                htmlFor="current-password"
                className="text-xs text-muted-foreground"
              >
                Current password
              </Label>
              <PasswordInput
                id="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={saving}
              />
            </div>
          )}

          <div>
            <Label
              htmlFor="new-password"
              className="text-xs text-muted-foreground"
            >
              New password
            </Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least {PASSWORD_MIN_LENGTH} characters.
            </p>
          </div>

          <div>
            <Label
              htmlFor="confirm-password"
              className="text-xs text-muted-foreground"
            >
              Confirm new password
            </Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" onClick={handleSave} disabled={!canSubmit}>
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <KeyRound className="h-3 w-3" />
              )}
              {saving
                ? "Saving..."
                : hasPassword
                  ? "Change Password"
                  : "Set Password"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
