
import { AgentRegistry } from './registry.js';
import { AgentRuntime } from './runtime.js';
import { globalRouter } from './town/router.js';

async function main() {
    console.log('--- AI Town (Serverless Actor Model) Starting ---');

    const registry = new AgentRegistry();
    const agents = registry.getAgents();

    console.log(`Booting ${agents.length} agents...`);

    for (const config of agents) {
        const runtime = new AgentRuntime(config);
        runtime.start();
    }

    // Keep alive and log traffic
    globalRouter.asObservable().subscribe(evt => {
        console.log(`[Town] ${evt.sender || '?'} -> ${evt.topic}:`, evt.type);
    });

    console.log('--- Town is Live. Press Ctrl+C to stop ---');

    // Prevent process exit
    setInterval(() => { }, 10000);
}

main().catch(console.error);
