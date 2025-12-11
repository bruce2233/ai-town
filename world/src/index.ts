import { WebSocketServer } from 'ws';
import { AgentRegistry } from './registry.js';
import { AgentRuntime } from './runtime.js';
import { globalRouter } from './town/router.js';

// Port for UI/Tests to connect
const PORT = parseInt(process.env.PORT || '8080', 10);

async function main() {
    console.log('--- AI Town (Serverless Actor Model) Starting ---');

    const registry = new AgentRegistry();
    const agents = registry.getAgents();

    console.log(`Booting ${agents.length} agents...`);

    for (const config of agents) {
        const runtime = new AgentRuntime(config);
        runtime.start();
    }

    // --- WebSocket Server (Output Adapter) ---
    const wss = new WebSocketServer({ port: PORT });
    console.log(`WebSocket Server listening on port ${PORT}`);

    wss.on('connection', (ws) => {
        console.log('New client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                // Handle basic protocol to keep client happy
                // For now, we just acknowledge or ignore.
                // In serverless, everyone subscribes to everything essentially for monitoring.
                if (data.type === 'identify') {
                    // console.log('Client identified:', data.payload.id);
                }
                if (data.type === 'publish') {
                    // Inject into Router if admin sends message
                    globalRouter.publish({
                        type: 'message',
                        topic: data.topic || 'town_hall',
                        sender: data.sender || 'Admin',
                        payload: data.payload || {}
                    });
                }
            } catch (e) {
                // ignore
            }
        });
    });

    // Forward Router events to all clients
    globalRouter.asObservable().subscribe(evt => {
        const msg = JSON.stringify(evt);
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN
                client.send(msg);
            }
        });
        console.log(`[Town] ${evt.sender || '?'} -> ${evt.topic}:`, evt.type);
    });

    console.log('--- Town is Live. Press Ctrl+C to stop ---');

    // Prevent process exit
    setInterval(() => { }, 10000);
}

main().catch(console.error);
