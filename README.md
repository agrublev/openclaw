# 🦞 OpenClaw

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text-dark.svg">
        <img src="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/assets/openclaw-logo-text.svg" alt="OpenClaw" width="500">
    </picture>
</p>

<p align="center">
  <strong>Minimal agent runtime: agents, skills, tasks, sessions, tools, and heartbeat.</strong>
</p>

<p align="center">
  <a href="https://github.com/openclaw/openclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/openclaw/openclaw/ci.yml?branch=main&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/openclaw/openclaw/releases"><img src="https://img.shields.io/github/v/release/openclaw/openclaw?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

OpenClaw is the smallest useful system in this repo for building agents that can do work.

The core loop is:

1. create an agent
2. give it tools
3. register skills
4. open one or more sessions
5. send tasks into those sessions
6. run heartbeat turns for periodic follow-up

Everything else is optional.

[Docs](https://docs.openclaw.ai) · [Minimal system](https://docs.openclaw.ai/concepts/minimal-system) · [Vision](VISION.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Install

Runtime: **Node 24 (recommended) or Node 22.19+**.

```bash
npm install openclaw
```

## Minimal API

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

## Core primitives

### Agents

Each agent owns one model, one system prompt, one tool set, one skill set, and many sessions.

### Skills

Skills are `SKILL.md` instruction files or in-memory skill objects. Use them to teach an agent how to approach recurring work.

### Tasks

Tasks are prompts sent into a session.

### Sessions

Sessions isolate conversation history. One agent can have many sessions active at once.

### Tools

Tools are passed in when the agent is created.

### Heartbeat

Heartbeat is the built-in periodic follow-up turn. It lets an agent re-check work without introducing a larger scheduler.

## Docs by topic

- Minimal system: https://docs.openclaw.ai/concepts/minimal-system
- Sessions: https://docs.openclaw.ai/concepts/session
- Skills: https://docs.openclaw.ai/tools/skills
- Tools: https://docs.openclaw.ai/tools
- Heartbeat: https://docs.openclaw.ai/gateway/heartbeat

## From source

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
corepack pnpm install
pnpm build
```
