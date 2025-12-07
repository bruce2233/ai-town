import { Broker } from '../src/Broker';
import WebSocket from 'ws';
import { setupAnalyst } from '../src/services';

describe('Analyst Dialogue & Feedback', () => {
    let broker: Broker;
    const PORT = 8082; // Dedicated test port

    beforeAll(() => {
        // Suppress logs during tests
        // jest.spyOn(console, 'log').mockImplementation(() => { });
        // jest.spyOn(console, 'warn').mockImplementation(() => { });
        // jest.spyOn(console, 'error').mockImplementation(() => { });
        broker = new Broker(PORT);
        setupAnalyst(broker);
        broker.start();
    });

    afterAll(async () => {
        await broker.stop();
        await new Promise(resolve => setTimeout(resolve, 500));
        jest.restoreAllMocks();
    });

    test('should send error feedback for malformed directive', (done) => {
        const agent = new WebSocket(`ws://localhost:${PORT}`);
        let agentId = '';

        agent.on('message', (data) => {
            const msg = JSON.parse(data.toString());

            // Capture assigned ID
            if (msg.type === 'system' && msg.payload.message === 'Connected to AI Town Broker') {
                agentId = msg.payload.id;
                // Create private inbox topic first
                agent.send(JSON.stringify({ type: 'create_topic', payload: { name: `agent:${agentId}:inbox`, type: 'private' } }));
                return;
            }

            if (msg.type === 'system' && msg.payload.status === 'topic_created') {
                // Subscribe to private inbox
                agent.send(JSON.stringify({ type: 'subscribe', topic: `agent:${agentId}:inbox` }));
                return;
            }

            if (msg.type === 'system' && msg.payload.status === 'subscribed') {
                // Send malformed message
                agent.send(JSON.stringify({
                    type: 'publish',
                    topic: 'town_hall',
                    payload: { content: '>>> TO: ' } // Missing topic
                }));
            }

            if (msg.type === 'message' && msg.topic === `agent:${agentId}:inbox`) {
                // Check if we got the error feedback
                if (msg.payload.content.includes('[System Error]: Invalid syntax')) {
                    agent.close();
                    done();
                }
            }
        });
    });

    test('should send error feedback for empty content', (done) => {
        const agent = new WebSocket(`ws://localhost:${PORT}`);
        let agentId = '';

        agent.on('message', (data) => {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'system' && msg.payload.message === 'Connected to AI Town Broker') {
                agentId = msg.payload.id;
                agent.send(JSON.stringify({ type: 'create_topic', payload: { name: `agent:${agentId}:inbox`, type: 'private' } }));
                return;
            }

            if (msg.type === 'system' && msg.payload.status === 'topic_created') {
                agent.send(JSON.stringify({ type: 'subscribe', topic: `agent:${agentId}:inbox` }));
                return;
            }

            if (msg.type === 'system' && msg.payload.status === 'subscribed') {
                agent.send(JSON.stringify({
                    type: 'publish',
                    topic: 'town_hall',
                    payload: { content: '>>> TO: target_topic   ' } // Content after trim is empty
                }));
            }

            if (msg.type === 'message' && msg.payload.content.includes('message content was empty')) {
                agent.close();
                done();
            }
        });
    });

    test('should successfully forward valid message', (done) => {
        const agent = new WebSocket(`ws://localhost:${PORT}`);
        const receiver = new WebSocket(`ws://localhost:${PORT}`);
        const TARGET_TOPIC = 'dialogue_target';
        let agentId = '';

        let receiverReady = false;
        let agentConnected = false;

        receiver.on('open', () => {
            receiver.send(JSON.stringify({ type: 'create_topic', payload: { name: TARGET_TOPIC, type: 'public' } }));
        });

        receiver.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.status === 'topic_created') {
                receiver.send(JSON.stringify({ type: 'subscribe', topic: TARGET_TOPIC }));
            }
            if (msg.type === 'system' && msg.payload.status === 'subscribed') {
                receiverReady = true;
                maybeSend();
            }
            if (msg.type === 'message' && msg.payload.content === 'Valid Message') {
                // console.log('[TEST] Success valid message');
                agent.close();
                receiver.close();
                done();
            }
        });

        agent.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.message === 'Connected to AI Town Broker') {
                agentId = msg.payload.id;
                agentConnected = true;
                maybeSend();
            }
        });

        function maybeSend() {
            if (receiverReady && agentConnected && agent.readyState === WebSocket.OPEN) {
                // console.log(`[TEST] Sending valid message from ${agentId}`);
                agent.send(JSON.stringify({
                    type: 'publish',
                    topic: 'town_hall',
                    payload: { content: `>>> TO: ${TARGET_TOPIC} Valid Message` }
                }));
            }
        }
    });
});
