import WebSocket from 'ws';
import OpenAI from 'openai';
import { EventEmitter } from 'events';
import { ContextState, templateString } from './ContextState.js';

// Configuration
export const BROKER_URL = 'ws://localhost:8080';
export const LLM_API_URL = 'http://192.168.31.21:8082/v1';
export const LLM_API_KEY = 'dummy';
export const MODEL_NAME = 'Qwen/Qwen3-4B-Instruct';

export interface Message {
  type: string;
  topic?: string;
  payload?: any;
  sender?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: any) => Promise<string>;
}

export class Agent extends EventEmitter {
  private ws: WebSocket | null = null;
  private name: string;
  private persona: string;
  private openai: OpenAI;
  private subscriptions: Set<string> = new Set();
  private messageQueue: Message[] = [];
  private processing: boolean = false;
  private context: ContextState = new ContextState();
  private tools: Map<string, Tool> = new Map();

  private history: Message[] = [];

  constructor(name: string, persona: string) {
    super();
    this.name = name;
    this.persona = persona;
    this.openai = new OpenAI({
      baseURL: LLM_API_URL,
      apiKey: LLM_API_KEY,
      dangerouslyAllowBrowser: true,
    });

    // Initialize Context
    this.context.set('name', name);
    this.context.set('persona', persona);

    // Register default tools
    this.registerTool({
      name: 'broadcast_message',
      description: 'Broadcast a message to the town hall.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The message content' },
        },
        required: ['message'],
      },
      execute: async ({ message }) => {
        // Agents can't broadcast to town_hall anymore, so we redirect to admin
        this.publish('agent:admin:inbox', `[Broadcast Request]: ${message}`);
        return `Sent broadcast request to Admin: "${message}"`;
      },
    });
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  async connect() {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(BROKER_URL);

      this.ws.on('open', () => {
        console.log(`${this.name} connected to broker`);
        this.subscribe('town_hall'); // Listen to announcements
        this.subscribe(`agent:${this.name}:inbox`); // Listen to private messages

        // Start status heartbeat
        setInterval(() => {
          this.publish(
            'system:status',
            JSON.stringify({
              queueLength: this.messageQueue.length,
              processing: this.processing,
              subscriptions: Array.from(this.subscriptions),
              history: this.history.slice(-10), // Send last 10 messages
            }),
          );
        }, 5000);

        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg: Message = JSON.parse(data.toString());
          if (msg.type === 'message') {
            console.log(`${this.name} received:`, msg);
            this.messageQueue.push(msg);
            this.processQueue();
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      });

      this.ws.on('error', (err) => reject(err));
    });
  }

  subscribe(topic: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', topic }));
      this.subscriptions.add(topic);
    }
  }

  publish(topic: string, content: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'publish',
          topic,
          payload: { content, sender: this.name },
        }),
      );
    }
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        // Add to history
        this.history.push(msg);
        await this.run(msg);
      }
    }

    this.processing = false;
  }

  /**
   * Runs the agent's execution loop for a single message processing round.
   * Mimics SubAgentScope.runNonInteractive but adapted for event-driven message handling.
   */
  async run(msg: Message) {
    if (msg.sender === this.name) return;
    // Ignore status updates
    if (msg.topic === 'system:status') return;

    // Creator bypass
    if (this.name === 'Creator' && msg.topic === 'town:reify_character') {
      try {
        const { name, persona } = JSON.parse(msg.payload.content);
        console.log(`Creator received request to create ${name}`);
        const newAgent = new Agent(name, persona);
        newAgent.connect();
        this.publish(`agent:${msg.sender}:inbox`, `OK, created ${name}.`);
      } catch (e) {
        console.error('Failed to create agent:', e);
        this.publish(`agent:${msg.sender}:inbox`, `Failed to create agent.`);
      }
      return;
    }

    this.emit('start', { msg });

    const systemPromptTemplate = `You are \${name}. Persona: \${persona}.
        You are in AI Town. 
        Received message from "\${sender}" on topic "\${topic}": "\${content}"`;

    // Update context for this run
    this.context.set('sender', msg.sender);
    this.context.set('topic', msg.topic);
    this.context.set('content', typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));

    const systemPrompt = templateString(systemPromptTemplate, this.context);

    const toolsDefinition = Array.from(this.tools.values()).map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const currentMessages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'How do you respond? Use tools if necessary, or just reply with text.' },
    ];

    let turnCounter = 0;
    const MAX_TURNS = 5;

    try {
      while (turnCounter < MAX_TURNS) {
        turnCounter++;
        this.emit('round_start', { round: turnCounter });

        const completion = await this.openai.chat.completions.create({
          model: MODEL_NAME,
          messages: currentMessages,
          tools: toolsDefinition.length > 0 ? toolsDefinition : undefined,
        });

        const choice = completion.choices[0];
        const message = choice?.message;

        if (!message) break;

        // Add assistant message to history
        currentMessages.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
          this.emit('tool_call', { toolCalls: message.tool_calls });

          // Process tool calls
          const toolOutputs = await this.processFunctionCalls(message.tool_calls);

          // Add tool outputs to history
          currentMessages.push(...toolOutputs);
        } else if (message.content) {
          console.log(`${this.name} replying: ${message.content}`);
          this.emit('reply', { content: message.content });

          // Reply Logic (Side Effect)
          if (this.name === 'Geppetto' && msg.topic === 'town:create_character') {
            this.publish('town:reify_character', message.content);
          } else if (msg.topic === 'town_hall') {
            this.publish('agent:admin:inbox', `[Reply to Announcement]: ${message.content}`);
          } else if (msg.sender) {
            const targetTopic = `agent:${msg.sender}:inbox`;
            this.publish(targetTopic, message.content);
          }

          // We are done after a text reply
          break;
        } else {
          break;
        }
      }
    } catch (e) {
      console.error(`${this.name} failed to run:`, e);
      this.emit('error', { error: e });
    }
  }

  /**
   * Processes a list of function calls, executing each one and collecting their responses.
   * Mimics SubAgentScope.processFunctionCalls.
   */
  private async processFunctionCalls(toolCalls: any[]): Promise<any[]> {
    const results = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const tool = this.tools.get(toolName);

      let resultContent = '';

      if (tool) {
        console.log(`${this.name} executing tool ${tool.name}`);
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await tool.execute(args);
          console.log(`${this.name} tool result: ${result}`);
          resultContent = result;
          this.emit('tool_result', { name: toolName, result });
        } catch (e: any) {
          console.error(`${this.name} tool execution failed:`, e);
          resultContent = `Error: ${e.message}`;
          this.emit('tool_error', { name: toolName, error: e.message });
        }
      } else {
        resultContent = `Error: Tool ${toolName} not found`;
      }

      results.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: resultContent,
      });
    }

    return results;
  }
}
