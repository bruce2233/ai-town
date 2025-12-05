"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Broker_1 = require("../src/Broker");
const ws_1 = __importDefault(require("ws"));
describe('Broker', () => {
    let broker;
    const PORT = 8081; // Use different port for testing
    beforeAll(() => {
        // Suppress logs during tests
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
        broker = new Broker_1.Broker(PORT);
        broker.start();
    });
    afterAll(async () => {
        await broker.stop();
        // Wait a bit for all sockets to fully close events
        await new Promise(resolve => setTimeout(resolve, 500));
        jest.restoreAllMocks();
    });
    test('should allow client connection', (done) => {
        const ws = new ws_1.default(`ws://localhost:${PORT}`);
        ws.on('open', () => {
            ws.close();
            done();
        });
    });
    test('should auto-subscribe to town_hall', (done) => {
        const ws = new ws_1.default(`ws://localhost:${PORT}`);
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
                const myAgent = msg.payload.agents.find((a) => a.subscriptions.includes('town_hall'));
                if (myAgent) {
                    ws.close();
                    done();
                }
            }
        });
    });
    test('should block unauthorized publish to town_hall', (done) => {
        const ws = new ws_1.default(`ws://localhost:${PORT}`);
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
            const admin = new ws_1.default(`ws://localhost:${PORT}`);
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
});
