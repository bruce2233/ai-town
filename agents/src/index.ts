
import { AgentRegistry } from './registry.js';
import { AgentRuntime } from './runtime.js';

async function main() {
    const registry = new AgentRegistry();
    const agents = registry.getAgents();

    console.log(`Starting ${agents.length} agents...`);

    for (const config of agents) {
        const runtime = new AgentRuntime(config);
        runtime.start();
        // Stagger start to avoid stampeding the broker
        await new Promise(r => setTimeout(r, 500));
    }
}

main().catch(console.error);
