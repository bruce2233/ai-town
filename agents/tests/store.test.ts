
import { createAgentStore, messageReceived, llmCompleted, toolCompleted, consumeEffects } from '../src/store.js';
import { AgentConfig, Message } from '../src/types.js';
import { ChatCompletionMessage } from 'openai/resources/chat/completions';

describe('Agent Store (Functional Logic)', () => {
    const config: AgentConfig = { name: 'TestBot', persona: 'Tester' };

    it('should initialize with IDLE status', () => {
        const store = createAgentStore(config);
        const state = store.getState();
        expect(state.status).toBe('IDLE');
        expect(state.id).toBe('TestBot');
    });

    it('should transition to THINKING and emit CALL_LLM when message received', () => {
        const store = createAgentStore(config);
        const msg: Message = { type: 'message', sender: 'User', content: 'Hello', topic: 'town_hall' };

        store.dispatch(messageReceived(msg));

        const state = store.getState();
        expect(state.status).toBe('THINKING');
        expect(state.effects).toHaveLength(1);
        expect(state.effects[0].type).toBe('CALL_LLM');
        // Verify system prompt is built
        const systemMsg = state.workingMemory.find(m => m.role === 'system');
        expect(systemMsg?.content).toContain('You are TestBot');
    });

    it('should emit EXECUTE_TOOL when LLM requests a tool', () => {
        const store = createAgentStore(config);
        // Manually set state to THINKING for test
        const msg: Message = { type: 'message', sender: 'User', content: 'Broadcast this', topic: 'town_hall' };
        store.dispatch(messageReceived(msg));
        store.dispatch(consumeEffects()); // Clear effects

        const toolMsg: ChatCompletionMessage = {
            role: 'assistant',
            content: null,
            tool_calls: [{
                id: 'call_123',
                type: 'function',
                function: { name: 'broadcast_message', arguments: '{"message":"Hello World"}' }
            }]
        };

        store.dispatch(llmCompleted(toolMsg));

        const state = store.getState();
        expect(state.status).toBe('EXECUTING_TOOL');
        expect(state.effects).toHaveLength(1);
        expect(state.effects[0].type).toBe('EXECUTE_TOOL');
        expect((state.effects[0] as any).toolCall.id).toBe('call_123'); // Cast to check internal prop
    });

    it('should loop back to THINKING after tool completion', () => {
        const store = createAgentStore(config);
        // Setup EXECUTING state
        const msg: Message = { type: 'message', sender: 'User', topic: 'town_hall' };
        store.dispatch(messageReceived(msg));

        // Mock LLM result triggering tool
        const toolMsg: ChatCompletionMessage = {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_123', type: 'function', function: { name: 'broadcast_message', arguments: '{}' } }]
        };
        store.dispatch(llmCompleted(toolMsg));
        store.dispatch(consumeEffects()); // Clear

        // Tool finishes
        store.dispatch(toolCompleted({ callId: 'call_123', result: 'Broadcast sent' }));

        const state = store.getState();
        expect(state.status).toBe('THINKING');
        expect(state.workingMemory.length).toBeGreaterThan(2); // System + User + Assistant + Tool
        expect(state.effects[0].type).toBe('CALL_LLM');
    });

    it('should go back to IDLE and PUBLISH when LLM replies with text', () => {
        const store = createAgentStore(config);
        store.dispatch(messageReceived({ type: 'message', sender: 'User', topic: 'town_hall' }));
        store.dispatch(consumeEffects());

        const replyMsg: ChatCompletionMessage = {
            role: 'assistant',
            content: 'I agree!',
            tool_calls: []
        };

        store.dispatch(llmCompleted(replyMsg));

        const state = store.getState();
        expect(state.status).toBe('IDLE');
        expect(state.workingMemory).toHaveLength(0);
        expect(state.effects).toHaveLength(1);
        expect(state.effects[0].type).toBe('PUBLISH');
        expect((state.effects[0] as any).content).toBe('I agree!');
    });
});
