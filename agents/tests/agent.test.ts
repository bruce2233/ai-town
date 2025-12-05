import { jest } from '@jest/globals';

// Mock WebSocket
jest.unstable_mockModule('ws', () => {
    return {
        default: jest.fn().mockImplementation(() => ({
            on: jest.fn(),
            send: jest.fn(),
            readyState: 1, // WebSocket.OPEN
            close: jest.fn(),
        })),
        WebSocket: jest.fn(),
    };
});

// Mock OpenAI
jest.unstable_mockModule('openai', () => {
    return {
        default: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: jest.fn().mockResolvedValue({
                        choices: [{
                            message: {
                                content: 'Mock response',
                                tool_calls: []
                            }
                        }]
                    } as any)
                }
            }
        }))
    };
});

// Dynamic imports are needed after mockModule
const WebSocket = (await import('ws')).default;
const { Agent } = await import('../src/Agent.js'); // Note the .js extension for ESM imports if needed, or rely on resolution

describe('Agent', () => {
    let agent: any; // Type as any to avoid strict type issues with mocks in test

    beforeEach(() => {
        // Clear mocks
        (WebSocket as unknown as jest.Mock).mockClear();
        agent = new Agent('TestAgent', 'TestPersona');
    });

    test('should initialize with correct name and persona', () => {
        expect(agent).toBeDefined();
    });

    test('should connect to broker', async () => {
        const connectPromise = agent.connect();

        // Simulate WebSocket open
        // When a mock implementation returns an object, we must get it from results, not instances
        const mockWsInstance = (WebSocket as unknown as jest.Mock).mock.results[0].value as any;
        // We need to wait a tick for the constructor to be called and instance registered
        expect(mockWsInstance).toBeDefined();

        const openCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')[1];
        openCallback();

        await connectPromise;
        expect(WebSocket).toHaveBeenCalled();
    });
});
