"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@multica/ui/components/ui/card";
import { Alert, AlertDescription } from "@multica/ui/components/ui/alert";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Label } from "@multica/ui/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@multica/ui/components/ui/input-otp";
import { useAuthStore } from "@multica/core/auth";
import { workspaceKeys } from "@multica/core/workspace/queries";
import { api } from "@multica/core/api";
import type { User } from "@multica/core/types";
import { useT } from "../i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GoogleAuthConfig {
  clientId: string;
  redirectUri: string;
  /** Opaque state passed through Google OAuth (e.g. "platform:desktop"). */
  state?: string;
}

interface CliCallbackConfig {
  /** Validated localhost callback URL. Omit to use the device-code (paste-in)
   *  flow — required for headless / SSH CLI logins where the browser can't
   *  reach a localhost listener on the CLI's machine. */
  url?: string;
  /** Opaque state to pass back to CLI (also used as the verifier for the
   *  device-code rendezvous). */
  state: string;
}

interface LoginPageProps {
  /** Logo element. Kept for backwards compatibility — the redesigned
   *  shell uses an AGENTHOST wordmark in the header strip and ignores
   *  this. Removing the prop would be a breaking API change for callers. */
  logo?: ReactNode;
  /** Called after successful login. The workspace list is seeded into React
   *  Query before this fires, so the caller can compute a destination URL. */
  onSuccess: () => void;
  /** Google OAuth config. Omit to disable Google login. */
  google?: GoogleAuthConfig;
  /** CLI callback config for authorizing CLI tools. */
  cliCallback?: CliCallbackConfig;
  /** Called after a token is obtained (e.g. to set cookies). */
  onTokenObtained?: () => void;
  /** Override Google login handler (e.g. desktop opens browser externally). When provided, renders the Google button even if `google` config is omitted. */
  onGoogleLogin?: () => void;
  /** Slot rendered at the bottom of the sign-in card, below the
   *  Google button. The web shell uses it for a "Prefer the desktop
   *  app?" prompt; desktop omits it (a download prompt inside the app
   *  would be absurd). */
  extra?: ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function redirectToCliCallback(url: string, token: string, state: string) {
  const separator = url.includes("?") ? "&" : "?";
  window.location.href = `${url}${separator}token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
}

/**
 * Validate that a CLI callback URL points to a safe host over HTTP.
 * Allows localhost and private/LAN IPs (RFC 1918) to support self-hosted setups
 * on local VMs while blocking arbitrary public hosts.
 */
export function validateCliCallback(cliCallback: string): boolean {
  try {
    const cbUrl = new URL(cliCallback);
    if (cbUrl.protocol !== "http:") return false;
    const h = cbUrl.hostname;
    if (h === "localhost" || h === "127.0.0.1") return true;
    // Allow RFC 1918 private IPs: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
    if (/^10\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^192\.168\./.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Visual primitives — Ops-style auth shell
// ---------------------------------------------------------------------------

/**
 * Dark, monospace auth shell: subtle grid backdrop + soft accent glow,
 * brand strip with the AGENTHOST wordmark and a pulsing accent dot, a
 * centered single-column content area below.
 *
 * Self-contained so this surface can render outside `.ops-landing`
 * without dragging the Ops design tokens across the package boundary.
 * Hex values mirror the canonical palette in
 * `apps/web/features/landing/components/ops/tokens.css`.
 */
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col bg-[#0a0d10] text-[#d4dde4] [font-family:ui-monospace,'JetBrains_Mono',Menlo,monospace]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(#1a2128 1px, transparent 1px), linear-gradient(90deg, #1a2128 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, rgba(124, 242, 156, 0.06), transparent 55%)",
        }}
      />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[#26303a] px-6 py-4 sm:px-10">
        {/* Plain <a> rather than next/link — packages/views can't import
            framework-specific routers, and a hard navigation to "/" is the
            right behavior for both web (lands on the marketing home) and
            desktop (the in-app router resolves "/" to the workspace
            chooser). */}
        <a
          href="/"
          aria-label="Agenthost — back to home"
          className="flex items-center gap-2.5 text-[12px] font-medium tracking-[0.18em] transition-opacity hover:opacity-80"
        >
          <span
            aria-hidden="true"
            className="block h-[10px] w-[10px] animate-pulse bg-[#7cf29c]"
            style={{ boxShadow: "0 0 12px #7cf29c" }}
          />
          <span className="text-[#d4dde4]">AGENTHOST</span>
          <span className="ml-1 hidden text-[10px] font-normal tracking-[0.16em] text-[#6b7780] sm:inline">
            {"// KENSINK_LABS"}
          </span>
        </a>
        <span className="text-[10px] tracking-[0.12em] text-[#6b7780]">
          <span className="text-[#7cf29c]">●</span> ONLINE
        </span>
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[480px]">{children}</div>
      </main>
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#26303a] px-6 py-3 text-[10px] tracking-[0.12em] text-[#6b7780] sm:px-10">
        <span>{"// SECURE_AUTH · 6-DIGIT_CODE_OVER_EMAIL"}</span>
        <span>{`// KENSINK_LABS · ${new Date().getFullYear()}`}</span>
      </footer>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#7cf29c]">
      {children}
    </div>
  );
}

function Headline({ children }: { children: ReactNode }) {
  return (
    <h1 className="m-0 mb-3 text-[36px] font-semibold uppercase leading-[0.96] tracking-[-0.025em] text-[#d4dde4] sm:text-[42px]">
      {children}
    </h1>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-8 text-[14px] leading-[1.6] text-[#9aa6af]">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginPage({
  logo,
  onSuccess,
  google,
  cliCallback,
  onTokenObtained,
  onGoogleLogin,
  extra,
}: LoginPageProps) {
  const { t } = useT("auth");
  const qc = useQueryClient();
  const [step, setStep] = useState<
    "email" | "password" | "code" | "cli_confirm" | "cli_show_code"
  >("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // Kensink: email + password sign-in.
  const [password, setPassword] = useState("");
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [existingUser, setExistingUser] = useState<User | null>(null);
  // Code shown to the user in the device-code flow (no `cliCallback.url`).
  const [cliAuthCode, setCliAuthCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  // Tracks how the existing session was detected so handleCliAuthorize
  // uses the matching token source (cookie → issueCliToken, localStorage → direct).
  const authSourceRef = useRef<"cookie" | "localStorage">("cookie");
  // The last session ended because the server rejected its credential, not
  // because the user asked to leave. Without saying so, landing here reads as
  // the app having lost their work for no reason.
  const sessionExpired = useAuthStore((state) => state.expired);

  // Check for existing session when CLI callback is present.
  // Prioritises cookie auth (= current browser session) to avoid authorising
  // the CLI with a stale or mismatched localStorage token.
  useEffect(() => {
    if (!cliCallback) return;

    // Snapshot the token before probing. The probe below is *expected* to 401
    // for a token-mode session, and a 401 ends the session — clearing this
    // very key — so reading it after the probe would always come back null
    // and the fallback could never run.
    const storedToken = localStorage.getItem("multica_token");

    // Ensure no stale bearer token interferes — we want to test the cookie first.
    api.setToken(null);

    api
      .getMe()
      .then((user) => {
        authSourceRef.current = "cookie";
        setExistingUser(user);
        setStep("cli_confirm");
      })
      .catch(() => {
        // Cookie auth failed — fall back to the token this browser had.
        if (!storedToken) return;

        localStorage.setItem("multica_token", storedToken);
        api.setToken(storedToken);
        api
          .getMe()
          .then((user) => {
            authSourceRef.current = "localStorage";
            setExistingUser(user);
            setStep("cli_confirm");
          })
          .catch(() => {
            api.setToken(null);
            localStorage.removeItem("multica_token");
          });
      });
  }, [cliCallback]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendCode = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!email) {
        setError(t(($) => $.common.email_required));
        return;
      }
      setLoading(true);
      setError("");
      try {
        await useAuthStore.getState().sendCode(email);
        setStep("code");
        setCode("");
        setCooldown(60);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `${t(($) => $.errors.send_failed)} ${t(($) => $.errors.server_unreachable)}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [email, t],
  );

  const handleVerify = useCallback(
    async (value: string) => {
      if (value.length !== 6) return;
      setLoading(true);
      setError("");
      try {
        if (cliCallback) {
          // CLI path: mint a token for the CLI session.
          const { token } = await api.verifyCode(email, value);
          localStorage.setItem("multica_token", token);
          api.setToken(token);
          onTokenObtained?.();
          if (cliCallback.url) {
            // Browser flow: redirect to the CLI's local callback listener.
            redirectToCliCallback(cliCallback.url, token, cliCallback.state);
          } else {
            // Device flow: stash JWT under a one-shot opaque code paired to
            // the CLI's verifier, then render the code for the user to paste.
            const { code: cc } = await api.issueCliAuthCode(cliCallback.state);
            setCliAuthCode(cc);
            setStep("cli_show_code");
            setLoading(false);
          }
          return;
        }

        // Normal path: seed the workspace list into the Query cache so the
        // caller's onSuccess can read it synchronously to compute a destination
        // URL (first workspace's slug, or /workspaces/new for zero-workspace
        // users).
        await useAuthStore.getState().verifyCode(email, value);
        const wsList = await api.listWorkspaces();
        qc.setQueryData(workspaceKeys.list(), wsList);
        onTokenObtained?.();
        onSuccess();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(($) => $.errors.code_invalid),
        );
        setCode("");
        setLoading(false);
      }
    },
    [email, onSuccess, cliCallback, onTokenObtained, qc, t],
  );

  // Kensink: email + password sign-in. Mirrors handleVerify's CLI and normal
  // paths; only the credential exchange differs.
  const handlePasswordLogin = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!email || !password) return;
      setLoading(true);
      setError("");
      try {
        if (cliCallback) {
          const { token } = await api.passwordLogin(email, password);
          localStorage.setItem("multica_token", token);
          api.setToken(token);
          onTokenObtained?.();
          if (cliCallback.url) {
            redirectToCliCallback(cliCallback.url, token, cliCallback.state);
          } else {
            const { code: cc } = await api.issueCliAuthCode(cliCallback.state);
            setCliAuthCode(cc);
            setStep("cli_show_code");
            setLoading(false);
          }
          return;
        }

        await useAuthStore.getState().loginWithPassword(email, password);
        const wsList = await api.listWorkspaces();
        qc.setQueryData(workspaceKeys.list(), wsList);
        onTokenObtained?.();
        onSuccess();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(($) => $.errors.password_invalid),
        );
        setPassword("");
        setLoading(false);
      }
    },
    [email, password, onSuccess, cliCallback, onTokenObtained, qc, t],
  );

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      await useAuthStore.getState().sendCode(email);
      setCooldown(60);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t(($) => $.errors.resend_failed),
      );
    }
  };

  const handleCliAuthorize = async () => {
    if (!cliCallback) return;
    setLoading(true);

    try {
      onTokenObtained?.();

      if (cliCallback.url) {
        // Browser flow: hand a JWT to the CLI via its localhost callback.
        let token: string;
        if (authSourceRef.current === "localStorage") {
          const stored = localStorage.getItem("multica_token");
          if (!stored) throw new Error("token missing");
          token = stored;
        } else {
          const res = await api.issueCliToken();
          token = res.token;
        }
        redirectToCliCallback(cliCallback.url, token, cliCallback.state);
        return;
      }

      // Device flow: server mints + stashes the JWT under an opaque code.
      // The localStorage and cookie paths both work — issueCliAuthCode reads
      // whichever auth the API client is currently sending (bearer or cookie).
      const { code: cc } = await api.issueCliAuthCode(cliCallback.state);
      setCliAuthCode(cc);
      setStep("cli_show_code");
      setLoading(false);
    } catch {
      setError(t(($) => $.errors.cli_auth_failed));
      setExistingUser(null);
      setStep("email");
      setLoading(false);
    }
  };

  const copyCliAuthCode = async () => {
    try {
      await navigator.clipboard.writeText(cliAuthCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts; user can still select+copy.
    }
  };

  const handleGoogleLogin = () => {
    if (onGoogleLogin) {
      onGoogleLogin();
      return;
    }
    if (!google) return;
    const params = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    if (google.state) params.set("state", google.state);
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  // -------------------------------------------------------------------------
  // CLI device-code flow: show the code for the user to paste into the CLI
  // -------------------------------------------------------------------------

  if (step === "cli_show_code" && cliAuthCode) {
    return (
      <AuthShell>
        {logo && <div className="mb-6">{logo}</div>}
        <Eyebrow>{"// PASTE_THIS"}</Eyebrow>
        <Headline>Authentication Code</Headline>
        <Sub>Paste this into the Agenthost CLI prompt.</Sub>
        <div className="border border-[#26303a] bg-[#0f1318] px-5 py-5">
          <code className="block w-full break-all text-center text-[18px] tracking-[0.04em] text-[#7cf29c]">
            {cliAuthCode}
          </code>
        </div>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={copyCliAuthCode}
            className="inline-flex items-center gap-2 border border-[#26303a] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#9aa6af] transition-colors duration-150 hover:border-[#384451] hover:text-[#d4dde4]"
          >
            {codeCopied ? (
              <Check className="h-3.5 w-3.5 text-[#7cf29c]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {codeCopied ? "Copied" : "Copy code"}
          </button>
        </div>
        <p className="mt-6 text-[11px] tracking-[0.12em] text-[#6b7780]">
          {"// EXPIRES IN 5 MINUTES · ONE-TIME USE"}
        </p>
        <p className="mt-2 text-[12px] leading-[1.6] text-[#9aa6af]">
          You can close this tab once the CLI shows{" "}
          <span className="text-[#d4dde4]">&ldquo;Authenticated&rdquo;</span>.
        </p>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // CLI confirm step
  // -------------------------------------------------------------------------

  if (step === "cli_confirm" && existingUser) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-display-sm">
              {t(($) => $.cli.title)}
            </CardTitle>
            <CardDescription>
              {t(($) => $.cli.description, { email: existingUser.email })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              onClick={handleCliAuthorize}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading
                ? t(($) => $.cli.authorizing)
                : t(($) => $.cli.authorize)}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setExistingUser(null);
                setStep("email");
              }}
            >
              {t(($) => $.cli.different_account)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Code verification step
  // -------------------------------------------------------------------------

  // Kensink: password step — email + password sign-in.
  if (step === "password") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-display-sm">
              {t(($) => $.password.title)}
            </CardTitle>
            <CardDescription>
              {t(($) => $.password.description, { email })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form id="password-form" onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-password">{t(($) => $.password.label)}</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={passwordRevealed ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordRevealed((v) => !v)}
                    aria-label={passwordRevealed ? t(($) => $.password.hide) : t(($) => $.password.show)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {passwordRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-body text-destructive">{error}</p>
              )}
            </form>
            {/* Doubles as the password reset path: a one-time code signs the
                user in, and they can set a new password from settings. */}
            <button
              type="button"
              onClick={() => {
                setPassword("");
                setError("");
                void handleSendCode();
              }}
              disabled={loading}
              className="text-body text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              {t(($) => $.password.forgot)}
            </button>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              form="password-form"
              className="w-full"
              size="lg"
              disabled={!password || loading}
            >
              {loading ? t(($) => $.password.submitting) : t(($) => $.password.submit)}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("email");
                setPassword("");
                setError("");
              }}
            >
              {t(($) => $.common.back)}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            {logo && <div className="mx-auto mb-4">{logo}</div>}
            <CardTitle className="text-display-sm">
              {t(($) => $.verify.title)}
            </CardTitle>
            <CardDescription>
              {t(($) => $.verify.description, { email })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <InputOTP
              autoFocus
              maxLength={6}
              value={code}
              onChange={(value) => {
                setCode(value);
                if (value.length === 6) handleVerify(value);
              }}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {error && (
              <p className="text-body text-destructive">{error}</p>
            )}
            <div className="flex items-center gap-2 text-body text-muted-foreground">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0}
                className="text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
              >
                {cooldown > 0
                  ? t(($) => $.verify.resend_cooldown, { seconds: cooldown })
                  : t(($) => $.verify.resend)}
              </button>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
            >
              {t(($) => $.common.back)}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Email step (default)
  // -------------------------------------------------------------------------

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {logo && <div className="mx-auto mb-4">{logo}</div>}
          <CardTitle className="text-display-sm">
            {t(($) => $.signin.title)}
          </CardTitle>
          <CardDescription>
            {t(($) => $.signin.description)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionExpired && (
            <Alert>
              <AlertDescription>
                {t(($) => $.errors.session_expired)}
              </AlertDescription>
            </Alert>
          )}
          <form id="login-form" onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">{t(($) => $.common.email)}</Label>
              <Input
                id="login-email"
                type="email"
                placeholder={t(($) => $.common.email_placeholder)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && (
              <p className="text-body text-destructive">{error}</p>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            form="login-form"
            className="w-full"
            size="lg"
            disabled={!email || loading}
          >
            {loading
              ? t(($) => $.signin.sending)
              : t(($) => $.signin.continue)}
          </Button>
          {/* Kensink: switch to email + password sign-in. */}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              if (!email) {
                setError(t(($) => $.common.email_required));
                return;
              }
              setError("");
              setStep("password");
            }}
            disabled={loading}
          >
            {t(($) => $.password.use_password)}
          </Button>
          {(google || onGoogleLogin) && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {t(($) => $.signin.google)}
            </Button>
          )}
          {extra && <div className="w-full pt-1 text-center">{extra}</div>}
        </CardFooter>
      </Card>
    </div>
  );
}
