import { describe, expect, it } from "vitest";
import type { Skill } from "../packages/agent-core/src/harness/types.js";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Model,
  type StreamFn,
} from "../packages/llm-core/src/index.js";
import { DEFAULT_MINIMAL_HEARTBEAT_PROMPT, MinimalAgentSystem } from "./minimal-system.js";

const TEST_MODEL: Model = {
  id: "test-model",
  name: "Test Model",
  api: "test-api",
  provider: "test-provider",
  baseUrl: "https://example.test",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32_000,
  maxTokens: 4_096,
};

function createAssistantMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: TEST_MODEL.api,
    provider: TEST_MODEL.provider,
    model: TEST_MODEL.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

const STATIC_STREAM_FN: StreamFn = async () => {
  const stream = createAssistantMessageEventStream();
  queueMicrotask(() => {
    stream.push({ type: "done", reason: "stop", message: createAssistantMessage("ok") });
  });
  return stream;
};

function expectLastUserText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  expect(Array.isArray(value)).toBe(true);
  const firstText = value.find(
    (
      item,
    ): item is {
      type: "text";
      text: string;
    } => typeof item === "object" && item !== null && "type" in item && "text" in item,
  );
  expect(firstText?.type).toBe("text");
  return firstText?.text ?? "";
}

describe("MinimalAgentSystem", () => {
  it("creates multiple agents and isolates multiple sessions", async () => {
    const system = new MinimalAgentSystem();
    const agent = system.createAgent({
      id: "writer",
      model: TEST_MODEL,
      systemPrompt: "Be helpful.",
      streamOptions: { maxRetries: 0 },
      streamFn: STATIC_STREAM_FN,
    });
    const secondAgent = system.createAgent({
      id: "ops",
      model: TEST_MODEL,
      systemPrompt: "Be concise.",
      streamOptions: { maxRetries: 0 },
      streamFn: STATIC_STREAM_FN,
    });

    const firstSession = await agent.createSession({ id: "session-a" });
    const secondSession = await agent.createSession({ id: "session-b" });
    const opsSession = await secondAgent.createSession({ id: "ops-session" });

    await firstSession.runTask("draft a summary");
    await secondSession.runTask("check the logs");
    await opsSession.runTask("heartbeat");

    const firstContext = await firstSession.buildContext();
    const secondContext = await secondSession.buildContext();
    const opsContext = await opsSession.buildContext();

    expect(system.listAgents().map((current) => current.id)).toEqual(["writer", "ops"]);
    expect(agent.listSessions().map((current) => current.id)).toEqual(["session-a", "session-b"]);
    expect(expectLastUserText(firstContext.messages[0]?.content)).toBe("draft a summary");
    expect(expectLastUserText(secondContext.messages[0]?.content)).toBe("check the logs");
    expect(expectLastUserText(opsContext.messages[0]?.content)).toBe("heartbeat");
  });

  it("updates existing sessions when registering a skill", async () => {
    const system = new MinimalAgentSystem();
    const agent = system.createAgent({
      id: "researcher",
      model: TEST_MODEL,
      systemPrompt: "Use skills when they help.",
      streamOptions: { maxRetries: 0 },
      streamFn: STATIC_STREAM_FN,
    });
    const session = await agent.createSession({ id: "research-session" });

    const skill: Skill = {
      name: "triage",
      description: "Handle quick triage work.",
      content: "Always start with the highest-signal issue.",
      filePath: "/skills/triage/SKILL.md",
    };

    await agent.registerSkill(skill);
    await session.runSkill("triage", "Focus on regressions.");

    const context = await session.buildContext();
    const skillInvocation = expectLastUserText(context.messages[0]?.content);

    expect(skillInvocation).toContain('<skill name="triage" location="/skills/triage/SKILL.md">');
    expect(skillInvocation).toContain("Always start with the highest-signal issue.");
    expect(skillInvocation).toContain("Focus on regressions.");
  });

  it("uses the default heartbeat prompt", async () => {
    const system = new MinimalAgentSystem();
    const agent = system.createAgent({
      id: "heartbeat-agent",
      model: TEST_MODEL,
      systemPrompt: "Stay aware.",
      streamOptions: { maxRetries: 0 },
      streamFn: STATIC_STREAM_FN,
    });
    const session = await agent.createSession({ id: "heartbeat-session" });

    await agent.runHeartbeat(session.id);

    const context = await session.buildContext();

    expect(expectLastUserText(context.messages[0]?.content)).toBe(DEFAULT_MINIMAL_HEARTBEAT_PROMPT);
  });
});
