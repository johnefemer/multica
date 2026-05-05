import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_PROMPT,
  GENERATE_PLAN_TOOL,
} from "@/lib/landing/team-planner/system-prompt";
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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "invalid json" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const valid = validateBody(body);
  if (!valid) {
    return new Response(
      JSON.stringify({ error: "invalid body shape" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "planner not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = new Anthropic();
  const messages = toAnthropicMessages(valid.messages);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
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
          tools: [GENERATE_PLAN_TOOL],
          messages,
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
            // input_json_delta blocks are intentionally not forwarded — the
            // assembled tool input arrives in the final message below.
          }
        }

        const finalMessage = await anthropicStream.finalMessage();

        const toolUseBlock = finalMessage.content.find(
          (b): b is Anthropic.ToolUseBlock =>
            b.type === "tool_use" && b.name === "generate_plan",
        );

        if (toolUseBlock) {
          // The tool's strict schema means input matches GeneratedPlan shape.
          send({
            type: "plan_ready",
            plan: toolUseBlock.input as unknown as GeneratedPlan,
          });
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
