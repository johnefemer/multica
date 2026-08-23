"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@multica/ui/components/ui/input-otp";
import { useAuthStore } from "@multica/core/auth";
import { workspaceKeys } from "@multica/core/workspace/queries";
import { api } from "@multica/core/api";
import type { User } from "@multica/core/types";
import { cn } from "@multica/ui/lib/utils";

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

function redirectToCliCallback(url: string, token: string, state: string) {
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
        <span>{"// SECURE_AUTH · EMAIL_CODE_OR_PASSWORD"}</span>
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

function PrimaryButton({
  children,
  type = "button",
  form,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  form?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 border border-[#7cf29c] bg-[#7cf29c] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a0d10] transition-colors duration-150",
        "hover:bg-[#a4f5ba]",
        "disabled:cursor-not-allowed disabled:border-[#26303a] disabled:bg-[#26303a] disabled:text-[#6b7780]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function OutlineButton({
  children,
  type = "button",
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 border border-[#26303a] bg-transparent px-4 py-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[#9aa6af] transition-colors duration-150",
        "hover:border-[#384451] hover:text-[#d4dde4]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Accent text link used for the flow switches (password <-> email code). */
function SwitchLink({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7cf29c] transition-colors duration-150 hover:text-[#a4f5ba] disabled:cursor-not-allowed disabled:text-[#6b7780]"
    >
      {children}
    </button>
  );
}

/** Password input with a reveal toggle. `autoComplete` distinguishes the
 *  sign-in field from the two change-password fields for password managers. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  autoFocus,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9aa6af]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          required
          className="w-full border border-[#26303a] bg-[#0f1318] px-4 py-3 pr-12 text-[14px] text-[#d4dde4] placeholder:text-[#6b7780] focus:border-[#7cf29c] focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-4 text-[#6b7780] transition-colors duration-150 hover:text-[#d4dde4]"
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 border-l-2 border-[#ff6363] bg-[rgba(255,99,99,0.06)] px-3 py-2 text-[12px] text-[#ff6363]">
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
  const qc = useQueryClient();
  const [step, setStep] = useState<
    "email" | "password" | "code" | "cli_confirm" | "cli_show_code"
  >("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
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

  // Check for existing session when CLI callback is present.
  // Prioritises cookie auth (= current browser session) to avoid authorising
  // the CLI with a stale or mismatched localStorage token.
  useEffect(() => {
    if (!cliCallback) return;

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
        // Cookie auth failed — fall back to localStorage token
        const token = localStorage.getItem("multica_token");
        if (!token) return;

        api.setToken(token);
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
        setError("Email is required");
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
            : "Failed to send code. Make sure the server is running.",
        );
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  // CLI path: hand the freshly minted JWT to the CLI session. Shared by the
  // verification-code and password flows.
  const handOffToCli = useCallback(
    async (token: string, cli: CliCallbackConfig) => {
      localStorage.setItem("multica_token", token);
      api.setToken(token);
      onTokenObtained?.();
      if (cli.url) {
        // Browser flow: redirect to the CLI's local callback listener.
        redirectToCliCallback(cli.url, token, cli.state);
        return;
      }
      // Device flow: stash JWT under a one-shot opaque code paired to the
      // CLI's verifier, then render the code for the user to paste.
      const { code: cc } = await api.issueCliAuthCode(cli.state);
      setCliAuthCode(cc);
      setStep("cli_show_code");
      setLoading(false);
    },
    [onTokenObtained],
  );

  // Normal path: seed the workspace list into the Query cache so the caller's
  // onSuccess can read it synchronously to compute a destination URL (first
  // workspace's slug, or /workspaces/new for zero-workspace users).
  const enterApp = useCallback(async () => {
    const wsList = await api.listWorkspaces();
    qc.setQueryData(workspaceKeys.list(), wsList);
    onTokenObtained?.();
    onSuccess();
  }, [onSuccess, onTokenObtained, qc]);

  const handleVerify = useCallback(
    async (value: string) => {
      if (value.length !== 6) return;
      setLoading(true);
      setError("");
      try {
        if (cliCallback) {
          const { token } = await api.verifyCode(email, value);
          await handOffToCli(token, cliCallback);
          return;
        }

        await useAuthStore.getState().verifyCode(email, value);
        await enterApp();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Invalid or expired code",
        );
        setCode("");
        setLoading(false);
      }
    },
    [email, cliCallback, enterApp, handOffToCli],
  );

  const handlePasswordLogin = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!email || !password) {
        setError("Email and password are required");
        return;
      }
      setLoading(true);
      setError("");
      try {
        if (cliCallback) {
          const { token } = await api.passwordLogin(email, password);
          await handOffToCli(token, cliCallback);
          return;
        }

        await useAuthStore.getState().loginWithPassword(email, password);
        await enterApp();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Invalid email or password",
        );
        setPassword("");
        setLoading(false);
      }
    },
    [email, password, cliCallback, enterApp, handOffToCli],
  );

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      await useAuthStore.getState().sendCode(email);
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
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
      setError("Failed to authorize CLI. Please log in again.");
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
      <AuthShell>
        {logo && <div className="mb-6">{logo}</div>}
        <Eyebrow>{"// AUTHORIZE_CLI"}</Eyebrow>
        <Headline>Authorize CLI</Headline>
        <Sub>
          Allow the Agenthost CLI to sign in as{" "}
          <span className="text-[#d4dde4]">{existingUser.email}</span>?
        </Sub>
        <div className="flex flex-col gap-3">
          <PrimaryButton onClick={handleCliAuthorize} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Authorizing..." : "Authorize"}
            {!loading && <ArrowRight className="h-3.5 w-3.5" />}
          </PrimaryButton>
          <OutlineButton
            onClick={() => {
              setExistingUser(null);
              setStep("email");
            }}
          >
            Use a different account
          </OutlineButton>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Password step
  // -------------------------------------------------------------------------

  if (step === "password") {
    return (
      <AuthShell>
        {logo && <div className="mb-6">{logo}</div>}
        <Eyebrow>{"// PASSWORD"}</Eyebrow>
        <Headline>Enter your password</Headline>
        <Sub>
          Signing in as <span className="text-[#d4dde4]">{email}</span>.
        </Sub>
        <form
          id="password-form"
          onSubmit={handlePasswordLogin}
          className="flex flex-col gap-5"
        >
          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            autoFocus
            disabled={loading}
          />
          {error && <ErrorLine>{error}</ErrorLine>}
          <PrimaryButton
            type="submit"
            form="password-form"
            disabled={!password || loading}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <ArrowRight className="h-3.5 w-3.5" />}
          </PrimaryButton>
        </form>
        <div className="mt-5 text-center">
          {/* Doubles as the password reset path: a one-time code signs the
              user in, and they can set a new password from settings. */}
          <SwitchLink onClick={handleSendCode} disabled={loading}>
            Forgot password? Email me a code
          </SwitchLink>
        </div>
        <div className="mt-8">
          <OutlineButton
            onClick={() => {
              setStep("email");
              setPassword("");
              setError("");
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </OutlineButton>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Code verification step
  // -------------------------------------------------------------------------

  if (step === "code") {
    return (
      <AuthShell>
        {logo && <div className="mb-6">{logo}</div>}
        <Eyebrow>{"// VERIFY"}</Eyebrow>
        <Headline>Check your email</Headline>
        <Sub>
          We sent a 6-digit code to{" "}
          <span className="text-[#d4dde4]">{email}</span>. Enter it below.
        </Sub>
        <div className="flex flex-col items-center gap-5">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (value.length === 6) handleVerify(value);
            }}
            disabled={loading}
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-11 border-[#26303a] bg-[#0f1318] text-[18px] font-medium text-[#d4dde4] data-[active=true]:border-[#7cf29c] data-[active=true]:ring-0"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && <ErrorLine>{error}</ErrorLine>}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#7cf29c] transition-colors duration-150 hover:text-[#a4f5ba] disabled:cursor-not-allowed disabled:text-[#6b7780]"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
        <div className="mt-8">
          <OutlineButton
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </OutlineButton>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Email step (default)
  // -------------------------------------------------------------------------

  return (
    <AuthShell>
      {logo && <div className="mb-6">{logo}</div>}
      <Eyebrow>{"// SIGN_IN"}</Eyebrow>
      <Headline>Sign in to Agenthost</Headline>
      <Sub>
        Enter your email to get a login code, or sign in with your password if
        you have set one.
      </Sub>
      <form id="login-form" onSubmit={handleSendCode} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="login-email"
            className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9aa6af]"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
            className="w-full border border-[#26303a] bg-[#0f1318] px-4 py-3 text-[14px] text-[#d4dde4] placeholder:text-[#6b7780] focus:border-[#7cf29c] focus:outline-none focus:ring-0"
          />
        </div>
        {error && <ErrorLine>{error}</ErrorLine>}
        <PrimaryButton
          type="submit"
          form="login-form"
          disabled={!email || loading}
        >
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading ? "Sending code..." : "Continue"}
          {!loading && <ArrowRight className="h-3.5 w-3.5" />}
        </PrimaryButton>
      </form>

      <div className="mt-5 text-center">
        <SwitchLink
          onClick={() => {
            if (!email) {
              setError("Email is required");
              return;
            }
            setError("");
            setStep("password");
          }}
          disabled={loading}
        >
          Sign in with password
        </SwitchLink>
      </div>

      {(google || onGoogleLogin) && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            className="my-6 flex items-center gap-3 text-[10px] tracking-[0.18em] text-[#6b7780]"
          >
            <span className="h-px flex-1 bg-[#26303a]" />
            <span>OR</span>
            <span className="h-px flex-1 bg-[#26303a]" />
          </div>
          <OutlineButton onClick={handleGoogleLogin} disabled={loading}>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" aria-hidden="true">
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
            Continue with Google
          </OutlineButton>
        </>
      )}

      {extra && (
        <div className="mt-6 text-center text-[11px] tracking-[0.12em] text-[#6b7780]">
          {extra}
        </div>
      )}
    </AuthShell>
  );
}
