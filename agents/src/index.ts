import WebSocket from 'ws';
import OpenAI from 'openai';

// Configuration
const BROKER_URL = 'ws://localhost:8080';
const LLM_API_URL = 'http://192.168.31.21:8082/v1';
const LLM_API_KEY = 'dummy';
const MODEL_NAME = 'Qwen/Qwen3-4B-Instruct';

interface Message {
    type: string;
    topic?: string;
    payload?: any;
    sender?: string;
}

// --- Qwen Code Inspired Components ---

class ContextState {
    private state: Record<string, unknown> = {};

    get(key: string): unknown {
        return this.state[key];
    }

    set(key: string, value: unknown): void {
        this.state[key] = value;
    }
}

interface Tool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: any) => Promise<string>;
}

// --- Agent Implementation ---

class Agent {
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
        this.name = name;
        this.persona = persona;
        this.openai = new OpenAI({
            baseURL: LLM_API_URL,
            apiKey: LLM_API_KEY,
            dangerouslyAllowBrowser: true
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
                    message: { type: 'string', description: 'The message content' }
                },
                required: ['message']
            },
            execute: async ({ message }) => {
                // Agents can't broadcast to town_hall anymore, so we redirect to admin
                this.publish('agent:admin:inbox', `[Broadcast Request]: ${message}`);
                return `Sent broadcast request to Admin: "${message}"`;
            }
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
                    this.publish('system:status', JSON.stringify({
                        queueLength: this.messageQueue.length,
                        processing: this.processing,
                        subscriptions: Array.from(this.subscriptions),
                        history: this.history.slice(-10) // Send last 10 messages
                    }));
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
            this.ws.send(JSON.stringify({
                type: 'publish',
                topic,
                payload: { content, sender: this.name }
            }));
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
                await this.think(msg);
            }
        }

        this.processing = false;
    }

    async think(msg: Message) {
        if (msg.sender === this.name) return;
        // Ignore status updates
        if (msg.topic === 'system:status') return;

        const systemPrompt = `You are ${this.name}. Persona: ${this.persona}.
        You are in AI Town. 
        Received message from "${msg.sender}" on topic "${msg.topic}": "${JSON.stringify(msg.payload)}"`;

        const toolsDefinition = Array.from(this.tools.values()).map(t => ({
            type: 'function' as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));

        try {
            const completion = await this.openai.chat.completions.create({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: 'How do you respond? Use tools if necessary, or just reply with text.' }
                ],
                tools: toolsDefinition.length > 0 ? toolsDefinition : undefined,
            });

            const choice = completion.choices[0];
            const message = choice?.message;

            if (message?.tool_calls) {
                for (const toolCall of message.tool_calls) {
                    const tool = this.tools.get(toolCall.function.name);
                    if (tool) {
                        console.log(`${this.name} executing tool ${tool.name}`);
                        const args = JSON.parse(toolCall.function.arguments);
                        const result = await tool.execute(args);
                        console.log(`${this.name} tool result: ${result}`);
                        // In a real loop, we would feed this back to the LLM. 
                        // For now, we assume the tool action (publish) is sufficient.
                    }
                }
            } else if (message?.content) {
                console.log(`${this.name} replying: ${message.content}`);

                // Reply Logic:
                if (msg.topic === 'town_hall') {
                    // Reply to Admin
                    this.publish('agent:admin:inbox', `[Reply to Announcement]: ${message.content}`);
                } else if (msg.sender) {
                    // Reply to sender's inbox
                    const targetTopic = `agent:${msg.sender}:inbox`;
                    this.publish(targetTopic, message.content);
                }
            }
        } catch (e) {
            console.error(`${this.name} failed to think:`, e);
        }
    }
}

// Main execution
async function main() {
    const alice = new Agent("Alice", "A friendly resident who loves gardening. You are very chatty.");
    const bob = new Agent("Bob", "A grumpy neighbor who complains about noise. You are brief.");

    await alice.connect();
    await bob.connect();

    // Kick off interaction - Alice messages Bob directly
    setTimeout(() => {
        alice.publish('agent:Bob:inbox', 'Hi Bob! Did you see my new roses?');
    }, 2000);
}

main().catch(console.error);
