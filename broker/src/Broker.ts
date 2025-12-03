import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(__dirname, '../../events.jsonl');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

export interface Message {
    type: 'subscribe' | 'publish' | 'system' | 'get_state';
    topic?: string;
    payload?: any;
    sender?: string;
    timestamp?: number;
}

export interface Client {
    ws: WebSocket;
    id: string;
    subscriptions: Set<string>;
    isSystem?: boolean; // e.g. Frontend observer
}

export class Broker {
    private wss: WebSocketServer | null = null;
    private clients = new Map<WebSocket, Client>();
    private port: number;

    constructor(port: number = 8080) {
        this.port = port;
    }

    public start() {
        this.wss = new WebSocketServer({ port: this.port });
        console.log(`Broker started on port ${this.port}`);

        this.wss.on('connection', (ws) => this.handleConnection(ws));
    }

    public stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.wss) {
                this.wss.close((err) => {
                    if (err) reject(err);
                    else {
                        this.wss = null;
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    private logEvent(event: any) {
        const line = JSON.stringify({ ...event, timestamp: Date.now() }) + '\n';
        fs.appendFile(LOG_FILE, line, (err) => {
            if (err) console.error('Failed to log event:', err);
        });
    }

    private handleConnection(ws: WebSocket) {
        const id = Math.random().toString(36).substring(7);
        const client: Client = {
            ws,
            id,
            subscriptions: new Set(['town_hall']), // Auto-subscribe to Town Hall
        };
        this.clients.set(ws, client);
        console.log(`Client connected: ${id}`);

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'system',
            payload: { message: 'Connected to AI Town Broker', id }
        }));

        ws.on('message', (data) => {
            try {
                const message: Message = JSON.parse(data.toString());
                this.handleMessage(client, message);
            } catch (e) {
                console.error('Invalid message format:', e);
            }
        });

        ws.on('close', () => {
            console.log(`Client disconnected: ${id}`);
            this.clients.delete(ws);
        });
    }

    private handleMessage(sender: Client, message: Message) {
        // Log every message
        this.logEvent({ sender: sender.id, ...message });

        switch (message.type) {
            case 'subscribe':
                if (message.topic) {
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
                        topics: Array.from(new Set([...this.clients.values()].flatMap(c => Array.from(c.subscriptions)))),
                        agents: Array.from(this.clients.values()).map(c => ({
                            id: c.id,
                            subscriptions: Array.from(c.subscriptions),
                            isSystem: c.isSystem
                        }))
                    }
                }));
                break;

            case 'publish':
                if (message.topic && message.payload) {
                    // Permission Check: Town Hall and Create Character are Admin/System only
                    if (message.topic === 'town_hall' || message.topic === 'town:create_character') {
                        // For this local demo, we trust the message.sender if it claims to be 'admin'
                        const isAdmin = sender.id === 'admin' || message.sender === 'admin';

                        if (!isAdmin) {
                            console.warn(`Client ${sender.id} tried to publish to ${message.topic} without permission.`);
                            return;
                        }
                    }

                    // Broadcast to subscribers
                    this.clients.forEach((client) => {
                        const hasSubscription = client.subscriptions.has(message.topic!) || client.subscriptions.has('*');
                        if (hasSubscription || client.isSystem) {
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
}
