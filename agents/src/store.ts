
import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AgentState, AgentConfig, Message, Effect, ToolCall, AgentEvent } from './types.js'; // Ensure AgentEvent types are compatible or redeclared
import { TOOLS, getToolByName } from './tools.js';
import { ChatCompletionMessage, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Helper to build system prompt (same as before)
const SYSTEM_TEMPLATE = `You are \${name}. Persona: \${persona}.
You are in AI Town. 
Received message from "\${sender}" on topic "\${topic}": "\${content}"

INSTRUCTIONS:
- If you want to send a message to a specific topic, start your message with:
  >>> TO: <topic_name>
  followed by your message content.
- If you just want to reply to the current topic context, simply type your message.
`;

function buildSystemPrompt(config: AgentConfig, msg: Message): string {
    let p = SYSTEM_TEMPLATE.replace('\${name}', config.name).replace('\${persona}', config.persona);
    p = p.replace('\${sender}', msg.sender || 'unknown');
    p = p.replace('\${topic}', msg.topic || 'unknown');
    p = p.replace('\${content}', JSON.stringify(msg.payload || ''));
    return p;
}

const MAX_TURNS = 5;

const initialState: AgentState = {
    id: '',
    config: { name: '', persona: '' },
    status: 'IDLE',
    workingMemory: [],
    history: [],
    turnsInCurrentRequest: 0,
    effects: []
};

const agentSlice = createSlice({
    name: 'agent',
    initialState,
    reducers: {
        init: (state, action: PayloadAction<AgentConfig>) => {
            state.id = action.payload.name;
            state.config = action.payload;
            state.status = 'IDLE';
            state.effects = [];
        },
        messageReceived: (state, action: PayloadAction<Message>) => {
            const message = action.payload;
            if (state.status !== 'IDLE') {
                state.effects.push({ type: 'LOG', message: `[Warn] Busy. Dropped: ${message.topic}` });
                return;
            }
            if (message.sender === state.id) return;
            // Ignore status
            if (message.topic === 'system:status') return;

            // Start Thinking
            state.status = 'THINKING';
            state.turnsInCurrentRequest = 0;
            const sysPrompt = buildSystemPrompt(state.config, message);
            state.workingMemory = [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: 'How do you respond?' }
            ];

            state.effects.push({ type: 'CALL_LLM', messages: state.workingMemory, tools: TOOLS });
        },
        llmCompleted: (state, action: PayloadAction<ChatCompletionMessage>) => {
            if (state.status !== 'THINKING') return;

            const response = action.payload;
            state.workingMemory.push(response);

            if (response.tool_calls && response.tool_calls.length > 0) {
                const toolCall = response.tool_calls[0];
                const toolDef = getToolByName(toolCall.function.name);

                if (toolDef) {
                    state.status = 'EXECUTING_TOOL';
                    state.effects.push({
                        type: 'EXECUTE_TOOL',
                        toolCall: { id: toolCall.id, function: toolCall.function },
                        def: toolDef
                    });
                } else {
                    // Error handling for missing tool
                    state.workingMemory.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Error: Tool not found' });
                    state.effects.push({ type: 'CALL_LLM', messages: state.workingMemory, tools: TOOLS });
                }
            } else {
                // Text Reply
                const content = response.content || '';
                if (content) {
                    const firstMsgContent = state.workingMemory?.[0]?.content;
                    const isSenderAdmin = typeof firstMsgContent === 'string' && firstMsgContent.includes('sender');
                    let topic = `agent:${isSenderAdmin ? 'admin' : 'unknown'}:inbox`;

                    if (content.includes('>>> TO:')) {
                        const match = content.match(/>>> TO: (\S+)/);
                        if (match) topic = match[1];
                    }

                    state.effects.push({ type: 'PUBLISH', topic, content });
                }
                state.status = 'IDLE';
                state.workingMemory = [];
            }
        },
        toolCompleted: (state, action: PayloadAction<{ callId: string, result: string }>) => {
            if (state.status !== 'EXECUTING_TOOL') return;
            const { callId, result } = action.payload;

            state.workingMemory.push({ role: 'tool', tool_call_id: callId, content: result });
            state.turnsInCurrentRequest++;

            if (state.turnsInCurrentRequest >= MAX_TURNS) {
                state.effects.push({ type: 'LOG', message: 'Max turns reached' });
                state.status = 'IDLE';
            } else {
                state.status = 'THINKING';
                state.effects.push({ type: 'CALL_LLM', messages: state.workingMemory, tools: TOOLS });
            }
        },
        errorOccurred: (state, action: PayloadAction<string>) => {
            state.effects.push({ type: 'LOG', message: `Error: ${action.payload}` });
            state.status = 'IDLE';
        },
        consumeEffects: (state) => {
            // Clear the effects queue
            state.effects = [];
        }
    }
});

export const { init, messageReceived, llmCompleted, toolCompleted, errorOccurred, consumeEffects } = agentSlice.actions;

export const createAgentStore = (config: AgentConfig) => {
    const store = configureStore({
        reducer: agentSlice.reducer,
        preloadedState: {
            ...initialState,
            id: config.name,
            config: config
        }
    });
    return store;
};

export type AppStore = ReturnType<typeof createAgentStore>;
export type RootState = ReturnType<AppStore['getState']>;
