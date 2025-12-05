import WebSocket, { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { TopicManager, TopicType } from './TopicManager';
import { SubscriptionManager, Subscriber } from './SubscriptionManager';

const LOG_FILE = path.join(__dirname, '../../events.jsonl');

// Ensure log file exists
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

export interface Message {
    type: 'subscribe' | 'publish' | 'system' | 'get_state' | 'create_topic' | 'add_permission' | 'identify' | 'get_history';
    topic?: string;
    payload?: any;
    sender?: string;
    timestamp?: number;
}

export class Broker {
    private wss: WebSocketServer | null = null;
    private port: number;
    private topicManager: TopicManager;
    private subscriptionManager: SubscriptionManager;

    // Map ws to subscriber identity
    private clients = new Map<WebSocket, Subscriber>();

    constructor(port: number = 8080) {
        this.port = port;
        this.topicManager = new TopicManager();
        this.subscriptionManager = new SubscriptionManager();
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
        const subscriber: Subscriber = { id, ws };

        this.clients.set(ws, subscriber);
        console.log(`Client connected: ${id}`);

        // Default subscriptions
        this.subscriptionManager.subscribe('town_hall', subscriber);

        // Send welcome message
        ws.send(JSON.stringify({
            type: 'system',
            payload: { message: 'Connected to AI Town Broker', id }
        }));

        ws.on('message', (data) => {
            try {
                const message: Message = JSON.parse(data.toString());
                this.handleMessage(subscriber, message);
            } catch (e) {
                console.error('Invalid message format:', e);
            }
        });

        ws.on('close', () => {
            console.log(`Client disconnected: ${id}`);
            this.subscriptionManager.unsubscribeAll(id);
            this.clients.delete(ws);
        });
    }

    private handleMessage(sender: Subscriber, message: Message) {
        this.logEvent({ sender: sender.id, ...message });

        // Use current sender ID
        message.sender = sender.id;

        switch (message.type) {
            case 'identify':
                if (message.payload && message.payload.id) {
                    if (message.payload.id === 'admin') {
                        // Simple auth check
                        if (message.payload.key === 'admin_secret') {
                            const oldId = sender.id;
                            sender.id = 'admin';
                            // sender.isSystem = true; // Subscriber interface doesn't have isSystem yet, but we can treat 'admin' specially or add it to interface.
                            // For now, rely on ID checks in TopicManager (which checks for 'admin')

                            this.subscriptionManager.updateSubscriberId(oldId, sender.id);
                            console.log(`Client identified as ADMIN`);
                            sender.ws.send(JSON.stringify({ type: 'system', payload: { status: 'identified', id: 'admin' } }));
                        } else {
                            sender.ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid admin key' } }));
                        }
                    } else {
                        const oldId = sender.id;
                        sender.id = message.payload.id;
                        this.subscriptionManager.updateSubscriberId(oldId, sender.id);
                        console.log(`Client ${oldId} renamed to ${sender.id}`);
                        sender.ws.send(JSON.stringify({ type: 'system', payload: { status: 'identified', id: sender.id } }));
                    }
                }
                break;

            case 'create_topic':
                if (message.payload && message.payload.name) {
                    const { name, type = TopicType.PUBLIC, description } = message.payload;
                    this.topicManager.createTopic(name, type, sender.id, description);

                    sender.ws.send(JSON.stringify({
                        type: 'system',
                        payload: { status: 'topic_created', name }
                    }));
                }
                break;

            case 'add_permission':
                if (message.payload && message.payload.topic && message.payload.user) {
                    const success = this.topicManager.addSubscriberPermission(message.payload.topic, sender.id, message.payload.user);
                    sender.ws.send(JSON.stringify({
                        type: 'system',
                        payload: { status: success ? 'permission_added' : 'permission_denied' }
                    }));
                }
                break;

            case 'subscribe':
                if (message.topic) {
                    if (this.topicManager.canSubscribe(message.topic, sender.id)) {
                        this.subscriptionManager.subscribe(message.topic, sender);
                        console.log(`Client ${sender.id} subscribed to ${message.topic}`);
                        sender.ws.send(JSON.stringify({
                            type: 'system',
                            payload: { status: 'subscribed', topic: message.topic }
                        }));
                    } else {
                        sender.ws.send(JSON.stringify({
                            type: 'system',
                            payload: { status: 'error', message: 'Permission denied for topic ' + message.topic }
                        }));
                    }
                }
                break;

            case 'get_history':
                try {
                    const data = fs.readFileSync(LOG_FILE, 'utf-8');
                    const lines = data.trim().split('\n');
                    const events = lines.slice(-100).map(line => {
                        try { return JSON.parse(line); } catch (e) { return null; }
                    }).filter(e => e !== null);

                    sender.ws.send(JSON.stringify({
                        type: 'system',
                        payload: { type: 'history_replay', events }
                    }));
                } catch (e) {
                    console.error('Failed to read history:', e);
                }
                break;

            case 'get_state':
                sender.ws.send(JSON.stringify({
                    type: 'system',
                    payload: {
                        type: 'state_update',
                        topics: this.topicManager.getAllTopics(),
                        agents: Array.from(this.clients.values()).map(c => ({
                            id: c.id,
                            subscriptions: this.subscriptionManager.getTopicsForSubscriber(c.id)
                        }))
                    }
                }));
                break;

            case 'publish':
                if (message.topic && message.payload) {
                    if (this.topicManager.canPublish(message.topic, sender.id)) {
                        const subscribers = this.subscriptionManager.getSubscribers(message.topic);
                        subscribers.forEach(sub => {
                            if (sub.ws.readyState === WebSocket.OPEN) {
                                sub.ws.send(JSON.stringify({
                                    type: 'message',
                                    topic: message.topic,
                                    payload: message.payload,
                                    sender: sender.id,
                                    timestamp: Date.now()
                                }));
                            }
                        });
                    } else {
                        console.warn(`Client ${sender.id} tried to publish to ${message.topic} without permission.`);
                        sender.ws.send(JSON.stringify({
                            type: 'error',
                            payload: { message: `Permission denied to publish to ${message.topic}` }
                        }));
                    }
                }
                break;

            default:
                console.warn('Unknown message type:', message.type);
        }
    }
}
