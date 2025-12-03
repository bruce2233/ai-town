import { describe, it, expect, vi } from 'vitest';
import { Agent } from './index';
import fs from 'fs/promises';

vi.mock('fs/promises');

describe('Agent', () => {
  it('should create a new agent and register a tool', () => {
    const agent = new Agent('Test Agent', 'A test persona');
    expect(agent).toBeDefined();
  });

  describe('create_agent tool', () => {
    it('should append a new agent to the agents.jsonl file', async () => {
      const agent = new Agent('Creator', 'The town founder.');
      const createAgentTool = {
        name: 'create_agent',
        description: 'Create a new resident in the town.',
        parameters: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                persona: { type: 'string' }
            },
            required: ['name', 'persona']
        },
        execute: async ({ name, persona }) => {
            const agentConfig = JSON.stringify({ name, persona }) + '\n';
            await fs.appendFile('agents.jsonl', agentConfig);
            return `Successfully created agent ${name}.`;
        }
      };
      agent.registerTool(createAgentTool);

      const tool = agent.tools.get('create_agent');
      expect(tool).toBeDefined();

      const newAgentName = 'Charlie';
      const newAgentPersona = 'A new agent.';
      await tool.execute({ name: newAgentName, persona: newAgentPersona });

      expect(fs.appendFile).toHaveBeenCalledWith('agents.jsonl', JSON.stringify({ name: newAgentName, persona: newAgentPersona }) + '\n');
    });
  });
});
