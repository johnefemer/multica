import type { QuestionnaireAnswers } from "@multica/core/onboarding";
import type {
  ImportStarterContentPayload,
  ImportStarterIssuePayload,
} from "@multica/core/api";

// =============================================================================
// Starter content templates.
//
// Pure functions that turn the user's questionnaire answers into the request
// payload for POST /api/me/starter-content/import. No side effects, no API
// calls, no DOM — the only consumer is `StarterContentPrompt`, which passes
// the output straight to the server.
//
// Separation of concerns:
//   - Markdown/copy lives here (TypeScript, reviewed as UI)
//   - Batch creation + idempotency + assignee resolution lives in Go
//     (handler/onboarding.go → ImportStarterContent)
// =============================================================================

interface WelcomeIssueText {
  title: string;
  description: string;
}

// Prefix titles with 1. 2. 3. … AFTER the full list is assembled so
// conditional items (invite team / connect repo) don't break numbering.
function numberTitles(
  issues: ImportStarterIssuePayload[],
): ImportStarterIssuePayload[] {
  return issues.map((s, i) => ({ ...s, title: `${i + 1}. ${s.title}` }));
}

export function buildWelcomeIssueText(
  q: QuestionnaireAnswers,
  userName: string,
): WelcomeIssueText {
  const name = userName.trim() || "there";

  const header = [
    `Welcome to Agenthost! 👋`,
    ``,
    `This is the first issue in your workspace. In a moment, your agent will reply right below — that's the rhythm of Agenthost: you describe what you want, an agent (or a teammate) picks it up and answers in the comments.`,
    ``,
    `Everything else — projects, autopilots, chat — builds on this one loop.`,
    ``,
    `---`,
    ``,
  ].join("\n");

  const sharedInstructions = [
    `In your first reply, please:`,
    ``,
    `1. **Introduce yourself briefly** — your name, your role, what you're good at.`,
    `2. **Explain how we work together in Agenthost**:`,
    `   - You start work on an issue when **Assignee = you AND Status = Todo**. Backlog means "paused".`,
    `   - For quick questions, ${name} can @mention you inside any comment.`,
    `   - **Workspace Context** (Settings → General) is shared background you'll read before every task — it's the fastest way for ${name} to make your replies sharper.`,
    `3. **Point them at the *Getting Started* project** in the sidebar and invite ${name} to assign you a real task whenever they're ready.`,
    ``,
    `Keep it warm and under 200 words. End with one short question that gives ${name} an easy way to reply.`,
  ].join("\n");

  // Softer variant for users who said they're just exploring — no
  // pressure to "assign a real task", just pull them into a
  // low-stakes conversation.
  const exploreInstructions = [
    `In your first reply, please:`,
    ``,
    `1. **Introduce yourself briefly** — your name, your role, what you're good at.`,
    `2. **Explain how we work together in Agenthost**:`,
    `   - You start work on an issue when **Assignee = you AND Status = Todo**. Backlog means "paused".`,
    `   - For quick questions, ${name} can @mention you inside any comment.`,
    `   - **Workspace Context** (Settings → General) is shared background you'll read before every task.`,
    `3. **Point them at the *Getting Started* project** in the sidebar.`,
    ``,
    `Keep it warm and under 200 words. End with a small, curious question — something like "what's something you've been wondering about lately?" — so ${name} has an easy way to reply without having to come up with a real task yet.`,
  ].join("\n");

  switch (q.use_case) {
    case "coding":
      return {
        title: "👋 Welcome to Agenthost — let's work together",
        description: `${header}Hi agent, this is ${name}'s first time in Agenthost. They plan to use you mostly for **coding work**.\n\n${sharedInstructions}`,
      };
    case "planning":
      return {
        title: "👋 Welcome to Agenthost — let's work together",
        description: `${header}Hi agent, this is ${name}'s first time in Agenthost. They want your help with **planning and breaking down work**.\n\n${sharedInstructions}`,
      };
    case "writing_research":
      return {
        title: "👋 Welcome to Agenthost — let's work together",
        description: `${header}Hi agent, this is ${name}'s first time in Agenthost. They'll use you for **research and writing** — drafting, summarizing, analysis.\n\n${sharedInstructions}`,
      };
    case "explore":
      return {
        title: "👋 Welcome to Agenthost — let's work together",
        description: `${header}Hi agent, this is ${name}'s first time in Agenthost. They're **exploring** what Agenthost can do — no specific goal yet.\n\n${exploreInstructions}`,
      };
    case "other": {
      const customUseCase = (q.use_case_other ?? "").trim();
      const contextLine = customUseCase
        ? `They told us they want to use you for: "${customUseCase}".`
        : `They haven't narrowed down their use case yet.`;
      return {
        title: "👋 Welcome to Agenthost — let's work together",
        description: `${header}Hi agent, this is ${name}'s first time in Agenthost. ${contextLine}\n\n${sharedInstructions}`,
      };
    }
    default:
      return {
        title: "👋 Welcome to Agenthost — let's work together",
        description: `${header}Hi agent, this is ${name}'s first time in Agenthost.\n\n${sharedInstructions}`,
      };
  }
}

export function buildAgentGuidedSubIssues(
  q: QuestionnaireAnswers,
): ImportStarterIssuePayload[] {
  // --- Tier 1: Core must-learn (Todo / urgent) ------------------------------
  const tier1: ImportStarterIssuePayload[] = [
    {
      status: "todo",
      priority: "high",
      assign_to_self: true,
      title: "Learn the trigger model — how agents start working",
      description: [
        `**Why it matters**: Agenthost is intentionally explicit about *when* an agent starts. There's no auto-magic; you stay in control. Once you understand the trigger, every other workflow falls into place.`,
        ``,
        `**The rule**:`,
        ``,
        `> Assignee = your agent **AND** Status = Todo`,
        ``,
        `That combination — both at once — is what kicks off a run. Backlog means paused, even if assigned. In Progress / Done are the agent's own state transitions.`,
        ``,
        `**Try it now**:`,
        `1. Press \`C\` (or click **New Issue** in the sidebar)`,
        `2. Title: *Test run: summarize Agenthost in 3 bullets*`,
        `3. Right-side **Properties** panel → **Assignee** → pick your agent`,
        `4. **Status** → flip from Backlog to **Todo**`,
        `5. Watch the **Live card** appear at the top of the Activity section`,
        ``,
        `**Gotcha**: new issues default to **Backlog**. The first time you forget, a hint dialog will nudge you to flip it.`,
        ``,
        `**Done when**: the Live card shows the agent thinking, status auto-flips to **In Progress**, and a comment lands when it finishes.`,
      ].join("\n"),
    },
    {
      status: "todo",
      priority: "high",
      assign_to_self: true,
      title: "Talk to your agent without creating an issue",
      description: [
        `**Why it matters**: not every question deserves a tracked issue. The chat panel is for quick back-and-forth — "explain this snippet", "what's a good name for X" — without polluting your Issues list.`,
        ``,
        `**Where it lives**: bottom-right corner of the screen, the round button with a 💬 icon. It pulses while an agent is working and shows a red badge when there are unread replies.`,
        ``,
        `**Try it**:`,
        `1. Click 💬 → panel slides in from the right`,
        `2. Bottom-left of the input → click the agent avatar → pick an agent`,
        `3. Ask anything — *"What can you help me with in this workspace?"* is a fine first prompt`,
        `4. Press **Enter**`,
        ``,
        `**Bonus — @mention inside any comment**: type \`@\` in a comment box and a dropdown shows members, agents, and other issues. @mentioning an agent inside an issue is handy when you want a quick second opinion without reassigning.`,
        ``,
        `**Done when**: the agent replies in the chat panel within a few seconds.`,
      ].join("\n"),
    },
    {
      status: "todo",
      priority: "high",
      assign_to_self: true,
      title: "Write your Workspace Context (highest-leverage 5 minutes)",
      description: [
        `**Why it matters**: Workspace Context is a system prompt every agent in this workspace reads before *every* task. Spend five minutes here and every future agent reply gets sharper — without you re-explaining who you are.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Configure** group (bottom) → **Settings** ⚙️`,
        `2. Left tabs → under **[Your Workspace]** → **General**`,
        `3. Scroll to the **Context** textarea`,
        ``,
        `**A good 3–5 line context covers**:`,
        `- Who you are (name, role, team)`,
        `- What you're building or working on`,
        `- House style — tone, language, defaults you always want`,
        ``,
        `**Example**:`,
        `> I'm a frontend engineer working on an AI-native task manager. Reply concisely in English. Always explain your reasoning in one short paragraph before code. Prefer TypeScript over JavaScript.`,
        ``,
        `Click **Save**.`,
        ``,
        `**Done when**: the next task you assign picks up details from this context without you having to repeat yourself.`,
      ].join("\n"),
    },
  ];

  // --- Tier 2: Setup (Todo / medium) ----------------------------------------
  const tier2: ImportStarterIssuePayload[] = [];

  if (q.team_size === "team") {
    tier2.push({
      status: "todo",
      priority: "medium",
      assign_to_self: true,
      title: "Invite your teammates",
      description: [
        `**Why it matters**: shared agents are the point. The same agent that read your Workspace Context will pick up tasks from your teammates with the same understanding — no per-person setup.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Settings** ⚙️ (bottom)`,
        `2. Left tabs → under **[Your Workspace]** → **Members**`,
        `3. Top of the page → **Add member** → email + role (Owner / Admin / Member) → **Send invite**`,
        ``,
        `Pending invites show in a "Pending Invitations" section below the member list — revoke from there if you change your mind.`,
        ``,
        `**Roles in one line**:`,
        `- **Owner** — full control, including billing and workspace deletion`,
        `- **Admin** — manage members, settings, integrations`,
        `- **Member** — work on issues, create agents`,
      ].join("\n"),
    });
  }

  if (q.role === "developer" || q.use_case === "coding") {
    tier2.push({
      status: "todo",
      priority: "medium",
      assign_to_self: true,
      title: "Connect a Git repository",
      description: [
        `**Why it matters**: once a repo is registered, any agent in this workspace can clone it, read it, and propose changes when you assign a coding task. Without it, an agent only sees what you paste into the issue.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Settings** ⚙️`,
        `2. Left tabs → under **[Your Workspace]** → **Repositories**`,
        `3. Bottom of the list → **+ Add repository**`,
        `4. Fill the two fields:`,
        `   - **URL** — e.g. \`https://github.com/you/repo.git\``,
        `   - **Description** — what this repo is for (helps agents pick the right one when you have several)`,
        `5. **Save** at the top`,
        ``,
        `**Tip**: register every repo your agents might need to read. Agents only act on the one referenced in an issue, but having the full set available means you don't have to re-add later.`,
      ].join("\n"),
    });
  }

  tier2.push({
    status: "todo",
    priority: "medium",
    assign_to_self: true,
    title: "Create a second agent with a different role",
    description: [
      `**Why it matters**: a small team of focused agents beats one generalist. A coding agent with house style baked in, a planning agent that breaks loose ideas into scoped issues, a writing agent for docs — each kept sharp by its own Instructions.`,
      ``,
      `Nothing in Agenthost *enforces* the split — Instructions are just a system prompt, editable any time. The point is that a focused prompt produces focused output.`,
      ``,
      `**Where to find it**:`,
      `1. Sidebar → under **Workspace** group → **Agents** 🤖`,
      `2. Top-right of the left list → click **+**`,
      `3. Fill:`,
      `   - **Name** — e.g. *Planning Agent*`,
      `   - **Description** — *Breaks loose ideas into scoped issues*`,
      `   - **Visibility** — Workspace (shared) or Private (only you)`,
      `   - **Runtime** — pick the runtime to back this agent`,
      `4. **Create**`,
      ``,
      `**Done when**: the new agent shows up in the **Assignee** dropdown on any issue.`,
    ].join("\n"),
  });

  // --- Tier 3: Advanced, discover later (Backlog) ---------------------------
  const tier3: ImportStarterIssuePayload[] = [
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Polish your agent's Instructions",
      description: [
        `**Why it matters**: creating an agent gives you a blank slate. The **Instructions** tab is where it gets a personality and house rules. Workspace Context covers shared background; Instructions cover *this* agent's voice and defaults.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Agents** 🤖 → click an agent in the left list`,
        `2. Right panel → 6 tabs at the top: **Instructions / Skills / Tasks / Environment / Custom Args / Settings**`,
        `3. **Instructions** → markdown editor; changes save automatically`,
        ``,
        `**Good Instructions cover**:`,
        `- Role/persona — *"You're a senior TypeScript engineer pairing with a frontend lead"*`,
        `- House rules — *"Always propose tests alongside code"*, *"Push back if a request seems wrong"*`,
        `- Output shape — *"Lead with a one-paragraph summary, then code, then caveats"*`,
        ``,
        `Workspace Context and Instructions stack — both go to the model on every task. Keep Context about *the workspace*, keep Instructions about *this agent*.`,
      ].join("\n"),
    },
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Watch your agent work in real time",
      description: [
        `**Heads-up task** — nothing to do now, just know this exists for next time.`,
        ``,
        `When an agent is working on an issue, a **Live card** appears at the top of the **Activity** section and sticks to the viewport as you scroll. It shows, in real time:`,
        ``,
        `- Which tool the agent is calling (reading a file, web search, running a command)`,
        `- Streaming thoughts and partial output as the model produces them`,
        `- Current status (thinking / tool-running / waiting / done / failed)`,
        ``,
        `Below the Live card sits the **Task Run History** — every past run on this issue, oldest at the bottom. Click **View transcript** on any row for the full timeline: messages, thinking steps, tool calls, results.`,
        ``,
        `**Why it's useful**: the transcript is your debugger. When an agent reply is off, the transcript shows where the reasoning went wrong — usually a missing piece of context that you can then add to Workspace Context or Instructions.`,
      ].join("\n"),
    },
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Use the Inbox to keep up with @mentions and assignments",
      description: [
        `**Why it matters**: as your workspace grows, you can't watch every issue. The Inbox is where Agenthost surfaces only what touches you — assignments, @mentions, replies on issues you've subscribed to.`,
        ``,
        `**Where to find it**: sidebar top section (above **Workspace**) → **Inbox** 📥. An unread badge sits on the right when there's anything new.`,
        ``,
        `**How it works**:`,
        `- Left column: notifications, newest first`,
        `- Right column: the linked issue opens inline, scrolled to the exact comment that mentioned you`,
        `- Top-right menu: **Mark all as read / Archive all / Archive all read / Archive completed**`,
        ``,
        `**Tip**: *Archive completed* is the fastest way to clear noise — it drops anything tied to a closed issue in one click.`,
      ].join("\n"),
    },
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Set up an Autopilot for recurring work",
      description: [
        `**Why it matters**: anything you'd do "every Monday" or "every morning" — triage, digests, dependency checks — is a candidate for an Autopilot. It turns a prompt + a schedule into an issue that auto-creates and auto-assigns.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → under **Workspace** group → **Autopilot** ⚡`,
        `2. With no autopilots yet, you'll see 6 starter templates: *Daily news digest*, *PR review reminder*, *Bug triage*, *Weekly progress report*, *Dependency audit*, *Documentation check*`,
        `3. Click a template (or **+ New autopilot** for a blank one)`,
        `4. Fill: **Name** / **Prompt** / **Agent** / **Schedule** (frequency + time + timezone) → **Create**`,
        ``,
        `**Good first autopilots**:`,
        `- *Monday morning triage* — every Monday 9:00, list any issues still in Backlog older than a week and propose what to drop`,
        `- *Daily standup* — every weekday 9:30, summarize yesterday's closed issues + today's Todos`,
        `- *Weekly dependency check* — Sunday night, list outdated packages in your repos with risk notes`,
      ].join("\n"),
    },
  ];

  return numberTitles([...tier1, ...tier2, ...tier3]);
}

export function buildSelfServeSubIssues(
  q: QuestionnaireAnswers,
): ImportStarterIssuePayload[] {
  // --- Tier 1: Unlock agent ability (Todo / high) ---------------------------
  // Without a runtime + an agent, nothing else in Agenthost works. These two
  // are the gates — everything below them waits on them.
  const tier1: ImportStarterIssuePayload[] = [
    {
      status: "todo",
      priority: "high",
      assign_to_self: true,
      title: "Install the agenthost CLI (your first runtime)",
      description: [
        `**Why this first**: agenthost talks to AI tools (Claude Code, Codex, Cursor, Gemini) only through a **runtime** — a small background process running on your own machine. Without one connected, agents can't actually *do* anything; they exist on paper only.`,
        ``,
        `Running locally means your code, repos, and credentials stay on your machine. agenthost.pro only sees the orchestration metadata.`,
        ``,
        `**Install** (macOS, Linux, or Windows via WSL):`,
        ``,
        `\`\`\``,
        `curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink-v2/scripts/kensink-install.sh | bash`,
        `\`\`\``,
        ``,
        `Then sign in and start the daemon:`,
        ``,
        `\`\`\``,
        `agenthost setup self-host --server-url https://agenthost.pro`,
        `\`\`\``,
        ``,
        `The installer drops the \`agenthost\` binary into \`/usr/local/bin\` (or \`~/.local/bin\` if you can't write to /usr). \`agenthost setup\` walks you through signing in, picking which AI providers to register (each provider becomes its own runtime entry), and starting a background daemon. The daemon keeps running after you close the terminal — nothing to leave open.`,
        ``,
        `**Verify**: in the browser, sidebar → **Configure** group (bottom) → **Runtimes** → at least one entry should be marked **online**.`,
        ``,
        `**Add more providers later**: \`agenthost runtime add\` from any terminal.`,
      ].join("\n"),
    },
    {
      status: "todo",
      priority: "high",
      assign_to_self: true,
      title: "Create your first agent",
      description: [
        `**Prerequisite**: previous task done — at least one runtime showing **online**.`,
        ``,
        `**Why this matters**: an agent in Agenthost is just three things stitched together — an LLM, a system prompt (Instructions), and access to your workspace. Once it exists, you can assign issues to it, @mention it in comments, and chat with it.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → under **Workspace** group → **Agents** 🤖`,
        `2. Top-right of the left list → **+**`,
        `3. Fill:`,
        `   - **Name** — e.g. *My Coding Agent*`,
        `   - **Description** — one line about what it does`,
        `   - **Visibility** — Workspace (shared with teammates) or Private (only you)`,
        `   - **Runtime** — the one you connected in Task 1`,
        `4. **Create**`,
        ``,
        `**Note**: nothing locks a "Coding Agent" to coding. The Instructions tab is editable any time — same agent can do research, writing, or planning by changing the prompt. Keep it flexible while you experiment.`,
        ``,
        `**Done when**: the new agent appears in the **Assignee** dropdown on any issue.`,
      ].join("\n"),
    },
  ];

  // --- Tier 2: Core usage after unlock (Todo / medium) ----------------------
  const tier2: ImportStarterIssuePayload[] = [
    {
      status: "todo",
      priority: "medium",
      assign_to_self: true,
      title: "Assign your first real task to your agent",
      description: [
        `**Prerequisite**: runtime + agent from Tasks 1 and 2.`,
        ``,
        `**The trigger model — the one rule to remember**:`,
        ``,
        `> Assignee = your agent **AND** Status = Todo`,
        ``,
        `Both at once. Backlog means paused (even if assigned). This is intentionally explicit — agents never start work behind your back.`,
        ``,
        `**Try it now** with something you actually want done:`,
        `1. Press \`C\` (or **New Issue** in the sidebar)`,
        `2. Title: a real, small task — *"Draft a one-paragraph project README"*, *"Suggest a name for X"*, *"Summarize the last 3 commits"*`,
        `3. Right panel → **Assignee** → pick your agent`,
        `4. **Status** → flip from Backlog to **Todo**`,
        `5. Watch the **Live card** appear in the Activity section as the agent works`,
        ``,
        `**Gotcha**: new issues default to **Backlog**. You'll forget the first time and wonder why nothing happened — flip to **Todo**.`,
        ``,
        `**Done when**: the agent posts its reply in the comments and the issue auto-flips to **In Progress** while it works.`,
      ].join("\n"),
    },
    {
      status: "todo",
      priority: "medium",
      assign_to_self: true,
      title: "Write your Workspace Context (highest-leverage 5 minutes)",
      description: [
        `**Why it matters**: Workspace Context is a system prompt every agent reads before *every* task. Five minutes here and every future agent reply gets sharper — without you having to repeat who you are.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Configure** group (bottom) → **Settings** ⚙️`,
        `2. Left tabs → under **[Your Workspace]** → **General**`,
        `3. Scroll to the **Context** textarea`,
        ``,
        `**A good 3–5 line context covers**:`,
        `- Who you are (name, role, team)`,
        `- What you're building or working on`,
        `- House style — tone, language, defaults you always want`,
        ``,
        `Click **Save**.`,
        ``,
        `**Done when**: the next task you assign picks up details from this context without you re-explaining.`,
      ].join("\n"),
    },
  ];

  // --- Tier 3: Advanced, discover later (Backlog) ---------------------------
  const tier3: ImportStarterIssuePayload[] = [
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Chat with an agent for quick questions",
      description: [
        `**Prerequisite**: at least one agent (Tier 1 #2).`,
        ``,
        `**Why it matters**: not every question deserves a tracked issue. The chat panel is for quick back-and-forth without polluting your Issues list.`,
        ``,
        `**Where it lives**: bottom-right corner — round button with a 💬 icon.`,
        ``,
        `**Try it**:`,
        `1. Click 💬 → panel slides in from the right`,
        `2. Bottom-left of the input → pick an agent`,
        `3. Ask anything → **Enter**`,
        ``,
        `**Bonus**: inside any issue's comment box, type \`@\` to mention an agent or member. @mentioning an agent inside a comment is handy when you want a quick second opinion without reassigning the whole issue.`,
      ].join("\n"),
    },
  ];

  if (q.role === "developer" || q.use_case === "coding") {
    tier3.push({
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Connect a Git repository",
      description: [
        `**Why it matters**: once a repo is registered, any agent in this workspace can clone it, read it, and propose changes when you assign a coding task. Without it, an agent only sees what you paste into the issue body.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Settings** ⚙️`,
        `2. Left tabs → under **[Your Workspace]** → **Repositories**`,
        `3. Bottom of the list → **+ Add repository**`,
        `4. **URL** (e.g. \`https://github.com/you/repo.git\`) + **Description**`,
        `5. **Save** at the top`,
      ].join("\n"),
    });
  }

  if (q.team_size === "team") {
    tier3.push({
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Invite your teammates",
      description: [
        `**Why it matters**: shared agents are the point. The same agent that read your Workspace Context will pick up tasks from teammates with the same understanding — no per-person setup.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Settings** ⚙️ (bottom)`,
        `2. Left tabs → **Members**`,
        `3. **Add member** → email → role (Owner / Admin / Member) → **Send invite**`,
      ].join("\n"),
    });
  }

  tier3.push(
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Polish your agent's Instructions (once it exists)",
      description: [
        `**Prerequisite**: at least one agent.`,
        ``,
        `**Why it matters**: the **Instructions** tab is where an agent gets a personality and house rules. Workspace Context covers *shared* background; Instructions cover *this* agent's voice, defaults, and constraints.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → **Agents** 🤖 → click an agent`,
        `2. Right panel → 6 tabs: **Instructions / Skills / Tasks / Environment / Custom Args / Settings**`,
        `3. **Instructions** → markdown; saves automatically`,
        ``,
        `**Good Instructions cover** role, house rules, and output shape — keep it tight, 5–15 lines is plenty.`,
      ].join("\n"),
    },
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Watch an agent work in real time (next time you assign one)",
      description: [
        `**Heads-up task** — nothing to do now.`,
        ``,
        `When an agent is working on an issue, a **Live card** appears at the top of the **Activity** section and sticks to the viewport as you scroll. It shows, in real time, which tool the agent is using, streaming thoughts, and current status.`,
        ``,
        `After the run finishes, the **Task Run History** below the card lists every past run — click **View transcript** on any row for the full timeline of messages, thinking steps, tool calls, and results.`,
        ``,
        `**Why it's useful**: the transcript is your debugger. When a reply is off, the transcript shows *where* — usually a missing piece of context you can then add to Workspace Context or Instructions.`,
      ].join("\n"),
    },
    {
      status: "backlog",
      priority: "low",
      assign_to_self: true,
      title: "Set up an Autopilot for recurring work",
      description: [
        `**Prerequisite**: at least one agent.`,
        ``,
        `**Why it matters**: anything you'd do "every Monday" or "every morning" — triage, digests, dependency checks — is a candidate for an Autopilot. It turns a prompt + a schedule into an issue that auto-creates and auto-assigns to an agent.`,
        ``,
        `**Where to find it**:`,
        `1. Sidebar → under **Workspace** group → **Autopilot** ⚡`,
        `2. Pick one of 6 starter templates (*Daily news digest*, *PR review reminder*, *Bug triage*, *Weekly progress report*, *Dependency audit*, *Documentation check*) or **+ New autopilot** for a blank one`,
        `3. **Name** / **Prompt** / **Agent** / **Schedule** (frequency + time + timezone) → **Create**`,
      ].join("\n"),
    },
  );

  return numberTitles([...tier1, ...tier2, ...tier3]);
}

/**
 * Builds the full import payload. The client does NOT decide between the
 * agent-guided and self-serve branches — it always sends both sub-issue
 * arrays and a welcome-issue template (no agent_id). The SERVER picks
 * inside the import transaction based on whether any agent exists in
 * the workspace at that moment. See handler/onboarding.go.
 */
export function buildImportPayload({
  workspaceId,
  userName,
  questionnaire,
}: {
  workspaceId: string;
  userName: string;
  questionnaire: QuestionnaireAnswers;
}): ImportStarterContentPayload {
  const welcome = buildWelcomeIssueText(questionnaire, userName);
  return {
    workspace_id: workspaceId,
    project: {
      title: "Getting Started",
      description:
        "A few things to try in Agenthost. Work through them at your own pace.",
      icon: "👋",
    },
    welcome_issue_template: {
      title: welcome.title,
      description: welcome.description,
      priority: "high",
    },
    agent_guided_sub_issues: buildAgentGuidedSubIssues(questionnaire),
    self_serve_sub_issues: buildSelfServeSubIssues(questionnaire),
  };
}
