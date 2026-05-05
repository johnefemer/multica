"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { sanitizeNextUrl, useAuthStore } from "@multica/core/auth";
import { useConfigStore } from "@multica/core/config";
import { workspaceKeys } from "@multica/core/workspace/queries";
import {
  paths,
  resolvePostAuthDestination,
  useHasOnboarded,
} from "@multica/core/paths";
import { api } from "@multica/core/api";
import type { Workspace } from "@multica/core/types";
import { Loader2 } from "lucide-react";
import { setLoggedInCookie } from "@/features/auth/auth-cookie";
import { LoginPage, validateCliCallback } from "@multica/views/auth";

/**
 * Inline-styled handoff screens for the Desktop OAuth bounce. They live
 * here (not in `@multica/views/auth`) because the LoginPage shell is a
 * shared component and these states are platform-specific to the web
 * shell — they only fire when `platform=desktop` and the browser is
 * trying to relinquish the session back to the desktop app.
 *
 * The styling mirrors the Ops aesthetic used by the redesigned
 * LoginPage so the user doesn't see a treatment shift on the bounce.
 */
function DesktopHandoffShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-[#0a0d10] px-6 text-center text-[#d4dde4] [font-family:ui-monospace,'JetBrains_Mono',Menlo,monospace]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(#1a2128 1px, transparent 1px), linear-gradient(90deg, #1a2128 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative z-10 flex w-full max-w-[480px] flex-col items-center gap-5 border border-[#26303a] bg-[#0f1318] px-8 py-10">
        <div className="flex items-center gap-2.5 text-[12px] font-medium tracking-[0.18em]">
          <span
            aria-hidden="true"
            className="block h-[10px] w-[10px] animate-pulse bg-[#7cf29c]"
            style={{ boxShadow: "0 0 12px #7cf29c" }}
          />
          <span>AGENTHOST</span>
        </div>
        <h1 className="m-0 text-[28px] font-semibold uppercase leading-[1] tracking-[-0.02em] text-[#d4dde4]">
          {title}
        </h1>
        <p className="m-0 text-[14px] leading-[1.6] text-[#9aa6af]">
          {description}
        </p>
        {children}
      </div>
    </div>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const qc = useQueryClient();
  const googleClientId = useConfigStore((state) => state.googleClientId);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const searchParams = useSearchParams();

  const cliCallbackRaw = searchParams.get("cli_callback");
  const cliState = searchParams.get("cli_state") || "";
  const platform = searchParams.get("platform");
  const isDesktopHandoff = platform === "desktop" && !cliCallbackRaw;
  // `next` carries a protected URL the user was originally headed to
  // (e.g. /invite/{id}). With URL-driven workspaces there is no legacy
  // "/issues" default — if `next` is absent we decide after login based on
  // the user's workspace list. Sanitize first so a crafted `?next=https://evil`
  // cannot bounce the user off-origin after a successful login.
  const nextUrl = sanitizeNextUrl(searchParams.get("next"));

  const [desktopToken, setDesktopToken] = useState<string | null>(null);
  const [desktopError, setDesktopError] = useState("");
  const hasOnboarded = useHasOnboarded();

  // Already authenticated — honor ?next= or fall back to first workspace
  // (or /onboarding if the user has none). Skip this entire path when
  // the user arrived to authorize the CLI.
  useEffect(() => {
    // Bail out when the user landed on /login to authorize the CLI — for
    // both the browser callback flow (cli_callback) AND the device-code
    // flow (cli_state alone). Otherwise an already-authenticated user gets
    // bounced into a workspace and the LoginPage never renders the cli_confirm
    // step that would mint and surface the auth code.
    if (isLoading || !user || cliCallbackRaw || cliState) return;
    if (isDesktopHandoff) {
      // Desktop opened the browser for login but the web session is already
      // authenticated — mint a bearer token from the cookie session and hand
      // it off via deep link instead of silently redirecting to the workspace.
      api
        .issueCliToken()
        .then(({ token }) => {
          setDesktopToken(token);
          window.location.href = `multica://auth/callback?token=${encodeURIComponent(token)}`;
        })
        .catch((err) => {
          setDesktopError(
            err instanceof Error ? err.message : "Failed to prepare Desktop sign-in",
          );
        });
      return;
    }
    if (!hasOnboarded) {
      router.replace(paths.onboarding());
      return;
    }
    if (nextUrl) {
      router.replace(nextUrl);
      return;
    }
    const list = qc.getQueryData<Workspace[]>(workspaceKeys.list()) ?? [];
    router.replace(resolvePostAuthDestination(list, hasOnboarded));
  }, [isLoading, user, router, nextUrl, cliCallbackRaw, cliState, isDesktopHandoff, hasOnboarded, qc]);

  const handleSuccess = () => {
    // Read the latest user snapshot directly — the closure's `hasOnboarded`
    // was captured before login completed and would be stale here.
    const currentUser = useAuthStore.getState().user;
    const onboarded = currentUser?.onboarded_at != null;
    if (!onboarded) {
      router.push(paths.onboarding());
      return;
    }
    if (nextUrl) {
      router.push(nextUrl);
      return;
    }
    const list = qc.getQueryData<Workspace[]>(workspaceKeys.list()) ?? [];
    router.push(resolvePostAuthDestination(list, onboarded));
  };

  // Build Google OAuth state: encode platform + next URL so the callback
  // can redirect to the right place after login.
  const googleState = [
    platform === "desktop" ? "platform:desktop" : "",
    nextUrl ? `next:${nextUrl}` : "",
  ]
    .filter(Boolean)
    .join(",") || undefined;

  // While the desktop handoff is in progress (or has produced a token/error),
  // render a dedicated screen instead of flashing the login form or redirecting
  // away to a workspace page.
  if (isDesktopHandoff && user) {
    if (desktopError) {
      return (
        <DesktopHandoffShell
          title="Sign-in failed"
          description={desktopError}
        />
      );
    }
    return (
      <DesktopHandoffShell
        title="Opening Agenthost"
        description={
          desktopToken
            ? "You should see a prompt to open the Agenthost desktop app. If nothing happens, click below."
            : "Preparing desktop sign-in..."
        }
      >
        {desktopToken ? (
          <button
            type="button"
            onClick={() => {
              window.location.href = `multica://auth/callback?token=${encodeURIComponent(desktopToken)}`;
            }}
            className="inline-flex items-center justify-center gap-2 border border-[#7cf29c] bg-[#7cf29c] px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0a0d10] transition-colors duration-150 hover:bg-[#a4f5ba]"
          >
            Open Agenthost Desktop
          </button>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-[#7cf29c]" />
        )}
      </DesktopHandoffShell>
    );
  }

  return (
    <LoginPage
      onSuccess={handleSuccess}
      logo={
        <img
          src="/kensink-logo.png"
          alt="Kensink Labs"
          className="h-12 w-12 object-contain"
        />
      }
      google={
        googleClientId
          ? {
              clientId: googleClientId,
              redirectUri: `${window.location.origin}/auth/callback`,
              state: googleState,
            }
          : undefined
      }
      cliCallback={
        cliCallbackRaw && validateCliCallback(cliCallbackRaw)
          ? { url: cliCallbackRaw, state: cliState }
          : cliState
            ? // Device-code flow: cli_state present without a callback URL.
              // The login page renders an "Authentication Code" view instead
              // of redirecting; the CLI exchanges the code for the JWT.
              { state: cliState }
            : undefined
      }
      onTokenObtained={setLoggedInCookie}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
