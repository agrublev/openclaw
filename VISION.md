## OpenClaw Vision

OpenClaw should stay small so it remains easy to embed, understand, and extend.

The core product is only:

- agents
- skills
- tasks
- sessions
- tools
- heartbeat

Everything outside that loop is optional and should justify its existence.

Project overview and developer docs: [`README.md`](README.md)  
Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## What OpenClaw is

OpenClaw is an agent runtime for work.

You create an agent, give it tools and skills, open one or more sessions, and
send tasks into those sessions. Heartbeat is the built-in periodic follow-up
mechanism.

## What we optimize for

- Small surface area
- Clear ownership
- Good defaults
- Easy embedding
- Strong documentation

## What stays out of the core

These are not the center of the product:

- large orchestration layers
- default manager-of-managers patterns
- feature piles that duplicate skills or tools
- optional delivery surfaces presented as required core

They can exist, but they should stay outside the minimal runtime unless they
improve the core loop directly.

## Security

OpenClaw should stay powerful without hiding risk.

Canonical policy and reporting live in [`SECURITY.md`](SECURITY.md).

## Plugins

Plugins are still valid, but they are support structure around the minimal
runtime rather than the runtime itself.

If a capability can live outside the core loop, it should.

## Why TypeScript?

OpenClaw is orchestration code: prompts, tools, sessions, and runtime
boundaries. TypeScript keeps that surface easy to inspect, change, and extend.
Its static types also keep agent, session, skill, and tool interfaces explicit.
