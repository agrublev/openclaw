import { randomUUID } from "node:crypto";
import process from "node:process";
import { CoreAgentHarness } from "../packages/agent-core/src/harness/agent-harness.js";
import { NodeExecutionEnv } from "../packages/agent-core/src/harness/env/nodejs.js";
import { InMemorySessionStorage } from "../packages/agent-core/src/harness/session/memory-storage.js";
import { Session } from "../packages/agent-core/src/harness/session/session.js";
import { loadSkills, type SkillDiagnostic } from "../packages/agent-core/src/harness/skills.js";
import type {
  AgentHarnessOptions,
  AgentHarnessStreamOptions,
  ExecutionEnv,
  SessionMetadata,
  Skill,
} from "../packages/agent-core/src/harness/types.js";
import type { AgentTool, ThinkingLevel } from "../packages/agent-core/src/types.js";
import type {
  AssistantMessage,
  ImageContent,
  Model,
  StreamFn,
} from "../packages/llm-core/src/index.js";
import { openClawAgentCoreRuntime } from "./agents/runtime/index.js";

export const DEFAULT_MINIMAL_HEARTBEAT_PROMPT =
  "Read HEARTBEAT.md if it exists in the workspace. Follow it strictly. If nothing needs attention, reply HEARTBEAT_OK.";

export interface MinimalSessionMetadata extends SessionMetadata {
  name?: string;
}

export interface MinimalSessionCreateOptions {
  id?: string;
  name?: string;
}

export interface MinimalAgentOptions<TTool extends AgentTool = AgentTool> {
  id?: string;
  model: Model;
  systemPrompt: AgentHarnessOptions<Skill, never, TTool>["systemPrompt"];
  tools?: TTool[];
  skills?: Skill[];
  env?: ExecutionEnv;
  cwd?: string;
  shellPath?: string;
  shellEnv?: NodeJS.ProcessEnv;
  getApiKeyAndHeaders?: AgentHarnessOptions<Skill, never, TTool>["getApiKeyAndHeaders"];
  runtime?: AgentHarnessOptions<Skill, never, TTool>["runtime"];
  streamFn?: StreamFn;
  streamOptions?: AgentHarnessStreamOptions;
  thinkingLevel?: ThinkingLevel;
  heartbeatPrompt?: string;
}

type MinimalHarness<TTool extends AgentTool> = CoreAgentHarness<Skill, never, TTool>;

export class MinimalAgentSession<TTool extends AgentTool = AgentTool> {
  readonly id: string;
  private readonly metadata: MinimalSessionMetadata;
  private readonly session: Session<MinimalSessionMetadata>;
  private readonly harness: MinimalHarness<TTool>;
  private readonly resolveHeartbeatPrompt: () => string;

  constructor(options: {
    metadata: MinimalSessionMetadata;
    session: Session<MinimalSessionMetadata>;
    harness: MinimalHarness<TTool>;
    resolveHeartbeatPrompt: () => string;
  }) {
    this.id = options.metadata.id;
    this.metadata = options.metadata;
    this.session = options.session;
    this.harness = options.harness;
    this.resolveHeartbeatPrompt = options.resolveHeartbeatPrompt;
  }

  get createdAt(): string {
    return this.metadata.createdAt;
  }

  get name(): string | undefined {
    return this.metadata.name;
  }

  async runTask(text: string, options?: { images?: ImageContent[] }): Promise<AssistantMessage> {
    return this.harness.prompt(text, options);
  }

  async runSkill(name: string, additionalInstructions?: string): Promise<AssistantMessage> {
    return this.harness.skill(name, additionalInstructions);
  }

  async heartbeat(prompt?: string): Promise<AssistantMessage> {
    return this.runTask(prompt ?? this.resolveHeartbeatPrompt());
  }

  async buildContext() {
    return this.session.buildContext();
  }

  async getEntries() {
    return this.session.getEntries();
  }

  async getSessionName(): Promise<string | undefined> {
    return this.session.getSessionName();
  }

  async setSkills(skills: Skill[]): Promise<void> {
    await this.harness.setResources({ skills });
  }
}

export class MinimalAgent<TTool extends AgentTool = AgentTool> {
  readonly id: string;
  private readonly env: ExecutionEnv;
  private readonly model: Model;
  private readonly systemPrompt: AgentHarnessOptions<Skill, never, TTool>["systemPrompt"];
  private readonly tools: TTool[];
  private readonly getApiKeyAndHeaders?: AgentHarnessOptions<
    Skill,
    never,
    TTool
  >["getApiKeyAndHeaders"];
  private readonly runtime?: AgentHarnessOptions<Skill, never, TTool>["runtime"];
  private readonly streamOptions?: AgentHarnessStreamOptions;
  private readonly thinkingLevel: ThinkingLevel;
  private heartbeatPrompt: string;
  private readonly sessions = new Map<string, MinimalAgentSession<TTool>>();
  private readonly skills = new Map<string, Skill>();

  constructor(options: MinimalAgentOptions<TTool>) {
    this.id = options.id?.trim() || randomUUID();
    this.env =
      options.env ??
      new NodeExecutionEnv({
        cwd: options.cwd ?? process.cwd(),
        shellEnv: options.shellEnv,
        shellPath: options.shellPath,
      });
    this.model = options.model;
    this.systemPrompt = options.systemPrompt;
    this.tools = options.tools?.slice() ?? [];
    this.getApiKeyAndHeaders = options.getApiKeyAndHeaders;
    this.runtime =
      options.runtime ??
      (options.streamFn
        ? {
            streamSimple: options.streamFn,
            completeSimple: async () => {
              throw new Error("completeSimple is not configured for this MinimalAgent");
            },
          }
        : openClawAgentCoreRuntime);
    this.streamOptions = options.streamOptions;
    this.thinkingLevel = options.thinkingLevel ?? "off";
    this.heartbeatPrompt = options.heartbeatPrompt?.trim() || DEFAULT_MINIMAL_HEARTBEAT_PROMPT;

    for (const skill of options.skills ?? []) {
      this.skills.set(skill.name, skill);
    }
  }

  listSkills(): Skill[] {
    return [...this.skills.values()];
  }

  listTools(): TTool[] {
    return this.tools.slice();
  }

  listSessions(): MinimalAgentSession<TTool>[] {
    return [...this.sessions.values()];
  }

  getSession(id: string): MinimalAgentSession<TTool> | undefined {
    return this.sessions.get(id);
  }

  removeSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  setHeartbeatPrompt(prompt: string): void {
    const trimmed = prompt.trim();
    this.heartbeatPrompt = trimmed || DEFAULT_MINIMAL_HEARTBEAT_PROMPT;
  }

  async createSession(
    options: MinimalSessionCreateOptions = {},
  ): Promise<MinimalAgentSession<TTool>> {
    const metadata: MinimalSessionMetadata = {
      id: options.id?.trim() || randomUUID(),
      createdAt: new Date().toISOString(),
      name: options.name?.trim() || undefined,
    };
    const session = new Session(
      new InMemorySessionStorage<MinimalSessionMetadata>({
        metadata,
      }),
    );
    if (metadata.name) {
      await session.appendSessionName(metadata.name);
    }
    const harness = new CoreAgentHarness<Skill, never, TTool>({
      env: this.env,
      session,
      tools: this.tools,
      resources: { skills: this.listSkills() },
      systemPrompt: this.systemPrompt,
      getApiKeyAndHeaders: this.getApiKeyAndHeaders,
      runtime: this.runtime,
      streamOptions: this.streamOptions,
      model: this.model,
      thinkingLevel: this.thinkingLevel,
    });
    const wrapped = new MinimalAgentSession<TTool>({
      metadata,
      session,
      harness,
      resolveHeartbeatPrompt: () => this.heartbeatPrompt,
    });
    this.sessions.set(metadata.id, wrapped);
    return wrapped;
  }

  async registerSkill(skill: Skill): Promise<void> {
    this.skills.set(skill.name, skill);
    await this.syncSkills();
  }

  async registerSkills(skills: Skill[]): Promise<void> {
    for (const skill of skills) {
      this.skills.set(skill.name, skill);
    }
    await this.syncSkills();
  }

  async loadSkillsFrom(...dirs: string[]): Promise<SkillDiagnostic[]> {
    const { skills, diagnostics } = await loadSkills(this.env, dirs);
    await this.registerSkills(skills);
    return diagnostics;
  }

  async runTask(
    sessionId: string,
    text: string,
    options?: { images?: ImageContent[] },
  ): Promise<AssistantMessage> {
    return this.requireSession(sessionId).runTask(text, options);
  }

  async runSkill(
    sessionId: string,
    name: string,
    additionalInstructions?: string,
  ): Promise<AssistantMessage> {
    return this.requireSession(sessionId).runSkill(name, additionalInstructions);
  }

  async runHeartbeat(sessionId: string, prompt?: string): Promise<AssistantMessage> {
    return this.requireSession(sessionId).heartbeat(prompt);
  }

  private requireSession(id: string): MinimalAgentSession<TTool> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Unknown session: ${id}`);
    }
    return session;
  }

  private async syncSkills(): Promise<void> {
    const skills = this.listSkills();
    for (const session of this.sessions.values()) {
      await session.setSkills(skills);
    }
  }
}

export class MinimalAgentSystem {
  private readonly agents = new Map<string, MinimalAgent>();

  createAgent<TTool extends AgentTool = AgentTool>(
    options: MinimalAgentOptions<TTool>,
  ): MinimalAgent<TTool> {
    const agent = new MinimalAgent(options);
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent already exists: ${agent.id}`);
    }
    this.agents.set(agent.id, agent as MinimalAgent);
    return agent;
  }

  getAgent<TTool extends AgentTool = AgentTool>(id: string): MinimalAgent<TTool> | undefined {
    return this.agents.get(id) as MinimalAgent<TTool> | undefined;
  }

  listAgents(): MinimalAgent[] {
    return [...this.agents.values()];
  }

  removeAgent(id: string): boolean {
    return this.agents.delete(id);
  }
}
