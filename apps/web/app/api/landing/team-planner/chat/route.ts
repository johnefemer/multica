import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  GENERATE_PLAN_TOOL,
  SUBMIT_CAPTURE_TOOL,
} from "@/lib/landing/team-planner/system-prompt";
import { executeCapture } from "@/lib/landing/team-planner/capture-service";
import type {
  ChatRequestBody,
  GeneratedPlan,
  PlannerChatMessage,
  StreamEvent,
} from "@/lib/landing/team-planner/types";

// Anthropic SDK uses Node primitives; can't run on Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 8192;
// Cap how many turns we accept on a single conversation. Hard ceiling against
// runaway context — PR 5 layers proper rate limiting on top of this.
const MAX_TURNS = 30;
// Cap tool-loop iterations within a SINGLE /chat request. Each iteration is
// one LLM call. Practical max in steady state: 1 (no tool) or 2 (one tool +
// the confirmation turn). 5 leaves slack for any nesting we don't anticipate.
const MAX_TOOL_LOOP = 5;

function isPlannerMessage(value: unknown): value is PlannerChatMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === "user" || v.role === "agent") && typeof v.text === "string"
  );
}

function validateBody(body: unknown): ChatRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) return null;
  if (b.messages.length === 0 || b.messages.length > MAX_TURNS) return null;
  if (!b.messages.every(isPlannerMessage)) return null;
  return { messages: b.messages as PlannerChatMessage[] };
}

function toAnthropicMessages(
  messages: PlannerChatMessage[],
): Anthropic.MessageParam[] {
  return messages.map((m) => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.text,
  }));
}

interface SubmitCaptureInput {
  primary_name: string;
  primary_email: string;
  cc_emails: string[];
}

function isSubmitCaptureInput(v: unknown): v is SubmitCaptureInput {
  if (!v || typeof v !== "object") return false;
  const x = v as Record<string, unknown>;
  return (
    typeof x.primary_name === "string" &&
    typeof x.primary_email === "string" &&
    Array.isArray(x.cc_emails) &&
    x.cc_emails.every((e) => typeof e === "string")
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const valid = validateBody(body);
  if (!valid) {
    return new Response(JSON.stringify({ error: "invalid body shape" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "planner not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic();
  // Keep growing across tool-result turns within one request.
  const messagesForApi: Anthropic.MessageParam[] = toAnthropicMessages(
    valid.messages,
  );

  // The full conversation history (incl. the seeded greeting) is what we
  // store on the planning_lead row when submit_capture fires.
  const fullConversation: PlannerChatMessage[] = valid.messages;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      // State that persists across tool-loop iterations within this request.
      let storedPlan: GeneratedPlan | null = null;
      let captureSubmitted = false;

      try {
        for (let i = 0; i < MAX_TOOL_LOOP; i++) {
          const anthropicStream = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            thinking: { type: "adaptive" },
            system: [
              {
                type: "text",
                text: SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: [GENERATE_PLAN_TOOL, SUBMIT_CAPTURE_TOOL],
            messages: messagesForApi,
          });

          for await (const event of anthropicStream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                send({
                  type: "tool_call_started",
                  name: event.content_block.name,
                });
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                send({ type: "delta", text: event.delta.text });
              }
              // input_json_delta blocks are intentionally not forwarded —
              // the assembled tool input arrives in finalMessage.
            }
          }

          const finalMessage = await anthropicStream.finalMessage();
          messagesForApi.push({
            role: "assistant",
            content: finalMessage.content,
          });

          if (finalMessage.stop_reason === "end_turn") {
            break;
          }
          if (finalMessage.stop_reason !== "tool_use") {
            break;
          }

          const toolUses = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0) break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            if (tu.name === "generate_plan") {
              const planData = tu.input as unknown as GeneratedPlan;
              storedPlan = planData;
              send({ type: "plan_ready", plan: planData });
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content:
                  "Plan generated and shown to the user. Now ask them for their name to start the email collection. Keep it warm and short.",
              });
            } else if (tu.name === "submit_capture") {
              if (!storedPlan) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content:
                    "Cannot submit_capture before generate_plan has been called.",
                  is_error: true,
                });
                continue;
              }
              if (captureSubmitted) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content:
                    "Capture has already been submitted in this conversation. Do not call again.",
                  is_error: true,
                });
                continue;
              }
              if (!isSubmitCaptureInput(tu.input)) {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content:
                    "submit_capture input was malformed. Re-collect the user's name and email and try again.",
                  is_error: true,
                });
                continue;
              }
              const input = tu.input;
              send({ type: "capture_started" });
              try {
                const result = await executeCapture({
                  primary_name: input.primary_name.trim(),
                  primary_email: input.primary_email.trim().toLowerCase(),
                  cc_emails: input.cc_emails
                    .map((e) => e.trim().toLowerCase())
                    .filter((e) => e.length > 0)
                    .slice(0, 3),
                  plan: storedPlan,
                  conversation: fullConversation,
                });
                captureSubmitted = true;
                send({
                  type: "capture_completed",
                  hash: result.hash,
                  plan_url: result.plan_url,
                  recipients_emailed: result.recipients_emailed,
                });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: `Email sent successfully. Private link: ${result.plan_url}. ${result.recipients_emailed} recipient(s) emailed. Confirm delivery to the user with one short, warm line that includes the URL inline so they can click it. Do not write a long monologue.`,
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : "unknown error";
                console.error("[planner/chat] executeCapture failed:", err);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: `Capture failed: ${msg}. Apologize briefly and ask the user to double-check the email or try again.`,
                  is_error: true,
                });
              }
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: `Unknown tool: ${tu.name}.`,
                is_error: true,
              });
            }
          }

          messagesForApi.push({ role: "user", content: toolResults });
          // Loop back for the next LLM call so the agent can react to the
          // tool result (e.g. send the confirmation message).
        }

        send({ type: "done" });
      } catch (err) {
        if (err instanceof Anthropic.APIError) {
          send({
            type: "error",
            message: err.message,
            status: err.status,
          });
        } else {
          send({
            type: "error",
            message:
              err instanceof Error ? err.message : "unknown planner error",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
