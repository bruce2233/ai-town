import { Broker } from '../src/Broker';
import WebSocket from 'ws';

describe('Broker', () => {
    let broker: Broker;
    const PORT = 8081; // Use different port for testing

    beforeAll(() => {
        // Suppress logs during tests
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        broker = new Broker(PORT);
        broker.start();
    });

    afterAll(async () => {
        await broker.stop();
        // Wait a bit for all sockets to fully close events
        await new Promise(resolve => setTimeout(resolve, 500));
        jest.restoreAllMocks();
    });

    test('should allow client connection', (done) => {
        const ws = new WebSocket(`ws://localhost:${PORT}`);
        ws.on('open', () => {
            ws.close();
            done();
        });
    });

    test('should auto-subscribe to town_hall', (done) => {
        const ws = new WebSocket(`ws://localhost:${PORT}`);
        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.message === 'Connected to AI Town Broker') {
                // Initial connection message
            }
        });

        // We can't easily check internal state without exposing it or sending a get_state
        // Let's send get_state
        ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'get_state' }));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.type === 'state_update') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const myAgent = msg.payload.agents.find((a: any) => a.subscriptions.includes('town_hall'));
                if (myAgent) {
                    ws.close();
                    done();
                }
            }
        });
    });

    test('should block unauthorized publish to town_hall', (done) => {
        const ws = new WebSocket(`ws://localhost:${PORT}`);
        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'publish',
                topic: 'town_hall',
                payload: { content: 'Hack' },
                sender: 'hacker'
            }));

            // Give it a moment to process (or fail silently as per current impl)
            // Ideally we should receive an error or nothing. 
            // Since we don't have a way to verify "nothing happened" easily in async test without timeout,
            // we will assume success if we don't crash. 
            // Better: Connect a second client (admin) and ensure it DOES NOT receive the message.

            const admin = new WebSocket(`ws://localhost:${PORT}`);
            admin.on('open', () => {
                admin.send(JSON.stringify({ type: 'subscribe', topic: 'town_hall' }));

                let received = false;
                admin.on('message', (data) => {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'message' && msg.payload.content === 'Hack') {
                        received = true;
                    }
                });

                setTimeout(() => {
                    expect(received).toBe(false);
                    ws.close();
                    admin.close();
                    done();
                }, 500);
            });
        });
    });

    test('should support wildcard (*) subscription', (done) => {
        const subscriber = new WebSocket(`ws://localhost:${PORT}`);
        const publisher = new WebSocket(`ws://localhost:${PORT}`);

        // Use a random topic to avoid collision
        const TOPIC = 'wildcard_test_topic_' + Math.random().toString(36).substring(7);

        let subReady = false;
        let pubReady = false;

        const checkStart = () => {
            if (subReady && pubReady) {
                publisher.send(JSON.stringify({
                    type: 'publish',
                    topic: TOPIC,
                    payload: { content: 'Wildcard Test' }
                }));
            }
        };

        subscriber.on('open', () => {
            subscriber.send(JSON.stringify({ type: 'subscribe', topic: '*' }));
        });

        subscriber.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            // Confirm subscription success
            if (msg.type === 'system' && msg.payload.status === 'subscribed' && msg.payload.topic === '*') {
                subReady = true;
                checkStart();
            }
            // Confirm received message
            if (msg.type === 'message' && msg.payload.content === 'Wildcard Test') {
                subscriber.close();
                publisher.close();
                done();
            }
        });

        publisher.on('open', () => {
            publisher.send(JSON.stringify({
                type: 'create_topic',
                payload: { name: TOPIC, type: 'public' }
            }));
        });

        publisher.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.status === 'topic_created') {
                pubReady = true;
                checkStart();
            }
        });
    });

    test('should emit event internally on publish', (done) => {
        const client = new WebSocket(`ws://localhost:${PORT}`);
        const TOPIC = 'event_test_topic_' + Math.random().toString(36).substring(7);

        // Hook into internal event emitter
        broker.once('message', (msg) => {
            if (msg.payload && msg.payload.content === 'Event Test') {
                client.close();
                done();
            }
        });

        client.on('open', () => {
            client.send(JSON.stringify({
                type: 'create_topic',
                payload: { name: TOPIC, type: 'public' }
            }));
        });

        client.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.status === 'topic_created') {
                client.send(JSON.stringify({
                    type: 'publish',
                    topic: TOPIC,
                    payload: { content: 'Event Test' }
                }));
            }
        });
    });

    test('should allow internalPublish to reach subscribers', (done) => {
        const client = new WebSocket(`ws://localhost:${PORT}`);
        const TOPIC = 'internal_test_topic_' + Math.random().toString(36).substring(7);

        client.on('open', () => {
            // Create topic first
            client.send(JSON.stringify({
                type: 'create_topic',
                payload: { name: TOPIC, type: 'public' }
            }));
        });

        client.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.status === 'topic_created') {
                client.send(JSON.stringify({ type: 'subscribe', topic: TOPIC }));
            }
            if (msg.type === 'system' && msg.payload.status === 'subscribed') {
                // Trigger internal publish
                broker.internalPublish(TOPIC, 'Internal Hello', 'system_service');
            }
            if (msg.type === 'message' && msg.payload.content === 'Internal Hello') {
                client.close();
                done();
            }
        });
    });
});
