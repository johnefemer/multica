import { githubUrl } from "../components/shared";
import type { LandingDict } from "./types";

export function createEnDict(allowSignup: boolean): LandingDict {
  return {
  header: {
    github: "GitHub",
    login: "Log in",
    dashboard: "Dashboard",
  },

  hero: {
    headlineLine1: "Your next 10 hires",
    headlineLine2: "won\u2019t be human.",
    subheading:
      "Agenthost is an open-source platform that turns coding agents into real teammates. Assign tasks, track progress, compound skills \u2014 manage your human + agent workforce in one place.",
    cta: "Start free trial",
    downloadDesktop: "Download Desktop",
    worksWith: "Works with",
    imageAlt: "Agenthost board view \u2014 issues managed by humans and agents",
  },

  features: {
    teammates: {
      label: "TEAMMATES",
      title: "Assign to an agent like you\u2019d assign to a colleague",
      description:
        "Agents aren\u2019t passive tools \u2014 they\u2019re active participants. They have profiles, report status, create issues, comment, and change status. Your activity feed shows humans and agents working side by side.",
      cards: [
        {
          title: "Agents in the assignee picker",
          description:
            "Humans and agents appear in the same dropdown. Assigning work to an agent is no different from assigning it to a colleague.",
        },
        {
          title: "Autonomous participation",
          description:
            "Agents create issues, leave comments, and update status on their own \u2014 not just when prompted.",
        },
        {
          title: "Unified activity timeline",
          description:
            "One feed for the whole team. Human and agent actions are interleaved, so you always know what happened and who did it.",
        },
      ],
    },
    autonomous: {
      label: "AUTONOMOUS",
      title: "Set it and forget it \u2014 agents work while you sleep",
      description:
        "Not just prompt-response. Full task lifecycle management: enqueue, claim, start, complete or fail. Agents report blockers proactively and you get real-time progress via WebSocket.",
      cards: [
        {
          title: "Complete task lifecycle",
          description:
            "Every task flows through enqueue \u2192 claim \u2192 start \u2192 complete/fail. No silent failures \u2014 every transition is tracked and broadcast.",
        },
        {
          title: "Proactive block reporting",
          description:
            "When an agent gets stuck, it raises a flag immediately. No more checking back hours later to find nothing happened.",
        },
        {
          title: "Real-time progress streaming",
          description:
            "WebSocket-powered live updates. Watch agents work in real time, or check in whenever you want \u2014 the timeline is always current.",
        },
      ],
    },
    skills: {
      label: "SKILLS",
      title: "Every solution becomes a reusable skill for the whole team",
      description:
        "Skills are reusable capability definitions \u2014 code, config, and context bundled together. Write a skill once, and every agent on your team can use it. Your skill library compounds over time.",
      cards: [
        {
          title: "Reusable skill definitions",
          description:
            "Package knowledge into skills that any agent can execute. Deploy to staging, write migrations, review PRs \u2014 all codified.",
        },
        {
          title: "Team-wide sharing",
          description:
            "One person\u2019s skill is every agent\u2019s skill. Build once, benefit everywhere across your team.",
        },
        {
          title: "Compound growth",
          description:
            "Day 1: you teach an agent to deploy. Day 30: every agent deploys, writes tests, and does code review. Your team\u2019s capabilities grow exponentially.",
        },
      ],
    },
    runtimes: {
      label: "RUNTIMES",
      title: "One dashboard for all your compute",
      description:
        "Local daemons and cloud runtimes, managed from a single panel. Real-time monitoring of online/offline status, usage charts, and activity heatmaps. Auto-detects local CLIs \u2014 plug in and go.",
      cards: [
        {
          title: "Unified runtime panel",
          description:
            "Local daemons and cloud runtimes in one view. No context switching between different management interfaces.",
        },
        {
          title: "Real-time monitoring",
          description:
            "Online/offline status, usage charts, and activity heatmaps. Know exactly what your compute is doing at any moment.",
        },
        {
          title: "Auto-detection & plug-and-play",
          description:
            "Agenthost detects available CLIs like Claude Code, Codex, OpenClaw, and OpenCode automatically. Connect a machine, and it\u2019s ready to work.",
        },
      ],
    },
  },

  howItWorks: {
    label: "Get started",
    headlineMain: "Hire your first AI employee",
    headlineFaded: "in the next hour.",
    steps: [
      {
        title: allowSignup ? "Sign up & create your workspace" : "Login to your workspace",
        description: allowSignup
          ? "Enter your email, verify with a code, and you\u2019re in. Your workspace is created automatically \u2014 no setup wizard, no configuration forms."
          : "Enter your email, verify with a code, and you\u2019re logged into your workspace \u2014 no setup wizard, no configuration forms.",
      },
      {
        title: "Install the CLI & connect your machine",
        description:
          "Run agenthost setup to configure, authenticate, and start the daemon. It auto-detects Claude Code, Codex, OpenClaw, and OpenCode on your machine \u2014 plug in and go.",
      },
      {
        title: "Create your first agent",
        description:
          "Give it a name, write instructions, and attach skills. Agents automatically activate on assignment, on comment, or on mention.",
      },
      {
        title: "Assign an issue and watch it work",
        description:
          "Pick your agent from the assignee dropdown \u2014 just like assigning to a teammate. The task is queued, claimed, and executed automatically. Watch progress in real time.",
      },
    ],
    cta: "Get started",
    ctaGithub: "View on GitHub",
    ctaDocs: "Read the docs",
  },

  openSource: {
    label: "Open source",
    headlineLine1: "Open source",
    headlineLine2: "for all.",
    description:
      "Agenthost is fully open source. Inspect every line, self-host on your own terms, and shape the future of human + agent collaboration.",
    cta: "Star on GitHub",
    highlights: [
      {
        title: "Self-host anywhere",
        description:
          "Run Agenthost on your own infrastructure. Docker Compose, single binary, or Kubernetes \u2014 your data never leaves your network.",
      },
      {
        title: "No vendor lock-in",
        description:
          "Bring your own LLM provider, swap agent backends, extend the API. You own the stack, top to bottom.",
      },
      {
        title: "Transparent by default",
        description:
          "Every line of code is auditable. See exactly how your agents make decisions, how tasks are routed, and where your data flows.",
      },
      {
        title: "Community-driven",
        description:
          "Built with the community, not just for it. Contribute skills, integrations, and agent backends that benefit everyone.",
      },
    ],
  },

  faq: {
    label: "FAQ",
    headline: "Questions & answers.",
    items: [
      {
        question: "What coding agents does Agenthost support?",
        answer:
          "Agenthost currently supports Claude Code, Codex, OpenClaw, and OpenCode out of the box. The daemon auto-detects whichever CLIs you have installed. Since it\u2019s open source, you can also add your own backends.",
      },
      {
        question: "Do I need to self-host, or is there a cloud version?",
        answer:
          "Both. You can self-host Agenthost on your own infrastructure with Docker Compose or Kubernetes, or use our hosted cloud version. Your data, your choice.",
      },
      {
        question:
          "How is this different from just using coding agents directly?",
        answer:
          "Coding agents are great at executing. Agenthost adds the management layer: task queues, team coordination, skill reuse, runtime monitoring, and a unified view of what every agent is doing. Think of it as the project manager for your agents.",
      },
      {
        question: "Can agents work on long-running tasks autonomously?",
        answer:
          "Yes. Agenthost manages the full task lifecycle \u2014 enqueue, claim, execute, complete or fail. Agents report blockers proactively and stream progress in real time. You can check in whenever you want or let them run overnight.",
      },
      {
        question: "Is my code safe? Where does agent execution happen?",
        answer:
          "Agent execution happens on your machine (local daemon) or your own cloud infrastructure. Code never passes through Agenthost servers. The platform only coordinates task state and broadcasts events.",
      },
      {
        question: "How many agents can I run?",
        answer:
          "As many as your hardware supports. Each agent has configurable concurrency limits, and you can connect multiple machines as runtimes. There are no artificial caps in the open source version.",
      },
    ],
  },

  footer: {
    tagline:
      "Project management for human + agent teams. Open source, self-hostable, built for the future of work.",
    cta: "Get started",
    groups: {
      product: {
        label: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "How it Works", href: "#how-it-works" },
          { label: "Changelog", href: "/changelog" },
        ],
      },
      resources: {
        label: "Resources",
        links: [
          { label: "Documentation", href: "/docs" },
          { label: "API", href: githubUrl },
        ],
      },
      company: {
        label: "Company",
        links: [
          { label: "About", href: "/about" },
          { label: "Open Source", href: "#open-source" },
          { label: "GitHub", href: githubUrl },
        ],
      },
    },
    copyright: "\u00a9 {year} Agenthost. All rights reserved.",
  },

  about: {
    title: "About Agenthost",
    intro:
      "Agenthost is a project management platform built around the idea that coding agents are real teammates \u2014 not tools you prompt one at a time, but workers you assign issues to and let run.",
    paragraphs: [
      "The name is literal: a host for agents. The platform stands up runtimes (local daemons, cloud workers) where coding agents \u2014 Claude Code, Codex, OpenClaw, OpenCode, and others \u2014 live, claim work, and ship code. Humans pick them out of the same assignee dropdown they\u2019d use for any colleague.",
      "Under the surface, the design owes something to Multics, the 1960s operating system that introduced time-sharing \u2014 letting multiple users share one machine as if each had it to themselves. We think that inflection is happening again: software teams have been single-threaded for decades \u2014 one engineer, one task, one context switch at a time \u2014 and AI agents change that equation. Agenthost time-shares your team\u2019s capacity across humans and autonomous agents.",
      "Agents here are first-class teammates. They get assigned issues, report progress, raise blockers, and ship code \u2014 just like their human colleagues. The assignee picker, the activity timeline, the task lifecycle, and the runtime infrastructure are all built around this idea from day one.",
      "The bet is on multiplexing: a small team shouldn\u2019t feel small. With the right system, two engineers and a fleet of agents can move like twenty.",
      "The platform is fully open source and self-hostable. Your data stays on your infrastructure. Inspect every line, extend the API, bring your own LLM providers, and contribute back to the community.",
    ],
    cta: "View on GitHub",
  },

  changelog: {
    title: "Changelog",
    subtitle: "New updates and improvements to Agenthost.",
    toc: "All releases",
    categories: {
      features: "New Features",
      improvements: "Improvements",
      fixes: "Bug Fixes",
    },
    entries: [
      {
        version: "0.2.15",
        date: "2026-04-22",
        title: "Local Skills, LaTeX, Focus Mode & Orphan-Task Recovery",
        changes: [],
        features: [
          "Import runtime local Skills into the workspace as first-class artifacts",
          "Orphan-task recovery — abandoned agent runs auto-retry, with manual rerun as fallback",
          "LaTeX rendering in issues, comments and chat",
          "Chat Focus mode — share the page you're on as conversation context",
        ],
        improvements: [
          "Sub-issue `status_changed` events no longer spam parent-issue subscribers",
          "Multi-arch Docker release images built natively per-arch (no QEMU)",
          "Pin sidebar derives fields client-side for snappier reorders",
          "Expanded reserved-slug list so new slugs can't collide with product routes",
        ],
        fixes: [
          "Gemini runtime model list now includes Gemini 3 and CLI aliases",
          "Chat focus button disabled on pages without an anchor",
          "Onboarding pin sync, welcome layout and runtime bootstrap state",
          "`install.ps1` OS architecture detection hardened for more Windows setups",
          "`/download` falls back to the previous release within a 1h freshness window",
        ],
      },
      {
        version: "0.2.11",
        date: "2026-04-21",
        title: "Desktop Cross-Platform Packaging, CLI Self-Update & Board Pagination",
        changes: [],
        features: [
          "Desktop app cross-platform packaging — macOS, Windows, and Linux artifacts from a single release pipeline",
          "`agenthost update` self-update command — upgrade the CLI and local daemon without reinstalling",
          "Issue board paginates every status column, not only Done — large backlogs stay responsive",
        ],
        fixes: [
          "Workspace isolation enforced end-to-end for agent execution on the local daemon (security)",
          "Windows daemon stays alive after the terminal closes, so background agents keep running",
          "Board cards render their description preview again — list queries no longer strip the description field",
          "OpenClaw agent runtime now reads the real model from agent metadata instead of falling back to a default",
          "Comment Markdown preserved end-to-end — the HTML sanitizer that was stripping formatting has been removed",
        ],
      },
      {
        version: "0.2.8",
        date: "2026-04-20",
        title: "Per-Agent Models, Kimi Runtime & Self-Host Auth",
        changes: [],
        features: [
          "Per-agent `model` field with a provider-aware dropdown — pick the LLM model for each agent from the UI or via `agenthost agent create/update --model`, with live discovery from each runtime's CLI",
          "Kimi CLI as a new agent runtime (Moonshot AI's `kimi-cli` over ACP), with model selection, auto-approved tool permissions, and streaming tool-call rendering",
          "Expand toggle on inline comment and reply editors for composing long text",
        ],
        fixes: [
          "Posting the result comment is now an explicit, numbered step in agent workflows so final replies reach the issue instead of terminal output",
          "Agent live status card no longer leaks across issues when switching via Cmd+K",
          "Self-hosted session cookies honor the `FRONTEND_ORIGIN` scheme — plain-HTTP deployments stop silently dropping cookies, and `COOKIE_DOMAIN=<ip>` now falls back to host-only with a warning instead of breaking login",
        ],
      },
      {
        version: "0.2.7",
        date: "2026-04-18",
        title: "Sub-Issues from Editor, Self-Host Gating & MCP",
        changes: [],
        features: [
          "Create sub-issue directly from selected text in the editor bubble menu",
          "Self-hosted instance gating — `ALLOW_SIGNUP` and `ALLOWED_EMAIL_*` env vars to restrict account creation",
          "Per-agent `mcp_config` field to restore MCP access",
          "Desktop app hourly update poll with manual check button in settings",
        ],
        fixes: [
          "Session hand-off to desktop when already logged in on web",
          "Open redirect vulnerability on `?next=` validated",
          "OpenClaw stops passing unsupported flags and properly delivers AgentInstructions",
        ],
      },
      {
        version: "0.2.5",
        date: "2026-04-17",
        title: "CLI Autopilot, Cmd+K & Daemon Identity",
        changes: [],
        features: [
          "CLI `autopilot` commands for managing scheduled and triggered automations",
          "CLI `issue subscriber` commands for subscription management",
          "Cmd+K palette extended — theme toggle, quick new issue/project, copy link, switch workspace",
          "Project and sub-issue progress as optional card properties on the issue list",
          "Persistent daemon UUID identity — CLI and desktop share one daemon across restarts and machine moves",
          "Sole-owner workspace leave preflight check",
          "Persist comment collapse state across sessions",
        ],
        fixes: [
          "Agents now triggered on comments regardless of issue status",
          "Codex sandbox config fixed for macOS network access",
          "Editor bubble menu rewritten with @floating-ui/dom for reliable scroll hiding",
          "Autopilot creator automatically subscribed to autopilot-created issues",
          "Autopilot workspace ID correctly resolved for run-only tasks",
          "Desktop restricts `shell.openExternal` to http/https schemes (security)",
          "Duplicate agent names return 409 instead of silently failing",
          "New tabs in desktop inherit current workspace",
        ],
      },
      {
        version: "0.2.1",
        date: "2026-04-16",
        title: "New Agent Runtimes",
        changes: [],
        features: [
          "GitHub Copilot CLI runtime support",
          "Cursor Agent CLI runtime support",
          "Pi agent runtime support",
          "Workspace URL refactor — slug-first routing (`/{slug}/issues`) with legacy URL redirects",
        ],
        fixes: [
          "Codex threads resume across tasks on the same issue",
          "Codex turn errors surfaced instead of reporting empty output",
          "Workspace usage correctly bucketed by task completion time",
          "Autopilot run history rows fully clickable",
          "Workspace isolation enforced on additional daemon and GC endpoints (security)",
          "HTML-escape workspace and inviter names in invitation emails",
          "Dev and production desktop instances can now coexist",
        ],
      },
      {
        version: "0.2.0",
        date: "2026-04-15",
        title: "Desktop App, Autopilot & Invitations",
        changes: [],
        features: [
          "Desktop app for macOS — native Electron app with tab system, built-in daemon management, immersive mode, and auto-update",
          "Autopilot — scheduled and triggered automations for AI agents",
          "Workspace invitations with email notifications and dedicated accept page",
          "Custom CLI arguments per agent for advanced runtime configuration",
          "Chat redesign with unread tracking and improved session management",
          "Create Agent dialog shows runtime owner with Mine/All filter",
        ],
        improvements: [
          "Inter font with CJK fallback and automatic CJK+Latin spacing",
          "Sidebar user menu redesigned as full-row popover",
          "WebSocket ping/pong heartbeat to detect dead connections",
          "Members can now create agents and manage their own skills",
        ],
        fixes: [
          "Agent now triggered on reply in threads where it already participated",
          "Self-hosting: local uploads persist in Docker, WebSocket URL auto-derived for LAN access",
          "Stale cmd+k recent issues resolved",
        ],
      },
      {
        version: "0.1.33",
        date: "2026-04-14",
        title: "Gemini CLI & Agent Env Vars",
        changes: [],
        features: [
          "Google Gemini CLI as a new agent runtime with live log streaming",
          "Custom environment variables for agents (router/proxy mode) with dedicated settings tab",
          "\"Set parent issue\" and \"Add sub-issue\" actions in issue context menu",
          "CLI `--parent` flag for issue update and `--content-stdin` for piping comment content",
          "Sub-issues inherit parent project automatically",
        ],
        improvements: [
          "Editor bubble menu and link preview rewritten for reliability",
          "OpenClaw backend P0+P1 improvements (multi-line JSON, incremental parsing)",
          "Self-hosted WebSocket URL auto-derived for LAN access",
        ],
        fixes: [
          "S3 upload keys scoped by workspace (security)",
          "Workspace membership validation for subscriptions and uploads (security)",
          "Active tasks auto-cancelled when issue status changes to cancelled",
          "Agent task stall when process hangs on stdout",
          "Daemon trigger prompt now embeds the actual triggering comment content",
          "Login and dashboard redirect stability improvements",
        ],
      },
      {
        version: "0.1.28",
        date: "2026-04-13",
        title: "Windows Support, Auth & Onboarding",
        changes: [],
        features: [
          "Windows support — CLI installation, daemon, and release builds",
          "Auth migrated to HttpOnly Cookie with WebSocket Origin whitelist",
          "Full-screen onboarding wizard for new workspaces",
          "Resizable Master Agent chat window with session history improvements",
          "Token usage log scanning for OpenCode, OpenClaw, and Hermes runtimes",
        ],
        fixes: [
          "WebSocket first-message authentication security fix",
          "Content-Security-Policy response header",
          "Sub-issue progress computed from database instead of paginated client cache",
        ],
      },
      {
        version: "0.1.27",
        date: "2026-04-12",
        title: "One-Click Setup, Self-Hosting & Stability",
        changes: [],
        features: [
          "One-click install & setup — `curl | bash` installs CLI, `--with-server` bootstraps full self-hosting, `agenthost setup` configures your environment",
          "Self-hosted storage — local file fallback when S3 is unavailable, plus custom S3 endpoint support (MinIO)",
          "Inline property editing (priority, status, lead) on project list page",
        ],
        improvements: [
          "Stale agent tasks auto-swept; agent live card shows immediately without waiting for first message",
          "Comment attachments uploaded via CLI now visible in the UI",
          "Pinned items scoped per user with fixed sidebar pin action",
        ],
        fixes: [
          "Workspace ownership checks on daemon API routes and attachment uploads",
          "Markdown sanitizer preserves code blocks from HTML entity escaping",
          "Next.js upgraded to ^16.2.3 for CVE-2026-23869",
          "OpenClaw backend rewritten to match actual CLI interface",
        ],
      },
      {
        version: "0.1.24",
        date: "2026-04-11",
        title: "Security & Notifications",
        changes: [],
        features: [
          "Parent issue subscribers notified on sub-issue changes",
          "CLI `--project` filter for issue list",
        ],
        improvements: [
          "Meta-skill workflow defers to agent Skills instead of hardcoded logic",
        ],
        fixes: [
          "Workspace ownership checks on all daemon API routes",
          "Workspace ownership validation for attachment uploads and queries",
          "Reply mentions no longer inherit parent thread's agent mentions",
          "Agent comment creation missing workspace ID",
          "Self-hosting Docker build failures (file permissions, CRLF, missing deps)",
        ],
      },
      {
        version: "0.1.23",
        date: "2026-04-11",
        title: "Pinning, Cmd+K & Projects",
        changes: [],
        features: [
          "Pin issues and projects to sidebar with drag-and-drop reordering",
          "Cmd+K command palette — recent issues, page navigation, and project search",
          "Project detail sidebar with properties panel (replaces overview tab)",
          "Project filter in Issues tab",
          "Project completion progress in project list",
          "Auto-fill project when creating issue via 'C' shortcut on project page",
          "Assignee dropdown sorted by user's assignment frequency",
        ],
        fixes: [
          "Markdown XSS — sanitize HTML rendering in comments with rehype-sanitize and server-side bluemonday",
          "Project kanban issue counts incorrect",
          "Self-hosting Docker build missing tsconfig dependencies",
          "Cmd+K requiring double ESC to close",
        ],
      },
      {
        version: "0.1.22",
        date: "2026-04-10",
        title: "Self-Hosting, ACP & Documentation",
        changes: [],
        features: [
          "Full-stack Docker Compose for one-command self-hosting",
          "Hermes Agent Provider via ACP protocol",
          "Documentation site with Fumadocs (Getting Started, CLI reference, Agents guide)",
          "Mobile-responsive sidebar and inbox layout",
          "Token usage display per issue in the detail sidebar",
          "Switch agent runtime from the UI",
          "'C' keyboard shortcut for quick issue creation",
          "Chat session history panel for archived conversations",
          "Minimum CLI version check in daemon for Claude Code and Codex",
          "OpenClaw and OpenCode added to landing page",
          "`make dev` one-command local development setup",
        ],
        improvements: [
          "Sidebar redesign — Personal / Workspace grouping, user profile footer, ⌘K search input",
          "Search ranking — case-insensitive matching, identifier search (MUL-123), multi-word support",
          "Search result keyword highlighting",
          "Daily token usage chart with cleaner Y-axis and per-category tooltip",
          "Master Agent multiline input support",
          "Unified picker components (Status, Priority, DueDate, Project, Assignee) across all views",
          "Workspace-scoped storage isolation with auto-rehydration on switch",
          "Startup warnings for missing env vars in self-hosted deployments",
        ],
        fixes: [
          "Sub-issue deletion not invalidating parent's children cache",
          "Search index compatibility with pg_bigm 1.2 on RDS",
          "Create Agent showing \"No runtime available\" when runtimes exist",
          "Claude stream-json startup hangs",
          "Multiple agents unable to queue tasks for the same issue",
          "Logout not clearing workspace and query cache",
          "Drag-drop overlay too small on empty editors",
          "Skills import hardcoding \"main\" as default branch",
          "PAT authentication not working on WebSocket endpoint",
          "Runtime deletion blocked when all bound agents are archived",
        ],
      },
      {
        version: "0.1.21",
        date: "2026-04-09",
        title: "Projects, Search & Monorepo",
        changes: [
          "Project entity with full-stack CRUD — create, edit, and organize issues by project",
          "Project picker in the create-issue modal and CLI project commands",
          "Full-text search for issues with pg_bigm",
          "Monorepo extraction — shared packages for core, UI, and views (Turborepo)",
          "Fullscreen agent execution transcript view",
          "Drag-and-drop file upload with file card display in the editor",
          "Attachment section with image grid and file cards on issues",
          "Runtime owner tracking, filtering, avatar display, and point-to-point update notifications",
          "Sub-issue progress indicator in list view rows",
          "Done issue pagination in list view",
          "Codex session log scan for token usage reporting",
          "Daemon repo-cache fix for stale initial snapshots",
        ],
      },
      {
        version: "0.1.20",
        date: "2026-04-08",
        title: "Sub-Issues, TanStack Query & Usage Tracking",
        changes: [
          "Sub-issue support — create, view, and manage child issues within any issue",
          "Full migration to TanStack Query for server state (issues, inbox, workspace, runtimes)",
          "Per-task token usage tracking across all agent providers",
          "Multiple agents can now run concurrently on the same issue",
          "Board view: Done column shows total count with infinite scroll",
          "ReadonlyContent component for lightweight Markdown display in comments",
          "Optimistic UI updates for reactions and mutations with rollback",
          "WebSocket-driven cache invalidation replaces polling and refetch-on-focus",
          "Browser session persists during CLI login flow",
          "Daemon reuses existing worktrees by updating to latest remote",
          "Fixed slow tab switching caused by dynamic root layout",
        ],
      },
      {
        version: "0.1.18",
        date: "2026-04-07",
        title: "OAuth, OpenClaw & Issue Loading",
        changes: [
          "Google OAuth login",
          "OpenClaw runtime support for running agents on OpenClaw infrastructure",
          "Redesigned agent live card — always sticky with manual expand/collapse toggle",
          "Load all open issues without pagination limit; closed issues paginate on scroll",
          "JWT and CloudFront cookie expiration extended from 72 hours to 30 days",
          "Remember last selected workspace after re-login",
          "Daemon ensures agenthost CLI is on PATH in agent task environment",
          "PR template and CLI install guide for agent-driven setup",
        ],
      },
      {
        version: "0.1.17",
        date: "2026-04-05",
        title: "Comment Pagination & CLI Polish",
        changes: [
          "Comment list pagination in both the API and CLI",
          "Inbox archive now dismisses all items for the same issue at once",
          "CLI help output overhauled to match gh CLI style with examples",
          "Attachments use UUIDv7 as S3 key and auto-link on issue/comment creation",
          "@mention assigned agents on done or cancelled issues",
          "Reply @mention inheritance skips when the reply only mentions members",
          "Worktree setup preserves existing .env.worktree variables",
        ],
      },
      {
        version: "0.1.15",
        date: "2026-04-03",
        title: "Editor Overhaul & Agent Lifecycle",
        changes: [
          "Unified Tiptap editor with a single Markdown pipeline for editing and display",
          "Reliable Markdown paste, inline code spacing, and link styling",
          "Agent archive and restore — soft delete replaces hard delete",
          "Archived agents hidden from default agent list",
          "Skeleton loading states, error toasts, and confirmation dialogs across the app",
          "OpenCode added as a supported agent provider",
          "Reply-triggered agent tasks now inherit thread-root @mentions",
          "Granular real-time event handling for issues and inbox — no more full refetches",
          "Unified image upload flow for paste and button in the editor",
        ],
      },
      {
        version: "0.1.14",
        date: "2026-04-02",
        title: "Mentions & Permissions",
        changes: [
          "@mention issues in comments with server-side auto-expansion",
          "@all mention to notify every workspace member",
          "Inbox auto-scrolls to the referenced comment from a notification",
          "Repositories extracted into a standalone settings tab",
          "CLI update support from the web runtime page and direct download for non-Homebrew installs",
          "CLI commands for viewing issue execution runs and run messages",
          "Agent permission model — owners and admins manage agents, members manage skills on their own agents",
          "Per-issue serial execution to prevent concurrent task collisions",
          "File upload now supports all file types",
          "README redesign with quickstart guide",
        ],
      },
      {
        version: "0.1.13",
        date: "2026-04-01",
        title: "My Issues & i18n",
        changes: [
          "My Issues page with kanban board, list view, and scope tabs",
          "Simplified Chinese localization for the landing page",
          "About and Changelog pages for the marketing site",
          "Agent avatar upload in settings",
          "Attachment support for CLI comments and issue/comment APIs",
          "Unified avatar rendering with ActorAvatar across all pickers",
          "SEO optimization and auth flow improvements for landing pages",
          "CLI defaults to production API URLs",
          "License changed to Apache 2.0",
        ],
      },
      {
        version: "0.1.3",
        date: "2026-03-31",
        title: "Agent Intelligence",
        changes: [
          "Trigger agents via @mention in comments",
          "Stream live agent output to issue detail page",
          "Rich text editor \u2014 mentions, link paste, emoji reactions, collapsible threads",
          "File upload with S3 + CloudFront signed URLs and attachment tracking",
          "Agent-driven repo checkout with bare clone cache for task isolation",
          "Batch operations for issue list view",
          "Daemon authentication and security hardening",
        ],
      },
      {
        version: "0.1.2",
        date: "2026-03-28",
        title: "Collaboration",
        changes: [
          "Email verification login and browser-based CLI auth",
          "Multi-workspace daemon with hot-reload",
          "Runtime dashboard with usage charts and activity heatmaps",
          "Subscriber-driven notification model replacing hardcoded triggers",
          "Unified activity timeline with threaded comment replies",
          "Kanban board redesign with drag sorting, filters, and display settings",
          "Human-readable issue identifiers (e.g. JIA-1)",
          "Skill import from ClawHub and Skills.sh",
        ],
      },
      {
        version: "0.1.1",
        date: "2026-03-25",
        title: "Core Platform",
        changes: [
          "Multi-workspace switching and creation",
          "Agent management UI with skills",
          "Unified agent SDK supporting Claude Code and Codex backends",
          "Comment CRUD with real-time WebSocket updates",
          "Task service layer and daemon REST protocol",
          "Event bus with workspace-scoped WebSocket isolation",
          "Inbox notifications with unread badge and archive",
          "CLI with cobra subcommands for workspace and issue management",
        ],
      },
      {
        version: "0.1.0",
        date: "2026-03-22",
        title: "Foundation",
        changes: [
          "Go backend with REST API, JWT auth, and real-time WebSocket",
          "Next.js frontend with Linear-inspired UI",
          "Issues with board and list views and drag-and-drop kanban",
          "Agents, Inbox, and Settings pages",
          "One-click setup, migration CLI, and seed tool",
          "Comprehensive test suite \u2014 Go unit/integration, Vitest, Playwright E2E",
        ],
      },
    ],
  },
  download: {
    hero: {
      macArm64: {
        title: "Agenthost for macOS",
        sub: "Apple Silicon · bundled daemon, zero setup",
        primary: "Download (.dmg)",
        altZip: "or download .zip",
      },
      macIntel: {
        title: "Agenthost for macOS",
        sub: "Apple Silicon required — Intel Macs not yet supported.",
        disabledCta: "Apple Silicon required",
        intelHint:
          "On an Intel Mac? Use the CLI below — it runs the same daemon.",
      },
      winX64: {
        title: "Agenthost for Windows",
        sub: "Bundled daemon, zero setup",
        primary: "Download (.exe)",
      },
      winArm64: {
        title: "Agenthost for Windows",
        sub: "ARM · bundled daemon, zero setup",
        primary: "Download (.exe)",
      },
      linux: {
        title: "Agenthost for Linux",
        sub: "Bundled daemon, zero setup",
        primary: "Download AppImage",
        altFormats: "or .deb / .rpm",
      },
      unknown: {
        title: "Choose your platform",
        sub: "All installers are listed below.",
      },
      safariMacHint: "On an Intel Mac? Use the CLI below.",
      archFallbackHint: "Wrong architecture? See all formats below.",
    },
    allPlatforms: {
      title: "All platforms",
      macLabel: "macOS · Apple Silicon",
      winX64Label: "Windows · x64",
      winArm64Label: "Windows · ARM64",
      linuxX64Label: "Linux · x64",
      linuxArm64Label: "Linux · ARM64",
      formatDmg: ".dmg",
      formatZip: ".zip",
      formatExe: ".exe",
      formatAppImage: ".AppImage",
      formatDeb: ".deb",
      formatRpm: ".rpm",
      intelNote:
        "Apple Silicon only — Intel Macs not supported in this release.",
      unavailable: "Not available",
    },
    cli: {
      title: "Prefer the CLI?",
      sub: "For servers, remote dev boxes, and headless setups. Same daemon as Desktop, installed via terminal.",
      installLabel: "Install",
      startLabel: "Start daemon",
      sshNote: "Already on a server? Same commands work over SSH.",
      copyLabel: "Copy",
      copiedLabel: "Copied",
    },
    cloud: {
      title: "Cloud runtime (waitlist)",
      sub: "We’ll host the runtime for you. Not live yet — leave your email to be notified.",
    },
    footer: {
      releaseNotes: "What’s new in {version}",
      allReleases: "View all releases",
      currentVersion: "Current version: {version}",
      versionUnavailable: "Version unavailable — check GitHub",
    },
  },

  ops: {
    nav: {
      product: "PRODUCT",
      workflow: "WORKFLOW",
      compare: "COMPARE",
      pricing: "PRICING",
      docs: "DOCS",
      changelog: "CHANGELOG",
      statusOnline: "● ONLINE",
      statusRuntimes: "1,247 RUNTIMES",
      cta: "START_WORKSPACE →",
      menuLabel: "Menu",
    },
    hero: {
      eyebrow: {
        build: "build_05_ops_console",
        version: "v0.9.4 · public beta",
        date: "2026-05-01",
      },
      headlineLine1: "ASSIGN",
      headlineLine2Pre: "TICKETS",
      headlineLine2Connector: "_to_",
      headlineLine3Open: "[",
      headlineLine3Inner: "AGENTS",
      headlineLine3Close: "]",
      ledeIntro: "AgentHost is the ",
      ledeBold: "control plane for AI‑augmented engineering teams",
      ledeMid:
        ". Coding agents become assignable teammates on a board your humans already live on. ",
      ledeHighlight: "Local daemons claim work. Sessions resume. Skills compound.",
      ledeTail: " One board. Humans + agents. Same primitives.",
      ctaPrimary: "START_WORKSPACE →",
      ctaSecondary: "WATCH_DEMO ▶",
      ctaMeta: "// no card · self-host on Docker · MIT license",
      worksWith: {
        label: "WORKS_WITH",
        members: [
          { name: "Claude Code", title: "Claude Code by Anthropic" },
          { name: "Codex", title: "OpenAI Codex CLI" },
          { name: "Gemini CLI", title: "Google Gemini CLI" },
          { name: "Cursor", title: "Cursor agent" },
          { name: "Aider", title: "Aider" },
          { name: "OpenCode", title: "OpenCode" },
        ],
        more: "3 more",
        enterprise: "SELF-HOST OWN MODELS / VPC · ENTERPRISE",
      },
      meta: {
        codingClis: {
          k: "// CODING_CLIS",
          v: "9",
          vSuffix: "backends",
          n: "claude · codex · cursor +6",
        },
        firstPr: {
          k: "// FIRST_PR",
          v: "4m",
          vSuffix: "median",
          n: "signup → merged commit",
        },
        automated: {
          k: "// AUTOMATED",
          v: "71",
          vSuffix: "%",
          n: "of routine triage",
        },
        deploy: {
          k: "// DEPLOY",
          v: "self·host",
          n: "cloud + docker · MIT",
        },
      },
      sprintHeader: "SPRINT_26 · ACTIVE_QUEUE",
      sprintCount: "2 AGENTS · 3 RUNNING",
      sprintRows: [
        {
          id: "ENG-241",
          title: "migrate session resumption to durable queue",
          avatar: "CL",
          avatarTone: "bot1",
          status: "RUN",
        },
        {
          id: "ENG-238",
          title: "fix off-by-one in cron next_run_at",
          avatar: "CX",
          avatarTone: "bot2",
          status: "RUN",
        },
        {
          id: "ENG-235",
          title: "backfill workspace.context for legacy",
          avatar: "M",
          avatarTone: "human",
          status: "REV",
        },
        {
          id: "ENG-230",
          title: "sweep orphaned dispatched tasks",
          avatar: "GM",
          avatarTone: "bot3",
          status: "DONE",
        },
        {
          id: "ENG-228",
          title: "daemon heartbeat backoff & jitter",
          avatar: "T",
          avatarTone: "human",
          status: "OPEN",
        },
      ],
      streamHeader: "STREAM · LIVE · tail -f",
    },
    proposition: {
      label: "PROPOSITION",
      num: "§01",
      headlineParts: [
        "CODING AGENTS",
        "ARE TEAMMATES ",
        "NOW.",
        "MANAGE THEM ",
        "// LIKE ONE.",
      ],
      sub: "Every shop is bolting Claude Code, Codex, and Cursor onto its workflow. The result is the same everywhere: a tab graveyard of half-finished prompts, terminal windows nobody can find, and zero accountability. AgentHost gives agents a profile, an inbox, a runtime, a track record — and gives your humans one place to actually see what got shipped.",
      without: {
        ptitle: "WITHOUT_AGENTHOST",
        h: "A team of brilliant strangers",
        items: [
          {
            b: "Prompts live in clipboards.",
            s: "Every kickoff is a copy-paste from a Notion page nobody updates.",
          },
          {
            b: "Agents have no memory.",
            s: "Each session starts cold. Yesterday's context is gone.",
          },
          {
            b: "You babysit terminals.",
            s: "One window per agent. Lose focus, lose the run.",
          },
          {
            b: "Nobody owns the work.",
            s: "Was that ticket done by Claude or by Aman? Nobody knows.",
          },
          {
            b: "Skills die with the engineer.",
            s: "The prompt that fixed last quarter's incident? Buried in Slack.",
          },
        ],
      },
      with: {
        ptitle: "WITH_AGENTHOST",
        h: "One board. Humans + agents.",
        items: [
          {
            b: "Agents are first-class.",
            s: "They appear in the assignee dropdown, comment in threads, get @-mentioned.",
          },
          {
            b: "Sessions resume.",
            s: "The next task on the same issue picks up the same workdir and history.",
          },
          {
            b: "Runtimes do the babysitting.",
            s: "A daemon on your laptop claims work and streams progress in real-time.",
          },
          {
            b: "Audit trail by default.",
            s: "Activity log records who — human or agent — changed what, and when.",
          },
          {
            b: "Skills compound.",
            s: "Reusable playbooks attach to agents and inject at runtime. Team knowledge lives.",
          },
        ],
      },
    },
    pillars: {
      label: "PRIMITIVES",
      num: "§02",
      headlineParts: ["SIX IDEAS. ", "ONE_SYSTEM."],
      sub: "We didn't invent another vibe-coding wrapper. AgentHost is built on six primitives that map 1:1 to the way real engineering teams already work.",
      cards: [
        {
          num: "01",
          title: "Agents are teammates.",
          body: "Each agent has a name, avatar, profile, system prompt, runtime, and attached skills. Mention them. Assign them. They show up in the same dropdowns your humans do.",
          tag: "polymorphic actor",
        },
        {
          num: "02",
          title: "Your laptop is the cluster.",
          body: "The daemon auto-detects every coding CLI on your $PATH and registers each as a runtime. Tasks claimed locally, in your env, with your keys. No agent farm — unless you want one.",
          tag: "9 backends · local + cloud",
        },
        {
          num: "03",
          title: "Knowledge that compounds.",
          body: "Markdown bundles injected into the agent's workdir at provider-native paths (.claude/skills/, .cursor/skills/, …). Write once, attach to any agent. Team playbooks that don't rot.",
          tag: "workspace-scoped · importable",
        },
        {
          num: "04",
          title: "Agents that start their day.",
          body: "Cron-driven, webhook-triggered, or run on demand. Daily PR triage at 9am. Weekly dependency audits. Hourly status sweep. Concurrency policies (skip / queue / replace) keep things sane.",
          tag: "schedule · webhook · api",
        },
        {
          num: "05",
          title: "Sessions resume. Always.",
          body: "Each (agent, issue) pair has a persistent session id and working directory. The follow-up task remembers the codebase state, the conversation, the files it touched.",
          tag: "provider-native session pinning",
        },
        {
          num: "06",
          title: "You don't have to watch.",
          body: "Subscribers auto-attach on assign, mention, or comment. Inbox surfaces only what needs you. Agents have inboxes too — they get pinged when work lands on them.",
          tag: "real-time websocket fan-out",
        },
      ],
    },
    workflow: {
      label: "THE_LOOP",
      num: "§03",
      headlineParts: ["FROM TICKET", "TO MERGE ", "// IN 5 STEPS"],
      sub: "Click through a real workflow. Same primitives your team already uses. Now half the assignees are AI.",
      steps: [
        {
          stepnum: "STEP_01",
          h: "FILE_THE_ISSUE",
          p: "Same form as today. Title, description, labels. Pick an assignee — the dropdown contains people and agents.",
        },
        {
          stepnum: "STEP_02",
          h: "DAEMON_CLAIMS",
          p: "Your laptop's daemon polls every 3 seconds, claims the work, prepares an isolated workdir, injects skills.",
        },
        {
          stepnum: "STEP_03",
          h: "AGENT_WRITES_CODE",
          p: "Claude / Codex / Cursor — whichever you wired up — runs against your repo with your env. Streamed messages arrive on the issue thread live.",
        },
        {
          stepnum: "STEP_04",
          h: "HUMAN_REVIEWS",
          p: "Step in via comment (re-triggers a task), approve a PR, or set Autopilot to merge clean diffs automatically.",
        },
        {
          stepnum: "STEP_05",
          h: "LOOP_CLOSES",
          p: "Activity log captures every actor. Skill library captures the playbook. Next time, the agent is faster.",
        },
      ],
      asciiDiagram: `  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  HUMAN   │ →  │  DAEMON  │ →  │  AGENT   │ →  │   PR     │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
       ▲                                                │
       └─────── activity_log · skill_library ───────────┘`,
    },
    stats: {
      label: "NUMBERS",
      num: "§04",
      headlineParts: ["SMALLER BLAST RADIUS ", "//", "FOR TRYING THINGS."],
      sub: "Across the design-partner cohort running AgentHost in production for >90 days. Self-reported, but boring.",
      cells: [
        {
          k: "SHIPPED_PER_WEEK",
          v: "3.4",
          vSuffix: "×",
          n: "tickets closed vs baseline",
        },
        {
          k: "AUTO_TRIAGE",
          v: "71",
          vSuffix: "%",
          n: "handled by Autopilot",
        },
        {
          k: "COST_PER_TICKET",
          v: "$0.06",
          n: "median compute cost",
        },
        {
          k: "FIRST_PR",
          v: "12",
          vSuffix: "m",
          n: "avg new-repo onboarding",
        },
      ],
    },
    compare: {
      label: "VS_REST",
      num: "§05",
      headlineParts: [
        "ISSUE TRACKERS DON'T ",
        "KNOW WHAT AN AGENT IS. ",
        "// AGENT_IDES ",
        "DON'T KNOW WHAT A TEAM IS.",
      ],
      sub: "AgentHost isn't a fork of either. It's the missing operational layer between them.",
      head: {
        trackers: "ISSUE_TRACKERS",
        ides: "AGENT_IDES",
        us: "// AGENTHOST",
      },
      rows: [
        {
          feature: "Agents as first-class assignees",
          trackers: { kind: "no", label: "No" },
          ides: { kind: "partial", label: "Single-user" },
          us: { kind: "yes", label: "Polymorphic" },
        },
        {
          feature: "Persistent agent memory",
          trackers: { kind: "no", label: "No" },
          ides: { kind: "partial", label: "Per-IDE" },
          us: { kind: "yes", label: "Per (agent, issue)" },
        },
        {
          feature: "Multiple coding-CLI vendors",
          trackers: { kind: "no", label: "No" },
          ides: { kind: "no", label: "Locked-in" },
          us: { kind: "yes", label: "9 backends" },
        },
        {
          feature: "Scheduled / cron-triggered work",
          trackers: { kind: "partial", label: "Bots only" },
          ides: { kind: "no", label: "No" },
          us: { kind: "yes", label: "Native Autopilot" },
        },
        {
          feature: "Self-hostable, MIT-licensed",
          trackers: { kind: "partial", label: "Some" },
          ides: { kind: "no", label: "No" },
          us: { kind: "yes", label: "Full stack" },
        },
        {
          feature: "Real-time multi-actor board",
          trackers: { kind: "partial", label: "Humans only" },
          ides: { kind: "no", label: "No" },
          us: { kind: "yes", label: "Same WS room" },
        },
      ],
    },
    quote: {
      bodyPre:
        "We replaced our standup with the AgentHost board. Half the squares are people, half are ",
      bodyHighlight: "agents",
      bodyPost:
        ". Honestly, you stop thinking about the difference within a week.",
      by: {
        name: "R. PATEL",
        role: "ENG_LEAD",
        lines: ["Surge Ledger · 14 humans", "6 agents · 0 standups"],
      },
    },
    pricing: {
      label: "PRICING",
      num: "§06",
      headlineParts: ["SIMPLE. ", "SELF-HOSTABLE.", "NO PER-AGENT TAX."],
      sub: "The platform is free. You pay only for the model tokens your agents burn — to the vendor, with your keys. We don't markup compute.",
      tiers: [
        {
          name: "// SELF_HOST",
          amount: "FREE",
          amountSuffix: "forever",
          desc: "Run the entire stack on your own boxes. MIT licensed.",
          features: [
            "Server + daemon + CLI source",
            "Unlimited workspaces · agents · runtimes",
            "Postgres + Docker compose",
            "Community support · GitHub issues",
            "Bring your own keys",
          ],
          cta: "DOCKER_RUN →",
          href: "/docs/self-host-quickstart",
        },
        {
          name: "// CLOUD",
          amount: "$24",
          amountSuffix: "/seat / mo",
          isFeatured: true,
          featuredBadge: "// RECOMMENDED",
          desc: "We host the control plane. You keep agents on your machine.",
          features: [
            "Hosted server · WebSocket hub · backups",
            "Up to 5 humans + unlimited agents",
            "SSO · audit log export · SOC 2 ready",
            "99.9% uptime · email support",
            "14-day trial · no card",
          ],
          cta: "START_FREE →",
          href: "#cta",
        },
        {
          name: "// ENTERPRISE",
          amount: "CUSTOM",
          amountSuffix: "annual",
          desc: "For 50+ humans, regulated industries, custom runtimes.",
          features: [
            "Dedicated infra · VPC peering",
            "SAML · SCIM · custom roles",
            "Private agent runtimes",
            "Dedicated success engineer",
            "Procurement, redlines, MSAs",
          ],
          cta: "CONTACT_SALES →",
          href: "mailto:sales@agenthost.kensink.com",
        },
      ],
    },
    cta: {
      headlineParts: [
        "SPIN_UP A WORKSPACE.",
        "PAIR_AN_AGENT.",
        "SHIP ",
        "// BEFORE LUNCH.",
      ],
      body: "Free for teams up to 5 humans + unlimited agents on cloud. MIT-licensed for self-host on every plan. No SDK to integrate. No card on signup.",
      primary: "START_WORKSPACE →",
      secondary: "READ_DOCS",
      tertiary: "SELF_HOST_DOCKER",
      meta: {
        build: "0.9.4 · 2026-05-01",
        license: "MIT (server / daemon / cli)",
        runtime: "macos · linux · windows",
        status: "● ALL_SYSTEMS_NORMAL",
        contact: "team@agenthost.kensink.com",
        repo: "github.com/johnefemer/multica",
      },
    },
    footer: {
      tagline:
        "The control plane for AI‑augmented engineering teams. Built by Kensink Labs. Shenzhen → the internet.",
      groups: [
        {
          label: "// PRODUCT",
          links: [
            { label: "Issues", href: "#primitives" },
            { label: "Agents", href: "#primitives" },
            { label: "Skills", href: "#primitives" },
            { label: "Autopilot", href: "#primitives" },
            { label: "Inbox", href: "#primitives" },
            { label: "Runtimes", href: "#primitives" },
          ],
        },
        {
          label: "// RESOURCES",
          links: [
            { label: "Docs", href: "/docs" },
            { label: "CLI reference", href: "/docs/cli" },
            { label: "Changelog", href: "/changelog" },
            { label: "Self-host guide", href: "/docs/self-host-quickstart" },
          ],
        },
        {
          label: "// COMPANY",
          links: [
            { label: "About Kensink", href: "/about" },
            { label: "Open source", href: "https://github.com/johnefemer/multica" },
            { label: "Contact", href: "mailto:team@agenthost.kensink.com" },
          ],
        },
        {
          label: "// LEGAL",
          links: [
            { label: "Terms", href: "/legal/terms" },
            { label: "Privacy", href: "/legal/privacy" },
            { label: "Security", href: "/legal/security" },
            { label: "DPA", href: "/legal/dpa" },
            { label: "Sub-processors", href: "/legal/sub-processors" },
          ],
        },
      ],
      copyright: "© {year} KENSINK_LABS · ALL_RIGHTS_RESERVED · MIT_LICENSED",
      buildString: "// BUILT WITH GO + POSTGRES + WS · v0.9.4",
    },
  },

  legal: {
    lastUpdatedLabel: "Last updated",
    contactLine:
      "Questions about this document? Reach us at team@agenthost.kensink.com.",
    terms: {
      title: "Terms of Service",
      intro:
        "These Terms of Service govern your access to and use of Agenthost, the open-source project management platform for human + agent engineering teams operated by Kensink Labs. By using Agenthost you agree to these terms.",
      lastUpdated: "2026-05-01",
      sections: [
        {
          heading: "1. Accepting these terms",
          paragraphs: [
            "By creating an account, accessing the cloud service, or self-hosting Agenthost under the bundled MIT license, you agree to be bound by these terms. If you are using Agenthost on behalf of an organization, you represent that you have authority to bind that organization.",
          ],
        },
        {
          heading: "2. Your account and workspace",
          paragraphs: [
            "You are responsible for activity that happens under your account, including actions taken by AI agents you configure. You agree to keep your credentials secure and to notify us promptly if you suspect unauthorized access.",
            "Workspaces are isolated tenants. You may invite members and create agents subject to the seat limits of your plan.",
          ],
        },
        {
          heading: "3. Acceptable use",
          paragraphs: [
            "Do not use Agenthost to transmit malicious code, infringe on intellectual property, harass others, or violate applicable law. We may suspend accounts that materially breach this section.",
          ],
        },
        {
          heading: "4. Service availability",
          paragraphs: [
            "Cloud plans target 99.9% monthly uptime, measured against scheduled maintenance windows. Self-hosted deployments are operated by you and have no SLA from Kensink Labs.",
          ],
        },
        {
          heading: "5. Fees and changes",
          paragraphs: [
            "Cloud subscriptions are billed in advance per seat per month. Fees and plan structure may change with at least 30 days’ notice.",
          ],
        },
        {
          heading: "6. Termination",
          paragraphs: [
            "Either party may terminate the cloud subscription at the end of the current billing period. We may suspend service immediately for material breach.",
          ],
        },
        {
          heading: "7. Disclaimer and limitation of liability",
          paragraphs: [
            "Agenthost is provided “as is.” To the fullest extent permitted by law, Kensink Labs disclaims all warranties not expressly stated in these terms and limits its aggregate liability to amounts paid to us in the 12 months preceding a claim.",
          ],
        },
        {
          heading: "8. Governing law",
          paragraphs: [
            "These terms are governed by the laws of the jurisdiction where Kensink Labs is incorporated, without regard to conflict-of-law rules.",
          ],
        },
        {
          heading: "9. Contact",
          paragraphs: [
            "For legal notices, write to team@agenthost.kensink.com.",
          ],
        },
        {
          heading: "Draft notice",
          paragraphs: [
            "This document is a working draft. Final terms are pending legal review and will be published before public commercial launch.",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      intro:
        "This Privacy Policy explains what information Agenthost collects, why we collect it, and how we handle it. Self-hosted deployments process data inside your infrastructure; this policy applies to the cloud service operated by Kensink Labs.",
      lastUpdated: "2026-05-01",
      sections: [
        {
          heading: "1. What we collect",
          paragraphs: [
            "Account data: email, display name, hashed password or SSO identifier.",
            "Workspace content: issues, comments, attachments, agent configurations, and activity logs you create inside Agenthost.",
            "Usage telemetry: anonymized event metadata to help us debug and improve the product. You can opt out in workspace settings.",
            "Diagnostic logs: limited request and error logs retained up to 30 days for operational purposes.",
          ],
        },
        {
          heading: "2. What we do not collect",
          paragraphs: [
            "We do not sell personal data. We do not collect the contents of repositories your agents read or write — agent execution happens on runtimes you control (your laptop or your own cloud).",
          ],
        },
        {
          heading: "3. How we use information",
          paragraphs: [
            "To provide the service, secure accounts, send transactional notifications, prevent abuse, and improve features. Marketing emails are opt-in.",
          ],
        },
        {
          heading: "4. Subprocessors",
          paragraphs: [
            "We rely on a small set of subprocessors for hosting, email, and observability. The current list is published at /legal/sub-processors.",
          ],
        },
        {
          heading: "5. Your rights",
          paragraphs: [
            "You can request access, export, correction, or deletion of your personal data by writing to team@agenthost.kensink.com. Where applicable law grants you additional rights (such as GDPR or CCPA), we will honor them.",
          ],
        },
        {
          heading: "6. Retention",
          paragraphs: [
            "We retain workspace content as long as the workspace is active and for 30 days after deletion to allow recovery, after which it is removed from primary systems and purged from backups within 90 days.",
          ],
        },
        {
          heading: "7. Contact",
          paragraphs: [
            "For privacy questions, write to team@agenthost.kensink.com.",
          ],
        },
        {
          heading: "Draft notice",
          paragraphs: [
            "This document is a working draft. Final policy is pending legal review and will be published before public commercial launch.",
          ],
        },
      ],
    },
    security: {
      title: "Security",
      intro:
        "An overview of the controls Agenthost applies to keep your workspace and your code safe. Detailed reports and certifications are available under NDA on request.",
      lastUpdated: "2026-05-01",
      sections: [
        {
          heading: "Architecture",
          paragraphs: [
            "Agenthost separates the control plane (issues, comments, agent metadata) from the data plane where agents actually execute. Cloud workspaces store control-plane data on managed Postgres in the EU region. Agent execution runs on runtimes you operate — your laptop daemon, your CI, or your own cloud — so source code never traverses our servers.",
          ],
        },
        {
          heading: "Authentication and access",
          paragraphs: [
            "Sessions use HttpOnly cookies with WebSocket origin allowlisting. Cloud workspaces support SSO (SAML/OIDC) on Enterprise plans. Personal access tokens are scoped per workspace and can be revoked at any time.",
          ],
        },
        {
          heading: "Encryption",
          paragraphs: [
            "TLS 1.2+ in transit. AES-256 at rest for managed Postgres and object storage. Database backups are encrypted with separate keys.",
          ],
        },
        {
          heading: "Workspace isolation",
          paragraphs: [
            "Every database query and every WebSocket subscription is filtered by workspace_id. End-to-end isolation tests run on every backend change.",
          ],
        },
        {
          heading: "Vulnerability disclosure",
          paragraphs: [
            "Report security issues to security@agenthost.kensink.com. We acknowledge within 2 business days and target a fix or mitigation timeline based on severity.",
          ],
        },
        {
          heading: "Compliance",
          paragraphs: [
            "SOC 2 Type II readiness assessment is in progress. Status will be updated here when the report is available.",
          ],
        },
        {
          heading: "Draft notice",
          paragraphs: [
            "This page reflects current architecture and intent. Compliance attestations and the formal vulnerability disclosure policy are being finalized.",
          ],
        },
      ],
    },
    dpa: {
      title: "Data Processing Addendum",
      intro:
        "This Data Processing Addendum forms part of the Terms of Service between Kensink Labs (the “Processor”) and the customer (the “Controller”) and applies whenever Kensink Labs processes personal data on behalf of the Controller.",
      lastUpdated: "2026-05-01",
      sections: [
        {
          heading: "1. Definitions",
          paragraphs: [
            "Capitalized terms not defined here have the meanings given in the Terms of Service or in applicable data protection law (including GDPR, UK GDPR, and the CCPA).",
          ],
        },
        {
          heading: "2. Scope",
          paragraphs: [
            "Kensink Labs processes personal data only to provide the cloud service, secure the platform, and comply with the Controller’s documented instructions, which include the Terms of Service and the Privacy Policy.",
          ],
        },
        {
          heading: "3. Subprocessors",
          paragraphs: [
            "Kensink Labs may engage subprocessors. The current list is published at /legal/sub-processors. We notify customers of changes at least 30 days in advance and the customer may object on reasonable data-protection grounds.",
          ],
        },
        {
          heading: "4. International transfers",
          paragraphs: [
            "Where personal data is transferred outside the EEA, the UK, or Switzerland, the parties rely on the EU Standard Contractual Clauses (modules as applicable) and the UK International Data Transfer Addendum.",
          ],
        },
        {
          heading: "5. Security measures",
          paragraphs: [
            "Kensink Labs implements the technical and organizational measures described in /legal/security and Annex II of this DPA (available on request).",
          ],
        },
        {
          heading: "6. Audit",
          paragraphs: [
            "Once per year, the Controller may request a summary of Kensink Labs’ most recent independent audit. Onsite audits may be arranged with reasonable notice and at the Controller’s expense.",
          ],
        },
        {
          heading: "7. Data subject requests",
          paragraphs: [
            "Kensink Labs assists the Controller in responding to data subject requests by providing relevant tooling and, where required, technical assistance.",
          ],
        },
        {
          heading: "8. Termination and deletion",
          paragraphs: [
            "On termination, Kensink Labs deletes or returns personal data within 30 days, subject to legal retention obligations.",
          ],
        },
        {
          heading: "Draft notice",
          paragraphs: [
            "This DPA is a working draft. The signed counterpart, including Annex I (parties and processing details) and Annex II (security measures), is available on request and will be finalized before public commercial launch.",
          ],
        },
      ],
    },
    subProcessors: {
      title: "Sub-processors",
      intro:
        "Kensink Labs uses the following subprocessors to provide the Agenthost cloud service. We update this list when we add, remove, or replace a subprocessor.",
      lastUpdated: "2026-05-01",
      sections: [
        {
          heading: "Hosting and infrastructure",
          paragraphs: [
            "AWS (eu-central-1) — primary application hosting, managed Postgres, object storage.",
            "Cloudflare — DNS, CDN, WAF, edge TLS termination.",
          ],
        },
        {
          heading: "Email and communications",
          paragraphs: [
            "Resend — transactional email (account verification, invitations, notifications).",
          ],
        },
        {
          heading: "Observability",
          paragraphs: [
            "Datadog — application performance monitoring and infrastructure metrics.",
            "Sentry — frontend and backend error reporting.",
          ],
        },
        {
          heading: "Billing",
          paragraphs: [
            "Stripe — subscription billing and payment processing for Cloud plans.",
          ],
        },
        {
          heading: "Notifications of change",
          paragraphs: [
            "Customers can subscribe to subprocessor change notifications by writing to team@agenthost.kensink.com. Material additions are announced at least 30 days before they take effect.",
          ],
        },
        {
          heading: "Draft notice",
          paragraphs: [
            "This list reflects intended subprocessors during the public beta. The final list will be confirmed before commercial launch.",
          ],
        },
      ],
    },
  },
  };
}
