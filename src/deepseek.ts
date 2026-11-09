import { z } from "zod";
import type { Config } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export class DeepSeekClient {
  constructor(private readonly config: Config) {}

  async json<T>(messages: ChatMessage[], schema: z.ZodType<T>): Promise<T> {
    const message = await this.complete(messages, [], "none", true);
    const content = message.content?.trim();
    if (!content) throw new Error("DeepSeek returned an empty JSON response");
    return schema.parse(JSON.parse(content));
  }

  async complete(
    messages: ChatMessage[],
    tools: ToolDefinition[] = [],
    toolChoice: "auto" | "none" = "auto",
    json = false
  ): Promise<ChatMessage> {
    const response = await fetch(`${this.config.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.config.DEEPSEEK_MODEL,
        messages,
        ...(tools.length ? { tools, tool_choice: toolChoice } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
        thinking: { type: "disabled" },
        temperature: 0.1,
        max_tokens: 8192
      })
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 2000);
      throw new Error(`DeepSeek API ${response.status}: ${detail}`);
    }
    const payload = await response.json() as { choices?: Array<{ message: ChatMessage }> };
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error("DeepSeek response did not contain a message");
    return message;
  }
}

export type { ToolDefinition };
