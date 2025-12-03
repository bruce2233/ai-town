import { Agent } from '../src/Agent';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');
// Mock OpenAI
jest.mock('openai', () => {
    return {
        __esModule: true,
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
                    })
                }
            }
        }))
    };
});

describe('Agent', () => {
    let agent: Agent;

    beforeEach(() => {
        // Clear mocks
        (WebSocket as unknown as jest.Mock).mockClear();
        agent = new Agent('TestAgent', 'TestPersona');
    });

    test('should initialize with correct name and persona', () => {
        expect(agent).toBeDefined();
        // We can't access private fields easily, but we can check behavior
    });

    test('should connect to broker', async () => {
        const connectPromise = agent.connect();

        // Simulate WebSocket open
        const mockWsInstance = (WebSocket as unknown as jest.Mock).mock.instances[0];
        const openCallback = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')[1];
        openCallback();

        await connectPromise;
        expect(WebSocket).toHaveBeenCalled();
    });

    // More complex tests for run() loop would require deeper mocking of OpenAI responses
});
