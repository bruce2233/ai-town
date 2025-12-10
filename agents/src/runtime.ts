
import WebSocket from 'ws';
import OpenAI from 'openai';
import { AgentConfig, Effect } from './types.js'; // AgentState unused, store has it
import { createAgentStore, AppStore, messageReceived, llmCompleted, toolCompleted, errorOccurred, consumeEffects } from './store.js';

// Env Config
const BROKER_URL = process.env.BROKER_URL || 'ws://localhost:8080';
const LLM_API_URL = process.env.LLM_API_URL || 'http://192.168.31.21:8082/v1';
const LLM_API_KEY = process.env.LLM_API_KEY || 'dummy';
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen/Qwen3-4B-Instruct';

export class AgentRuntime {
    private store: AppStore;
    private ws: WebSocket | null = null;
    private openai: OpenAI;
    private running = false;
    private processingEffects = false;

    constructor(config: AgentConfig) {
        this.store = createAgentStore(config);
        this.openai = new OpenAI({
            baseURL: LLM_API_URL,
            apiKey: LLM_API_KEY,
        });
    }

    public async start() {
        this.running = true;
        this.connectWs();

        // Subscribe to Store Changes
        this.store.subscribe(() => {
            this.handleStoreUpdate();
        });

        // Heartbeat loop
        setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                const state = this.store.getState();
                this.dispatchEffect({
                    type: 'PUBLISH',
                    topic: 'system:status',
                    content: JSON.stringify({
                        id: state.id,
                        status: state.status,
                        queue: 0
                    })
                });
            }
        }, 5000);
    }

    private async handleStoreUpdate() {
        if (this.processingEffects) return;
        const state = this.store.getState();
        const effects = state.effects;

        if (effects.length > 0) {
            this.processingEffects = true;
            // Consume them from state immediately so we don't loop
            this.store.dispatch(consumeEffects());

            for (const effect of effects) {
                await this.dispatchEffect(effect);
            }
            this.processingEffects = false;
        }
    }

    private connectWs() {
        const id = this.store.getState().id;
        console.log(`[${id}] Connecting to ${BROKER_URL}...`);
        this.ws = new WebSocket(BROKER_URL);

        this.ws.on('open', () => {
            console.log(`[${id}] Connected.`);
            // Identification
            this.ws?.send(JSON.stringify({ type: 'identify', payload: { id } }));

            // Initial Subscriptions
            this.dispatchEffect({ type: 'SUBSCRIBE', topic: 'town_hall' });
            this.dispatchEffect({ type: 'SUBSCRIBE', topic: `agent:${id}:inbox` });
        });

        this.ws.on('message', (data) => {
            try {
                const str = data.toString();
                const msg = JSON.parse(str);
                if (msg.type === 'message') {
                    this.store.dispatch(messageReceived(msg));
                }
            } catch (e) {
                console.error('Failed to parse WS message', e);
            }
        });

        this.ws.on('error', (e) => console.error('WS Error:', e));
        this.ws.on('close', () => {
            console.log('WS Closed. Reconnecting in 3s...');
            setTimeout(() => this.connectWs(), 3000);
        });
    }

    private async dispatchEffect(effect: Effect) {
        const id = this.store.getState().id;
        console.log(`[${id}] Effect: ${effect.type}`);

        switch (effect.type) {
            case 'PUBLISH':
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'publish',
                        topic: effect.topic,
                        payload: { content: effect.content, sender: id }
                    }));
                }
                break;

            case 'SUBSCRIBE':
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ type: 'subscribe', topic: effect.topic }));
                }
                break;

            case 'LOG':
                console.log(`[${id}] LOG: ${effect.message}`);
                break;

            case 'CALL_LLM':
                try {
                    const completion = await this.openai.chat.completions.create({
                        model: MODEL_NAME,
                        messages: effect.messages,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        tools: effect.tools as any,
                    });
                    const msg = completion.choices[0]?.message;
                    if (msg) {
                        this.store.dispatch(llmCompleted(msg));
                    }
                } catch (e: any) {
                    console.error('LLM Failed', e);
                    this.store.dispatch(errorOccurred(e.message));
                }
                break;

            case 'EXECUTE_TOOL':
                try {
                    const args = JSON.parse(effect.toolCall.function.arguments);
                    const result = await effect.def.execute(args);
                    this.store.dispatch(toolCompleted({
                        callId: effect.toolCall.id,
                        result
                    }));
                } catch (e: any) {
                    console.error('Tool Exec Failed', e);
                    this.store.dispatch(toolCompleted({
                        callId: effect.toolCall.id,
                        result: `Error: ${e.message}`
                    }));
                }
                break;
        }
    }
}
