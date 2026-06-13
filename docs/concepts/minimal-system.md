---
summary: "Build the smallest OpenClaw setup: agents, skills, tasks, sessions, tools, and heartbeat."
read_when:
  - You want the bare minimum OpenClaw runtime
  - You want to embed OpenClaw as a small agent system
title: "Minimal system"
---

OpenClaw provides a minimal agent runtime for building agents with skills, tools, sessions, and heartbeat.

The minimal product shape is:

- create an agent
- give it tools
- register skills
- open one or more sessions
- send tasks into those sessions
- trigger heartbeat turns when you want periodic follow-up

Everything else is optional.

## Core objects

| Object                | Owns                                           |
| --------------------- | ---------------------------------------------- |
| `MinimalAgentSystem`  | the list of agents                             |
| `MinimalAgent`        | one agent's model, tools, skills, and sessions |
| `MinimalAgentSession` | one conversation history for one agent         |

## Quick start

```ts
import { MinimalAgentSystem } from "openclaw/minimal";

const system = new MinimalAgentSystem();

const agent = system.createAgent({
  id: "main",
  model: {
    id: "gpt-5.4-mini",
    name: "GPT-5.4 mini",
    api: "responses",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
  systemPrompt: "You are a focused software agent.",
  tools: [],
});

await agent.registerSkill({
  name: "triage",
  description: "Handle quick triage work.",
  content: "Start with the highest-signal issue.",
  filePath: "/skills/triage/SKILL.md",
});

const session = await agent.createSession({ id: "default" });

await session.runTask("Review today's tasks.");
await session.runSkill("triage", "Focus on regressions.");
await session.heartbeat();
```

## Skills

Use either:

- `agent.registerSkill(...)` for one in-memory skill
- `agent.loadSkillsFrom("/absolute/path/to/skills")` to load `SKILL.md` files

See [Skills](/tools/skills).

## Sessions

Each agent can own many sessions.

- Create one with `agent.createSession()`
- List them with `agent.listSessions()`
- Reuse a specific one with `agent.getSession(id)`

See [Session management](/concepts/session).

## Tasks

For the minimal system, a task is just a prompt sent into a session.

- `session.runTask(...)`
- `agent.runTask(sessionId, ...)`

This keeps the runtime small: one agent, one session transcript, one task at a time unless you choose otherwise.

## Tools

Tools are attached when the agent is created.

```ts
const agent = system.createAgent({
  model,
  systemPrompt,
  tools: [readTool, writeTool, bashTool],
});
```

See [Tools](/tools).

## Heartbeat

Heartbeat is the smallest periodic automation surface in OpenClaw.

- `session.heartbeat()` sends the default heartbeat prompt
- `agent.runHeartbeat(sessionId)` does the same through the agent
- `agent.setHeartbeatPrompt(...)` replaces the default prompt

See [Heartbeat](/gateway/heartbeat).

## What stays out of the minimal system

The minimal system does not require channels, apps, dashboards, cron flows, or plugin orchestration.

Add those only when the core loop is no longer enough.

## Related

- [Agent runtime](/concepts/agent)
- [Session management](/concepts/session)
- [Skills](/tools/skills)
- [Heartbeat](/gateway/heartbeat)
