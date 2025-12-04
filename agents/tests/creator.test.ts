import { jest } from '@jest/globals';

// Dynamically import the actual Agent class for instantiation
const { Agent: ActualAgent } = await import('../src/Agent.js');

// Mock the Agent module
jest.mock('../src/Agent.js', () => ({
    Agent: jest.fn().mockImplementation((name, persona) => ({
        name,
        persona,
        connect: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn(),
        run: jest.fn(),
    })),
}));

const AgentMock = (await import('../src/Agent.js')).Agent as jest.Mock;


describe('Creator Agent Logic', () => {

    beforeEach(() => {
        // Clear mock history before each test
        AgentMock.mockClear();
    });

    it('should create a new agent when receiving a valid JSON message', async () => {
        const creator = new ActualAgent('Creator', 'persona');

        const newAgentName = 'Zoe';
        const newAgentPersona = 'A cheerful artist';
        const msg = {
            topic: 'town:reify_character',
            payload: {
                content: JSON.stringify({ name: newAgentName, persona: newAgentPersona }),
            },
            sender: 'Geppetto',
        };

        await creator.run(msg);

        expect(AgentMock).toHaveBeenCalledTimes(1);
        expect(AgentMock).toHaveBeenCalledWith(newAgentName, newAgentPersona);
    });

    it('should handle invalid JSON gracefully and not create a new agent', async () => {
        const creator = new ActualAgent('Creator', 'persona');
        const msg = {
            topic: 'town:reify_character',
            payload: {
                content: 'This is not valid JSON',
            },
            sender: 'Geppetto',
        };

        await creator.run(msg);

        expect(AgentMock).toHaveBeenCalledTimes(0);
    });
});
