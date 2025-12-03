import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

const PORT = 8080;
const LOG_FILE = path.join(__dirname, '../../events.jsonl');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

interface Message {
    type: 'subscribe' | 'publish' | 'system' | 'get_state';
    topic?: string;
    payload?: any;
    sender?: string;
    timestamp?: number;
}

interface Client {
    ws: WebSocket;
    id: string;
    subscriptions: Set<string>;
    isSystem?: boolean; // e.g. Frontend observer
}

const wss = new WebSocketServer({ port: PORT });
const clients = new Map<WebSocket, Client>();

// Town Hall topic is mandatory
const TOWN_HALL_TOPIC = 'town_hall';

console.log(`Broker started on port ${PORT}`);

function logEvent(event: any) {
    const line = JSON.stringify({ ...event, timestamp: Date.now() }) + '\n';
    fs.appendFile(LOG_FILE, line, (err) => {
        if (err) console.error('Failed to log event:', err);
    });
}

wss.on('connection', (ws) => {
    const id = Math.random().toString(36).substring(7);
    const client: Client = {
        ws,
        id,
        subscriptions: new Set([TOWN_HALL_TOPIC]), // Auto-subscribe to Town Hall
    };
    clients.set(ws, client);
    console.log(`Client connected: ${id}`);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'system',
        payload: { message: 'Connected to AI Town Broker', id }
    }));

    ws.on('message', (data) => {
        try {
            const message: Message = JSON.parse(data.toString());
            handleMessage(client, message);
        } catch (e) {
            console.error('Invalid message format:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${id}`);
        clients.delete(ws);
    });
});

function handleMessage(sender: Client, message: Message) {
    // Log every message
    logEvent({ sender: sender.id, ...message });

    switch (message.type) {
        case 'subscribe':
            if (message.topic) {
                // Permission check: Private topics logic could go here
                // For now, we allow all subscriptions, but we could restrict 'private:*'
                sender.subscriptions.add(message.topic);
                console.log(`Client ${sender.id} subscribed to ${message.topic}`);
                sender.ws.send(JSON.stringify({
                    type: 'system',
                    payload: { status: 'subscribed', topic: message.topic }
                }));
            }
            break;

        case 'get_state':
            sender.ws.send(JSON.stringify({
                type: 'system',
                payload: {
                    type: 'state_update',
                    topics: Array.from(new Set([...clients.values()].flatMap(c => Array.from(c.subscriptions)))),
                    agents: Array.from(clients.values()).map(c => ({
                        id: c.id,
                        subscriptions: Array.from(c.subscriptions),
                        isSystem: c.isSystem
                    }))
                }
            }));
            break;

        case 'publish':
            if (message.topic && message.payload) {
                // Permission Check: Town Hall is Admin/System only
                if (message.topic === 'town_hall') {
                    // For this local demo, we trust the message.sender if it claims to be 'admin'
                    const isAdmin = sender.id === 'admin' || message.sender === 'admin';

                    if (!isAdmin) {
                        console.warn(`Client ${sender.id} tried to publish to town_hall without permission.`);
                        return;
                    }
                }

                // Check if topic is private
                const isPrivate = message.topic.startsWith('private:');

                // Broadcast to subscribers
                clients.forEach((client) => {
                    const hasSubscription = client.subscriptions.has(message.topic!) || client.subscriptions.has('*');
                    if (hasSubscription || client.isSystem) {
                        // If private, only allow if explicitly subscribed (already checked) 
                        // or if it's the sender (echo) or system
                        // For this simple implementation, subscription implies permission

                        // Don't echo back to sender unless they want it (optional)
                        if (client.ws !== sender.ws) {
                            if (client.ws.readyState === WebSocket.OPEN) {
                                client.ws.send(JSON.stringify({
                                    type: 'message',
                                    topic: message.topic,
                                    payload: message.payload,
                                    sender: sender.id,
                                    timestamp: Date.now()
                                }));
                            }
                        }
                    }
                });
            }
            break;

        default:
            console.warn('Unknown message type:', message.type);
    }
}
